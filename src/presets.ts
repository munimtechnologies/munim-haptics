/**
 * Ready-made patterns, designed once and played the same way on both
 * platforms: Core Haptics on iOS, amplitude waveforms on Android (sharpness
 * is iOS-only, so on Android the presets differ only in timing and
 * strength). Pure data, so they are testable and can be inspected or
 * tweaked with `getPresetPattern`.
 */
import type { HapticEvent, HapticPattern } from './types'

function tap(time: number, intensity: number, sharpness: number): HapticEvent {
  return { type: 'transient', time, intensity, sharpness }
}

function hold(time: number, duration: number, intensity: number, sharpness: number): HapticEvent {
  return { type: 'continuous', time, duration, intensity, sharpness }
}

/** Taps at `times` (seconds), all alike. */
function taps(times: number[], intensity: number, sharpness: number): HapticEvent[] {
  return times.map((time) => tap(time, intensity, sharpness))
}

const PRESETS = {
  /** One light, crisp tap. */
  tap: { events: [tap(0, 0.6, 0.7)] },
  /** Two quick taps. */
  doubleTap: { events: taps([0, 0.09], 0.8, 0.6) },
  /** Three quick taps. */
  tripleTap: { events: taps([0, 0.08, 0.16], 0.75, 0.6) },
  /** A firm click with a short tail. */
  click: { events: [tap(0, 1, 0.9), hold(0, 0.025, 0.35, 0.9)] },
  /** A soft, deep hit. */
  thud: {
    events: [tap(0, 1, 0.05), hold(0, 0.08, 0.7, 0.05)],
    curves: [{ parameter: 'intensity', time: 0, points: [{ time: 0, value: 1 }, { time: 0.08, value: 0 }] }],
  },
  /** Two dull knocks, like on a door. */
  knock: { events: [tap(0, 0.9, 0.15), tap(0.14, 1, 0.15)] },
  /** Lub-dub, twice. */
  heartbeat: {
    events: [tap(0, 0.9, 0.2), tap(0.13, 0.6, 0.2), tap(0.8, 0.9, 0.2), tap(0.93, 0.6, 0.2)],
  },
  /** A rising pair: done. */
  success: { events: [tap(0, 0.6, 0.5), tap(0.11, 1, 0.8)] },
  /** A strong tap, then a softer one: careful. */
  warning: { events: [tap(0, 1, 0.6), tap(0.16, 0.6, 0.4)] },
  /** Three sharp buzzes: failed. */
  error: {
    events: [hold(0, 0.05, 1, 0.9), hold(0.09, 0.05, 1, 0.9), hold(0.18, 0.08, 1, 0.9)],
  },
  /** A short, even buzz. */
  buzz: { events: [hold(0, 0.3, 0.8, 0.8)] },
  /** A low rumble that swells and fades. */
  rumble: {
    events: [hold(0, 0.7, 1, 0.1)],
    curves: [
      {
        parameter: 'intensity',
        time: 0,
        points: [
          { time: 0, value: 0.2 },
          { time: 0.3, value: 1 },
          { time: 0.7, value: 0 },
        ],
      },
    ],
  },
  /** A vibration that builds from nothing to full. */
  rampUp: {
    events: [hold(0, 0.6, 1, 0.5)],
    curves: [{ parameter: 'intensity', time: 0, points: [{ time: 0, value: 0 }, { time: 0.6, value: 1 }] }],
  },
  /** A vibration that fades from full to nothing. */
  rampDown: {
    events: [hold(0, 0.6, 1, 0.5)],
    curves: [{ parameter: 'intensity', time: 0, points: [{ time: 0, value: 1 }, { time: 0.6, value: 0 }] }],
  },
  /** Four even pulses. */
  pulse: {
    events: [0, 0.2, 0.4, 0.6].map((time) => hold(time, 0.1, 0.8, 0.4)),
  },
  /** Taps that speed up into a final hit. */
  drumroll: {
    events: [
      ...taps([0, 0.12, 0.22, 0.3, 0.37, 0.43, 0.48, 0.52, 0.56, 0.59, 0.62], 0.55, 0.5),
      tap(0.72, 1, 0.8),
    ],
  },
  /** A heavy blow with a dying ring. */
  hammer: {
    events: [tap(0, 1, 1), hold(0.01, 0.25, 0.8, 0.3)],
    curves: [
      {
        parameter: 'intensity',
        time: 0.01,
        points: [
          { time: 0, value: 1 },
          { time: 0.05, value: 0.4 },
          { time: 0.25, value: 0 },
        ],
      },
    ],
  },
  /** A ball dropped on the floor: each bounce lower and sooner. */
  bounce: {
    events: [
      tap(0, 1, 0.5),
      tap(0.32, 0.75, 0.5),
      tap(0.55, 0.55, 0.5),
      tap(0.71, 0.4, 0.5),
      tap(0.82, 0.28, 0.5),
      tap(0.89, 0.18, 0.5),
    ],
  },
  /** A fast train of crisp ticks. */
  zipper: { events: taps(Array.from({ length: 14 }, (_, i) => i * 0.025), 0.6, 1) },
  /** A rumble that wobbles up and down. */
  wobble: {
    events: [hold(0, 0.8, 1, 0.3)],
    curves: [
      {
        parameter: 'intensity',
        time: 0,
        points: Array.from({ length: 9 }, (_, i) => ({ time: i * 0.1, value: i % 2 === 0 ? 0.25 : 1 })),
      },
    ],
  },
  /** A hard hit and a long rumble that dies away. */
  explosion: {
    events: [tap(0, 1, 0.6), hold(0, 1.2, 1, 0.05)],
    curves: [
      {
        parameter: 'intensity',
        time: 0,
        points: [
          { time: 0, value: 1 },
          { time: 0.15, value: 0.8 },
          { time: 0.5, value: 0.35 },
          { time: 1.2, value: 0 },
        ],
      },
    ],
  },
} satisfies Record<string, HapticPattern>

export type HapticPresetName = keyof typeof PRESETS

/** Every preset name, in a stable order. */
export const presetNames = Object.keys(PRESETS) as HapticPresetName[]

/** The pattern behind a preset (a copy: change it freely). */
export function getPresetPattern(name: HapticPresetName): HapticPattern {
  const pattern: HapticPattern | undefined = PRESETS[name]
  if (!pattern) throw new Error(`munim-haptics: unknown preset "${String(name)}"`)
  return {
    events: pattern.events.map((event) => ({ ...event })),
    ...(pattern.curves
      ? {
          curves: pattern.curves.map((curve) => ({
            ...curve,
            points: curve.points.map((point) => ({ ...point })),
          })),
        }
      : {}),
  }
}
