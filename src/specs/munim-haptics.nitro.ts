import type { HybridObject } from 'react-native-nitro-modules'

// ─── Patterns ──────────────────────────────────────────────────────────────

/**
 * A single tap (`transient`), a held vibration (`continuous`), or (iOS only)
 * a sound the haptic engine plays in sync: a built-in tone
 * (`audioContinuous`) or your own audio file (`audioCustom`).
 */
export type HapticEventType =
  | 'transient'
  | 'continuous'
  | 'audioContinuous'
  | 'audioCustom'

/**
 * The dynamic parameter a curve (or `sendParameters`) drives.
 *
 * - `intensity`: multiplier (0..1) on haptic intensity.
 * - `sharpness`: offset (-1..1) added to haptic sharpness (iOS only).
 * - `attackTime` / `decayTime` / `releaseTime`: offsets (-1..1) to the
 *   envelope of haptic events (iOS only).
 * - `audioVolume` (0..1 multiplier), `audioPan` (-1..1), `audioPitch`
 *   (-1..1), `audioBrightness` (-1..1): audio events (iOS only).
 */
export type HapticCurveParameter =
  | 'intensity'
  | 'sharpness'
  | 'attackTime'
  | 'decayTime'
  | 'releaseTime'
  | 'audioVolume'
  | 'audioPan'
  | 'audioPitch'
  | 'audioBrightness'

/**
 * One event, as it crosses the bridge. The public API in `src/index.ts` uses
 * a discriminated union; it is flattened here (`duration`, `intensity` and
 * `sharpness` are always set, the rest is optional).
 */
export interface NativeHapticEvent {
  type: HapticEventType
  /** Start, in seconds from the start of the pattern. */
  time: number
  /** Length in seconds. 0 for transients (and audioCustom: whole file). */
  duration: number
  /** 0..1 (haptic events; ignored for audio). */
  intensity: number
  /** 0..1 (haptic events; ignored for audio). */
  sharpness: number
  /**
   * 0..1, Core Haptics' relative scale: how long the event takes to reach
   * full strength (longer as it grows). Android: a fade-in over up to half
   * of a continuous event.
   */
  attackTime?: number
  /** 0..1: how fast a non-sustained event fades after its attack (iOS). */
  decayTime?: number
  /**
   * 0..1: how long the event takes to fade out at its end. Android: a
   * fade-out over up to half of a continuous event.
   */
  releaseTime?: number
  /** Whether a continuous event holds its strength for its whole duration (iOS, default true). */
  sustained?: boolean
  /** Audio events: volume 0..1. */
  audioVolume?: number
  /** Audio events: pitch -1..1. */
  audioPitch?: number
  /** Audio events: stereo pan -1 (left)..1 (right). */
  audioPan?: number
  /** Audio events: brightness -1..1. */
  audioBrightness?: number
  /** audioCustom: a file path, `file://` URI or main-bundle resource name. */
  resource?: string
}

export interface HapticCurvePoint {
  /** Seconds, relative to the curve's own `time`. */
  time: number
  value: number
}

export interface HapticCurve {
  parameter: HapticCurveParameter
  /** Start, in seconds from the start of the pattern. */
  time: number
  points: HapticCurvePoint[]
}

export interface NativeHapticPattern {
  events: NativeHapticEvent[]
  curves: HapticCurve[]
}

/** One value for `HapticPlayer.sendParameters`. */
export interface HapticDynamicParameter {
  parameter: HapticCurveParameter
  value: number
}

// ─── Feedback (UIKit generators, mapped on Android) ────────────────────────

export type ImpactStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid'

export type NotificationFeedbackType = 'success' | 'warning' | 'error'

// ─── Android ───────────────────────────────────────────────────────────────

/** `VibrationEffect.EFFECT_*` (API 29+). */
export type AndroidPredefinedEffect =
  | 'click'
  | 'doubleClick'
  | 'tick'
  | 'heavyClick'

/** `VibrationEffect.Composition.PRIMITIVE_*` (API 30+; thud, spin, lowTick: 31+). */
export type AndroidPrimitive =
  | 'click'
  | 'thud'
  | 'spin'
  | 'quickRise'
  | 'slowRise'
  | 'quickFall'
  | 'tick'
  | 'lowTick'

/**
 * How a primitive's `delayMs` is measured (API 36+; older versions always
 * use `pause`): after the previous primitive ends (`pause`), or from the
 * previous primitive's start (`relativeStartOffset`).
 */
export type AndroidPrimitiveDelayType = 'pause' | 'relativeStartOffset'

export interface NativePrimitiveStep {
  primitive: AndroidPrimitive
  /** 0..1 */
  scale: number
  /** Milliseconds. */
  delayMs: number
  delayType: AndroidPrimitiveDelayType
}

/** `HapticFeedbackConstants.*` for `View.performHapticFeedback`. */
export type AndroidHapticFeedback =
  | 'longPress'
  | 'virtualKey'
  | 'keyboardTap'
  | 'clockTick'
  | 'contextClick'
  | 'keyboardPress'
  | 'keyboardRelease'
  | 'virtualKeyRelease'
  | 'textHandleMove'
  | 'gestureStart'
  | 'gestureEnd'
  | 'confirm'
  | 'reject'
  | 'toggleOn'
  | 'toggleOff'
  | 'gestureThresholdActivate'
  | 'gestureThresholdDeactivate'
  | 'dragStart'
  | 'segmentTick'
  | 'segmentFrequentTick'
  | 'noHaptics'

/** `VibrationAttributes.USAGE_*`: tells the system which settings apply. */
export type AndroidVibrationUsage =
  | 'unknown'
  | 'touch'
  | 'notification'
  | 'alarm'
  | 'ringtone'
  | 'media'
  | 'communicationRequest'
  | 'hardwareFeedback'
  | 'physicalEmulation'
  | 'accessibility'

export interface NativeVibrationOptions {
  usage: AndroidVibrationUsage
  /** Vibrator ids (VibratorManager, API 31+). Empty: the default vibrator. */
  vibratorIds: number[]
}

/** `basic`: intensity + sharpness points. `waveform`: amplitude + frequency points. */
export type AndroidEnvelopeKind = 'basic' | 'waveform'

export interface NativeEnvelopePoint {
  /** basic: intensity 0..1. waveform: amplitude 0..1. */
  intensity: number
  /** basic only: 0..1. */
  sharpness: number
  /** waveform only: Hz. */
  frequencyHz: number
  /** Milliseconds to ramp from the previous point to this one. */
  durationMs: number
}

export interface NativeHapticEnvelope {
  kind: AndroidEnvelopeKind
  /** basic: starting sharpness (0..1); waveform: starting frequency (Hz). Negative: the builder's default. */
  initialValue: number
  points: NativeEnvelopePoint[]
}

// ─── Capabilities ──────────────────────────────────────────────────────────

export interface AndroidPrimitiveInfo {
  primitive: AndroidPrimitive
  supported: boolean
  /** Milliseconds; 0 when unknown (API < 31) or unsupported. */
  durationMs: number
}

/**
 * `Vibrator.areEffectsSupported`. (Not 'yes' / 'no': those become C++
 * enumerators YES / NO, which clash with Objective-C's macros.)
 */
export type AndroidEffectSupport = 'supported' | 'unsupported' | 'unknown'

export interface AndroidEffectInfo {
  effect: AndroidPredefinedEffect
  support: AndroidEffectSupport
}

export interface HapticCapabilities {
  /** 'ios' or 'android'. */
  platform: string
  /** iOS version, or Android release. */
  osVersion: string
  /** Android `Build.VERSION.SDK_INT`; 0 on iOS. */
  apiLevel: number

  /** iOS: Core Haptics. Android: a vibrator. */
  supportsHaptics: boolean
  /** iOS: Core Haptics audio. Android: false. */
  supportsAudio: boolean
  /** Rich `playPattern` (iOS: Core Haptics; Android: amplitude control). */
  supportsPatterns: boolean

  /** Android: Vibrator.hasVibrator(). iOS: same as supportsHaptics. */
  hasVibrator: boolean
  /** Android: Vibrator.hasAmplitudeControl(). iOS: same as supportsHaptics. */
  hasAmplitudeControl: boolean
  /** Android 16+: the vibrator has a frequency profile. */
  hasFrequencyControl: boolean

  /** Android 30+: at least one composition primitive is supported. */
  supportsPrimitives: boolean
  primitives: AndroidPrimitiveInfo[]
  /** Android 29+ predefined effects (support is 'unknown' before API 30). */
  effects: AndroidEffectInfo[]

  /** Android 16+: BasicEnvelopeBuilder / WaveformEnvelopeBuilder play natively. */
  supportsEnvelopeEffects: boolean
  envelopeMaxControlPoints?: number
  envelopeMaxDurationMs?: number
  envelopeMinControlPointDurationMs?: number
  envelopeMaxControlPointDurationMs?: number

  /** Android 14+: Hz, when the vibrator reports it. */
  resonantFrequency?: number
  /** Android 14+, when the vibrator reports it. */
  qFactor?: number
  /** Android 16+ frequency profile. */
  minFrequencyHz?: number
  maxFrequencyHz?: number
  maxOutputAccelerationGs?: number

  /** Android 12+: VibratorManager ids. Empty elsewhere. */
  vibratorIds: number[]
  /** Android: the system "Touch feedback" setting. Unknown (undefined) on iOS. */
  hapticFeedbackEnabled?: boolean
}

// ─── Engine (iOS Core Haptics) ─────────────────────────────────────────────

export interface HapticEngineOptions {
  /** Default true. Must be false for audio events (restarts the engine). */
  playsHapticsOnly?: boolean
  /** iOS 16+. Default false. */
  playsAudioOnly?: boolean
  isMutedForHaptics?: boolean
  isMutedForAudio?: boolean
  /** Let the system stop the idle engine (default false: stays warm). */
  autoShutdown?: boolean
}

export interface HapticEngineState {
  isRunning: boolean
  playsHapticsOnly: boolean
  playsAudioOnly: boolean
  isMutedForHaptics: boolean
  isMutedForAudio: boolean
  autoShutdown: boolean
}

export type HapticEngineEventType = 'stopped' | 'reset'

export type HapticEngineStopReason =
  | 'audioSessionInterrupt'
  | 'applicationSuspended'
  | 'idleTimeout'
  | 'notifyWhenFinished'
  | 'engineDestroyed'
  | 'gameControllerDisconnect'
  | 'systemError'
  | 'unknown'
  | 'none'

export interface HapticEngineEvent {
  type: HapticEngineEventType
  /** 'none' for resets. */
  reason: HapticEngineStopReason
}

export interface HapticPlayerCompletion {
  /** Empty when the player finished normally. */
  error: string
}

// ─── Hybrid objects ────────────────────────────────────────────────────────

/**
 * An advanced pattern player. iOS: CHHapticAdvancedPatternPlayer. Android:
 * an emulation on top of waveforms (timing, looping, pause/seek, rate and
 * intensity work; sharpness and audio do not).
 *
 * Every `atTime` is a delay in seconds from now (0: immediately).
 */
export interface HapticPlayer
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /** Pattern length in seconds. */
  readonly duration: number
  loopEnabled: boolean
  /** Seconds; 0 = loop at the end of the pattern. */
  loopEnd: number
  /** 1 = normal speed. */
  playbackRate: number
  isMuted: boolean

  start(atTime: number): Promise<void>
  stop(atTime: number): Promise<void>
  pause(atTime: number): Promise<void>
  resume(atTime: number): Promise<void>
  /** Seconds from the start of the pattern. */
  seek(offset: number): Promise<void>
  /** Stops immediately and drops anything scheduled. */
  cancel(): Promise<void>
  sendParameters(
    parameters: HapticDynamicParameter[],
    atTime: number
  ): Promise<void>
  scheduleParameterCurve(curve: HapticCurve, atTime: number): Promise<void>
  /** Called when the player finishes (not when it loops), or fails. */
  setCompletionListener(
    listener: (completion: HapticPlayerCompletion) => void
  ): void
}

export interface MunimHaptics
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  // ── 0.1.0 ──
  /**
   * iOS: the device supports Core Haptics. Android: it has a vibrator with
   * amplitude control (API 26+).
   */
  isSupported(): boolean

  /** Starts the haptic engine ahead of time so the next pattern plays with no lag. */
  prepare(): Promise<void>

  /** Plays a pattern, replacing any pattern still playing. Resolves once it has started. */
  playPattern(pattern: NativeHapticPattern): Promise<void>

  /** Stops the pattern that is playing, if any. */
  stop(): Promise<void>

  // ── Capabilities ──
  getCapabilities(): HapticCapabilities

  // ── Feedback generators ──
  impact(style: ImpactStyle, intensity: number): Promise<void>
  notification(type: NotificationFeedbackType): Promise<void>
  selection(): Promise<void>
  prepareImpact(style: ImpactStyle): Promise<void>
  prepareNotification(): Promise<void>
  prepareSelection(): Promise<void>

  // ── Core Haptics: AHAP and players ──
  /** iOS: plays an AHAP JSON document. */
  playAHAP(ahap: string): Promise<void>
  /** iOS: plays an AHAP file (path, file:// URI or main-bundle resource name). */
  playAHAPFile(path: string): Promise<void>
  /** Reads a text file (path, file:// URI, Android asset name or iOS bundle resource name). */
  readTextFile(path: string): Promise<string>
  createPlayer(pattern: NativeHapticPattern): HapticPlayer
  /** iOS only (Android parses AHAP in JS and calls createPlayer). */
  createPlayerFromAHAP(ahap: string): HapticPlayer

  // ── Core Haptics engine ──
  startEngine(): Promise<void>
  stopEngine(): Promise<void>
  setEngineOptions(options: HapticEngineOptions): void
  getEngineState(): HapticEngineState
  setEngineListener(listener: (event: HapticEngineEvent) => void): void

  // ── Android vibrator ──
  vibrate(
    durationMs: number,
    amplitude: number,
    options: NativeVibrationOptions
  ): Promise<void>
  playWaveform(
    timingsMs: number[],
    amplitudes: number[],
    repeatIndex: number,
    options: NativeVibrationOptions
  ): Promise<void>
  /** Resolves false when the effect isn't supported and `fallback` is false. */
  playPredefined(
    effect: AndroidPredefinedEffect,
    fallback: boolean,
    options: NativeVibrationOptions
  ): Promise<boolean>
  /** Resolves false when primitives aren't supported and `fallback` is false. */
  playPrimitives(
    steps: NativePrimitiveStep[],
    fallback: boolean,
    options: NativeVibrationOptions
  ): Promise<boolean>
  /** Native on Android 16+; a sampled waveform before that. */
  playEnvelope(
    envelope: NativeHapticEnvelope,
    options: NativeVibrationOptions
  ): Promise<void>
  /** View.performHapticFeedback on the current activity's decor view. */
  performHapticFeedback(
    feedback: AndroidHapticFeedback,
    fallback: boolean
  ): Promise<boolean>
  /** Cancels any vibration (Android) or stops every player (iOS). */
  cancel(): Promise<void>
}
