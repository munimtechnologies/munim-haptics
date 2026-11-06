package com.munimhaptics

import com.margelo.nitro.munimhaptics.HapticCurve
import com.margelo.nitro.munimhaptics.HapticCurveParameter
import com.margelo.nitro.munimhaptics.HapticEventType
import com.margelo.nitro.munimhaptics.NativeHapticPattern
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Turns a pattern into the (timings, amplitudes) pair that
 * VibrationEffect.createWaveform plays. The pattern is sampled on a 10 ms
 * grid: continuous events take their intensity times the intensity curve at
 * that moment, transients become 10-20 ms pulses (sharper is shorter) at
 * their own intensity, and equal neighbouring steps are merged.
 */
object HapticWaveform {
  const val STEP_MS = 10L

  /** Below this, without amplitude control, a continuous event stays off. */
  private const val ON_OFF_THRESHOLD = 0.6

  class Waveform(val timings: LongArray, val amplitudes: IntArray) {
    val isSilent: Boolean get() = amplitudes.all { it == 0 }
  }

  fun build(pattern: NativeHapticPattern, amplitudeControl: Boolean): Waveform {
    val events = pattern.events
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
    val intensityCurves = pattern.curves.filter { it.parameter == HapticCurveParameter.INTENSITY }

    for (event in events) {
      if (event.type != HapticEventType.CONTINUOUS || event.duration <= 0.0) continue
      val start = max(0.0, event.time)
      val end = start + event.duration
      for (step in 0 until steps) {
        val mid = (step + 0.5) * STEP_MS / 1000.0
        if (mid < start || mid >= end) continue
        var level = clamp01(event.intensity) * curveValue(intensityCurves, mid)
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

    // Merge runs of equal amplitude into single segments.
    val timings = ArrayList<Long>()
    val amplitudes = ArrayList<Int>()
    for (level in levels) {
      val amplitude = (clamp01(level) * 255.0).roundToInt()
      if (amplitudes.isNotEmpty() && amplitudes.last() == amplitude) {
        timings[timings.size - 1] = timings.last() + STEP_MS
      } else {
        timings.add(STEP_MS)
        amplitudes.add(amplitude)
      }
    }
    return Waveform(timings.toLongArray(), amplitudes.toIntArray())
  }

  /** Transient pulse length: 20 ms when soft, 10 ms when sharp. */
  private fun pulseMs(sharpness: Double): Double = 20.0 - 10.0 * clamp01(sharpness)

  /**
   * The intensity multiplier at `time` (seconds): the latest curve that has
   * started wins; before its first point nothing changes (1), after its last
   * point it holds the last value.
   */
  private fun curveValue(curves: List<HapticCurve>, time: Double): Double {
    var active: HapticCurve? = null
    for (curve in curves) {
      val firstTime = curve.time + (curve.points.minOfOrNull { it.time } ?: continue)
      if (firstTime <= time && (active == null || curve.time >= active.time)) active = curve
    }
    val curve = active ?: return 1.0
    val points = curve.points.sortedBy { it.time }
    val local = time - curve.time
    if (local <= points.first().time) return clamp01(points.first().value)
    for (index in 1 until points.size) {
      val a = points[index - 1]
      val b = points[index]
      if (local <= b.time) {
        val span = b.time - a.time
        val t = if (span <= 0.0) 1.0 else (local - a.time) / span
        return clamp01(a.value + (b.value - a.value) * t)
      }
    }
    return clamp01(points.last().value)
  }

  private fun clamp01(value: Double): Double = if (value.isNaN()) 0.0 else min(1.0, max(0.0, value))
}
