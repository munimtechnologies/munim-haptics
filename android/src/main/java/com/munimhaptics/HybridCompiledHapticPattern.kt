package com.munimhaptics

import android.os.Build
import android.os.VibrationEffect
import com.margelo.nitro.core.Promise
import com.margelo.nitro.munimhaptics.HybridCompiledHapticPatternSpec
import com.margelo.nitro.munimhaptics.NativeHapticPattern

/**
 * A pattern sampled into a waveform and turned into a `VibrationEffect`
 * once. play() hands the same effect to the vibrator every time: no
 * sampling, no allocation, no bridge copy of the events.
 */
class HybridCompiledHapticPattern(pattern: NativeHapticPattern) : HybridCompiledHapticPatternSpec() {
  private val host = VibratorHost
  private val waveform = HapticWaveform.build(pattern, host.hasAmplitudeControl)
  private val effect: VibrationEffect? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !waveform.isSilent && waveform.timings.isNotEmpty()) {
      VibrationEffect.createWaveform(waveform.timings, waveform.amplitudes, -1)
    } else {
      null
    }

  override val duration: Double = waveform.durationMs / 1000.0

  // Timings (8 bytes) and amplitudes (4 bytes) per step, twice (waveform and effect).
  override val memorySize: Long get() = waveform.timings.size * 24L

  override fun play(): Promise<Unit> = try {
    if (host.hasVibrator && !waveform.isSilent) {
      host.cancel()
      val effect = effect
      if (effect != null) {
        host.vibrate(effect, host.defaultOptions)
      } else {
        host.playWaveform(waveform, -1, host.defaultOptions)
      }
    }
    Promise.resolved(Unit)
  } catch (error: Throwable) {
    Promise.rejected(error)
  }

  override fun stop(): Promise<Unit> = try {
    host.cancel()
    Promise.resolved(Unit)
  } catch (error: Throwable) {
    Promise.rejected(error)
  }
}
