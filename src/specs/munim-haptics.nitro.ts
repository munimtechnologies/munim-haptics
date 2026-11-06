import type { HybridObject } from 'react-native-nitro-modules'

/** A single tap (`transient`) or a held vibration (`continuous`). */
export type HapticEventType = 'transient' | 'continuous'

/** The dynamic parameter a curve drives. */
export type HapticCurveParameter = 'intensity' | 'sharpness'

/**
 * One event, as it crosses the bridge. The public API in `src/index.ts` uses
 * a discriminated union; it is flattened here (with `duration` always set)
 * so no optional struct fields cross into Swift/Kotlin.
 */
export interface NativeHapticEvent {
  type: HapticEventType
  /** Start, in seconds from the start of the pattern. */
  time: number
  /** Length in seconds. Ignored for transients (pass 0). */
  duration: number
  /** 0..1 */
  intensity: number
  /** 0..1 */
  sharpness: number
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

export interface MunimHaptics
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
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
}
