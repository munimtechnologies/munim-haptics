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
