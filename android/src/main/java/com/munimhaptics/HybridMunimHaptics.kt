package com.munimhaptics

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import com.margelo.nitro.munimhaptics.HybridMunimHapticsSpec
import com.margelo.nitro.munimhaptics.NativeHapticPattern

class HybridMunimHaptics : HybridMunimHapticsSpec() {
  private val vibrator: Vibrator? by lazy {
    val context: Context = NitroModules.applicationContext ?: return@lazy null
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
      manager?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }
  }

  private fun hasAmplitudeControl(vibrator: Vibrator): Boolean =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && vibrator.hasAmplitudeControl()

  override fun isSupported(): Boolean {
    val vibrator = vibrator ?: return false
    return vibrator.hasVibrator() && hasAmplitudeControl(vibrator)
  }

  // Android vibrators need no warm-up.
  override fun prepare(): Promise<Unit> = Promise.resolved(Unit)

  override fun playPattern(pattern: NativeHapticPattern): Promise<Unit> {
    val vibrator = vibrator
    if (vibrator == null || !vibrator.hasVibrator()) return Promise.resolved(Unit)
    return try {
      play(vibrator, pattern)
      Promise.resolved(Unit)
    } catch (error: Throwable) {
      Promise.rejected(error)
    }
  }

  override fun stop(): Promise<Unit> {
    vibrator?.cancel()
    return Promise.resolved(Unit)
  }

  private fun play(vibrator: Vibrator, pattern: NativeHapticPattern) {
    val amplitudeControl = hasAmplitudeControl(vibrator)
    val waveform = HapticWaveform.build(pattern, amplitudeControl)
    vibrator.cancel()
    if (waveform.isSilent) return

    if (amplitudeControl && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      vibrator.vibrate(VibrationEffect.createWaveform(waveform.timings, waveform.amplitudes, -1))
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      // No amplitude control: a plain on/off waveform.
      vibrator.vibrate(VibrationEffect.createWaveform(onOffTimings(waveform), -1))
    } else {
      @Suppress("DEPRECATION")
      vibrator.vibrate(onOffTimings(waveform), -1)
    }
  }

  /** Alternating off/on durations, starting with off, as the plain waveform APIs take. */
  private fun onOffTimings(waveform: HapticWaveform.Waveform): LongArray {
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
}
