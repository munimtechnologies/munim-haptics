import type {
  HapticCurveParameter,
  NativeHapticEnvelope,
  NativeHapticEvent,
  NativeHapticPattern,
  NativePrimitiveStep,
} from './specs/munim-haptics.nitro'
import type {
  HapticCurve,
  HapticEnvelope,
  HapticEvent,
  HapticPattern,
  PrimitiveStep,
} from './types'

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/** A finite, non-negative number of seconds (anything else is 0). */
export function seconds(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : 0
}

/** The lowest value a curve / dynamic parameter takes. */
export function parameterMin(parameter: HapticCurveParameter): number {
  return parameter === 'intensity' || parameter === 'audioVolume' ? 0 : -1
}

function optional(value: number | undefined, min: number, max: number): number | undefined {
  return value === undefined ? undefined : clamp(value, min, max)
}

function nativeEvent(event: HapticEvent): NativeHapticEvent | null {
  const base = {
    time: seconds(event.time),
    attackTime: optional(event.attackTime, 0, 1),
    decayTime: optional(event.decayTime, 0, 1),
    releaseTime: optional(event.releaseTime, 0, 1),
    sustained: event.sustained,
  }
  switch (event.type) {
    case 'transient':
      return {
        ...base,
        type: 'transient',
        duration: 0,
        intensity: clamp(event.intensity, 0, 1),
        sharpness: clamp(event.sharpness, 0, 1),
      }
    case 'continuous': {
      const duration = seconds(event.duration)
      if (duration <= 0) return null
      return {
        ...base,
        type: 'continuous',
        duration,
        intensity: clamp(event.intensity, 0, 1),
        sharpness: clamp(event.sharpness, 0, 1),
      }
    }
    case 'audioContinuous':
    case 'audioCustom': {
      const duration = seconds(event.duration)
      if (event.type === 'audioContinuous' && duration <= 0) return null
      if (event.type === 'audioCustom' && !event.resource) return null
      return {
        ...base,
        type: event.type,
        duration,
        intensity: 0,
        sharpness: 0,
        audioVolume: optional(event.volume, 0, 1),
        audioPitch: optional(event.pitch, -1, 1),
        audioPan: optional(event.pan, -1, 1),
        audioBrightness: optional(event.brightness, -1, 1),
        resource: event.type === 'audioCustom' ? event.resource : undefined,
      }
    }
    default:
      return null
  }
}

/** A curve with its values clamped and points in time order. */
export function normalizeCurve(curve: HapticCurve): HapticCurve {
  const min = parameterMin(curve.parameter)
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
}

/**
 * The pattern as the native side gets it: values clamped to their ranges,
 * events in time order, empty continuous events (and audio files without a
 * resource) dropped. Exported for tests.
 */
export function normalizePattern(pattern: HapticPattern): NativeHapticPattern {
  const events = pattern.events
    .map(nativeEvent)
    .filter((event): event is NativeHapticEvent => event !== null)
    .sort((a, b) => a.time - b.time)

  const curves = (pattern.curves ?? [])
    .map(normalizeCurve)
    .filter((curve) => curve.points.length > 0)

  return { events, curves }
}

/** Primitive steps with defaults filled in and values clamped. */
export function normalizePrimitives(steps: PrimitiveStep[]): NativePrimitiveStep[] {
  return steps.map((step) => ({
    primitive: step.primitive,
    scale: clamp(step.scale ?? 1, 0, 1),
    delayMs: Math.max(0, Number.isFinite(step.delayMs) ? (step.delayMs as number) : 0),
    delayType: step.delayType ?? 'pause',
  }))
}

/** An envelope flattened for the bridge. */
export function normalizeEnvelope(envelope: HapticEnvelope): NativeHapticEnvelope {
  const duration = (ms: number) => (Number.isFinite(ms) && ms > 0 ? ms : 0)
  if (envelope.kind === 'waveform') {
    return {
      kind: 'waveform',
      initialValue: envelope.initialFrequencyHz ?? -1,
      points: envelope.points.map((point) => ({
        intensity: clamp(point.amplitude, 0, 1),
        sharpness: 0,
        frequencyHz: Math.max(0, point.frequencyHz),
        durationMs: duration(point.durationMs),
      })),
    }
  }
  return {
    kind: 'basic',
    initialValue: envelope.initialSharpness === undefined ? -1 : clamp(envelope.initialSharpness, 0, 1),
    points: envelope.points.map((point) => ({
      intensity: clamp(point.intensity, 0, 1),
      sharpness: clamp(point.sharpness, 0, 1),
      frequencyHz: 0,
      durationMs: duration(point.durationMs),
    })),
  }
}

/** Pattern length in seconds (the end of its last event or curve point). */
export function patternDuration(pattern: HapticPattern): number {
  let end = 0
  for (const event of pattern.events) {
    const duration = event.type === 'transient' ? 0 : seconds(event.duration)
    end = Math.max(end, seconds(event.time) + duration)
  }
  for (const curve of pattern.curves ?? []) {
    const last = Math.max(0, ...curve.points.map((point) => seconds(point.time)))
    end = Math.max(end, seconds(curve.time) + last)
  }
  return end
}
