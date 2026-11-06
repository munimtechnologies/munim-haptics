import {
  normalizeEnvelope,
  normalizePattern,
  normalizePrimitives,
  patternDuration,
} from '../pattern'
import type { HapticPattern } from '../types'

describe('normalizePattern', () => {
  it('clamps values, sorts events and drops empty continuous events', () => {
    const pattern: HapticPattern = {
      events: [
        { type: 'continuous', time: 0.5, duration: 0.2, intensity: 2, sharpness: -1 },
        { type: 'transient', time: 0.1, intensity: 0.5, sharpness: 0.5 },
        { type: 'continuous', time: 0, duration: 0, intensity: 1, sharpness: 1 },
        { type: 'transient', time: -3, intensity: Number.NaN, sharpness: 0.3 },
      ],
    }
    const { events, curves } = normalizePattern(pattern)
    expect(curves).toEqual([])
    expect(events.map((e) => [e.type, e.time])).toEqual([
      ['transient', 0],
      ['transient', 0.1],
      ['continuous', 0.5],
    ])
    expect(events[0]).toMatchObject({ intensity: 0, sharpness: 0.3, duration: 0 })
    expect(events[2]).toMatchObject({ intensity: 1, sharpness: 0, duration: 0.2 })
  })

  it('keeps 0.1.0 patterns byte-for-byte equivalent', () => {
    const { events } = normalizePattern({
      events: [{ type: 'continuous', time: 0, duration: 0.6, intensity: 1, sharpness: 0.1 }],
    })
    expect(events).toEqual([
      { type: 'continuous', time: 0, duration: 0.6, intensity: 1, sharpness: 0.1 },
    ])
  })

  it('clamps envelope parameters and passes sustained through', () => {
    const { events } = normalizePattern({
      events: [
        {
          type: 'continuous',
          time: 0,
          duration: 1,
          intensity: 1,
          sharpness: 0.5,
          attackTime: 3,
          releaseTime: -1,
          sustained: false,
        },
      ],
    })
    expect(events[0]).toMatchObject({ attackTime: 1, releaseTime: 0, sustained: false })
  })

  it('flattens audio events and drops ones that cannot play', () => {
    const { events } = normalizePattern({
      events: [
        { type: 'audioContinuous', time: 0, duration: 0.5, volume: 2, pitch: -4, pan: 0.5 },
        { type: 'audioContinuous', time: 0, duration: 0 },
        { type: 'audioCustom', time: 0.2, resource: 'boom.wav', brightness: 0.3 },
        { type: 'audioCustom', time: 0.2, resource: '' },
      ],
    })
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      type: 'audioContinuous',
      duration: 0.5,
      audioVolume: 1,
      audioPitch: -1,
      audioPan: 0.5,
      intensity: 0,
    })
    expect(events[1]).toMatchObject({ type: 'audioCustom', resource: 'boom.wav', audioBrightness: 0.3, duration: 0 })
  })

  it('clamps curves by parameter range and sorts points', () => {
    const { curves } = normalizePattern({
      events: [],
      curves: [
        { parameter: 'intensity', time: 0, points: [{ time: 0.5, value: -1 }, { time: 0, value: 2 }] },
        { parameter: 'sharpness', time: 0.1, points: [{ time: 0, value: -2 }] },
        { parameter: 'audioPan', time: 0, points: [{ time: 0, value: -0.5 }] },
        { parameter: 'intensity', time: 0, points: [] },
      ],
    })
    expect(curves).toEqual([
      { parameter: 'intensity', time: 0, points: [{ time: 0, value: 1 }, { time: 0.5, value: 0 }] },
      { parameter: 'sharpness', time: 0.1, points: [{ time: 0, value: -1 }] },
      { parameter: 'audioPan', time: 0, points: [{ time: 0, value: -0.5 }] },
    ])
  })
})

describe('normalizePrimitives', () => {
  it('fills defaults and clamps', () => {
    expect(
      normalizePrimitives([
        { primitive: 'click' },
        { primitive: 'thud', scale: 3, delayMs: -5, delayType: 'relativeStartOffset' },
      ])
    ).toEqual([
      { primitive: 'click', scale: 1, delayMs: 0, delayType: 'pause' },
      { primitive: 'thud', scale: 1, delayMs: 0, delayType: 'relativeStartOffset' },
    ])
  })
})

describe('normalizeEnvelope', () => {
  it('flattens basic envelopes', () => {
    expect(
      normalizeEnvelope({
        kind: 'basic',
        points: [{ intensity: 2, sharpness: 0.4, durationMs: 50 }],
      })
    ).toEqual({
      kind: 'basic',
      initialValue: -1,
      points: [{ intensity: 1, sharpness: 0.4, frequencyHz: 0, durationMs: 50 }],
    })
  })

  it('flattens waveform envelopes', () => {
    expect(
      normalizeEnvelope({
        kind: 'waveform',
        initialFrequencyHz: 120,
        points: [{ amplitude: 0.5, frequencyHz: 200, durationMs: -1 }],
      })
    ).toEqual({
      kind: 'waveform',
      initialValue: 120,
      points: [{ intensity: 0.5, sharpness: 0, frequencyHz: 200, durationMs: 0 }],
    })
  })
})

describe('patternDuration', () => {
  it('is the end of the last event or curve point', () => {
    expect(
      patternDuration({
        events: [
          { type: 'transient', time: 0.9, intensity: 1, sharpness: 1 },
          { type: 'continuous', time: 0.2, duration: 0.5, intensity: 1, sharpness: 1 },
        ],
        curves: [{ parameter: 'intensity', time: 0.5, points: [{ time: 0.6, value: 1 }] }],
      })
    ).toBeCloseTo(1.1)
    expect(patternDuration({ events: [] })).toBe(0)
  })
})
