import { normalizePattern, patternDuration } from '../pattern'
import { getPresetPattern, presetNames } from '../presets'

describe('presets', () => {
  it('has a stable list of names', () => {
    expect(presetNames.length).toBeGreaterThanOrEqual(20)
    expect(new Set(presetNames).size).toBe(presetNames.length)
  })

  it.each(presetNames)('%s is a valid, playable pattern', (name) => {
    const pattern = getPresetPattern(name)
    const normalized = normalizePattern(pattern)
    // Nothing is clamped or dropped: the preset is already in range.
    expect(normalized.events).toHaveLength(pattern.events.length)
    for (const event of pattern.events) {
      if (event.type === 'transient' || event.type === 'continuous') {
        expect(event.intensity).toBeGreaterThanOrEqual(0)
        expect(event.intensity).toBeLessThanOrEqual(1)
        expect(event.sharpness).toBeGreaterThanOrEqual(0)
        expect(event.sharpness).toBeLessThanOrEqual(1)
      }
    }
    for (const curve of pattern.curves ?? []) {
      // Core Haptics allows 16 points per curve; presets stay within one.
      expect(curve.points.length).toBeLessThanOrEqual(16)
      for (const point of curve.points) {
        expect(point.value).toBeGreaterThanOrEqual(0)
        expect(point.value).toBeLessThanOrEqual(1)
      }
    }
    const duration = patternDuration(pattern)
    // Short UI feedback: no preset runs longer than 1.5 s.
    expect(duration).toBeLessThanOrEqual(1.5)
  })

  it('returns copies', () => {
    const a = getPresetPattern('heartbeat')
    a.events.length = 0
    expect(getPresetPattern('heartbeat').events.length).toBeGreaterThan(0)
    const b = getPresetPattern('rumble')
    b.curves![0]!.points[0]!.value = 0.99
    expect(getPresetPattern('rumble').curves![0]!.points[0]!.value).toBe(0.2)
  })

  it('rejects unknown names', () => {
    expect(() => getPresetPattern('nope' as never)).toThrow('unknown preset')
  })
})
