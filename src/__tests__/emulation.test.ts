import {
  envelopeToPattern,
  frequencyToSharpness,
  oneShotToPattern,
  predefinedToFeedback,
  primitivesToPattern,
  splitWaveform,
  viewFeedbackToFeedback,
  waveformToPattern,
} from '../emulation'
import type { AndroidHapticFeedback } from '../types'

describe('oneShotToPattern', () => {
  it('maps duration and amplitude to one continuous event', () => {
    expect(oneShotToPattern(250, 51).events).toEqual([
      { type: 'continuous', time: 0, duration: 0.25, intensity: 0.2, sharpness: 0.5 },
    ])
    expect(oneShotToPattern(100).events[0]).toMatchObject({ intensity: 1 })
  })
})

describe('waveformToPattern', () => {
  it('alternates off / on without amplitudes', () => {
    expect(waveformToPattern([100, 200, 50, 300]).events).toEqual([
      { type: 'continuous', time: 0.1, duration: 0.2, intensity: 1, sharpness: 0.5 },
      { type: 'continuous', time: 0.35, duration: 0.3, intensity: 1, sharpness: 0.5 },
    ])
  })

  it('uses amplitudes when given (-1 is full strength)', () => {
    const { events } = waveformToPattern([100, 100, 100], [0, 255, -1])
    expect(events.map((e) => [e.time, e.type === 'continuous' && e.intensity])).toEqual([
      [0.1, 1],
      [0.2, 1],
    ])
  })

  it('splits at the repeat index, keeping the on / off phase', () => {
    const { head, headDuration, body } = splitWaveform([100, 200, 50, 300], undefined, 2)
    expect(headDuration).toBeCloseTo(0.3)
    expect(head.events).toHaveLength(1)
    expect(body?.events).toEqual([
      { type: 'continuous', time: 0.05, duration: 0.3, intensity: 1, sharpness: 0.5 },
    ])
    expect(splitWaveform([100], undefined, -1).body).toBeNull()
  })
})

describe('primitivesToPattern', () => {
  it('places primitives after the previous one ends (pause)', () => {
    const { events } = primitivesToPattern([
      { primitive: 'click' },
      { primitive: 'click', delayMs: 100, scale: 0.5 },
    ])
    expect(events).toEqual([
      { type: 'transient', time: 0, intensity: 1, sharpness: 0.7 },
      { type: 'transient', time: 0.11, intensity: 0.5, sharpness: 0.7 },
    ])
  })

  it('measures relativeStartOffset delays from the previous start', () => {
    const { events } = primitivesToPattern([
      { primitive: 'slowRise' },
      { primitive: 'tick', delayMs: 100, delayType: 'relativeStartOffset' },
    ])
    expect(events[1]).toMatchObject({ type: 'transient', time: 0.1 })
  })

  it('shapes rises and falls with intensity curves', () => {
    const { events, curves } = primitivesToPattern([{ primitive: 'quickRise', scale: 0.8 }])
    expect(events[0]).toMatchObject({ type: 'continuous', duration: 0.08, intensity: 0.8 })
    expect(curves?.[0]?.points).toEqual([
      { time: 0, value: 0.1 },
      { time: 0.08, value: 1 },
    ])
  })
})

describe('envelopeToPattern', () => {
  it('builds intensity and sharpness curves from a basic envelope', () => {
    const pattern = envelopeToPattern({
      kind: 'basic',
      initialSharpness: 0.3,
      points: [
        { intensity: 1, sharpness: 0.8, durationMs: 100 },
        { intensity: 0, sharpness: 0.8, durationMs: 200 },
      ],
    })
    expect(pattern.events).toEqual([
      { type: 'continuous', time: 0, duration: 0.3, intensity: 1, sharpness: 0 },
    ])
    expect(pattern.curves?.[0]?.points).toEqual([
      { time: 0, value: 0 },
      { time: 0.1, value: 1 },
      { time: 0.3, value: 0 },
    ])
    expect(pattern.curves?.[1]?.points[0]).toEqual({ time: 0, value: 0.3 })
  })

  it('maps frequency to sharpness for waveform envelopes', () => {
    expect(frequencyToSharpness(60)).toBe(0)
    expect(frequencyToSharpness(300)).toBe(1)
    const pattern = envelopeToPattern({
      kind: 'waveform',
      points: [{ amplitude: 0.5, frequencyHz: 180, durationMs: 50 }],
    })
    expect(pattern.curves?.[1]?.points[1]).toEqual({ time: 0.05, value: 0.5 })
  })

  it('is empty for a zero-length envelope', () => {
    expect(envelopeToPattern({ kind: 'basic', points: [] }).events).toEqual([])
  })
})

describe('feedback mapping', () => {
  it('maps predefined effects to UIKit impacts', () => {
    expect(predefinedToFeedback('heavyClick')).toEqual({ kind: 'impact', style: 'heavy' })
    expect(predefinedToFeedback('doubleClick').kind).toBe('pattern')
  })

  it('maps every view feedback constant', () => {
    const all: AndroidHapticFeedback[] = [
      'longPress', 'virtualKey', 'keyboardTap', 'clockTick', 'contextClick', 'keyboardPress',
      'keyboardRelease', 'virtualKeyRelease', 'textHandleMove', 'gestureStart', 'gestureEnd',
      'confirm', 'reject', 'toggleOn', 'toggleOff', 'gestureThresholdActivate',
      'gestureThresholdDeactivate', 'dragStart', 'segmentTick', 'segmentFrequentTick', 'noHaptics',
    ]
    for (const feedback of all) {
      expect(viewFeedbackToFeedback(feedback)).toBeDefined()
    }
    expect(viewFeedbackToFeedback('confirm')).toEqual({ kind: 'notification', type: 'success' })
    expect(viewFeedbackToFeedback('segmentTick')).toEqual({ kind: 'selection' })
    expect(viewFeedbackToFeedback('noHaptics')).toEqual({ kind: 'none' })
  })
})
