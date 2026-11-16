import { compilePattern, normalizePattern, playPattern, stop, type HapticPattern } from 'munim-haptics'

/**
 * A long, busy pattern: 64 faint taps over a rumble shaped by a 24-point
 * curve. Heavy enough that conversion costs show; faint enough to run
 * repeatedly.
 */
export const BENCH_PATTERN: HapticPattern = {
  events: [
    ...Array.from({ length: 64 }, (_, i) => ({
      type: 'transient' as const,
      time: i * 0.03,
      intensity: 0.15,
      sharpness: (i % 8) / 8,
    })),
    { type: 'continuous', time: 0, duration: 2, intensity: 0.15, sharpness: 0.3 },
  ],
  curves: [
    {
      parameter: 'intensity',
      time: 0,
      points: Array.from({ length: 24 }, (_, i) => ({ time: i * 0.08, value: i % 2 === 0 ? 0.4 : 1 })),
    },
  ],
}

export type BenchResult = {
  iterations: number
  /** Mean ms for normalizePattern alone (pure JavaScript). */
  normalizeMs: number
  /** Mean ms until playPattern resolves (normalize + bridge copy + native build + start). */
  playPatternMs: number
  /** Mean ms until a compiled pattern's play() resolves (start only). */
  compiledPlayMs: number
  /** One-off ms to compile the pattern. */
  compileMs: number
}

async function mean(iterations: number, body: () => Promise<void> | void): Promise<number> {
  // One warm-up round (engine start, JIT, first-call caches).
  await body()
  const start = performance.now()
  for (let i = 0; i < iterations; i++) await body()
  return (performance.now() - start) / iterations
}

/** Times playing the same pattern with and without compiling it first. */
export async function runBenchmark(iterations = 50): Promise<BenchResult> {
  const normalizeMs = await mean(iterations * 4, () => {
    normalizePattern(BENCH_PATTERN)
  })
  const playPatternMs = await mean(iterations, () => playPattern(BENCH_PATTERN, { fallback: true }))
  const compileStart = performance.now()
  const compiled = compilePattern(BENCH_PATTERN, { fallback: true })
  const compileMs = performance.now() - compileStart
  const compiledPlayMs = await mean(iterations, () => compiled.play())
  await stop()
  compiled.release()
  return { iterations, normalizeMs, playPatternMs, compiledPlayMs, compileMs }
}
