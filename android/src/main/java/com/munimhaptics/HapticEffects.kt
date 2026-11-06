package com.munimhaptics

import android.os.Build
import android.os.VibrationEffect
import android.view.HapticFeedbackConstants
import com.margelo.nitro.NitroModules
import com.margelo.nitro.munimhaptics.AndroidEffectSupport
import com.margelo.nitro.munimhaptics.AndroidEnvelopeKind
import com.margelo.nitro.munimhaptics.AndroidHapticFeedback
import com.margelo.nitro.munimhaptics.AndroidPredefinedEffect
import com.margelo.nitro.munimhaptics.AndroidPrimitive
import com.margelo.nitro.munimhaptics.AndroidPrimitiveDelayType
import com.margelo.nitro.munimhaptics.ImpactStyle
import com.margelo.nitro.munimhaptics.NativeHapticEnvelope
import com.margelo.nitro.munimhaptics.NativePrimitiveStep
import com.margelo.nitro.munimhaptics.NativeVibrationOptions
import com.margelo.nitro.munimhaptics.NotificationFeedbackType
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.roundToLong

/** Predefined effects, primitive compositions, envelopes and view feedback. */
object HapticEffects {
  private val host = VibratorHost

  // ─── One-shots and waveforms ─────────────────────────────────────────────

  /** `amplitude` 1..255, or <= 0 for the device default. */
  fun oneShot(durationMs: Double, amplitude: Double, options: NativeVibrationOptions) {
    val duration = max(1L, durationMs.roundToLong())
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val value = if (amplitude <= 0.0 || amplitude.isNaN() || !host.hasAmplitudeControl) {
        VibrationEffect.DEFAULT_AMPLITUDE
      } else {
        min(255, max(1, amplitude.roundToInt()))
      }
      host.vibrate(VibrationEffect.createOneShot(duration, value), options)
    } else {
      host.vibrateLegacy(longArrayOf(0L, duration), -1)
    }
  }

  /**
   * `createWaveform(timings, amplitudes, repeat)`. With no amplitudes the
   * timings alternate off / on, starting with off.
   */
  fun waveform(timingsMs: DoubleArray, amplitudes: DoubleArray, repeatIndex: Int, options: NativeVibrationOptions) {
    val timings = LongArray(timingsMs.size) { max(0L, timingsMs[it].roundToLong()) }
    if (timings.isEmpty() || timings.sum() <= 0L) return
    val repeat = if (repeatIndex in timings.indices) repeatIndex else -1
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      host.vibrateLegacy(timings, repeat)
      return
    }
    val effect = if (amplitudes.isEmpty()) {
      VibrationEffect.createWaveform(timings, repeat)
    } else {
      require(amplitudes.size == timings.size) { "timings and amplitudes must have the same length" }
      val values = IntArray(amplitudes.size) {
        val value = amplitudes[it]
        if (value < 0.0) VibrationEffect.DEFAULT_AMPLITUDE else min(255, value.roundToInt())
      }
      VibrationEffect.createWaveform(timings, values, repeat)
    }
    host.vibrate(effect, options)
  }

  // ─── Predefined effects ──────────────────────────────────────────────────

  /** A short pulse standing in for each predefined effect. */
  private fun predefinedFallback(effect: AndroidPredefinedEffect): Array<NativePrimitiveStep> = when (effect) {
    AndroidPredefinedEffect.CLICK -> arrayOf(step(AndroidPrimitive.CLICK, 0.8))
    AndroidPredefinedEffect.TICK -> arrayOf(step(AndroidPrimitive.TICK, 0.7))
    AndroidPredefinedEffect.HEAVYCLICK -> arrayOf(step(AndroidPrimitive.CLICK, 1.0))
    AndroidPredefinedEffect.DOUBLECLICK -> arrayOf(step(AndroidPrimitive.CLICK, 0.8), step(AndroidPrimitive.CLICK, 0.8, 100.0))
  }

  /**
   * Plays a predefined effect. When the device says it doesn't support it,
   * `fallback` plays a close pulse instead (and the result is true); without
   * fallback nothing plays and the result is false.
   */
  fun predefined(effect: AndroidPredefinedEffect, fallback: Boolean, options: NativeVibrationOptions): Boolean {
    if (!host.hasVibrator) return false
    val id = host.effectId(effect)
    // Support is only known from Android 11; on 10 it reads 'unknown' and
    // createPredefined picks a generic vibration if the effect is missing.
    if (id != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
      host.effectSupport(effect) != AndroidEffectSupport.UNSUPPORTED
    ) {
      host.vibrate(VibrationEffect.createPredefined(id), options)
      return true
    }
    if (!fallback) return false
    return primitives(predefinedFallback(effect), true, options)
  }

  // ─── Primitives ──────────────────────────────────────────────────────────

  private fun step(
    primitive: AndroidPrimitive,
    scale: Double,
    delayMs: Double = 0.0,
  ) = NativePrimitiveStep(primitive, scale, delayMs, AndroidPrimitiveDelayType.PAUSE)

  /**
   * `VibrationEffect.startComposition()`. When any primitive in the
   * sequence isn't supported: with `fallback`, a waveform of similar pulses
   * plays instead (result true); without it nothing plays (result false).
   */
  fun primitives(steps: Array<NativePrimitiveStep>, fallback: Boolean, options: NativeVibrationOptions): Boolean {
    if (steps.isEmpty() || !host.hasVibrator) return false
    val allSupported = steps.all { host.isPrimitiveSupported(it.primitive) }
    if (allSupported && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val composition = VibrationEffect.startComposition()
      for (item in steps) {
        val id = host.primitiveId(item.primitive) ?: continue
        val scale = HapticWaveform.clamp01(item.scale).toFloat()
        val delay = max(0, item.delayMs.roundToInt())
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.BAKLAVA) {
          val type = if (item.delayType == AndroidPrimitiveDelayType.RELATIVESTARTOFFSET) {
            VibrationEffect.Composition.DELAY_TYPE_RELATIVE_START_OFFSET
          } else {
            VibrationEffect.Composition.DELAY_TYPE_PAUSE
          }
          composition.addPrimitive(id, scale, delay, type)
        } else {
          composition.addPrimitive(id, scale, delay)
        }
      }
      host.vibrate(composition.compose(), options)
      return true
    }
    if (!fallback) return false
    val waveform = HapticWaveform.fromPrimitives(steps, host.hasAmplitudeControl)
    host.playWaveform(waveform, -1, options)
    return true
  }

  // ─── Envelopes ───────────────────────────────────────────────────────────

  /** Native envelope on Android 16+ when supported, a sampled waveform otherwise. */
  fun envelope(envelope: NativeHapticEnvelope, options: NativeVibrationOptions) {
    if (envelope.points.isEmpty() || !host.hasVibrator) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.BAKLAVA && host.supportsEnvelopeEffects) {
      val effect = try {
        nativeEnvelope(envelope)
      } catch (_: Throwable) {
        null // Outside the vibrator's limits: fall back below.
      }
      if (effect != null) {
        host.vibrate(effect, options)
        return
      }
    }
    host.playWaveform(HapticWaveform.fromEnvelope(envelope, host.hasAmplitudeControl), -1, options)
  }

  private fun nativeEnvelope(envelope: NativeHapticEnvelope): VibrationEffect? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.BAKLAVA) return null
    val info = host.vibrator?.envelopeEffectInfo ?: return null
    if (envelope.points.size > info.maxSize) return null
    val minPoint = info.minControlPointDurationMillis
    val maxPoint = info.maxControlPointDurationMillis
    fun duration(ms: Double): Long = min(maxPoint, max(minPoint, ms.roundToLong()))
    val total = envelope.points.sumOf { duration(it.durationMs) }
    if (info.maxDurationMillis > 0 && total > info.maxDurationMillis) return null

    return if (envelope.kind == AndroidEnvelopeKind.WAVEFORM) {
      val builder = VibrationEffect.WaveformEnvelopeBuilder()
      if (envelope.initialValue > 0.0) builder.setInitialFrequencyHz(envelope.initialValue.toFloat())
      for (point in envelope.points) {
        builder.addControlPoint(
          HapticWaveform.clamp01(point.intensity).toFloat(),
          point.frequencyHz.toFloat(),
          duration(point.durationMs)
        )
      }
      builder.build()
    } else {
      val builder = VibrationEffect.BasicEnvelopeBuilder()
      if (envelope.initialValue >= 0.0) builder.setInitialSharpness(HapticWaveform.clamp01(envelope.initialValue).toFloat())
      for (point in envelope.points) {
        builder.addControlPoint(
          HapticWaveform.clamp01(point.intensity).toFloat(),
          HapticWaveform.clamp01(point.sharpness).toFloat(),
          duration(point.durationMs)
        )
      }
      builder.build()
    }
  }

  // ─── iOS-style feedback ──────────────────────────────────────────────────

  /**
   * The closest Android effect to UIImpactFeedbackGenerator's styles: a
   * click / tick primitive scaled by `intensity` where primitives are
   * supported, a predefined effect or a short pulse otherwise.
   */
  fun impact(style: ImpactStyle, intensity: Double) {
    val strength = if (intensity < 0.0 || intensity.isNaN()) 1.0 else HapticWaveform.clamp01(intensity)
    val (primitive, scale) = when (style) {
      ImpactStyle.LIGHT -> AndroidPrimitive.CLICK to 0.5
      ImpactStyle.MEDIUM -> AndroidPrimitive.CLICK to 0.8
      ImpactStyle.HEAVY -> AndroidPrimitive.CLICK to 1.0
      ImpactStyle.SOFT -> (if (host.isPrimitiveSupported(AndroidPrimitive.LOWTICK)) AndroidPrimitive.LOWTICK else AndroidPrimitive.TICK) to 1.0
      ImpactStyle.RIGID -> AndroidPrimitive.TICK to 1.0
    }
    if (host.isPrimitiveSupported(primitive)) {
      primitives(arrayOf(step(primitive, scale * strength)), false, host.touchOptions)
      return
    }
    // Full-strength calls can use the tuned predefined effects.
    if (strength >= 1.0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val effect = when (style) {
        ImpactStyle.LIGHT, ImpactStyle.SOFT -> AndroidPredefinedEffect.TICK
        ImpactStyle.MEDIUM, ImpactStyle.RIGID -> AndroidPredefinedEffect.CLICK
        ImpactStyle.HEAVY -> AndroidPredefinedEffect.HEAVYCLICK
      }
      if (host.effectSupport(effect) != AndroidEffectSupport.UNSUPPORTED) {
        predefined(effect, false, host.touchOptions)
        return
      }
    }
    primitives(arrayOf(step(primitive, scale * strength)), true, host.touchOptions)
  }

  /** UINotificationFeedbackGenerator's success / warning / error as click sequences. */
  fun notification(type: NotificationFeedbackType) {
    val steps = when (type) {
      NotificationFeedbackType.SUCCESS -> arrayOf(
        step(AndroidPrimitive.CLICK, 0.6),
        step(AndroidPrimitive.CLICK, 1.0, 100.0),
      )
      NotificationFeedbackType.WARNING -> arrayOf(
        step(AndroidPrimitive.CLICK, 1.0),
        step(AndroidPrimitive.CLICK, 0.6, 150.0),
      )
      NotificationFeedbackType.ERROR -> arrayOf(
        step(AndroidPrimitive.CLICK, 0.8),
        step(AndroidPrimitive.CLICK, 0.8, 70.0),
        step(AndroidPrimitive.CLICK, 1.0, 70.0),
        step(AndroidPrimitive.CLICK, 0.6, 70.0),
      )
    }
    primitives(steps, true, host.touchOptions)
  }

  /** UISelectionFeedbackGenerator: a light tick. */
  fun selection() {
    if (host.isPrimitiveSupported(AndroidPrimitive.TICK)) {
      primitives(arrayOf(step(AndroidPrimitive.TICK, 0.6)), false, host.touchOptions)
    } else if (host.effectSupport(AndroidPredefinedEffect.TICK) != AndroidEffectSupport.UNSUPPORTED) {
      predefined(AndroidPredefinedEffect.TICK, true, host.touchOptions)
    } else {
      primitives(arrayOf(step(AndroidPrimitive.TICK, 0.6)), true, host.touchOptions)
    }
  }

  // ─── View haptic feedback ────────────────────────────────────────────────

  /** The constant and the API level that added it. */
  private fun feedbackConstant(feedback: AndroidHapticFeedback): Pair<Int, Int> = when (feedback) {
    AndroidHapticFeedback.LONGPRESS -> HapticFeedbackConstants.LONG_PRESS to 3
    AndroidHapticFeedback.VIRTUALKEY -> HapticFeedbackConstants.VIRTUAL_KEY to 5
    AndroidHapticFeedback.KEYBOARDTAP -> HapticFeedbackConstants.KEYBOARD_TAP to 8
    AndroidHapticFeedback.CLOCKTICK -> HapticFeedbackConstants.CLOCK_TICK to 21
    AndroidHapticFeedback.CONTEXTCLICK -> HapticFeedbackConstants.CONTEXT_CLICK to 23
    AndroidHapticFeedback.KEYBOARDPRESS -> HapticFeedbackConstants.KEYBOARD_PRESS to 27
    AndroidHapticFeedback.KEYBOARDRELEASE -> HapticFeedbackConstants.KEYBOARD_RELEASE to 27
    AndroidHapticFeedback.VIRTUALKEYRELEASE -> HapticFeedbackConstants.VIRTUAL_KEY_RELEASE to 27
    AndroidHapticFeedback.TEXTHANDLEMOVE -> HapticFeedbackConstants.TEXT_HANDLE_MOVE to 27
    AndroidHapticFeedback.GESTURESTART -> HapticFeedbackConstants.GESTURE_START to 30
    AndroidHapticFeedback.GESTUREEND -> HapticFeedbackConstants.GESTURE_END to 30
    AndroidHapticFeedback.CONFIRM -> HapticFeedbackConstants.CONFIRM to 30
    AndroidHapticFeedback.REJECT -> HapticFeedbackConstants.REJECT to 30
    AndroidHapticFeedback.TOGGLEON -> HapticFeedbackConstants.TOGGLE_ON to 34
    AndroidHapticFeedback.TOGGLEOFF -> HapticFeedbackConstants.TOGGLE_OFF to 34
    AndroidHapticFeedback.GESTURETHRESHOLDACTIVATE -> HapticFeedbackConstants.GESTURE_THRESHOLD_ACTIVATE to 34
    AndroidHapticFeedback.GESTURETHRESHOLDDEACTIVATE -> HapticFeedbackConstants.GESTURE_THRESHOLD_DEACTIVATE to 34
    AndroidHapticFeedback.DRAGSTART -> HapticFeedbackConstants.DRAG_START to 34
    AndroidHapticFeedback.SEGMENTTICK -> HapticFeedbackConstants.SEGMENT_TICK to 34
    AndroidHapticFeedback.SEGMENTFREQUENTTICK -> HapticFeedbackConstants.SEGMENT_FREQUENT_TICK to 34
    AndroidHapticFeedback.NOHAPTICS -> HapticFeedbackConstants.NO_HAPTICS to 34
  }

  /** The nearest older constant, for API levels that lack `feedback`. */
  private fun olderFeedback(feedback: AndroidHapticFeedback): AndroidHapticFeedback? = when (feedback) {
    AndroidHapticFeedback.CLOCKTICK -> AndroidHapticFeedback.KEYBOARDTAP
    AndroidHapticFeedback.CONTEXTCLICK -> AndroidHapticFeedback.VIRTUALKEY
    AndroidHapticFeedback.KEYBOARDPRESS -> AndroidHapticFeedback.KEYBOARDTAP
    AndroidHapticFeedback.TEXTHANDLEMOVE -> AndroidHapticFeedback.CLOCKTICK
    AndroidHapticFeedback.GESTURESTART, AndroidHapticFeedback.GESTUREEND -> AndroidHapticFeedback.CONTEXTCLICK
    AndroidHapticFeedback.CONFIRM -> AndroidHapticFeedback.VIRTUALKEY
    AndroidHapticFeedback.REJECT -> AndroidHapticFeedback.LONGPRESS
    AndroidHapticFeedback.TOGGLEON, AndroidHapticFeedback.GESTURETHRESHOLDACTIVATE -> AndroidHapticFeedback.CONFIRM
    AndroidHapticFeedback.TOGGLEOFF, AndroidHapticFeedback.GESTURETHRESHOLDDEACTIVATE -> AndroidHapticFeedback.CLOCKTICK
    AndroidHapticFeedback.DRAGSTART -> AndroidHapticFeedback.LONGPRESS
    AndroidHapticFeedback.SEGMENTTICK -> AndroidHapticFeedback.CLOCKTICK
    AndroidHapticFeedback.SEGMENTFREQUENTTICK -> AndroidHapticFeedback.TEXTHANDLEMOVE
    else -> null // The *_RELEASE constants and NO_HAPTICS have no audible stand-in.
  }

  /**
   * View.performHapticFeedback on the current activity's decor view (on the
   * UI thread). Follows the system's touch-feedback setting. Calls back
   * false when there's no activity or the constant isn't available on this
   * API level (and `fallback` finds no older one).
   */
  fun performHapticFeedback(feedback: AndroidHapticFeedback, fallback: Boolean, done: (Boolean) -> Unit) {
    var chosen: AndroidHapticFeedback? = feedback
    while (chosen != null && Build.VERSION.SDK_INT < feedbackConstant(chosen).second) {
      chosen = if (fallback) olderFeedback(chosen) else null
    }
    val activity = NitroModules.applicationContext?.currentActivity
    if (chosen == null || activity == null) {
      done(false)
      return
    }
    val constant = feedbackConstant(chosen).first
    activity.runOnUiThread {
      val view = activity.window?.decorView
      done(view?.performHapticFeedback(constant) == true)
    }
  }
}
