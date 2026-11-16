import { Platform } from 'react-native'
import { NitroModules } from 'react-native-nitro-modules'
import type {
  CompiledHapticPattern as NativeCompiledPattern,
  HapticPlayer as NativeHapticPlayer,
  MunimHaptics as MunimHapticsSpec,
  NativeVibrationOptions,
} from './specs/munim-haptics.nitro'
import { buildAHAP, parseAHAP } from './ahap'
import type { AHAP } from './ahap'
import {
  envelopeToPattern,
  oneShotToPattern,
  predefinedToFeedback,
  primitivesToPattern,
  splitWaveform,
  viewFeedbackToFeedback,
} from './emulation'
import type { FeedbackCall } from './emulation'
import {
  clamp,
  normalizeCurve,
  normalizeEnvelope,
  normalizePattern,
  normalizePrimitives,
  parameterMin,
  patternDuration,
} from './pattern'
import { getPresetPattern, presetNames } from './presets'
import type { HapticPresetName } from './presets'
import type {
  AndroidHapticFeedback,
  AndroidPredefinedEffect,
  CompiledHapticPattern,
  FallbackOptions,
  HapticCapabilities,
  HapticCurve,
  HapticDynamicParameter,
  HapticEngineEvent,
  HapticEngineOptions,
  HapticEngineState,
  HapticEnvelope,
  HapticPattern,
  HapticPlayer,
  HapticPlayerParameters,
  ImpactStyle,
  NotificationFeedbackType,
  PlayPatternOptions,
  PrimitiveStep,
  RealtimeHaptic,
  VibrationOptions,
} from './types'

export * from './types'
export type * from './ahap'
export type { HapticPresetName }
export { buildAHAP, parseAHAP, normalizePattern, getPresetPattern, presetNames }

// ─── Native module ─────────────────────────────────────────────────────────

let native: MunimHapticsSpec | null | undefined

function getNative(): MunimHapticsSpec | null {
  if (native === undefined) {
    try {
      native =
        Platform.OS === 'ios' || Platform.OS === 'android'
          ? NitroModules.createHybridObject<MunimHapticsSpec>('MunimHaptics')
          : null
    } catch {
      // A binary built without this module.
      native = null
    }
  }
  return native
}

const isIOS = Platform.OS === 'ios'

/** Runs `fn` on the native module; resolves `fallback` when there is none. */
async function call<T>(fallback: T, fn: (module: MunimHapticsSpec) => Promise<T>): Promise<T> {
  const module = getNative()
  if (!module) return fallback
  return fn(module)
}

// Hardware answers, asked once: they don't change while the app runs.
let supportedCache: boolean | undefined
let hardwareCache: { hasVibrator: boolean; supportsFeedback: boolean } | undefined

// ─── 0.1.0 API ─────────────────────────────────────────────────────────────

/**
 * Whether rich patterns play on this device: Core Haptics on iOS, a vibrator
 * with amplitude control on Android. When false, `playPattern` does nothing,
 * so fall back to `impact` / `notification` / `selection`.
 */
export function isSupported(): boolean {
  if (supportedCache !== undefined) return supportedCache
  const module = getNative()
  if (!module) return (supportedCache = false)
  try {
    supportedCache = module.isSupported()
  } catch {
    supportedCache = false
  }
  return supportedCache
}

function hardware(): { hasVibrator: boolean; supportsFeedback: boolean } {
  if (!hardwareCache) {
    const { hasVibrator, supportsFeedback } = getCapabilities()
    hardwareCache = { hasVibrator, supportsFeedback }
  }
  return hardwareCache
}

/**
 * Whether a pattern plays: Core Haptics on iOS; on Android amplitude
 * control, or (with `fallback`) any vibrator, as on / off pulses.
 */
function canPlayPatterns(options?: PlayPatternOptions): boolean {
  if (isSupported()) return true
  return !isIOS && options?.fallback === true && hardware().hasVibrator
}

/** Starts the haptic engine ahead of time, so the next pattern plays with no lag. */
export async function prepare(): Promise<void> {
  if (!isSupported()) return
  await getNative()?.prepare()
}

/**
 * Plays a pattern, replacing any pattern still playing. Resolves once it has
 * started (not when it ends). Does nothing when unsupported (see
 * `PlayPatternOptions.fallback` for Android vibrators without amplitude
 * control). To play the same pattern often, `compilePattern` it once.
 */
export async function playPattern(pattern: HapticPattern, options?: PlayPatternOptions): Promise<void> {
  if (!canPlayPatterns(options)) return
  await getNative()?.playPattern(normalizePattern(pattern))
}

// ─── Compiled patterns ─────────────────────────────────────────────────────

class CompiledHandle implements CompiledHapticPattern {
  constructor(private readonly compiled: NativeCompiledPattern) {}
  get duration(): number {
    return this.compiled.duration
  }
  play() {
    return this.compiled.play()
  }
  stop() {
    return this.compiled.stop()
  }
  release() {
    this.compiled.dispose()
  }
}

/** Stands in on web and unsupported devices: nothing plays. */
class NoopCompiled implements CompiledHapticPattern {
  constructor(readonly duration: number) {}
  play() {
    return Promise.resolve()
  }
  stop() {
    return Promise.resolve()
  }
  release() {}
}

/**
 * Converts a pattern into the platform's own form once (iOS: Core Haptics
 * patterns and players; Android: a `VibrationEffect`), so every `play()`
 * skips normalization, the bridge copy of the events and the native
 * conversion. Returns a no-op pattern where patterns can't play.
 */
export function compilePattern(pattern: HapticPattern, options?: PlayPatternOptions): CompiledHapticPattern {
  const module = getNative()
  const normalized = normalizePattern(pattern)
  if (!module || !canPlayPatterns(options) || normalized.events.length === 0) {
    return new NoopCompiled(patternDuration(pattern))
  }
  return new CompiledHandle(module.compilePattern(normalized))
}

/** `compilePattern` for an AHAP document. iOS: native (audio included). Android: the parsed pattern. */
export function compileAHAP(ahap: string | AHAP, options?: PlayPatternOptions): CompiledHapticPattern {
  const module = getNative()
  if (!module || !canPlayPatterns(options)) return new NoopCompiled(0)
  if (isIOS) return new CompiledHandle(module.compileAHAP(ahapText(ahap)))
  return compilePattern(parseAHAP(ahap), options)
}

// ─── Presets ───────────────────────────────────────────────────────────────

const compiledPresets = new Map<HapticPresetName, CompiledHapticPattern>()

function compiledPreset(name: HapticPresetName): CompiledHapticPattern {
  let compiled = compiledPresets.get(name)
  if (!compiled) {
    compiled = compilePattern(getPresetPattern(name), { fallback: true })
    compiledPresets.set(name, compiled)
  }
  return compiled
}

/**
 * Plays a ready-made pattern (see `presetNames`). Each preset is compiled
 * the first time it plays (or in `preloadPresets`) and replayed from the
 * native copy after that. On Android vibrators without amplitude control
 * presets play as on / off pulses. Resolves whether something played
 * (false on devices without haptics, such as iPads).
 */
export async function playPreset(name: HapticPresetName): Promise<boolean> {
  if (!canPlayPatterns({ fallback: true })) return false
  await compiledPreset(name).play()
  return true
}

/** Compiles presets ahead of time (all of them by default) so their first play is as fast as the rest. */
export function preloadPresets(names: HapticPresetName[] = presetNames): void {
  if (!canPlayPatterns({ fallback: true })) return
  for (const name of names) compiledPreset(name)
}

/** Stops the pattern that is playing, if any. */
export async function stop(): Promise<void> {
  await stopEmulatedLoop()
  await call(undefined, (module) => module.stop())
}

// ─── Capabilities ──────────────────────────────────────────────────────────

const NO_CAPABILITIES: HapticCapabilities = {
  platform: Platform.OS,
  osVersion: String(Platform.Version ?? ''),
  apiLevel: 0,
  supportsHaptics: false,
  supportsFeedback: false,
  supportsAudio: false,
  supportsPatterns: false,
  hasVibrator: false,
  hasAmplitudeControl: false,
  hasFrequencyControl: false,
  supportsPrimitives: false,
  primitives: [],
  effects: [],
  supportsEnvelopeEffects: false,
  frequencyResponse: [],
  vibratorIds: [],
}

/** What this device supports. On web (or without the module) everything is false. */
export function getCapabilities(): HapticCapabilities {
  const module = getNative()
  if (!module) return NO_CAPABILITIES
  try {
    return module.getCapabilities()
  } catch {
    return NO_CAPABILITIES
  }
}

// ─── Feedback (UIKit generators; mapped to effects on Android) ─────────────

/**
 * A physical impact. iOS: UIImpactFeedbackGenerator (follows the System
 * Haptics setting). Android: a click / tick primitive at a matching scale,
 * or a predefined effect / short pulse on older devices (usage `touch`, so
 * it follows the touch-feedback setting).
 *
 * @param intensity 0..1; omit for the style's default strength.
 */
export async function impact(style: ImpactStyle = 'medium', intensity?: number): Promise<void> {
  const value = intensity === undefined ? -1 : clamp(intensity, 0, 1)
  await call(undefined, (module) => module.impact(style, value))
}

/** Success / warning / error. iOS: UINotificationFeedbackGenerator. Android: click sequences. */
export async function notification(type: NotificationFeedbackType = 'success'): Promise<void> {
  await call(undefined, (module) => module.notification(type))
}

/** A selection change (a light tick). iOS: UISelectionFeedbackGenerator. */
export async function selection(): Promise<void> {
  await call(undefined, (module) => module.selection())
}

/** iOS: warms the impact generator up for the next `impact(style)`. Android: no-op. */
export async function prepareImpact(style: ImpactStyle = 'medium'): Promise<void> {
  await call(undefined, (module) => module.prepareImpact(style))
}

/** iOS: warms the notification generator up. Android: no-op. */
export async function prepareNotification(): Promise<void> {
  await call(undefined, (module) => module.prepareNotification())
}

/** iOS: warms the selection generator up. Android: no-op. */
export async function prepareSelection(): Promise<void> {
  await call(undefined, (module) => module.prepareSelection())
}

/** iOS stand-ins for Android calls: resolves whether something was felt. */
async function runFeedback(feedback: FeedbackCall): Promise<boolean> {
  // UIKit's generators silently do nothing without a Taptic Engine (iPad).
  if (feedback.kind !== 'none' && feedback.kind !== 'pattern' && !hardware().supportsFeedback) return false
  switch (feedback.kind) {
    case 'impact':
      await impact(feedback.style, feedback.intensity)
      return true
    case 'notification':
      await notification(feedback.type)
      return true
    case 'selection':
      await selection()
      return true
    case 'pattern':
      if (!isSupported()) return false
      await playPattern(feedback.pattern)
      return true
    case 'none':
      return false
  }
}

// ─── AHAP ──────────────────────────────────────────────────────────────────

function ahapText(ahap: string | AHAP): string {
  return typeof ahap === 'string' ? ahap : JSON.stringify(ahap)
}

/**
 * Plays an AHAP document (JSON string or object). iOS: natively, audio
 * included. Android: parsed and played as a pattern (haptics only).
 */
export async function playAHAP(ahap: string | AHAP): Promise<void> {
  if (!isSupported()) return
  if (isIOS) {
    await getNative()?.playAHAP(ahapText(ahap))
  } else {
    await playPattern(parseAHAP(ahap))
  }
}

/**
 * Plays an `.ahap` file: an absolute path, a `file://` URI, or a bundled
 * resource (iOS: main-bundle resource name; Android: asset name or
 * `res/raw` name).
 */
export async function playAHAPFile(path: string): Promise<void> {
  if (!isSupported()) return
  if (isIOS) {
    await getNative()?.playAHAPFile(path)
  } else {
    await playPattern(parseAHAP(await readTextFile(path)))
  }
}

/** Reads a text file the same way `playAHAPFile` finds it. */
export async function readTextFile(path: string): Promise<string> {
  const module = getNative()
  if (!module) throw new Error('munim-haptics: native module unavailable')
  return module.readTextFile(path)
}

// ─── Advanced players ──────────────────────────────────────────────────────

function dynamicParameters(parameters: HapticPlayerParameters): HapticDynamicParameter[] {
  const list = Array.isArray(parameters)
    ? parameters
    : (Object.entries(parameters) as [HapticDynamicParameter['parameter'], number | undefined][])
        .filter((entry): entry is [HapticDynamicParameter['parameter'], number] => entry[1] !== undefined)
        .map(([parameter, value]) => ({ parameter, value }))
  return list.map(({ parameter, value }) => ({
    parameter,
    value: clamp(value, parameterMin(parameter), 1),
  }))
}

function delay(atTime: number | undefined): number {
  return atTime !== undefined && Number.isFinite(atTime) && atTime > 0 ? atTime : 0
}

class PlayerHandle implements HapticPlayer {
  constructor(private readonly player: NativeHapticPlayer) {}

  get duration(): number {
    return this.player.duration
  }
  get loopEnabled(): boolean {
    return this.player.loopEnabled
  }
  set loopEnabled(value: boolean) {
    this.player.loopEnabled = value
  }
  get loopEnd(): number {
    return this.player.loopEnd
  }
  set loopEnd(value: number) {
    this.player.loopEnd = Math.max(0, Number.isFinite(value) ? value : 0)
  }
  get playbackRate(): number {
    return this.player.playbackRate
  }
  set playbackRate(value: number) {
    this.player.playbackRate = Number.isFinite(value) && value > 0 ? value : 1
  }
  get isMuted(): boolean {
    return this.player.isMuted
  }
  set isMuted(value: boolean) {
    this.player.isMuted = value
  }
  start(atTime?: number) {
    return this.player.start(delay(atTime))
  }
  stop(atTime?: number) {
    return this.player.stop(delay(atTime))
  }
  pause(atTime?: number) {
    return this.player.pause(delay(atTime))
  }
  resume(atTime?: number) {
    return this.player.resume(delay(atTime))
  }
  seek(offset: number) {
    return this.player.seek(Math.max(0, Number.isFinite(offset) ? offset : 0))
  }
  cancel() {
    return this.player.cancel()
  }
  sendParameters(parameters: HapticPlayerParameters, atTime?: number) {
    return this.player.sendParameters(dynamicParameters(parameters), delay(atTime))
  }
  scheduleParameterCurve(curve: HapticCurve, atTime?: number) {
    return this.player.scheduleParameterCurve(normalizeCurve(curve), delay(atTime))
  }
  onComplete(listener: (error?: string) => void) {
    this.player.setCompletionListener((completion) => listener(completion.error || undefined))
  }
  release() {
    this.player.dispose()
  }
}

/** Stands in on web and unsupported devices: every call resolves, nothing plays. */
class NoopPlayer implements HapticPlayer {
  loopEnabled = false
  loopEnd = 0
  playbackRate = 1
  isMuted = false
  constructor(readonly duration: number) {}
  start() {
    return Promise.resolve()
  }
  stop() {
    return Promise.resolve()
  }
  pause() {
    return Promise.resolve()
  }
  resume() {
    return Promise.resolve()
  }
  seek() {
    return Promise.resolve()
  }
  cancel() {
    return Promise.resolve()
  }
  sendParameters() {
    return Promise.resolve()
  }
  scheduleParameterCurve() {
    return Promise.resolve()
  }
  onComplete() {}
  release() {}
}

function canCreatePlayers(): boolean {
  if (isIOS) return isSupported()
  return hardware().hasVibrator
}

/**
 * A player for a pattern: start / stop / pause / resume / seek, looping,
 * playback rate, mute, and live intensity / sharpness changes. Returns a
 * no-op player on web and unsupported devices.
 */
export function createPlayer(pattern: HapticPattern): HapticPlayer {
  const module = getNative()
  if (!module || !canCreatePlayers()) return new NoopPlayer(patternDuration(pattern))
  return new PlayerHandle(module.createPlayer(normalizePattern(pattern)))
}

/** A player for an AHAP document. iOS: native (audio included). Android: the parsed pattern. */
export function createPlayerFromAHAP(ahap: string | AHAP): HapticPlayer {
  const module = getNative()
  if (!module || !canCreatePlayers()) return new NoopPlayer(0)
  if (isIOS) return new PlayerHandle(module.createPlayerFromAHAP(ahapText(ahap)))
  return createPlayer(parseAHAP(ahap))
}

/** A player for an `.ahap` file (found like `playAHAPFile`). */
export async function createPlayerFromAHAPFile(path: string): Promise<HapticPlayer> {
  if (!getNative() || !canCreatePlayers()) return new NoopPlayer(0)
  return createPlayerFromAHAP(await readTextFile(path))
}

// ─── Real-time haptics ─────────────────────────────────────────────────────

/** Core Haptics' longest continuous event; the player loops it. */
const REALTIME_SPAN = 30
/** The event's own sharpness; `set` moves it with the sharpness control (an offset). */
const REALTIME_BASE_SHARPNESS = 0.5

class Realtime implements RealtimeHaptic {
  private player: HapticPlayer | null = null

  get isActive(): boolean {
    return this.player !== null
  }

  async start(intensity = 1, sharpness = REALTIME_BASE_SHARPNESS): Promise<void> {
    if (this.player || !canCreatePlayers()) return
    const player = createPlayer({
      events: [
        {
          type: 'continuous',
          time: 0,
          duration: REALTIME_SPAN,
          intensity: 1,
          sharpness: REALTIME_BASE_SHARPNESS,
        },
      ],
    })
    player.loopEnabled = true
    this.player = player
    // Android applies this before the first waveform plays.
    this.set(intensity, sharpness)
    try {
      await player.start()
      // Core Haptics takes dynamic parameters once the player runs.
      if (isIOS) this.set(intensity, sharpness)
    } catch (error) {
      this.player = null
      player.release()
      throw error
    }
  }

  set(intensity: number, sharpness?: number): void {
    const player = this.player
    if (!player) return
    const parameters: HapticDynamicParameter[] = [{ parameter: 'intensity', value: clamp(intensity, 0, 1) }]
    if (isIOS && sharpness !== undefined) {
      parameters.push({ parameter: 'sharpness', value: clamp(sharpness, 0, 1) - REALTIME_BASE_SHARPNESS })
    }
    // Fire and forget: a gesture calls this every frame.
    player.sendParameters(parameters).catch(() => {})
  }

  async stop(): Promise<void> {
    const player = this.player
    this.player = null
    if (!player) return
    try {
      await player.stop()
    } finally {
      player.release()
    }
  }
}

/**
 * A vibration you steer live, e.g. from a pan gesture or a slider:
 * `start()`, then `set(intensity, sharpness)` as often as you like, then
 * `stop()`. iOS: one looping Core Haptics continuous event driven by the
 * intensity and sharpness controls. Android: a looping waveform whose
 * amplitude follows `set` (re-issued at most once per frame; no
 * sharpness). Does nothing on devices without haptics.
 */
export function createRealtimeHaptic(): RealtimeHaptic {
  return new Realtime()
}

// ─── Core Haptics engine (iOS; no-ops elsewhere) ───────────────────────────

/** Starts the shared CHHapticEngine (same as `prepare`). */
export async function startEngine(): Promise<void> {
  if (!isIOS || !isSupported()) return
  await getNative()?.startEngine()
}

/** Stops the shared engine and every pattern on it. It restarts on the next play. */
export async function stopEngine(): Promise<void> {
  await call(undefined, (module) => module.stopEngine())
}

/**
 * Engine settings (iOS). `playsHapticsOnly` (default true) must be false for
 * audio events; changing it or `playsAudioOnly` restarts the engine, which
 * invalidates running patterns (players rebuild themselves on next use).
 * `autoShutdown` (default false) lets the system stop the idle engine.
 */
export function setEngineOptions(options: HapticEngineOptions): void {
  getNative()?.setEngineOptions(options)
}

export function getEngineState(): HapticEngineState {
  const module = getNative()
  if (module) return module.getEngineState()
  return {
    isRunning: false,
    playsHapticsOnly: true,
    playsAudioOnly: false,
    isMutedForHaptics: false,
    isMutedForAudio: false,
    autoShutdown: false,
  }
}

const engineListeners = new Set<(event: HapticEngineEvent) => void>()
let engineListenerInstalled = false

/**
 * Engine `stopped` (with a reason) and `reset` events (iOS). After a reset
 * the library restarts the engine itself; players rebuild on next use.
 */
export function addEngineListener(listener: (event: HapticEngineEvent) => void): { remove: () => void } {
  engineListeners.add(listener)
  const module = getNative()
  if (module && !engineListenerInstalled) {
    engineListenerInstalled = true
    module.setEngineListener((event) => engineListeners.forEach((l) => l(event)))
  }
  return { remove: () => engineListeners.delete(listener) }
}

// ─── Android vibrator (emulated with Core Haptics on iOS) ──────────────────

let defaults: Required<VibrationOptions> = { usage: 'unknown', vibratorIds: [] }

/** Default `usage` / `vibratorIds` for the Android vibrator calls below. */
export function setDefaultVibrationOptions(options: VibrationOptions): void {
  defaults = { ...defaults, ...options }
}

function nativeOptions(options?: VibrationOptions): NativeVibrationOptions {
  return {
    usage: options?.usage ?? defaults.usage,
    vibratorIds: options?.vibratorIds ?? defaults.vibratorIds,
  }
}

/**
 * Vibrates for `durationMs`. Android: `createOneShot` (`amplitude` 1..255;
 * omit for the default). iOS: a continuous Core Haptics event.
 */
export async function vibrate(durationMs: number, amplitude?: number, options?: VibrationOptions): Promise<void> {
  if (isIOS) {
    if (isSupported()) await playPattern(oneShotToPattern(durationMs, amplitude))
    return
  }
  await call(undefined, (module) => module.vibrate(durationMs, amplitude ?? -1, nativeOptions(options)))
}

let emulatedLoop: HapticPlayer | null = null

async function stopEmulatedLoop(): Promise<void> {
  const loop = emulatedLoop
  emulatedLoop = null
  if (loop) await loop.stop()
}

/**
 * Android `createWaveform(timings, amplitudes, repeat)`: `amplitudes` 0..255
 * (-1: default); without amplitudes the timings alternate off / on starting
 * with off. A `repeatIndex` >= 0 repeats from there until `cancel()`.
 * iOS: continuous events (the repeating part loops on a player).
 */
export async function playWaveform(
  timingsMs: number[],
  amplitudes?: number[],
  repeatIndex = -1,
  options?: VibrationOptions
): Promise<void> {
  if (isIOS) {
    if (!isSupported()) return
    await stopEmulatedLoop()
    const { head, headDuration, body } = splitWaveform(timingsMs, amplitudes, repeatIndex)
    await playPattern(head)
    if (body && body.events.length > 0) {
      const player = createPlayer(body)
      player.loopEnabled = true
      // Loop over the whole repeating part, trailing silence included.
      player.loopEnd = timingsMs.slice(repeatIndex).reduce((sum, ms) => sum + Math.max(0, ms), 0) / 1000
      emulatedLoop = player
      await player.start(headDuration)
    }
    return
  }
  await call(undefined, (module) =>
    module.playWaveform(timingsMs, amplitudes ?? [], repeatIndex, nativeOptions(options))
  )
}

/**
 * Android `VibrationEffect.createPredefined` (click, doubleClick, tick,
 * heavyClick; API 29+). Resolves whether something played. iOS: the closest
 * UIKit impact.
 */
export async function playPredefined(effect: AndroidPredefinedEffect, options?: FallbackOptions): Promise<boolean> {
  if (isIOS) return runFeedback(predefinedToFeedback(effect))
  return call(false, (module) => module.playPredefined(effect, options?.fallback ?? true, nativeOptions(options)))
}

/**
 * Android `VibrationEffect.startComposition()` primitives (API 30+; check
 * `getCapabilities().primitives`). Resolves whether something played.
 * iOS: transients and short shaped rumbles.
 */
export async function playPrimitives(steps: PrimitiveStep[], options?: FallbackOptions): Promise<boolean> {
  if (steps.length === 0) return false
  if (isIOS) {
    if (!isSupported()) return false
    await playPattern(primitivesToPattern(steps))
    return true
  }
  return call(false, (module) =>
    module.playPrimitives(normalizePrimitives(steps), options?.fallback ?? true, nativeOptions(options))
  )
}

/**
 * Android 16 envelope effects (`BasicEnvelopeBuilder` /
 * `WaveformEnvelopeBuilder`) where supported; a sampled waveform on older
 * Android. iOS: a continuous event shaped by intensity and sharpness curves.
 */
export async function playEnvelope(envelope: HapticEnvelope, options?: VibrationOptions): Promise<void> {
  if (isIOS) {
    if (isSupported()) await playPattern(envelopeToPattern(envelope))
    return
  }
  await call(undefined, (module) => module.playEnvelope(normalizeEnvelope(envelope), nativeOptions(options)))
}

/**
 * Android `View.performHapticFeedback` on the current activity (follows the
 * touch-feedback setting). Constants newer than the device fall back to the
 * nearest older one unless `fallback` is false. Resolves whether it played.
 * iOS: the closest UIKit feedback.
 */
export async function performHapticFeedback(
  feedback: AndroidHapticFeedback,
  options?: { fallback?: boolean }
): Promise<boolean> {
  if (isIOS) return runFeedback(viewFeedbackToFeedback(feedback))
  return call(false, (module) => module.performHapticFeedback(feedback, options?.fallback ?? true))
}

/** Stops every vibration (Android) / pattern (iOS), including repeating waveforms. */
export async function cancel(): Promise<void> {
  await stopEmulatedLoop()
  await call(undefined, (module) => module.cancel())
}

export default {
  isSupported,
  prepare,
  playPattern,
  stop,
  normalizePattern,
  compilePattern,
  compileAHAP,
  playPreset,
  preloadPresets,
  presetNames,
  getPresetPattern,
  createRealtimeHaptic,
  getCapabilities,
  impact,
  notification,
  selection,
  prepareImpact,
  prepareNotification,
  prepareSelection,
  playAHAP,
  playAHAPFile,
  readTextFile,
  buildAHAP,
  parseAHAP,
  createPlayer,
  createPlayerFromAHAP,
  createPlayerFromAHAPFile,
  startEngine,
  stopEngine,
  setEngineOptions,
  getEngineState,
  addEngineListener,
  setDefaultVibrationOptions,
  vibrate,
  playWaveform,
  playPredefined,
  playPrimitives,
  playEnvelope,
  performHapticFeedback,
  cancel,
}
