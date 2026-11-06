package com.munimhaptics

import android.content.Context
import android.media.AudioAttributes
import android.os.Build
import android.os.CombinedVibration
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import com.margelo.nitro.NitroModules
import com.margelo.nitro.munimhaptics.AndroidEffectInfo
import com.margelo.nitro.munimhaptics.AndroidEffectSupport
import com.margelo.nitro.munimhaptics.AndroidPredefinedEffect
import com.margelo.nitro.munimhaptics.AndroidPrimitive
import com.margelo.nitro.munimhaptics.AndroidPrimitiveInfo
import com.margelo.nitro.munimhaptics.AndroidVibrationUsage
import com.margelo.nitro.munimhaptics.HapticCapabilities
import com.margelo.nitro.munimhaptics.NativeVibrationOptions

/** The device's vibrator(s), and how effects reach them. */
object VibratorHost {
  val context: Context? get() = NitroModules.applicationContext

  private val manager: VibratorManager? by lazy {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@lazy null
    context?.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
  }

  val vibrator: Vibrator? by lazy {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      manager?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      context?.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }
  }

  val hasVibrator: Boolean get() = vibrator?.hasVibrator() == true

  val hasAmplitudeControl: Boolean
    get() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && vibrator?.hasAmplitudeControl() == true

  /** Plain vibration, no attributes (how 0.1.0 played patterns). */
  val defaultOptions = NativeVibrationOptions(AndroidVibrationUsage.UNKNOWN, DoubleArray(0))

  /** Touch feedback: follows the system's touch-feedback setting and intensity. */
  val touchOptions = NativeVibrationOptions(AndroidVibrationUsage.TOUCH, DoubleArray(0))

  // ─── Playing ─────────────────────────────────────────────────────────────

  /** Plays `effect` (API 26+) on the chosen vibrators with the chosen usage. */
  fun vibrate(effect: VibrationEffect, options: NativeVibrationOptions) {
    val vibrator = vibrator ?: return
    val ids = options.vibratorIds.map { it.toInt() }
    if (ids.isNotEmpty() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val manager = manager
      if (manager != null) {
        val known = manager.vibratorIds.toSet()
        val combination = CombinedVibration.startParallel()
        var any = false
        for (id in ids) {
          if (id in known) {
            combination.addVibrator(id, effect)
            any = true
          }
        }
        if (any) {
          val attributes = vibrationAttributes(options.usage)
          if (attributes != null) manager.vibrate(combination.combine(), attributes)
          else manager.vibrate(combination.combine())
          return
        }
      }
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val attributes = vibrationAttributes(options.usage)
      if (attributes != null) {
        vibrator.vibrate(effect, attributes)
        return
      }
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val audio = audioAttributes(options.usage)
      if (audio != null) {
        @Suppress("DEPRECATION")
        vibrator.vibrate(effect, audio)
        return
      }
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) vibrator.vibrate(effect)
  }

  /** On/off timings for API 24-25 (no VibrationEffect). */
  fun vibrateLegacy(timings: LongArray, repeat: Int) {
    if (timings.isEmpty()) return
    @Suppress("DEPRECATION")
    vibrator?.vibrate(timings, repeat)
  }

  /** A waveform at the best fidelity the device has. */
  fun playWaveform(waveform: HapticWaveform.Waveform, repeat: Int, options: NativeVibrationOptions) {
    if (waveform.timings.isEmpty() || waveform.durationMs <= 0L) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      vibrate(VibrationEffect.createWaveform(waveform.timings, waveform.amplitudes, repeat), options)
    } else {
      // No amplitudes: on/off, and the repeat index no longer lines up.
      vibrateLegacy(HapticWaveform.onOffTimings(waveform), if (repeat >= 0) 0 else -1)
    }
  }

  fun cancel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val manager = manager
      if (manager != null) {
        manager.cancel()
        return
      }
    }
    vibrator?.cancel()
  }

  private fun usageValue(usage: AndroidVibrationUsage): Int? = when (usage) {
    AndroidVibrationUsage.UNKNOWN -> null
    AndroidVibrationUsage.TOUCH -> VibrationAttributes.USAGE_TOUCH
    AndroidVibrationUsage.NOTIFICATION -> VibrationAttributes.USAGE_NOTIFICATION
    AndroidVibrationUsage.ALARM -> VibrationAttributes.USAGE_ALARM
    AndroidVibrationUsage.RINGTONE -> VibrationAttributes.USAGE_RINGTONE
    AndroidVibrationUsage.MEDIA -> VibrationAttributes.USAGE_MEDIA
    AndroidVibrationUsage.COMMUNICATIONREQUEST -> VibrationAttributes.USAGE_COMMUNICATION_REQUEST
    AndroidVibrationUsage.HARDWAREFEEDBACK -> VibrationAttributes.USAGE_HARDWARE_FEEDBACK
    AndroidVibrationUsage.PHYSICALEMULATION -> VibrationAttributes.USAGE_PHYSICAL_EMULATION
    AndroidVibrationUsage.ACCESSIBILITY -> VibrationAttributes.USAGE_ACCESSIBILITY
  }

  private fun vibrationAttributes(usage: AndroidVibrationUsage): VibrationAttributes? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      // VibratorManager on 12 / 12L: no attributes (createForUsage is 13+).
      return null
    }
    val value = usageValue(usage) ?: return null
    return VibrationAttributes.createForUsage(value)
  }

  /** Before Android 13, usage travels as AudioAttributes. */
  @Suppress("DEPRECATION")
  private fun audioAttributes(usage: AndroidVibrationUsage): AudioAttributes? {
    val value = when (usage) {
      AndroidVibrationUsage.UNKNOWN -> return null
      AndroidVibrationUsage.TOUCH,
      AndroidVibrationUsage.HARDWAREFEEDBACK,
      AndroidVibrationUsage.PHYSICALEMULATION -> AudioAttributes.USAGE_ASSISTANCE_SONIFICATION
      AndroidVibrationUsage.NOTIFICATION -> AudioAttributes.USAGE_NOTIFICATION
      AndroidVibrationUsage.ALARM -> AudioAttributes.USAGE_ALARM
      AndroidVibrationUsage.RINGTONE -> AudioAttributes.USAGE_NOTIFICATION_RINGTONE
      AndroidVibrationUsage.MEDIA -> AudioAttributes.USAGE_MEDIA
      AndroidVibrationUsage.COMMUNICATIONREQUEST -> AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_REQUEST
      AndroidVibrationUsage.ACCESSIBILITY -> AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY
    }
    return AudioAttributes.Builder()
      .setUsage(value)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
  }

  // ─── Primitives and effects ──────────────────────────────────────────────

  /** `VibrationEffect.Composition.PRIMITIVE_*`, or null before the API level that added it. */
  fun primitiveId(primitive: AndroidPrimitive): Int? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return null
    return when (primitive) {
      AndroidPrimitive.CLICK -> VibrationEffect.Composition.PRIMITIVE_CLICK
      AndroidPrimitive.QUICKRISE -> VibrationEffect.Composition.PRIMITIVE_QUICK_RISE
      AndroidPrimitive.SLOWRISE -> VibrationEffect.Composition.PRIMITIVE_SLOW_RISE
      AndroidPrimitive.QUICKFALL -> VibrationEffect.Composition.PRIMITIVE_QUICK_FALL
      AndroidPrimitive.TICK -> VibrationEffect.Composition.PRIMITIVE_TICK
      AndroidPrimitive.THUD,
      AndroidPrimitive.SPIN,
      AndroidPrimitive.LOWTICK -> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return null
        when (primitive) {
          AndroidPrimitive.THUD -> VibrationEffect.Composition.PRIMITIVE_THUD
          AndroidPrimitive.SPIN -> VibrationEffect.Composition.PRIMITIVE_SPIN
          else -> VibrationEffect.Composition.PRIMITIVE_LOW_TICK
        }
      }
    }
  }

  fun isPrimitiveSupported(primitive: AndroidPrimitive): Boolean {
    val id = primitiveId(primitive) ?: return false
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return false
    return vibrator?.arePrimitivesSupported(id)?.firstOrNull() == true
  }

  /** `VibrationEffect.EFFECT_*`, or null before Android 10. */
  fun effectId(effect: AndroidPredefinedEffect): Int? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null
    return when (effect) {
      AndroidPredefinedEffect.CLICK -> VibrationEffect.EFFECT_CLICK
      AndroidPredefinedEffect.DOUBLECLICK -> VibrationEffect.EFFECT_DOUBLE_CLICK
      AndroidPredefinedEffect.TICK -> VibrationEffect.EFFECT_TICK
      AndroidPredefinedEffect.HEAVYCLICK -> VibrationEffect.EFFECT_HEAVY_CLICK
    }
  }

  fun effectSupport(effect: AndroidPredefinedEffect): AndroidEffectSupport {
    val id = effectId(effect) ?: return AndroidEffectSupport.UNSUPPORTED
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return AndroidEffectSupport.UNKNOWN
    return when (vibrator?.areEffectsSupported(id)?.firstOrNull()) {
      Vibrator.VIBRATION_EFFECT_SUPPORT_YES -> AndroidEffectSupport.SUPPORTED
      Vibrator.VIBRATION_EFFECT_SUPPORT_NO -> AndroidEffectSupport.UNSUPPORTED
      else -> AndroidEffectSupport.UNKNOWN
    }
  }

  val supportsEnvelopeEffects: Boolean
    get() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.BAKLAVA && vibrator?.areEnvelopeEffectsSupported() == true

  // ─── Capabilities ────────────────────────────────────────────────────────

  fun capabilities(): HapticCapabilities {
    val vibrator = vibrator
    val hasVibrator = vibrator?.hasVibrator() == true
    val sdk = Build.VERSION.SDK_INT

    val primitives = AndroidPrimitive.values().map { primitive ->
      val supported = hasVibrator && isPrimitiveSupported(primitive)
      var duration = 0.0
      val id = primitiveId(primitive)
      if (supported && id != null && sdk >= Build.VERSION_CODES.S) {
        duration = (vibrator.getPrimitiveDurations(id).firstOrNull() ?: 0).toDouble()
      }
      AndroidPrimitiveInfo(primitive, supported, duration)
    }
    val effects = AndroidPredefinedEffect.values().map { effect ->
      AndroidEffectInfo(effect, if (hasVibrator) effectSupport(effect) else AndroidEffectSupport.UNSUPPORTED)
    }

    var resonant: Double? = null
    var qFactor: Double? = null
    if (sdk >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE && vibrator != null) {
      resonant = vibrator.resonantFrequency.toDouble().takeIf { !it.isNaN() }
      qFactor = vibrator.qFactor.toDouble().takeIf { !it.isNaN() }
    }

    var envelope = false
    var maxPoints: Double? = null
    var maxDuration: Double? = null
    var minPointDuration: Double? = null
    var maxPointDuration: Double? = null
    var minFrequency: Double? = null
    var maxFrequency: Double? = null
    var maxAcceleration: Double? = null
    if (sdk >= Build.VERSION_CODES.BAKLAVA && vibrator != null) {
      envelope = vibrator.areEnvelopeEffectsSupported()
      if (envelope) {
        val info = vibrator.envelopeEffectInfo
        maxPoints = info.maxSize.toDouble()
        maxDuration = info.maxDurationMillis.toDouble()
        minPointDuration = info.minControlPointDurationMillis.toDouble()
        maxPointDuration = info.maxControlPointDurationMillis.toDouble()
      }
      val profile = vibrator.frequencyProfile
      if (profile != null) {
        minFrequency = profile.minFrequencyHz.toDouble()
        maxFrequency = profile.maxFrequencyHz.toDouble()
        maxAcceleration = profile.maxOutputAccelerationGs.toDouble()
      }
    }

    val ids = if (sdk >= Build.VERSION_CODES.S) {
      manager?.vibratorIds?.map { it.toDouble() }?.toDoubleArray() ?: DoubleArray(0)
    } else DoubleArray(0)

    // Deprecated for writing (apps should use View feedback), still the
    // only way to read the user's touch-feedback setting.
    @Suppress("DEPRECATION")
    val feedbackEnabled = context?.let {
      try {
        Settings.System.getInt(it.contentResolver, Settings.System.HAPTIC_FEEDBACK_ENABLED, 1) != 0
      } catch (_: Throwable) {
        null
      }
    }

    return HapticCapabilities(
      platform = "android",
      osVersion = Build.VERSION.RELEASE ?: "",
      apiLevel = sdk.toDouble(),
      supportsHaptics = hasVibrator,
      supportsAudio = false,
      supportsPatterns = hasVibrator && hasAmplitudeControl,
      hasVibrator = hasVibrator,
      hasAmplitudeControl = hasAmplitudeControl,
      hasFrequencyControl = minFrequency != null,
      supportsPrimitives = primitives.any { it.supported },
      primitives = primitives.toTypedArray(),
      effects = effects.toTypedArray(),
      supportsEnvelopeEffects = envelope,
      envelopeMaxControlPoints = maxPoints,
      envelopeMaxDurationMs = maxDuration,
      envelopeMinControlPointDurationMs = minPointDuration,
      envelopeMaxControlPointDurationMs = maxPointDuration,
      resonantFrequency = resonant,
      qFactor = qFactor,
      minFrequencyHz = minFrequency,
      maxFrequencyHz = maxFrequency,
      maxOutputAccelerationGs = maxAcceleration,
      vibratorIds = ids,
      hapticFeedbackEnabled = feedbackEnabled
    )
  }
}
