package com.munimhaptics

import com.margelo.nitro.munimhaptics.AndroidPrimitive
import com.margelo.nitro.munimhaptics.AndroidPrimitiveDelayType
import com.margelo.nitro.munimhaptics.HapticCurve
import com.margelo.nitro.munimhaptics.HapticCurveParameter
import com.margelo.nitro.munimhaptics.HapticEventType
import com.margelo.nitro.munimhaptics.NativeHapticEnvelope
import com.margelo.nitro.munimhaptics.NativeHapticPattern
import com.margelo.nitro.munimhaptics.NativePrimitiveStep
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.roundToLong

/**
 * Turns patterns, envelopes and primitive sequences into the
 * (timings, amplitudes) pairs that VibrationEffect.createWaveform plays.
 *
 * Patterns are sampled on a 10 ms grid: continuous events take their
 * intensity times the intensity curve at that moment (with attack / release
 * fades), transients become 10-20 ms pulses (sharper is shorter) at their
 * own intensity, and equal neighbouring steps are merged. Audio events are
 * skipped: Android vibrators play no sound.
 */
object HapticWaveform {
  const val STEP_MS = 10L

  /** Below this, without amplitude control, a continuous event stays off. */
  private const val ON_OFF_THRESHOLD = 0.6

  class Waveform(val timings: LongArray, val amplitudes: IntArray) {
    val isSilent: Boolean = amplitudes.all { it == 0 }
    val durationMs: Long = timings.sum()

    /** The part between `fromMs` and `toMs`. */
    fun slice(fromMs: Long, toMs: Long): Waveform {
      val out = Builder(this.timings.size)
      var start = 0L
      for (index in this.timings.indices) {
        val end = start + this.timings[index]
        val from = max(start, fromMs)
        val to = min(end, toMs)
        if (to > from) out.add(to - from, this.amplitudes[index])
        start = end
        if (start >= toMs) break
      }
      return out.build()
    }

    /** Amplitudes times `multiplier` (0..1). */
    fun scaled(multiplier: Double): Waveform {
      if (multiplier >= 1.0) return this
      val factor = clamp01(multiplier)
      return Waveform(timings, IntArray(amplitudes.size) { (amplitudes[it] * factor).roundToInt() })
    }

    /** Played `rate` times as fast. */
    fun stretched(rate: Double): Waveform {
      if (rate == 1.0 || rate <= 0.0 || rate.isNaN()) return this
      return Waveform(LongArray(timings.size) { max(1L, (timings[it] / rate).roundToLong()) }, amplitudes)
    }

    operator fun plus(other: Waveform): Waveform =
      Waveform(timings + other.timings, amplitudes + other.amplitudes)
  }

  /** Appends steps without boxing (no ArrayList<Long> / ArrayList<Int>). */
  private class Builder(capacity: Int) {
    private var timings = LongArray(max(4, capacity))
    private var amplitudes = IntArray(max(4, capacity))
    var size = 0
      private set

    fun add(timing: Long, amplitude: Int) {
      if (size == timings.size) {
        timings = timings.copyOf(size * 2)
        amplitudes = amplitudes.copyOf(size * 2)
      }
      timings[size] = timing
      amplitudes[size] = amplitude
      size++
    }

    /** Adds a step, or lengthens the last one when it has the same amplitude. */
    fun addMerging(timing: Long, amplitude: Int) {
      if (size > 0 && amplitudes[size - 1] == amplitude) {
        timings[size - 1] += timing
      } else {
        add(timing, amplitude)
      }
    }

    fun build() = Waveform(timings.copyOf(size), amplitudes.copyOf(size))
  }

  /** An intensity curve with its points sorted once, for fast lookups. */
  private class SortedCurve(curve: HapticCurve) {
    val start = curve.time
    private val times: DoubleArray
    private val values: DoubleArray

    init {
      val points = curve.points.sortedBy { it.time }
      times = DoubleArray(points.size) { points[it].time }
      values = DoubleArray(points.size) { points[it].value }
    }

    val isEmpty: Boolean get() = times.isEmpty()
    /** Pattern time (s) of the first point. */
    val firstTime: Double get() = start + times[0]

    /** The value at pattern time `time` (s), interpolated linearly. */
    fun valueAt(time: Double): Double {
      val local = time - start
      if (local <= times[0]) return clamp01(values[0])
      val last = times.size - 1
      if (local >= times[last]) return clamp01(values[last])
      // Binary search for the segment [a, b] that holds `local`.
      var low = 0
      var high = last
      while (high - low > 1) {
        val mid = (low + high) ushr 1
        if (times[mid] < local) low = mid else high = mid
      }
      val span = times[high] - times[low]
      val t = if (span <= 0.0) 1.0 else (local - times[low]) / span
      return clamp01(values[low] + (values[high] - values[low]) * t)
    }
  }

  // ─── Patterns ────────────────────────────────────────────────────────────

  fun build(pattern: NativeHapticPattern, amplitudeControl: Boolean): Waveform {
    val events = pattern.events.filter {
      it.type == HapticEventType.TRANSIENT || it.type == HapticEventType.CONTINUOUS
    }
    var endMs = 0.0
    for (event in events) {
      val startMs = max(0.0, event.time) * 1000.0
      endMs = if (event.type == HapticEventType.CONTINUOUS) {
        max(endMs, startMs + max(0.0, event.duration) * 1000.0)
      } else {
        max(endMs, startMs + pulseMs(event.sharpness))
      }
    }
    val steps = ceil(endMs / STEP_MS).toInt()
    if (steps <= 0) return Waveform(LongArray(0), IntArray(0))

    val levels = DoubleArray(steps)
    // The intensity curves' multiplier at each step, worked out once for all
    // events (not per event and step, re-sorting the points every time).
    val multipliers = curveMultipliers(pattern.curves, steps)

    for (event in events) {
      if (event.type != HapticEventType.CONTINUOUS || event.duration <= 0.0) continue
      val start = max(0.0, event.time)
      val end = start + event.duration
      // Core Haptics' attack / release are on a relative 0..1 scale; here
      // they fade in / out over up to half of the event.
      val attack = clamp01(event.attackTime ?: 0.0) * event.duration / 2.0
      val release = clamp01(event.releaseTime ?: 0.0) * event.duration / 2.0
      // Only the steps whose midpoint falls inside the event.
      val first = max(0, floor(start * 1000.0 / STEP_MS - 0.5).toInt())
      val last = min(steps, ceil(end * 1000.0 / STEP_MS - 0.5).toInt() + 1)
      for (step in first until last) {
        val mid = (step + 0.5) * STEP_MS / 1000.0
        if (mid < start || mid >= end) continue
        var level = clamp01(event.intensity) * (multipliers?.get(step) ?: 1.0)
        if (attack > 0.0 && mid - start < attack) level *= (mid - start) / attack
        if (release > 0.0 && end - mid < release) level *= (end - mid) / release
        if (!amplitudeControl) level = if (level >= ON_OFF_THRESHOLD) 1.0 else 0.0
        levels[step] = max(levels[step], level)
      }
    }

    for (event in events) {
      if (event.type != HapticEventType.TRANSIENT) continue
      val first = (max(0.0, event.time) * 1000.0 / STEP_MS).toInt()
      val count = max(1, (pulseMs(event.sharpness) / STEP_MS).roundToInt())
      val level = if (amplitudeControl) clamp01(event.intensity) else 1.0
      for (step in first until min(steps, first + count)) {
        levels[step] = max(levels[step], level)
      }
    }
    return merge(levels, STEP_MS)
  }

  /** Pattern length in milliseconds, as `build` samples it. */
  fun durationMs(pattern: NativeHapticPattern): Long = build(pattern, true).durationMs

  // ─── Envelopes (fallback before Android 16) ─────────────────────────────

  /**
   * An envelope sampled every 10 ms: intensity (basic) or amplitude
   * (waveform) ramps linearly from the previous control point (starting at
   * 0) to each point over its duration. Sharpness and frequency are lost.
   */
  fun fromEnvelope(envelope: NativeHapticEnvelope, amplitudeControl: Boolean): Waveform {
    val levels = ArrayList<Double>()
    var previous = 0.0
    var carry = 0.0
    for (point in envelope.points) {
      val target = clamp01(point.intensity)
      val durationMs = max(0.0, point.durationMs)
      // Steps at the midpoints of 10 ms slots, carrying the remainder over.
      val total = durationMs + carry
      val steps = (total / STEP_MS).toInt()
      for (step in 0 until steps) {
        val t = ((step + 0.5) * STEP_MS - carry) / max(durationMs, 1.0)
        levels.add(previous + (target - previous) * clamp01(t))
      }
      carry = total - steps * STEP_MS
      previous = target
    }
    val values = DoubleArray(levels.size) {
      val level = levels[it]
      if (amplitudeControl) level else if (level >= ON_OFF_THRESHOLD) 1.0 else 0.0
    }
    return merge(values, STEP_MS)
  }

  // ─── Primitives (fallback before Android 11, or when unsupported) ───────

  /** Approximate length (ms) and shape of each primitive as a plain pulse. */
  private fun primitiveShape(primitive: AndroidPrimitive): Pair<Int, (Double) -> Double> = when (primitive) {
    AndroidPrimitive.CLICK -> 12 to { _ -> 1.0 }
    AndroidPrimitive.TICK -> 6 to { _ -> 0.7 }
    AndroidPrimitive.LOWTICK -> 10 to { _ -> 0.5 }
    AndroidPrimitive.THUD -> 60 to { t -> 1.0 - 0.6 * t }
    AndroidPrimitive.SPIN -> 120 to { t -> 0.4 + 0.6 * (1.0 - kotlin.math.abs(2.0 * t - 1.0)) }
    AndroidPrimitive.QUICKRISE -> 80 to { t -> 0.1 + 0.9 * t }
    AndroidPrimitive.SLOWRISE -> 250 to { t -> 0.1 + 0.9 * t }
    AndroidPrimitive.QUICKFALL -> 80 to { t -> 1.0 - 0.9 * t }
  }

  /**
   * A primitive sequence on a 1 ms grid. `pause` delays count from the end
   * of the previous primitive, `relativeStartOffset` delays from its start
   * (a later primitive cuts an earlier one short).
   */
  fun fromPrimitives(steps: Array<NativePrimitiveStep>, amplitudeControl: Boolean): Waveform {
    data class Placed(val start: Int, val length: Int, val scale: Double, val shape: (Double) -> Double)
    val placed = ArrayList<Placed>()
    var previousStart = 0
    var previousEnd = 0
    for (step in steps) {
      val (length, shape) = primitiveShape(step.primitive)
      val delay = max(0, step.delayMs.roundToInt())
      val start = if (step.delayType == AndroidPrimitiveDelayType.RELATIVESTARTOFFSET && placed.isNotEmpty()) {
        previousStart + delay
      } else {
        previousEnd + delay
      }
      placed.add(Placed(start, length, clamp01(step.scale), shape))
      previousStart = start
      previousEnd = start + length
    }
    val total = placed.maxOfOrNull { it.start + it.length } ?: 0
    if (total <= 0) return Waveform(LongArray(0), IntArray(0))
    val levels = DoubleArray(total)
    for ((index, item) in placed.withIndex()) {
      val cut = placed.getOrNull(index + 1)?.start ?: Int.MAX_VALUE
      for (ms in item.start until min(item.start + item.length, cut)) {
        val t = (ms - item.start + 0.5) / item.length
        var level = item.scale * item.shape(t)
        if (!amplitudeControl) level = if (item.scale > 0.0) 1.0 else 0.0
        levels[ms] = clamp01(level)
      }
    }
    return merge(levels, 1L)
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Levels (0..1) per `stepMs` slot, with equal neighbours merged. */
  private fun merge(levels: DoubleArray, stepMs: Long): Waveform {
    val out = Builder(min(levels.size, 64))
    for (level in levels) {
      out.addMerging(stepMs, (clamp01(level) * 255.0).roundToInt())
    }
    return out.build()
  }

  /** Alternating off/on durations, starting with off, as the plain waveform APIs take. */
  fun onOffTimings(waveform: Waveform): LongArray {
    val onOff = ArrayList<Long>()
    var on = false
    for (index in waveform.timings.indices) {
      val isOn = waveform.amplitudes[index] > 0
      if (onOff.isEmpty() && isOn) onOff.add(0L)
      if (onOff.isNotEmpty() && isOn == on) {
        onOff[onOff.size - 1] = onOff.last() + waveform.timings[index]
      } else {
        onOff.add(waveform.timings[index])
        on = isOn
      }
    }
    return onOff.toLongArray()
  }

  /** Transient pulse length: 20 ms when soft, 10 ms when sharp. */
  private fun pulseMs(sharpness: Double): Double = 20.0 - 10.0 * clamp01(sharpness)

  /**
   * The intensity multiplier at the midpoint of every step, or null when the
   * pattern has no intensity curve. At each moment the latest curve that has
   * started wins; before its first point nothing changes (1), after its last
   * point it holds the last value.
   */
  private fun curveMultipliers(curves: Array<HapticCurve>, steps: Int): DoubleArray? {
    val sorted = curves.asSequence()
      .filter { it.parameter == HapticCurveParameter.INTENSITY }
      .map { SortedCurve(it) }
      .filter { !it.isEmpty }
      .toList()
    if (sorted.isEmpty()) return null
    val result = DoubleArray(steps)
    for (step in 0 until steps) {
      val time = (step + 0.5) * STEP_MS / 1000.0
      var active: SortedCurve? = null
      for (curve in sorted) {
        if (curve.firstTime <= time && (active == null || curve.start >= active.start)) active = curve
      }
      result[step] = active?.valueAt(time) ?: 1.0
    }
    return result
  }

  fun clamp01(value: Double): Double = if (value.isNaN()) 0.0 else min(1.0, max(0.0, value))
}
