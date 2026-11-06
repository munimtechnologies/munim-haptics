/**
 * iOS stand-ins for Android-only calls, as Core Haptics patterns or UIKit
 * feedback. Pure functions, so they are testable without a device.
 */
import { clamp, normalizePrimitives } from './pattern'
import type {
  AndroidHapticFeedback,
  AndroidPredefinedEffect,
  HapticEnvelope,
  HapticEvent,
  HapticCurve,
  HapticPattern,
  ImpactStyle,
  NotificationFeedbackType,
  PrimitiveStep,
} from './types'

/** A one-shot vibration as one continuous event. `amplitude` 1..255 (<= 0: full). */
export function oneShotToPattern(durationMs: number, amplitude?: number): HapticPattern {
  const intensity = amplitude === undefined || amplitude <= 0 ? 1 : clamp(amplitude / 255, 0, 1)
  return {
    events: [
      {
        type: 'continuous',
        time: 0,
        duration: Math.max(0, durationMs) / 1000,
        intensity,
        sharpness: 0.5,
      },
    ],
  }
}

/**
 * A waveform (Android `createWaveform`) as continuous events. Without
 * amplitudes, timings alternate off / on starting with off.
 */
export function waveformToPattern(timingsMs: number[], amplitudes?: number[]): HapticPattern {
  const events: HapticEvent[] = []
  // Milliseconds, so times don't pick up floating-point drift.
  let timeMs = 0
  timingsMs.forEach((ms, index) => {
    const durationMs = Math.max(0, Number.isFinite(ms) ? ms : 0)
    const duration = durationMs / 1000
    const time = timeMs / 1000
    let level: number
    if (amplitudes && amplitudes.length > 0) {
      const amplitude = amplitudes[index] ?? 0
      level = amplitude < 0 ? 1 : clamp(amplitude / 255, 0, 1)
    } else {
      level = index % 2 === 1 ? 1 : 0
    }
    if (level > 0 && duration > 0) {
      events.push({ type: 'continuous', time, duration, intensity: level, sharpness: 0.5 })
    }
    timeMs += durationMs
  })
  return { events }
}

/** Splits a waveform at `repeatIndex` into the part played once and the part that loops. */
export function splitWaveform(
  timingsMs: number[],
  amplitudes: number[] | undefined,
  repeatIndex: number
): { head: HapticPattern; headDuration: number; body: HapticPattern | null } {
  if (repeatIndex < 0 || repeatIndex >= timingsMs.length) {
    return { head: waveformToPattern(timingsMs, amplitudes), headDuration: 0, body: null }
  }
  const hasAmplitudes = !!amplitudes && amplitudes.length > 0
  const headTimings = timingsMs.slice(0, repeatIndex)
  const bodyTimings = timingsMs.slice(repeatIndex)
  const headDuration = headTimings.reduce((sum, ms) => sum + Math.max(0, ms), 0) / 1000
  // Without amplitudes on/off alternates by index: keep the body's phase.
  const bodyAmplitudes = hasAmplitudes
    ? amplitudes!.slice(repeatIndex)
    : bodyTimings.map((_, i) => ((repeatIndex + i) % 2 === 1 ? 255 : 0))
  return {
    head: waveformToPattern(headTimings, amplitudes?.slice(0, repeatIndex)),
    headDuration,
    body: waveformToPattern(bodyTimings, bodyAmplitudes),
  }
}

/** Primitives as transients and short shaped rumbles. */
export function primitivesToPattern(steps: PrimitiveStep[]): HapticPattern {
  const events: HapticEvent[] = []
  const curves: HapticCurve[] = []
  let previousStart = 0
  let previousEnd = 0
  normalizePrimitives(steps).forEach((step, index) => {
    const delay = step.delayMs / 1000
    const start =
      step.delayType === 'relativeStartOffset' && index > 0 ? previousStart + delay : previousEnd + delay
    const s = step.scale
    let length = 0.01
    const ramp = (duration: number, from: number, to: number, sharpness: number) => {
      length = duration
      events.push({ type: 'continuous', time: start, duration, intensity: s, sharpness })
      curves.push({
        parameter: 'intensity',
        time: start,
        points: [
          { time: 0, value: from },
          { time: duration, value: to },
        ],
      })
    }
    switch (step.primitive) {
      case 'click':
        events.push({ type: 'transient', time: start, intensity: s, sharpness: 0.7 })
        break
      case 'tick':
        events.push({ type: 'transient', time: start, intensity: 0.7 * s, sharpness: 1 })
        break
      case 'lowTick':
        events.push({ type: 'transient', time: start, intensity: 0.6 * s, sharpness: 0.2 })
        break
      case 'thud':
        events.push({ type: 'transient', time: start, intensity: s, sharpness: 0.1 })
        ramp(0.06, 0.8, 0, 0.1)
        break
      case 'spin':
        ramp(0.12, 0.4, 0.4, 0.4)
        curves[curves.length - 1]!.points.splice(1, 0, { time: 0.06, value: 1 })
        break
      case 'quickRise':
        ramp(0.08, 0.1, 1, 0.5)
        break
      case 'slowRise':
        ramp(0.25, 0.1, 1, 0.4)
        break
      case 'quickFall':
        ramp(0.08, 1, 0.1, 0.5)
        break
    }
    previousStart = start
    previousEnd = start + length
  })
  return curves.length > 0 ? { events, curves } : { events }
}

/** Android frequency (Hz) as Core Haptics sharpness: ~60 Hz soft to ~300 Hz crisp. */
export function frequencyToSharpness(hz: number): number {
  return clamp((hz - 60) / 240, 0, 1)
}

/**
 * An envelope as one continuous event shaped by an intensity curve and a
 * sharpness curve (sharpness from frequency for waveform envelopes).
 * Intensity starts at 0, like Android's envelopes.
 */
export function envelopeToPattern(envelope: HapticEnvelope): HapticPattern {
  const intensity: { time: number; value: number }[] = [{ time: 0, value: 0 }]
  const sharpness: { time: number; value: number }[] = []
  const initialSharpness =
    envelope.kind === 'basic'
      ? clamp(envelope.initialSharpness ?? 0.5, 0, 1)
      : frequencyToSharpness(envelope.initialFrequencyHz ?? 150)
  sharpness.push({ time: 0, value: initialSharpness })
  let timeMs = 0
  let time = 0
  for (const point of envelope.points) {
    timeMs += Math.max(0, point.durationMs)
    time = timeMs / 1000
    if (envelope.kind === 'basic') {
      const p = point as { intensity: number; sharpness: number }
      intensity.push({ time, value: clamp(p.intensity, 0, 1) })
      sharpness.push({ time, value: clamp(p.sharpness, 0, 1) })
    } else {
      const p = point as { amplitude: number; frequencyHz: number }
      intensity.push({ time, value: clamp(p.amplitude, 0, 1) })
      sharpness.push({ time, value: frequencyToSharpness(p.frequencyHz) })
    }
  }
  if (time <= 0) return { events: [] }
  return {
    // Sharpness 0 plus the sharpness curve's offset = the envelope's sharpness.
    events: [{ type: 'continuous', time: 0, duration: time, intensity: 1, sharpness: 0 }],
    curves: [
      { parameter: 'intensity', time: 0, points: intensity },
      { parameter: 'sharpness', time: 0, points: sharpness },
    ],
  }
}

export type FeedbackCall =
  | { kind: 'impact'; style: ImpactStyle; intensity?: number }
  | { kind: 'notification'; type: NotificationFeedbackType }
  | { kind: 'selection' }
  | { kind: 'pattern'; pattern: HapticPattern }
  | { kind: 'none' }

/** The UIKit feedback (or pattern) closest to an Android predefined effect. */
export function predefinedToFeedback(effect: AndroidPredefinedEffect): FeedbackCall {
  switch (effect) {
    case 'click':
      return { kind: 'impact', style: 'medium' }
    case 'tick':
      return { kind: 'impact', style: 'light' }
    case 'heavyClick':
      return { kind: 'impact', style: 'heavy' }
    case 'doubleClick':
      return {
        kind: 'pattern',
        pattern: {
          events: [
            { type: 'transient', time: 0, intensity: 0.8, sharpness: 0.6 },
            { type: 'transient', time: 0.1, intensity: 0.8, sharpness: 0.6 },
          ],
        },
      }
  }
}

/** The UIKit feedback closest to an Android `HapticFeedbackConstants` value. */
export function viewFeedbackToFeedback(feedback: AndroidHapticFeedback): FeedbackCall {
  switch (feedback) {
    case 'confirm':
      return { kind: 'notification', type: 'success' }
    case 'reject':
      return { kind: 'notification', type: 'error' }
    case 'longPress':
    case 'toggleOn':
      return { kind: 'impact', style: 'medium' }
    case 'dragStart':
    case 'gestureThresholdActivate':
      return { kind: 'impact', style: 'rigid' }
    case 'gestureThresholdDeactivate':
      return { kind: 'impact', style: 'soft' }
    case 'virtualKey':
    case 'keyboardTap':
    case 'keyboardPress':
    case 'contextClick':
    case 'gestureStart':
    case 'gestureEnd':
    case 'toggleOff':
      return { kind: 'impact', style: 'light' }
    case 'clockTick':
    case 'textHandleMove':
    case 'segmentTick':
    case 'segmentFrequentTick':
      return { kind: 'selection' }
    case 'keyboardRelease':
    case 'virtualKeyRelease':
    case 'noHaptics':
      return { kind: 'none' }
  }
}
