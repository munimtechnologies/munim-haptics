import { buildAHAP, parseAHAP } from '../ahap'
import type { HapticPattern } from '../types'

const pattern: HapticPattern = {
  events: [
    { type: 'transient', time: 0, intensity: 0.8, sharpness: 0.4 },
    {
      type: 'continuous',
      time: 0.1,
      duration: 0.5,
      intensity: 1,
      sharpness: 0.2,
      attackTime: 0.3,
      sustained: false,
    },
    { type: 'audioCustom', time: 0.2, resource: 'Boom.wav', volume: 0.5 },
    { type: 'audioContinuous', time: 0.3, duration: 0.2, pitch: -0.5 },
  ],
  curves: [
    {
      parameter: 'intensity',
      time: 0,
      points: [
        { time: 0, value: 0.2 },
        { time: 0.5, value: 1 },
      ],
    },
  ],
}

describe('buildAHAP', () => {
  it('writes events and curves in AHAP form', () => {
    const ahap = buildAHAP(pattern, { Project: 'test' })
    expect(ahap.Version).toBe(1)
    expect(ahap.Metadata).toEqual({ Project: 'test' })
    expect(ahap.Pattern[0]).toEqual({
      Event: {
        Time: 0,
        EventType: 'HapticTransient',
        EventParameters: [
          { ParameterID: 'HapticIntensity', ParameterValue: 0.8 },
          { ParameterID: 'HapticSharpness', ParameterValue: 0.4 },
        ],
      },
    })
    expect(ahap.Pattern[1]).toEqual({
      Event: {
        Time: 0.1,
        EventType: 'HapticContinuous',
        EventDuration: 0.5,
        EventParameters: [
          { ParameterID: 'HapticIntensity', ParameterValue: 1 },
          { ParameterID: 'HapticSharpness', ParameterValue: 0.2 },
          { ParameterID: 'AttackTime', ParameterValue: 0.3 },
          { ParameterID: 'Sustained', ParameterValue: 0 },
        ],
      },
    })
    expect(ahap.Pattern[2]).toEqual({
      Event: {
        Time: 0.2,
        EventType: 'AudioCustom',
        EventWaveformPath: 'Boom.wav',
        EventParameters: [{ ParameterID: 'AudioVolume', ParameterValue: 0.5 }],
      },
    })
    expect(ahap.Pattern[4]).toEqual({
      ParameterCurve: {
        ParameterID: 'HapticIntensityControl',
        Time: 0,
        ParameterCurveControlPoints: [
          { Time: 0, ParameterValue: 0.2 },
          { Time: 0.5, ParameterValue: 1 },
        ],
      },
    })
  })

  it('round-trips through parseAHAP', () => {
    expect(parseAHAP(JSON.stringify(buildAHAP(pattern)))).toEqual(pattern)
  })
})

describe('parseAHAP', () => {
  it('uses Core Haptics defaults for missing parameters', () => {
    const parsed = parseAHAP({
      Version: 1,
      Pattern: [{ Event: { Time: 0.25, EventType: 'HapticTransient' } }],
    })
    expect(parsed).toEqual({
      events: [{ type: 'transient', time: 0.25, intensity: 1, sharpness: 0.5 }],
    })
  })

  it('turns single Parameter entries into one-point curves', () => {
    const parsed = parseAHAP({
      Version: 1,
      Pattern: [
        { Parameter: { ParameterID: 'HapticSharpnessControl', Time: 0.4, ParameterValue: -3 } },
        { Parameter: { ParameterID: 'AudioAttackTimeControl', Time: 0, ParameterValue: 0.5 } },
      ],
    })
    expect(parsed.curves).toEqual([
      { parameter: 'sharpness', time: 0.4, points: [{ time: 0, value: -1 }] },
    ])
  })

  it('rejects malformed documents', () => {
    expect(() => parseAHAP('{"Version":1}')).toThrow(/Pattern array/)
    expect(() => parseAHAP('not json')).toThrow()
    expect(() =>
      parseAHAP({ Pattern: [{ Event: { Time: 0, EventType: 'HapticContinuous' } }] })
    ).toThrow(/EventDuration/)
    expect(() => parseAHAP({ Pattern: [{ Event: { Time: 0, EventType: 'Sparkle' } }] })).toThrow(
      /unknown EventType/
    )
  })
})
