## [0.3.0](https://github.com/munimtechnologies/munim-haptics/compare/v0.2.0...v0.3.0) (2026-11-16)

### ✨ Features

* compiled patterns, presets, real-time haptics and honest capabilities ([7789de5](https://github.com/munimtechnologies/munim-haptics/commit/7789de58a8c875294928b594045d1c22f4d7c1f0))
* **example:** Expo example app, CI and native build workflows ([3d1d807](https://github.com/munimtechnologies/munim-haptics/commit/3d1d8077ada053c7244c01fba6b73fd29f938c2e))

### 🐛 Bug Fixes

* **ios:** read the engine generation without self before init completes ([1469b4d](https://github.com/munimtechnologies/munim-haptics/commit/1469b4d8e7a46d95d7d9c0f5be265377d596c2fc))

### 💨 Performance Improvements

* **android:** faster waveform sampling and coalesced live intensity changes ([a6eacb1](https://github.com/munimtechnologies/munim-haptics/commit/a6eacb1829fe651b13d0976ecda41e16672b4d29))

### 📚 Documentation

* presets, compiled patterns, real-time haptics, iPad capabilities and the example app ([28a5e15](https://github.com/munimtechnologies/munim-haptics/commit/28a5e1571811d12ee149ac2d0b4c469786b4c89c))

### 🛠️ Other changes

* **deps:** React Native 0.88.1, Nitro 0.37.2, Expo SDK 58 example workspace, TypeScript 6, ESLint 10, semantic-release 26 ([57dd863](https://github.com/munimtechnologies/munim-haptics/commit/57dd8638458bbc28877559a0f64965cdc1b6065b))
* regenerate nitrogen 0.37.2 bindings and lockfile ([1861051](https://github.com/munimtechnologies/munim-haptics/commit/186105142960f9824b335a14db6830d831c5e553))
* regenerate nitrogen bindings for compiled patterns and new capabilities ([c5e6d8d](https://github.com/munimtechnologies/munim-haptics/commit/c5e6d8d977176640ad19a28f4713ce3341c902f2))

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
