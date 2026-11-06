import { NitroModules } from 'react-native-nitro-modules'
import type {
  MunimHaptics as MunimHapticsSpec,
  HapticCurveParameter,
  HapticCurvePoint,
  NativeHapticEvent,
  NativeHapticPattern,
} from './specs/munim-haptics.nitro'

export type { HapticCurveParameter, HapticCurvePoint }

/** A single tap. */
export type HapticTransientEvent = {
  type: 'transient'
  /** Seconds from the start of the pattern. */
  time: number
  /** 0..1 */
  intensity: number
  /** 0..1: soft and round (0) to crisp and clicky (1). */
  sharpness: number
}

/** A held vibration. */
export type HapticContinuousEvent = {
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

export type HapticEvent = HapticTransientEvent | HapticContinuousEvent

/**
 * Shapes continuous events over time. Transient events are never affected,
 * so taps keep their own strength on top of a shaped rumble.
 *
 * - `intensity`: a multiplier (0..1) on the intensity of the continuous
 *   events playing at that moment.
 * - `sharpness`: an offset (-1..1) added to their sharpness (iOS only;
 *   Android vibrators have no sharpness control).
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

let native: MunimHapticsSpec | null | undefined

function getNative(): MunimHapticsSpec | null {
  if (native === undefined) {
    try {
      native = NitroModules.createHybridObject<MunimHapticsSpec>('MunimHaptics')
    } catch {
      // Web, or a binary built without this module.
      native = null
    }
  }
  return native
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function seconds(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

/**
 * The pattern as the native side gets it: values clamped to their ranges,
 * events in time order, empty continuous events dropped. Exported for tests.
 */
export function normalizePattern(pattern: HapticPattern): NativeHapticPattern {
  const events: NativeHapticEvent[] = pattern.events
    .map((event) => ({
      type: event.type,
      time: seconds(event.time),
      duration: event.type === 'continuous' ? seconds(event.duration) : 0,
      intensity: clamp(event.intensity, 0, 1),
      sharpness: clamp(event.sharpness, 0, 1),
    }))
    .filter((event) => event.type === 'transient' || event.duration > 0)
    .sort((a, b) => a.time - b.time)

  const curves = (pattern.curves ?? [])
    .map((curve) => {
      const min = curve.parameter === 'sharpness' ? -1 : 0
      return {
        parameter: curve.parameter,
        time: seconds(curve.time),
        points: curve.points
          .map((point) => ({
            time: seconds(point.time),
            value: clamp(point.value, min, 1),
          }))
          .sort((a, b) => a.time - b.time),
      }
    })
    .filter((curve) => curve.points.length > 0)

  return { events, curves }
}

/**
 * Whether rich patterns play on this device: Core Haptics on iOS, a vibrator
 * with amplitude control on Android. When false, `playPattern` does nothing,
 * so fall back to simpler feedback (e.g. expo-haptics).
 */
export function isSupported(): boolean {
  const module = getNative()
  if (!module) return false
  try {
    return module.isSupported()
  } catch {
    return false
  }
}

/** Starts the haptic engine ahead of time, so the next pattern plays with no lag. */
export async function prepare(): Promise<void> {
  if (!isSupported()) return
  await getNative()?.prepare()
}

/**
 * Plays a pattern, replacing any pattern still playing. Resolves once it has
 * started (not when it ends). Does nothing when unsupported.
 */
export async function playPattern(pattern: HapticPattern): Promise<void> {
  if (!isSupported()) return
  await getNative()?.playPattern(normalizePattern(pattern))
}

/** Stops the pattern that is playing, if any. */
export async function stop(): Promise<void> {
  const module = getNative()
  if (!module) return
  await module.stop()
}

export default { isSupported, prepare, playPattern, stop, normalizePattern }
