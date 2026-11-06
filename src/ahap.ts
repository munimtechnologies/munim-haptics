/**
 * AHAP (Apple Haptic and Audio Pattern) documents: build one from a
 * HapticPattern, or parse one into a HapticPattern. iOS plays AHAP natively;
 * Android plays the parsed pattern (haptics only).
 *
 * https://developer.apple.com/documentation/corehaptics/representing-haptic-patterns-in-ahap-files
 */
import type { HapticCurveParameter } from './specs/munim-haptics.nitro'
import { clamp, normalizeCurve, parameterMin, seconds } from './pattern'
import type { HapticCurve, HapticEvent, HapticPattern } from './types'

export type AHAPEventType =
  | 'HapticTransient'
  | 'HapticContinuous'
  | 'AudioContinuous'
  | 'AudioCustom'

export type AHAPEventParameterID =
  | 'HapticIntensity'
  | 'HapticSharpness'
  | 'AttackTime'
  | 'DecayTime'
  | 'ReleaseTime'
  | 'Sustained'
  | 'AudioVolume'
  | 'AudioPitch'
  | 'AudioPan'
  | 'AudioBrightness'

export type AHAPDynamicParameterID =
  | 'HapticIntensityControl'
  | 'HapticSharpnessControl'
  | 'HapticAttackTimeControl'
  | 'HapticDecayTimeControl'
  | 'HapticReleaseTimeControl'
  | 'AudioVolumeControl'
  | 'AudioPanControl'
  | 'AudioPitchControl'
  | 'AudioBrightnessControl'

export type AHAPEvent = {
  Event: {
    Time: number
    EventType: AHAPEventType
    EventDuration?: number
    EventWaveformPath?: string
    EventWaveformUseVolumeEnvelope?: boolean
    EventWaveformLoopEnabled?: boolean
    EventParameters?: { ParameterID: AHAPEventParameterID; ParameterValue: number }[]
  }
}

export type AHAPParameter = {
  Parameter: { ParameterID: AHAPDynamicParameterID; Time: number; ParameterValue: number }
}

export type AHAPParameterCurve = {
  ParameterCurve: {
    ParameterID: AHAPDynamicParameterID
    Time: number
    ParameterCurveControlPoints: { Time: number; ParameterValue: number }[]
  }
}

export type AHAPPatternEntry = AHAPEvent | AHAPParameter | AHAPParameterCurve

export type AHAP = {
  Version: number
  Metadata?: Record<string, unknown>
  Pattern: AHAPPatternEntry[]
}

const CURVE_TO_AHAP: Record<HapticCurveParameter, AHAPDynamicParameterID> = {
  intensity: 'HapticIntensityControl',
  sharpness: 'HapticSharpnessControl',
  attackTime: 'HapticAttackTimeControl',
  decayTime: 'HapticDecayTimeControl',
  releaseTime: 'HapticReleaseTimeControl',
  audioVolume: 'AudioVolumeControl',
  audioPan: 'AudioPanControl',
  audioPitch: 'AudioPitchControl',
  audioBrightness: 'AudioBrightnessControl',
}

const AHAP_TO_CURVE = Object.fromEntries(
  Object.entries(CURVE_TO_AHAP).map(([key, value]) => [value, key])
) as Record<AHAPDynamicParameterID, HapticCurveParameter>

/** Core Haptics' defaults for events that leave a parameter out. */
const DEFAULT_INTENSITY = 1
const DEFAULT_SHARPNESS = 0.5

// ─── Building ──────────────────────────────────────────────────────────────

function eventToAHAP(event: HapticEvent): AHAPEvent {
  const parameters: { ParameterID: AHAPEventParameterID; ParameterValue: number }[] = []
  const add = (id: AHAPEventParameterID, value: number | undefined, min = 0) => {
    if (value !== undefined) parameters.push({ ParameterID: id, ParameterValue: clamp(value, min, 1) })
  }
  const entry: AHAPEvent['Event'] = { Time: seconds(event.time), EventType: 'HapticTransient' }
  switch (event.type) {
    case 'transient':
    case 'continuous':
      entry.EventType = event.type === 'transient' ? 'HapticTransient' : 'HapticContinuous'
      add('HapticIntensity', event.intensity)
      add('HapticSharpness', event.sharpness)
      if (event.type === 'continuous') entry.EventDuration = seconds(event.duration)
      break
    case 'audioContinuous':
    case 'audioCustom':
      entry.EventType = event.type === 'audioContinuous' ? 'AudioContinuous' : 'AudioCustom'
      add('AudioVolume', event.volume)
      add('AudioPitch', event.pitch, -1)
      add('AudioPan', event.pan, -1)
      add('AudioBrightness', event.brightness, -1)
      if (event.duration !== undefined) entry.EventDuration = seconds(event.duration)
      if (event.type === 'audioCustom') entry.EventWaveformPath = event.resource
      break
  }
  add('AttackTime', event.attackTime)
  add('DecayTime', event.decayTime)
  add('ReleaseTime', event.releaseTime)
  if (event.sustained !== undefined) add('Sustained', event.sustained ? 1 : 0)
  if (parameters.length > 0) entry.EventParameters = parameters
  return { Event: entry }
}

function curveToAHAP(curve: HapticCurve): AHAPParameterCurve {
  const normalized = normalizeCurve(curve)
  return {
    ParameterCurve: {
      ParameterID: CURVE_TO_AHAP[normalized.parameter],
      Time: normalized.time,
      ParameterCurveControlPoints: normalized.points.map((point) => ({
        Time: point.time,
        ParameterValue: point.value,
      })),
    },
  }
}

/**
 * The AHAP document for a pattern. Pass it to `playAHAP`, save it as a
 * `.ahap` file, or open it in a haptics editor.
 */
export function buildAHAP(pattern: HapticPattern, metadata?: Record<string, unknown>): AHAP {
  const ahap: AHAP = {
    Version: 1,
    Pattern: [
      ...pattern.events.map(eventToAHAP),
      ...(pattern.curves ?? []).filter((curve) => curve.points.length > 0).map(curveToAHAP),
    ],
  }
  if (metadata) ahap.Metadata = metadata
  return ahap
}

// ─── Parsing ───────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function num(value: unknown, name: string, fallback?: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value === undefined && fallback !== undefined) return fallback
  throw new Error(`Invalid AHAP: ${name} must be a number`)
}

/**
 * A HapticPattern from an AHAP document (JSON string or object). Single
 * `Parameter` entries become one-point curves. Throws on malformed input.
 */
export function parseAHAP(ahap: string | AHAP | Record<string, unknown>): HapticPattern {
  const document: unknown = typeof ahap === 'string' ? JSON.parse(ahap) : ahap
  if (!isRecord(document) || !Array.isArray(document.Pattern)) {
    throw new Error('Invalid AHAP: expected an object with a Pattern array')
  }
  const events: HapticEvent[] = []
  const curves: HapticCurve[] = []

  for (const entry of document.Pattern as unknown[]) {
    if (!isRecord(entry)) continue
    if (isRecord(entry.Event)) {
      const event = entry.Event
      const time = num(event.Time, 'Event.Time', 0)
      const parameters = new Map<string, number>()
      if (Array.isArray(event.EventParameters)) {
        for (const parameter of event.EventParameters as unknown[]) {
          if (isRecord(parameter) && typeof parameter.ParameterID === 'string') {
            parameters.set(parameter.ParameterID, num(parameter.ParameterValue, parameter.ParameterID))
          }
        }
      }
      const envelope = {
        attackTime: parameters.get('AttackTime'),
        decayTime: parameters.get('DecayTime'),
        releaseTime: parameters.get('ReleaseTime'),
        sustained: parameters.has('Sustained') ? parameters.get('Sustained') !== 0 : undefined,
      }
      const audio = {
        volume: parameters.get('AudioVolume'),
        pitch: parameters.get('AudioPitch'),
        pan: parameters.get('AudioPan'),
        brightness: parameters.get('AudioBrightness'),
      }
      const intensity = parameters.get('HapticIntensity') ?? DEFAULT_INTENSITY
      const sharpness = parameters.get('HapticSharpness') ?? DEFAULT_SHARPNESS
      switch (event.EventType) {
        case 'HapticTransient':
          events.push(clean({ type: 'transient', time, intensity, sharpness, ...envelope }))
          break
        case 'HapticContinuous':
          events.push(
            clean({
              type: 'continuous',
              time,
              duration: num(event.EventDuration, 'EventDuration'),
              intensity,
              sharpness,
              ...envelope,
            })
          )
          break
        case 'AudioContinuous':
          events.push(
            clean({
              type: 'audioContinuous',
              time,
              duration: num(event.EventDuration, 'EventDuration'),
              ...audio,
              ...envelope,
            })
          )
          break
        case 'AudioCustom':
          if (typeof event.EventWaveformPath !== 'string') {
            throw new Error('Invalid AHAP: AudioCustom needs an EventWaveformPath')
          }
          events.push(
            clean({
              type: 'audioCustom',
              time,
              resource: event.EventWaveformPath,
              duration: event.EventDuration === undefined ? undefined : num(event.EventDuration, 'EventDuration'),
              ...audio,
              ...envelope,
            })
          )
          break
        default:
          throw new Error(`Invalid AHAP: unknown EventType ${String(event.EventType)}`)
      }
    } else if (isRecord(entry.ParameterCurve)) {
      const curve = entry.ParameterCurve
      const parameter = AHAP_TO_CURVE[curve.ParameterID as AHAPDynamicParameterID]
      if (!parameter) continue // e.g. AudioAttackTimeControl: no equivalent
      const points = Array.isArray(curve.ParameterCurveControlPoints)
        ? (curve.ParameterCurveControlPoints as unknown[]).filter(isRecord).map((point) => ({
            time: num(point.Time, 'ControlPoint.Time', 0),
            value: num(point.ParameterValue, 'ControlPoint.ParameterValue'),
          }))
        : []
      curves.push({ parameter, time: num(curve.Time, 'ParameterCurve.Time', 0), points })
    } else if (isRecord(entry.Parameter)) {
      const single = entry.Parameter
      const parameter = AHAP_TO_CURVE[single.ParameterID as AHAPDynamicParameterID]
      if (!parameter) continue
      const value = num(single.ParameterValue, 'Parameter.ParameterValue')
      curves.push({
        parameter,
        time: num(single.Time, 'Parameter.Time', 0),
        points: [{ time: 0, value: clamp(value, parameterMin(parameter), 1) }],
      })
    }
  }
  return curves.length > 0 ? { events, curves } : { events }
}

/** Drops keys whose value is undefined. */
function clean<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T
}
