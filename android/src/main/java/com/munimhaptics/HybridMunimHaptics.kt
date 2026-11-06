package com.munimhaptics

import android.net.Uri
import com.margelo.nitro.core.Promise
import com.margelo.nitro.munimhaptics.AndroidHapticFeedback
import com.margelo.nitro.munimhaptics.AndroidPredefinedEffect
import com.margelo.nitro.munimhaptics.HapticCapabilities
import com.margelo.nitro.munimhaptics.HapticEngineEvent
import com.margelo.nitro.munimhaptics.HapticEngineOptions
import com.margelo.nitro.munimhaptics.HapticEngineState
import com.margelo.nitro.munimhaptics.HybridHapticPlayerSpec
import com.margelo.nitro.munimhaptics.HybridMunimHapticsSpec
import com.margelo.nitro.munimhaptics.ImpactStyle
import com.margelo.nitro.munimhaptics.NativeHapticEnvelope
import com.margelo.nitro.munimhaptics.NativeHapticPattern
import com.margelo.nitro.munimhaptics.NativePrimitiveStep
import com.margelo.nitro.munimhaptics.NativeVibrationOptions
import com.margelo.nitro.munimhaptics.NotificationFeedbackType
import java.io.File

/**
 * Nitro entry point. Vibrations go through VibratorHost (vibrator lookup,
 * attributes, VibratorManager) and HapticEffects (effects, primitives,
 * envelopes, view feedback). Core Haptics' engine calls have nothing to
 * drive on Android and resolve without effect; AHAP is parsed in JS.
 */
class HybridMunimHaptics : HybridMunimHapticsSpec() {
  private val host = VibratorHost

  private inline fun run(body: () -> Unit): Promise<Unit> = try {
    body()
    Promise.resolved(Unit)
  } catch (error: Throwable) {
    Promise.rejected(error)
  }

  private inline fun <T> result(body: () -> T): Promise<T> = try {
    Promise.resolved(body())
  } catch (error: Throwable) {
    Promise.rejected(error)
  }

  // ─── 0.1.0 ───────────────────────────────────────────────────────────────

  override fun isSupported(): Boolean = host.hasVibrator && host.hasAmplitudeControl

  // Android vibrators need no warm-up.
  override fun prepare(): Promise<Unit> = Promise.resolved(Unit)

  override fun playPattern(pattern: NativeHapticPattern): Promise<Unit> = run {
    if (!host.hasVibrator) return@run
    val waveform = HapticWaveform.build(pattern, host.hasAmplitudeControl)
    host.cancel()
    if (!waveform.isSilent) host.playWaveform(waveform, -1, host.defaultOptions)
  }

  override fun stop(): Promise<Unit> = run { host.cancel() }

  // ─── Capabilities ────────────────────────────────────────────────────────

  override fun getCapabilities(): HapticCapabilities = host.capabilities()

  // ─── Feedback ────────────────────────────────────────────────────────────

  override fun impact(style: ImpactStyle, intensity: Double): Promise<Unit> = run {
    HapticEffects.impact(style, intensity)
  }

  override fun notification(type: NotificationFeedbackType): Promise<Unit> = run {
    HapticEffects.notification(type)
  }

  override fun selection(): Promise<Unit> = run { HapticEffects.selection() }

  override fun prepareImpact(style: ImpactStyle): Promise<Unit> = Promise.resolved(Unit)

  override fun prepareNotification(): Promise<Unit> = Promise.resolved(Unit)

  override fun prepareSelection(): Promise<Unit> = Promise.resolved(Unit)

  // ─── AHAP and players ────────────────────────────────────────────────────

  override fun playAHAP(ahap: String): Promise<Unit> =
    Promise.rejected(UnsupportedOperationException("playAHAP is parsed in JavaScript on Android"))

  override fun playAHAPFile(path: String): Promise<Unit> =
    Promise.rejected(UnsupportedOperationException("playAHAPFile is parsed in JavaScript on Android"))

  override fun readTextFile(path: String): Promise<String> = Promise.parallel { readText(path) }

  override fun createPlayer(pattern: NativeHapticPattern): HybridHapticPlayerSpec = HybridHapticPlayer(pattern)

  override fun createPlayerFromAHAP(ahap: String): HybridHapticPlayerSpec =
    throw UnsupportedOperationException("createPlayerFromAHAP is parsed in JavaScript on Android")

  // ─── Engine (iOS only) ───────────────────────────────────────────────────

  override fun startEngine(): Promise<Unit> = Promise.resolved(Unit)

  override fun stopEngine(): Promise<Unit> = Promise.resolved(Unit)

  override fun setEngineOptions(options: HapticEngineOptions) {}

  override fun getEngineState(): HapticEngineState = HapticEngineState(
    isRunning = false,
    playsHapticsOnly = true,
    playsAudioOnly = false,
    isMutedForHaptics = false,
    isMutedForAudio = false,
    autoShutdown = false
  )

  override fun setEngineListener(listener: (event: HapticEngineEvent) -> Unit) {}

  // ─── Android vibrator ────────────────────────────────────────────────────

  override fun vibrate(durationMs: Double, amplitude: Double, options: NativeVibrationOptions): Promise<Unit> = run {
    if (host.hasVibrator) HapticEffects.oneShot(durationMs, amplitude, options)
  }

  override fun playWaveform(
    timingsMs: DoubleArray,
    amplitudes: DoubleArray,
    repeatIndex: Double,
    options: NativeVibrationOptions
  ): Promise<Unit> = run {
    if (host.hasVibrator) HapticEffects.waveform(timingsMs, amplitudes, repeatIndex.toInt(), options)
  }

  override fun playPredefined(
    effect: AndroidPredefinedEffect,
    fallback: Boolean,
    options: NativeVibrationOptions
  ): Promise<Boolean> = result { HapticEffects.predefined(effect, fallback, options) }

  override fun playPrimitives(
    steps: Array<NativePrimitiveStep>,
    fallback: Boolean,
    options: NativeVibrationOptions
  ): Promise<Boolean> = result { HapticEffects.primitives(steps, fallback, options) }

  override fun playEnvelope(envelope: NativeHapticEnvelope, options: NativeVibrationOptions): Promise<Unit> = run {
    HapticEffects.envelope(envelope, options)
  }

  override fun performHapticFeedback(feedback: AndroidHapticFeedback, fallback: Boolean): Promise<Boolean> {
    val promise = Promise<Boolean>()
    try {
      HapticEffects.performHapticFeedback(feedback, fallback) { promise.resolve(it) }
    } catch (error: Throwable) {
      promise.reject(error)
    }
    return promise
  }

  override fun cancel(): Promise<Unit> = run { host.cancel() }

  // ─── Files ───────────────────────────────────────────────────────────────

  /** A path, file:// or content:// URI, `asset:/name`, an asset name, or a res/raw name. */
  private fun readText(path: String): String {
    val context = host.context ?: throw IllegalStateException("No application context")
    return when {
      path.startsWith("file://") -> File(Uri.parse(path).path ?: path.removePrefix("file://")).readText()
      path.startsWith("content://") -> context.contentResolver.openInputStream(Uri.parse(path))
        ?.bufferedReader()?.use { it.readText() }
        ?: throw java.io.FileNotFoundException(path)
      path.startsWith("/") -> File(path).readText()
      else -> {
        val name = path.removePrefix("asset://").removePrefix("asset:/")
        try {
          context.assets.open(name).bufferedReader().use { it.readText() }
        } catch (missing: java.io.IOException) {
          @Suppress("DiscouragedApi")
          val id = context.resources.getIdentifier(name.substringBeforeLast('.'), "raw", context.packageName)
          if (id == 0) throw missing
          context.resources.openRawResource(id).bufferedReader().use { it.readText() }
        }
      }
    }
  }
}
