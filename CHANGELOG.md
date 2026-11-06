## 0.2.0 (2026-11-06)

A complete haptics library: everything iOS and Android offer apps, behind
one API. 0.1.0 code keeps working unchanged.

### ✨ Features

* **Cross-platform feedback:** `impact(style, intensity?)` (light, medium,
  heavy, soft, rigid), `notification(type)`, `selection()` and the
  `prepare*` calls. iOS: UIKit feedback generators, cached and reused.
  Android: click / tick primitives, predefined effects or pulses, with
  `USAGE_TOUCH` so they follow the touch-feedback setting.
* **`getCapabilities()`:** a typed description of the device's haptics
  (Core Haptics / audio; vibrator, amplitude and frequency control,
  primitives with durations, predefined effects, envelope limits, resonant
  frequency, Q factor, frequency profile, vibrator ids, touch-feedback
  setting).
* **Patterns:** audio events (`audioContinuous`, `audioCustom`, iOS),
  attack / decay / release / sustained, and curves for every Core Haptics
  dynamic parameter.
* **AHAP:** `playAHAP`, `playAHAPFile`, `buildAHAP`, `parseAHAP`
  (Android plays parsed AHAP as a pattern), `readTextFile`.
* **Advanced players:** `createPlayer`, `createPlayerFromAHAP`,
  `createPlayerFromAHAPFile` return a `HapticPlayer` with start / stop /
  pause / resume / seek / cancel at a delay, loop and `loopEnd`,
  `playbackRate`, mute, live `sendParameters`, `scheduleParameterCurve`
  and `onComplete`. iOS: CHHapticAdvancedPatternPlayer, rebuilt after a
  haptic-server reset. Android: a waveform emulation.
* **Core Haptics engine:** `startEngine`, `stopEngine`, `setEngineOptions`
  (plays-haptics-only / audio-only, muting, auto-shutdown),
  `getEngineState`, `addEngineListener` (stopped with reason, reset).
* **Android vibrator:** `vibrate` (one-shot), `playWaveform` (amplitudes,
  repeat), `playPredefined`, `playPrimitives` (all eight primitives, API 36
  delay types), `playEnvelope` (Android 16 envelope builders, sampled on
  older versions), `performHapticFeedback` (every HapticFeedbackConstants
  value with fallbacks), `cancel`, VibrationAttributes usage and
  VibratorManager vibrator ids. iOS gets Core Haptics / UIKit stand-ins.
* Web and builds without the module: every call is a no-op that resolves.

### 🧪 Tests and tooling

* Jest tests for pattern normalization, AHAP and the iOS stand-ins.
* `scripts/typecheck-swift.sh` (Swift + Nitro C++ bridge against the iOS
  SDK) and `scripts/compile-kotlin.sh` (Kotlin against android.jar).

## 0.1.0 (2026-11-06)

### ✨ Features

* First release: `isSupported`, `prepare`, `playPattern` and `stop`.
* iOS: Core Haptics patterns from transient and continuous events plus
  intensity and sharpness parameter curves, on a shared pre-warmed
  `CHHapticEngine` that restarts after a reset or stop. Curves shape the
  continuous events only; transients play on their own player in sync.
* Android: patterns sampled every 10 ms into
  `VibrationEffect.createWaveform` amplitudes, with an on/off fallback for
  vibrators without amplitude control and API 24–25.
