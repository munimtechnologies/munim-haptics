<p align="center">
  <a href="https://github.com/munimtechnologies/munim-haptics">
    <h1 align="center">munim-haptics</h1>
  </a>
</p>

<p align="center">
  <a aria-label="Package version" href="https://www.npmjs.com/package/munim-haptics" target="_blank">
    <img alt="Package version" src="https://img.shields.io/npm/v/munim-haptics.svg?style=flat-square&label=Version&labelColor=000000&color=0066CC" />
  </a>
  <a aria-label="Package is free to use" href="https://github.com/munimtechnologies/munim-haptics/blob/main/LICENSE" target="_blank">
    <img alt="License: Apache-2.0" src="https://img.shields.io/badge/License-Apache%202.0-success.svg?style=flat-square&color=33CC12" target="_blank" />
  </a>
</p>

<p align="center">
  <a aria-label="try with expo" href="https://docs.expo.dev/"><b>Works with Expo</b></a>
&ensp;•&ensp;
  <a aria-label="report issues" href="https://github.com/munimtechnologies/munim-haptics/issues">Report Issues</a>
</p>

Rich, finely controlled haptic patterns for React Native. Go beyond a few
fixed "light / medium / heavy" bumps: play **continuous vibration shaped by
intensity and sharpness curves**, with **transient taps at the exact times and
strengths you choose**.

- **iOS:** [Core Haptics](https://developer.apple.com/documentation/corehaptics)
  (`CHHapticEngine`, `CHHapticPattern`, `CHHapticParameterCurve`) on one shared,
  pre-warmed engine that restarts itself after the system resets or stops it.
- **Android:** `VibrationEffect.createWaveform` with per-step amplitudes,
  sampled every 10 ms (API 26+), with a plain on/off fallback for vibrators
  without amplitude control.
- Built with [Nitro Modules](https://nitro.margelo.com/).

## Installation

```sh
npm install munim-haptics react-native-nitro-modules
```

Then rebuild the native app (`npx expo prebuild` / `npx expo run:ios`, or
`pod install` in a bare app). No permissions or config are needed: `VIBRATE`
is declared in the library's Android manifest. The Expo config plugin is
optional:

```json
{ "expo": { "plugins": ["munim-haptics"] } }
```

## Usage

```ts
import * as Haptics from 'munim-haptics'
import type { HapticPattern } from 'munim-haptics'

// A rumble that swells for 0.6 s under a drum roll that speeds up, then a hit.
const pattern: HapticPattern = {
  events: [
    { type: 'continuous', time: 0, duration: 0.6, intensity: 1, sharpness: 0.1 },
    { type: 'transient', time: 0.0, intensity: 0.4, sharpness: 0.3 },
    { type: 'transient', time: 0.15, intensity: 0.6, sharpness: 0.5 },
    { type: 'transient', time: 0.27, intensity: 0.8, sharpness: 0.7 },
    { type: 'transient', time: 0.36, intensity: 0.9, sharpness: 0.8 },
    { type: 'transient', time: 0.6, intensity: 1, sharpness: 1 },
  ],
  curves: [
    {
      parameter: 'intensity',
      time: 0,
      points: [
        { time: 0, value: 0.1 },
        { time: 0.4, value: 0.35 },
        { time: 0.6, value: 0.85 },
      ],
    },
    {
      parameter: 'sharpness',
      time: 0,
      points: [
        { time: 0, value: 0 },
        { time: 0.6, value: 0.5 },
      ],
    },
  ],
}

if (Haptics.isSupported()) {
  await Haptics.prepare() // optional: warms the engine up ahead of time
  await Haptics.playPattern(pattern)
} else {
  // Fall back to simpler feedback, e.g. expo-haptics.
}

// Later, e.g. when the screen closes:
await Haptics.stop()
```

## API

### `isSupported(): boolean`

`true` when the device can play rich patterns: Core Haptics on iOS
(`CHHapticEngine.capabilitiesForHardware().supportsHaptics`), or a vibrator
with amplitude control on Android (API 26+). Always `false` on web or in a
binary built without the module. When it's `false`, `playPattern` does
nothing.

### `prepare(): Promise<void>`

Starts the haptic engine ahead of time so the first pattern plays without
start-up lag (iOS). Optional: `playPattern` starts the engine when it needs to.

### `playPattern(pattern: HapticPattern): Promise<void>`

Plays a pattern, replacing any pattern still playing. Resolves once playback
has **started** (not when it ends). Values are clamped to their ranges and
events sorted by time.

### `stop(): Promise<void>`

Stops the pattern that is playing, if any.

### Types

```ts
type HapticEvent =
  | { type: 'transient'; time: number; intensity: number; sharpness: number }
  | { type: 'continuous'; time: number; duration: number; intensity: number; sharpness: number }

type HapticCurve = {
  parameter: 'intensity' | 'sharpness'
  time: number
  points: { time: number; value: number }[]
}

type HapticPattern = { events: HapticEvent[]; curves?: HapticCurve[] }
```

- All times and durations are in **seconds**. An event's `time` is from the
  start of the pattern; a curve point's `time` is from the curve's own `time`.
- `intensity` and `sharpness` are `0..1`. Sharpness runs from soft and round
  (0) to crisp and clicky (1).
- **Curves shape continuous events only.** Transients always keep their own
  intensity and sharpness, so taps stay crisp on top of a shaped rumble (on
  iOS the transients play on a second player, started together with the
  first).
  - `intensity` curve: a multiplier (`0..1`) on the intensity of the
    continuous events playing at that moment.
  - `sharpness` curve: an offset (`-1..1`) added to their sharpness. iOS only:
    Android vibrators have no sharpness control.
  - Values are interpolated linearly between points. Before a curve's first
    point the parameter is unchanged; after its last point it holds the last
    value. Curves with more than 16 points are split for Core Haptics
    automatically.

### Platform notes

- **iOS:** the engine keeps running between patterns (no auto-shutdown) so
  there's no start-up lag; the system stops it when the app goes to the
  background, and it restarts on the next `prepare` / `playPattern`. Haptics
  don't play while the app is in the background, or while the device is
  recording audio from the microphone.
- **Android:** transients become 10–20 ms pulses (sharper is shorter) at their
  intensity, merged with the sampled continuous events (the stronger one wins
  at each step). The 10 ms grid can shift a tap by up to 5 ms. Without
  amplitude control the pattern plays as an on/off waveform: transients are
  full pulses and continuous events are on only where they reach 0.6.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
