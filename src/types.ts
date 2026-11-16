import type {
  AndroidEffectInfo,
  AndroidEffectSupport,
  AndroidHapticFeedback,
  AndroidPredefinedEffect,
  AndroidPrimitive,
  AndroidPrimitiveDelayType,
  AndroidPrimitiveInfo,
  AndroidVibrationUsage,
  FrequencyResponsePoint,
  HapticCapabilities,
  HapticCurveParameter,
  HapticCurvePoint,
  HapticDynamicParameter,
  HapticEngineEvent,
  HapticEngineEventType,
  HapticEngineOptions,
  HapticEngineState,
  HapticEngineStopReason,
  ImpactStyle,
  NotificationFeedbackType,
} from './specs/munim-haptics.nitro'

export type {
  AndroidEffectInfo,
  AndroidEffectSupport,
  AndroidHapticFeedback,
  AndroidPredefinedEffect,
  AndroidPrimitive,
  AndroidPrimitiveDelayType,
  AndroidPrimitiveInfo,
  AndroidVibrationUsage,
  FrequencyResponsePoint,
  HapticCapabilities,
  HapticCurveParameter,
  HapticCurvePoint,
  HapticDynamicParameter,
  HapticEngineEvent,
  HapticEngineEventType,
  HapticEngineOptions,
  HapticEngineState,
  HapticEngineStopReason,
  ImpactStyle,
  NotificationFeedbackType,
}

// ─── Patterns ──────────────────────────────────────────────────────────────

/**
 * Core Haptics' event envelope, on its relative 0..1 scale (iOS). Android
 * applies `attackTime` / `releaseTime` to continuous events as fades over up
 * to half of the event, and ignores `decayTime` / `sustained`.
 */
export type HapticEventEnvelope = {
  attackTime?: number
  decayTime?: number
  releaseTime?: number
  /** Continuous events hold their strength (default true); false lets them decay. */
  sustained?: boolean
}

/** A single tap. */
export type HapticTransientEvent = HapticEventEnvelope & {
  type: 'transient'
  /** Seconds from the start of the pattern. */
  time: number
  /** 0..1 */
  intensity: number
  /** 0..1: soft and round (0) to crisp and clicky (1). */
  sharpness: number
}

/** A held vibration. */
export type HapticContinuousEvent = HapticEventEnvelope & {
  type: 'continuous'
  /** Seconds from the start of the pattern. */
  time: number
  /** Seconds. */
  duration: number
  /** 0..1 */
  intensity: number
  /** 0..1 */
  sharpness: number
}

/** Audio parameters for audio events (iOS only). */
export type HapticAudioParameters = {
  /** 0..1 */
  volume?: number
  /** -1..1 */
  pitch?: number
  /** -1 (left)..1 (right) */
  pan?: number
  /** -1..1 */
  brightness?: number
}

/**
 * A tone Core Haptics synthesises in sync with the haptics (iOS only; needs
 * `setEngineOptions({ playsHapticsOnly: false })`). Skipped on Android.
 */
export type HapticAudioContinuousEvent = HapticEventEnvelope &
  HapticAudioParameters & {
    type: 'audioContinuous'
    time: number
    duration: number
  }

/**
 * Your own sound file played in sync (iOS only; needs
 * `setEngineOptions({ playsHapticsOnly: false })`). Skipped on Android.
 */
export type HapticAudioCustomEvent = HapticEventEnvelope &
  HapticAudioParameters & {
    type: 'audioCustom'
    time: number
    /** An absolute path, a `file://` URI, or a resource name in the app bundle. */
    resource: string
    /** Seconds; omit to play the whole file. */
    duration?: number
  }

export type HapticEvent =
  | HapticTransientEvent
  | HapticContinuousEvent
  | HapticAudioContinuousEvent
  | HapticAudioCustomEvent

/**
 * Shapes events over time. Transient events are never affected, so taps
 * keep their own strength on top of a shaped rumble.
 *
 * - `intensity`: a multiplier (0..1) on the intensity of the continuous
 *   events playing at that moment.
 * - `sharpness`: an offset (-1..1) added to their sharpness (iOS only;
 *   Android vibrators have no sharpness control).
 * - `attackTime` / `decayTime` / `releaseTime` (-1..1 offsets) and the audio
 *   parameters (`audioVolume` 0..1, `audioPan` / `audioPitch` /
 *   `audioBrightness` -1..1): iOS only.
 *
 * Values are interpolated linearly between points. Before the first point
 * the parameter is unchanged; after the last it holds the last value.
 */
export type HapticCurve = {
  parameter: HapticCurveParameter
  /** Seconds from the start of the pattern. */
  time: number
  /** `time` of each point is relative to the curve's `time`. */
  points: HapticCurvePoint[]
}

export type HapticPattern = {
  events: HapticEvent[]
  curves?: HapticCurve[]
}

export type PlayPatternOptions = {
  /**
   * Android devices whose vibrator has no amplitude control (where
   * `isSupported()` is false) can still play a pattern as on / off pulses:
   * continuous events at 60% intensity or more vibrate, the rest stay
   * off, and every tap is a full-strength pulse. Default false (nothing
   * plays). No effect on iOS, where patterns need Core Haptics.
   */
  fallback?: boolean
}

/**
 * A pattern built into the platform's own form once (see
 * `compilePattern`). Replays skip all conversion: the cheapest way to play
 * the same pattern again and again.
 */
export interface CompiledHapticPattern {
  /** Seconds. */
  readonly duration: number
  /** Plays it, replacing any pattern still playing. Resolves once it has started. */
  play(): Promise<void>
  /** Stops it if it is playing (Android: cancels the vibration). */
  stop(): Promise<void>
  /** Frees the native objects now instead of when garbage-collected. Don't use it afterwards. */
  release(): void
}

/**
 * A vibration you steer while it plays, e.g. from a gesture (see
 * `createRealtimeHaptic`).
 */
export interface RealtimeHaptic {
  /** Whether it is playing. */
  readonly isActive: boolean
  /** Starts it (0..1 each; sharpness is iOS-only). Does nothing if it is already playing. */
  start(intensity?: number, sharpness?: number): Promise<void>
  /**
   * Changes intensity (0..1) and, on iOS, sharpness (0..1) right away.
   * Call it as often as you like: Android re-issues the vibration at most
   * once per frame, with the latest value. Ignored while stopped.
   */
  set(intensity: number, sharpness?: number): void
  /** Stops it and frees the native player. */
  stop(): Promise<void>
}

// ─── Android options and inputs ────────────────────────────────────────────

export type VibrationOptions = {
  /**
   * Which system settings apply (Android 13+ `VibrationAttributes`, or
   * `AudioAttributes` on 8-12). `touch` follows the user's touch-feedback
   * setting and intensity. Default: `unknown` (no attributes).
   */
  usage?: AndroidVibrationUsage
  /** VibratorManager ids (Android 12+); default: the default vibrator. */
  vibratorIds?: number[]
}

export type FallbackOptions = VibrationOptions & {
  /**
   * When the device lacks the effect / primitive: play the closest
   * waveform instead (default true). With false, nothing plays and the
   * promise resolves false.
   */
  fallback?: boolean
}

export type PrimitiveStep = {
  primitive: AndroidPrimitive
  /** 0..1 (default 1). */
  scale?: number
  /** Milliseconds before this primitive (default 0). */
  delayMs?: number
  /** Android 16+: measure `delayMs` from the previous primitive's start. Default `pause`. */
  delayType?: AndroidPrimitiveDelayType
}

/** Android 16 `BasicEnvelopeBuilder`: intensity and sharpness control points. */
export type BasicEnvelope = {
  kind: 'basic'
  /** 0..1 */
  initialSharpness?: number
  points: { intensity: number; sharpness: number; durationMs: number }[]
}

/** Android 16 `WaveformEnvelopeBuilder`: amplitude and frequency control points. */
export type WaveformEnvelope = {
  kind: 'waveform'
  initialFrequencyHz?: number
  points: { amplitude: number; frequencyHz: number; durationMs: number }[]
}

export type HapticEnvelope = BasicEnvelope | WaveformEnvelope

// ─── Players ───────────────────────────────────────────────────────────────

export type HapticPlayerParameters =
  | HapticDynamicParameter[]
  | Partial<Record<HapticCurveParameter, number>>

/**
 * A pattern you control while it plays. iOS: CHHapticAdvancedPatternPlayer.
 * Android: an emulation on waveforms (timing, looping, pause / seek, rate,
 * mute and intensity work; sharpness and audio don't).
 *
 * Every `atTime` is a delay in seconds from now (default 0: immediately).
 */
export interface HapticPlayer {
  /** Pattern length in seconds. */
  readonly duration: number
  loopEnabled: boolean
  /** Seconds; 0 loops at the end of the pattern. */
  loopEnd: number
  /** 1 = normal speed. */
  playbackRate: number
  isMuted: boolean
  start(atTime?: number): Promise<void>
  stop(atTime?: number): Promise<void>
  pause(atTime?: number): Promise<void>
  resume(atTime?: number): Promise<void>
  /** Seconds from the start of the pattern. */
  seek(offset: number): Promise<void>
  cancel(): Promise<void>
  /** e.g. `{ intensity: 0.4, sharpness: 0.2 }` while it plays. */
  sendParameters(parameters: HapticPlayerParameters, atTime?: number): Promise<void>
  scheduleParameterCurve(curve: HapticCurve, atTime?: number): Promise<void>
  /** Called when the player finishes (not when it loops), is stopped, or fails (with a message). */
  onComplete(listener: (error?: string) => void): void
  /**
   * Stops it and frees the native players now instead of when
   * garbage-collected. Don't use it afterwards.
   */
  release(): void
}
