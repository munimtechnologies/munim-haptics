package com.munimhaptics

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.margelo.nitro.core.Promise
import com.margelo.nitro.munimhaptics.HapticCurve
import com.margelo.nitro.munimhaptics.HapticCurveParameter
import com.margelo.nitro.munimhaptics.HapticDynamicParameter
import com.margelo.nitro.munimhaptics.HapticPlayerCompletion
import com.margelo.nitro.munimhaptics.HybridHapticPlayerSpec
import com.margelo.nitro.munimhaptics.NativeHapticPattern
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong

/**
 * Android's stand-in for CHHapticAdvancedPatternPlayer. The pattern is
 * sampled into a waveform once; every change (start, seek, resume, rate,
 * loop, intensity, a new curve) re-issues the rest of the waveform from the
 * current position. Looping uses createWaveform's repeat index.
 *
 * Intensity works (sendParameters and intensity curves); sharpness, the
 * envelope parameters and audio don't exist on Android vibrators.
 *
 * Immediate intensity changes are coalesced: a gesture sending 120 updates a
 * second re-issues the waveform at most once per frame (16 ms), with the
 * latest value, and not at all when the amplitude would not change.
 *
 * All state below the volatile settings lives on the main thread.
 */
class HybridHapticPlayer(pattern: NativeHapticPattern) : HybridHapticPlayerSpec() {
  private val host = VibratorHost
  private val handler = Handler(Looper.getMainLooper())
  /** Tags every scheduled action so cancel() can drop them. */
  private val token = Any()

  private var pattern = pattern
  private var waveform = HapticWaveform.build(pattern, host.hasAmplitudeControl)
  private val durationMs = waveform.durationMs.toDouble()

  // Settings as JS sees them (set immediately)...
  @Volatile private var loopEnabledValue = false
  @Volatile private var loopEndValue = 0.0
  @Volatile private var playbackRateValue = 1.0
  @Volatile private var isMutedValue = false
  @Volatile private var listener: ((HapticPlayerCompletion) -> Unit)? = null

  // ...and as the playing waveform uses them (main thread).
  private var appliedLoop = false
  private var appliedLoopEndMs = durationMs
  private var appliedRate = 1.0
  private var appliedMuted = false
  private var intensity = 1.0

  private var playing = false
  /** Pattern position (ms) at `anchor`. */
  private var positionMs = 0.0
  private var anchor = 0L

  /** The latest immediate intensity, applied by one pending re-issue. */
  @Volatile private var pendingIntensity = 1.0
  private val reissuePosted = AtomicBoolean(false)
  private var lastReissue = 0L

  private val completion = Runnable {
    playing = false
    positionMs = 0.0
    notifyCompletion()
  }

  override val duration: Double get() = durationMs / 1000.0

  override var loopEnabled: Boolean
    get() = loopEnabledValue
    set(value) {
      loopEnabledValue = value
      reapply()
    }

  override var loopEnd: Double
    get() = loopEndValue
    set(value) {
      loopEndValue = if (value.isFinite()) max(0.0, value) else 0.0
      reapply()
    }

  override var playbackRate: Double
    get() = playbackRateValue
    set(value) {
      playbackRateValue = if (value.isFinite() && value > 0.0) value else 1.0
      reapply()
    }

  override var isMuted: Boolean
    get() = isMutedValue
    set(value) {
      isMutedValue = value
      reapply()
    }

  override fun setCompletionListener(listener: (completion: HapticPlayerCompletion) -> Unit) {
    this.listener = listener
  }

  // ─── Playback ────────────────────────────────────────────────────────────

  override fun start(atTime: Double): Promise<Unit> = schedule(atTime) { playFrom(0.0) }

  override fun stop(atTime: Double): Promise<Unit> = schedule(atTime) {
    val wasPlaying = playing
    halt()
    positionMs = 0.0
    if (wasPlaying) notifyCompletion()
  }

  override fun pause(atTime: Double): Promise<Unit> = schedule(atTime) {
    if (playing) {
      positionMs = currentPositionMs()
      halt()
    }
  }

  override fun resume(atTime: Double): Promise<Unit> = schedule(atTime) {
    if (!playing) playFrom(positionMs)
  }

  override fun seek(offset: Double): Promise<Unit> {
    val target = if (offset.isFinite()) min(durationMs, max(0.0, offset * 1000.0)) else 0.0
    return schedule(0.0) {
      if (playing) playFrom(target) else positionMs = target
    }
  }

  override fun cancel(): Promise<Unit> {
    handler.removeCallbacksAndMessages(token)
    reissuePosted.set(false)
    return schedule(0.0) {
      val wasPlaying = playing
      halt()
      positionMs = 0.0
      if (wasPlaying) notifyCompletion()
    }
  }

  override fun sendParameters(parameters: Array<HapticDynamicParameter>, atTime: Double): Promise<Unit> {
    val value = parameters.lastOrNull { it.parameter == HapticCurveParameter.INTENSITY }?.value
      ?: return Promise.resolved(Unit)
    if (atTime.isFinite() && atTime > 0.0) {
      return schedule(atTime) { applyIntensity(HapticWaveform.clamp01(value)) }
    }
    pendingIntensity = HapticWaveform.clamp01(value)
    if (reissuePosted.compareAndSet(false, true)) {
      val now = SystemClock.uptimeMillis()
      val at = max(now, lastReissue + MIN_REISSUE_INTERVAL_MS)
      handler.postAtTime({
        reissuePosted.set(false)
        try {
          applyIntensity(pendingIntensity)
        } catch (error: Throwable) {
          notifyCompletion(error.message ?: error.toString())
        }
      }, token, at)
    }
    return Promise.resolved(Unit)
  }

  /** Main thread. Re-issues the waveform only when the amplitude changes. */
  private fun applyIntensity(value: Double) {
    if (abs(value - intensity) < 0.5 / 255.0) return
    val position = currentPositionMs()
    intensity = value
    if (playing) {
      playFrom(position)
      lastReissue = SystemClock.uptimeMillis()
    }
  }

  override fun scheduleParameterCurve(curve: HapticCurve, atTime: Double): Promise<Unit> {
    if (curve.parameter != HapticCurveParameter.INTENSITY || curve.points.isEmpty()) {
      return Promise.resolved(Unit)
    }
    return schedule(atTime) {
      val position = currentPositionMs()
      // The curve starts now (or at its own offset), in pattern time.
      val start = (if (playing) position / 1000.0 else 0.0) + max(0.0, curve.time)
      val shifted = HapticCurve(curve.parameter, start, curve.points)
      pattern = NativeHapticPattern(pattern.events, pattern.curves + shifted)
      waveform = HapticWaveform.build(pattern, host.hasAmplitudeControl)
      if (playing) playFrom(position)
    }
  }

  // ─── Internals (main thread) ─────────────────────────────────────────────

  private fun schedule(atTime: Double, action: () -> Unit): Promise<Unit> {
    val delay = if (atTime.isFinite() && atTime > 0.0) (atTime * 1000.0).roundToLong() else 0L
    val runnable = Runnable {
      try {
        action()
      } catch (error: Throwable) {
        notifyCompletion(error.message ?: error.toString())
      }
    }
    handler.postAtTime(runnable, token, SystemClock.uptimeMillis() + delay)
    return Promise.resolved(Unit)
  }

  /** Applies changed loop / rate / mute settings, keeping the position. */
  private fun reapply() {
    handler.post {
      val position = currentPositionMs()
      if (playing) playFrom(position) else applySettings()
    }
  }

  private fun applySettings() {
    appliedLoop = loopEnabledValue
    appliedLoopEndMs = if (loopEndValue > 0.0) min(durationMs, loopEndValue * 1000.0) else durationMs
    appliedRate = playbackRateValue
    appliedMuted = isMutedValue
  }

  private fun currentPositionMs(): Double {
    if (!playing) return positionMs
    var position = positionMs + (SystemClock.uptimeMillis() - anchor) * appliedRate
    if (appliedLoop && appliedLoopEndMs > 0.0 && position >= appliedLoopEndMs) {
      position = (position - appliedLoopEndMs) % appliedLoopEndMs
    }
    return min(position, durationMs)
  }

  private fun playFrom(fromMs: Double) {
    applySettings()
    handler.removeCallbacks(completion)
    host.cancel()
    positionMs = min(durationMs, max(0.0, fromMs))
    anchor = SystemClock.uptimeMillis()
    playing = true

    val from = positionMs.roundToLong()
    val loopEnd = appliedLoopEndMs.roundToLong()
    if (!appliedMuted) {
      var segment = waveform.slice(from, if (appliedLoop) loopEnd else waveform.durationMs)
      var repeat = -1
      if (appliedLoop) {
        val body = waveform.slice(0L, loopEnd)
        if (body.durationMs > 0L) {
          repeat = segment.timings.size
          segment += body
        }
      }
      segment = segment.scaled(intensity).stretched(appliedRate)
      if (repeat >= segment.timings.size) repeat = -1
      host.playWaveform(segment, repeat, host.defaultOptions)
    }
    if (!appliedLoop) {
      val remaining = ((durationMs - positionMs) / appliedRate).roundToLong()
      handler.postDelayed(completion, max(0L, remaining))
    }
  }

  private fun halt() {
    handler.removeCallbacks(completion)
    if (playing) host.cancel()
    playing = false
  }

  private fun notifyCompletion(error: String = "") {
    listener?.invoke(HapticPlayerCompletion(error))
  }

  /** Drops everything scheduled and stops the vibration if this player is playing. */
  override fun dispose() {
    handler.removeCallbacksAndMessages(token)
    handler.removeCallbacks(completion)
    reissuePosted.set(false)
    listener = null
    handler.post { halt() }
    super.dispose()
  }

  private companion object {
    const val MIN_REISSUE_INTERVAL_MS = 16L
  }
}
