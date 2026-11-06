<!-- Banner Image -->

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
  <a aria-label="package downloads" href="https://www.npmtrends.com/munim-haptics" target="_blank">
    <img alt="Downloads" src="https://img.shields.io/npm/dm/munim-haptics.svg?style=flat-square&labelColor=gray&color=33CC12&label=Downloads" />
  </a>
  <a aria-label="total package downloads" href="https://www.npmjs.com/package/munim-haptics" target="_blank">
    <img alt="Total Downloads" src="https://img.shields.io/npm/dt/munim-haptics.svg?style=flat-square&labelColor=gray&color=0066CC&label=Total%20Downloads" />
  </a>
</p>

<p align="center">
  <img alt="iOS" src="https://img.shields.io/badge/iOS-Core%20Haptics%20%2B%20UIKit-000000?style=flat-square&logo=apple&logoColor=white" />
  <img alt="Android" src="https://img.shields.io/badge/Android-VibrationEffect%20%2B%20View%20feedback-3DDC84?style=flat-square&logo=android&logoColor=white" />
  <img alt="Web" src="https://img.shields.io/badge/Web-no--op-lightgrey?style=flat-square" />
  <img alt="Nitro Modules" src="https://img.shields.io/badge/Nitro-Modules-FF6F00?style=flat-square" />
</p>

<p align="center">
  <a aria-label="try with expo" href="https://docs.expo.dev/"><b>Works with Expo</b></a>
&ensp;•&ensp;
  <a aria-label="documentation" href="https://github.com/munimtechnologies/munim-haptics#readme">Read the Documentation</a>
&ensp;•&ensp;
  <a aria-label="report issues" href="https://github.com/munimtechnologies/munim-haptics/issues">Report Issues</a>
</p>

<h6 align="center">Follow Munim Technologies</h6>
<p align="center">
  <a aria-label="Follow Munim Technologies on GitHub" href="https://github.com/munimtechnologies" target="_blank">
    <img alt="Munim Technologies on GitHub" src="https://img.shields.io/badge/GitHub-222222?style=for-the-badge&logo=github&logoColor=white" target="_blank" />
  </a>&nbsp;
  <a aria-label="Follow Munim Technologies on LinkedIn" href="https://linkedin.com/in/sheehanmunim" target="_blank">
    <img alt="Munim Technologies on LinkedIn" src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" target="_blank" />
  </a>&nbsp;
  <a aria-label="Visit Munim Technologies Website" href="https://munimtech.com" target="_blank">
    <img alt="Munim Technologies Website" src="https://img.shields.io/badge/Website-0066CC?style=for-the-badge&logo=globe&logoColor=white" target="_blank" />
  </a>
</p>

## Introduction

**munim-haptics** is a complete haptics library for React Native. It covers what iOS and Android let apps do with the Taptic Engine and vibration motors: the system feedback generators, **Core Haptics** patterns, AHAP files, audio-synced haptics and advanced players on iOS, and **predefined effects, primitive compositions, envelopes, waveforms, view haptic feedback** and multi-vibrator control on Android.

One API works on both: call `impact('heavy')`, `notification('success')` or `playPattern(...)` and each platform plays its closest native equivalent. Platform-specific calls are still there when you want them, and `getCapabilities()` tells you what the device can actually do.

**Fully compatible with Expo!** Works with both Expo managed (development builds) and bare workflows.

**Built with React Native's Nitro modules architecture** for high performance and reliability.

**Note**: Haptic hardware varies a lot, especially on Android. This library uses the best API each device supports, falls back to the nearest older one where it can, and reports what's available through `getCapabilities()` instead of pretending. On web, and in a binary built without the module, every call is a no-op that resolves.

## Table of contents

- [📚 Documentation](#-documentation)
- [🚀 Features](#-features)
- [Platform Support Matrix](#platform-support-matrix)
- [📦 Installation](#-installation)
- [⚡ Quick Start](#-quick-start)
- [🔧 API Reference](#-api-reference)
- [📖 Usage Examples](#-usage-examples)
- [Platform Notes](#platform-notes)
- [🔍 Troubleshooting](#-troubleshooting)
- [👏 Contributing](#-contributing)
- [📄 License](#-license)

## 📚 Documentation

<p>Learn about designing haptics <a aria-label="documentation" href="https://github.com/munimtechnologies/munim-haptics#readme">in our documentation!</a></p>

- [Getting Started](#-installation)
- [API Reference](#-api-reference)
- [Usage Examples](#-usage-examples)
- [Troubleshooting](#-troubleshooting)

## 🚀 Features

### Cross-platform feedback

- 👆 **Impact**: `light`, `medium`, `heavy`, `soft` and `rigid`, with an optional intensity (UIImpactFeedbackGenerator on iOS; click / tick primitives on Android)
- ✅ **Notification**: `success`, `warning` and `error`
- 🔘 **Selection**: a light tick for pickers and sliders
- ⚙️ **Respects the user's settings**: iOS feedback generators follow System Haptics; Android feedback uses `USAGE_TOUCH`, so it follows the touch-feedback setting and intensity

### Rich patterns

- 🌊 **Continuous and transient events** with intensity and sharpness, at the exact times you choose
- 📈 **Parameter curves** for intensity, sharpness, attack / decay / release and audio
- 🎚️ **Event envelopes**: attack, decay, release, sustained
- 🔊 **Audio events** (iOS): synthesized tones and your own sound files, in sync with the haptics
- 📄 **AHAP**: play AHAP JSON or `.ahap` files, and convert between AHAP and patterns (`buildAHAP` / `parseAHAP`), so AHAP files play on Android too

### Advanced players

- ⏯️ `start`, `stop`, `pause`, `resume`, `seek` and `cancel`, each at a chosen time
- 🔁 Looping with `loopEnd`, `playbackRate` and mute
- 🎛️ **Live control**: change intensity and sharpness while a pattern plays (`sendParameters`), or schedule new curves
- ♻️ Survives haptic-server resets: players rebuild themselves

### Android vibrator

- 🧩 **Primitives**: click, thud, spin, quick / slow rise, quick fall, tick, low tick, with scale and delay (and Android 16 delay types)
- 🎯 **Predefined effects**: click, double click, tick, heavy click
- 📉 **Envelopes** (Android 16): `BasicEnvelopeBuilder` and `WaveformEnvelopeBuilder`, sampled into a waveform on older versions
- 〰️ **One-shots and waveforms** with amplitudes and repeat
- 📳 **View haptic feedback**: every `HapticFeedbackConstants` value, with fallbacks on older API levels
- 🎛️ **VibrationAttributes** usage (touch, notification, alarm, media, ...) and **VibratorManager** vibrator ids

### Additional Features

- 🧭 **Capability reporting**: `getCapabilities()` returns a typed description of the device's haptics
- 🔔 **Engine events**: Core Haptics `stopped` (with the reason) and `reset`
- 🎯 **TypeScript Support**: full type definitions included
- ⚡ **High Performance**: built with React Native's Nitro modules architecture
- 🚀 **Expo Compatible**: works with Expo managed and bare workflows
- 🌐 **Web-safe**: no-ops that resolve, so shared code needs no platform checks

## Platform Support Matrix

| Function | iOS | Android | Notes |
| --- | --- | --- | --- |
| `impact(style, intensity?)` | ✅ | ✅ | iOS: UIImpactFeedbackGenerator (`impactOccurred(intensity:)`). Android: click / tick / low-tick primitive at the style's scale (API 30+), predefined effect (29+), or a short pulse. |
| `notification(type)` | ✅ | ✅ | iOS: UINotificationFeedbackGenerator. Android: click sequences (success rises, warning falls, error repeats). |
| `selection()` | ✅ | ✅ | iOS: UISelectionFeedbackGenerator. Android: tick primitive, `EFFECT_TICK` or a short pulse. |
| `prepareImpact` / `prepareNotification` / `prepareSelection` | ✅ | ➖ | Warms the cached generator. Android needs no warm-up (resolves). |
| `isSupported()` | ✅ | ✅ | Core Haptics (iOS); a vibrator with amplitude control (Android). |
| `getCapabilities()` | ✅ | ✅ | See [`HapticCapabilities`](#hapticcapabilities). Web: all `false`. |
| `playPattern(pattern)` | ✅ | ✅ | iOS: Core Haptics. Android: a 10 ms-sampled amplitude waveform (intensity only, no sharpness or audio). |
| Audio events (`audioContinuous`, `audioCustom`) | ✅ | ➖ | iOS only; skipped on Android. Needs `setEngineOptions({ playsHapticsOnly: false })`. |
| Curves (`intensity`) | ✅ | ✅ | |
| Curves (`sharpness`, attack / decay / release, audio) | ✅ | ➖ | Ignored on Android. |
| `playAHAP` / `playAHAPFile` | ✅ | ✅ | iOS: native, audio included. Android: parsed in JS and played as a pattern. |
| `buildAHAP` / `parseAHAP` | ✅ | ✅ | Pure JS. |
| `createPlayer` / `createPlayerFromAHAP(File)` | ✅ | ✅ | iOS: CHHapticAdvancedPatternPlayer. Android: waveform emulation (timing, loop, pause / seek, rate, mute, intensity). |
| `player.sendParameters` | ✅ | ✅ | Android: intensity only. |
| `player.scheduleParameterCurve` | ✅ | ✅ | Android: intensity curves only. |
| `startEngine` / `stopEngine` / `setEngineOptions` / `getEngineState` | ✅ | ➖ | Core Haptics engine. Android resolves / returns defaults. |
| `addEngineListener` | ✅ | ➖ | `stopped` (with reason) and `reset`. Never fires on Android. |
| `vibrate(ms, amplitude?)` | 🔁 | ✅ | Android: `createOneShot`. iOS: a continuous event. |
| `playWaveform(timings, amplitudes?, repeat?)` | 🔁 | ✅ | Android: `createWaveform`. iOS: continuous events (repeat loops on a player). |
| `playPredefined(effect)` | 🔁 | ✅ | Android: `createPredefined` (API 29+). iOS: the closest UIKit impact. |
| `playPrimitives(steps)` | 🔁 | ✅ | Android: `startComposition` (API 30+; thud, spin, low tick 31+; delay types 36+). iOS: transients and shaped rumbles. |
| `playEnvelope(envelope)` | 🔁 | ✅ | Android 16+: envelope builders; older: sampled waveform. iOS: a continuous event with curves. |
| `performHapticFeedback(constant)` | 🔁 | ✅ | Android: `View.performHapticFeedback` on the current activity. iOS: the closest UIKit feedback. |
| VibrationAttributes usage, vibrator ids | ➖ | ✅ | Usage: API 33+ (AudioAttributes on 26-32). Vibrator ids: API 31+. |
| `cancel()` / `stop()` | ✅ | ✅ | |
| Web | ➖ | ➖ | Every call resolves without effect. |

✅ native · 🔁 emulated with the platform's closest feature · ➖ no-op (resolves)

Call `getCapabilities()` at runtime when you need optional behavior: support varies by OS version and hardware.

## 📦 Installation

### React Native CLI

```bash
npm install munim-haptics react-native-nitro-modules
# or
yarn add munim-haptics react-native-nitro-modules
```

### Expo

```bash
npx expo install munim-haptics react-native-nitro-modules
```

> **Note**: This library requires Expo SDK 50+ and works with both managed and bare workflows. To support Nitro modules, you need React Native version v0.78.0 or higher (`react-native-nitro-modules` >= 0.36.5).
>
> **Important**: This package requires a native development build in Expo. It does not work in Expo Go. After installing, run `npx expo run:ios`, `npx expo run:android`, or create a development build with EAS.

### iOS Setup

Nothing to add: Core Haptics and UIKit feedback need no Info.plist keys. Run `pod install` (bare apps) or rebuild (Expo).

Haptics only play on an iPhone with a Taptic Engine (iPhone 8 and later). The Simulator, iPads and Macs report `supportsHaptics: false`; feedback calls resolve without effect there.

### Android Setup

`android.permission.VIBRATE` is declared in the library's manifest and merged into your app automatically.

### Expo Config Plugin

Optional. It adds `VIBRATE` to your app's own manifest too:

```json
{
  "expo": {
    "plugins": ["munim-haptics"]
  }
}
```

## ⚡ Quick Start

### Feedback

```typescript
import { impact, notification, selection } from 'munim-haptics'

await impact('medium') // a button press
await impact('heavy', 0.6) // a softer heavy impact
await notification('success') // a task finished
await selection() // a picker moved
```

### A pattern

```typescript
import { isSupported, playPattern, impact } from 'munim-haptics'
import type { HapticPattern } from 'munim-haptics'

// A rumble that swells for 0.6 s under a drum roll that speeds up, then a hit.
const buildUp: HapticPattern = {
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
  ],
}

if (isSupported()) {
  await playPattern(buildUp)
} else {
  await impact('heavy')
}
```

### A player you control

```typescript
import { createPlayer } from 'munim-haptics'

const engine = createPlayer({
  events: [{ type: 'continuous', time: 0, duration: 1, intensity: 1, sharpness: 0.3 }],
})
engine.loopEnabled = true
await engine.start()

// Follow a slider or a gesture:
await engine.sendParameters({ intensity: 0.4, sharpness: 0.1 })

await engine.stop()
```

### Android effects (with iOS stand-ins)

```typescript
import { getCapabilities, playPrimitives, performHapticFeedback } from 'munim-haptics'

const { supportsPrimitives } = getCapabilities()

await playPrimitives([
  { primitive: 'quickRise', scale: 0.6 },
  { primitive: 'click', scale: 1, delayMs: 40 },
])

await performHapticFeedback('confirm')
```

## 🔧 API Reference

All functions are named exports (and also on the default export). Every function that returns a `Promise` resolves without effect on web and on devices without haptics.

### Feedback Functions

#### `impact(style?, intensity?)`

A physical impact.

**Parameters:**

- `style` (`'light' | 'medium' | 'heavy' | 'soft' | 'rigid'`, default `'medium'`)
- `intensity?` (number, 0..1): strength. Omit for the style's default.

iOS: `UIImpactFeedbackGenerator(style:).impactOccurred(intensity:)`, on a generator cached per style. Android: a primitive (`light` / `medium` / `heavy`: click at 0.5 / 0.8 / 1.0; `soft`: low tick; `rigid`: tick) scaled by `intensity`; without primitives, the matching predefined effect at full strength, else a short pulse. Uses `USAGE_TOUCH`.

**Returns:** Promise<void>

#### `notification(type?)`

`'success' | 'warning' | 'error'` (default `'success'`). iOS: `UINotificationFeedbackGenerator`. Android: click compositions shaped like the iOS ones.

**Returns:** Promise<void>

#### `selection()`

A selection change. iOS: `UISelectionFeedbackGenerator`. Android: a tick.

**Returns:** Promise<void>

#### `prepareImpact(style?)`, `prepareNotification()`, `prepareSelection()`

iOS: calls `prepare()` on the cached generator so the next call plays with minimal latency (UIKit keeps it ready for a few seconds). Android: resolves.

**Returns:** Promise<void>

### Pattern Functions

#### `isSupported()`

`true` when the device can play rich patterns: Core Haptics on iOS (`CHHapticEngine.capabilitiesForHardware().supportsHaptics`), a vibrator with amplitude control on Android (API 26+). Always `false` on web. When it's `false`, `playPattern` does nothing.

**Returns:** boolean

#### `prepare()`

Starts the haptic engine ahead of time so the first pattern plays without start-up lag (iOS). Optional: playing starts the engine when needed.

**Returns:** Promise<void>

#### `playPattern(pattern)`

Plays a [`HapticPattern`](#hapticpattern), replacing any pattern still playing. Resolves once playback has **started** (not when it ends). Values are clamped to their ranges and events sorted by time.

**Returns:** Promise<void>

#### `stop()`

Stops the pattern that is playing, if any.

**Returns:** Promise<void>

#### `normalizePattern(pattern)`

The pattern exactly as the native side receives it (clamped, sorted, empty events dropped). Useful for tests.

**Returns:** NativeHapticPattern

### AHAP Functions

#### `playAHAP(ahap)`

Plays an AHAP document, as a JSON string or an object. iOS: `CHHapticPattern(dictionary:)`, audio included. Android: parsed with `parseAHAP` and played as a pattern.

**Returns:** Promise<void>

#### `playAHAPFile(path)`

Plays an `.ahap` file: an absolute path, a `file://` URI, or a bundled resource. iOS: a main-bundle resource name (`'Boing'` or `'Boing.ahap'`); audio paths inside the file resolve relative to it (iOS 16+). Android: an asset name (`asset:/Boing.ahap` or `Boing.ahap`), a `res/raw` name, or a `content://` URI.

**Returns:** Promise<void>

#### `buildAHAP(pattern, metadata?)`

The AHAP document for a pattern (`{ Version: 1, Pattern: [...] }`). Save it as an `.ahap` file, open it in a haptics editor, or pass it to `playAHAP`.

**Returns:** AHAP

#### `parseAHAP(ahap)`

A `HapticPattern` from an AHAP document (string or object). Missing intensity / sharpness use Core Haptics' defaults (1 / 0.5); single `Parameter` entries become one-point curves. Throws on malformed input.

**Returns:** HapticPattern

#### `readTextFile(path)`

Reads a text file the way `playAHAPFile` finds it.

**Returns:** Promise<string>

### Player Functions

#### `createPlayer(pattern)`

A [`HapticPlayer`](#hapticplayer) for a pattern. On web and devices without haptics it returns a no-op player.

**Returns:** HapticPlayer

#### `createPlayerFromAHAP(ahap)`

A player for an AHAP document. iOS: `makeAdvancedPlayer` on the AHAP pattern (audio included). Android: the parsed pattern.

**Returns:** HapticPlayer

#### `createPlayerFromAHAPFile(path)`

A player for an `.ahap` file, found like `playAHAPFile`. On iOS, give audio files in it as absolute paths or bundle resource names.

**Returns:** Promise<HapticPlayer>

#### `HapticPlayer`

| Member | Description |
| --- | --- |
| `duration` | Pattern length in seconds (read-only). |
| `loopEnabled` | Loop until stopped. |
| `loopEnd` | Seconds; `0` loops at the end of the pattern. |
| `playbackRate` | `1` = normal speed. |
| `isMuted` | Keeps time silently. |
| `start(atTime?)` | Starts from the beginning. `atTime` is a delay in seconds from now (default 0). |
| `stop(atTime?)` | Stops (calls `onComplete`). |
| `pause(atTime?)` / `resume(atTime?)` | Pauses / continues where it paused. |
| `seek(offset)` | Jumps to `offset` seconds. |
| `cancel()` | Stops immediately and drops anything scheduled. |
| `sendParameters(parameters, atTime?)` | Dynamic parameters while playing: `{ intensity: 0.5, sharpness: -0.2 }` or `[{ parameter, value }]`. Intensity is a 0..1 multiplier; the others are -1..1 offsets. Android: intensity only. |
| `scheduleParameterCurve(curve, atTime?)` | A curve that starts at `atTime`. Android: intensity curves only. |
| `onComplete(listener)` | Called with `undefined` when the player finishes or stops (not on each loop), or with an error message. |

On iOS, a pattern whose curves would otherwise shape its taps plays on two Core Haptics players started together (curves on the continuous events only), padded to the same length so they loop in step.

### Engine Functions (iOS)

#### `startEngine()`, `stopEngine()`

Starts / stops the shared `CHHapticEngine`. Stopping also stops every pattern; the next play starts it again.

**Returns:** Promise<void>

#### `setEngineOptions(options)`

- `playsHapticsOnly?` (boolean, default `true`): set `false` before playing audio events.
- `playsAudioOnly?` (boolean, default `false`, iOS 16+)
- `isMutedForHaptics?`, `isMutedForAudio?` (boolean)
- `autoShutdown?` (boolean, default `false`): let the system stop the idle engine. Off by default so the first tap has no start-up lag.

Changing `playsHapticsOnly` / `playsAudioOnly` recreates the engine (they can only be set before it starts). Players rebuild themselves on their next call.

#### `getEngineState()`

`{ isRunning, playsHapticsOnly, playsAudioOnly, isMutedForHaptics, isMutedForAudio, autoShutdown }`.

**Returns:** HapticEngineState

#### `addEngineListener(listener)`

Core Haptics engine events: `{ type: 'stopped', reason }` (`audioSessionInterrupt`, `applicationSuspended`, `idleTimeout`, `notifyWhenFinished`, `engineDestroyed`, `gameControllerDisconnect`, `systemError`, `unknown`) and `{ type: 'reset', reason: 'none' }`. After a reset the library restarts the engine itself.

**Returns:** `{ remove(): void }`

### Android Vibrator Functions

All take an optional [`VibrationOptions`](#vibrationoptions) (`usage`, `vibratorIds`). On iOS they're emulated with Core Haptics or UIKit (see the matrix).

#### `vibrate(durationMs, amplitude?, options?)`

`VibrationEffect.createOneShot`. `amplitude` 1..255; omit for the device default.

**Returns:** Promise<void>

#### `playWaveform(timingsMs, amplitudes?, repeatIndex?, options?)`

`VibrationEffect.createWaveform`. With `amplitudes` (0..255, `-1` = default) each timing plays at its amplitude; without, timings alternate off / on starting with off. `repeatIndex` >= 0 repeats from that index until `cancel()`.

**Returns:** Promise<void>

#### `playPredefined(effect, options?)`

`VibrationEffect.createPredefined` with `'click' | 'doubleClick' | 'tick' | 'heavyClick'` (API 29+). When the vibrator reports the effect unsupported, plays a close pulse instead unless `options.fallback` is `false`.

**Returns:** Promise<boolean> (whether something played)

#### `playPrimitives(steps, options?)`

`VibrationEffect.startComposition()`. Each step: `{ primitive, scale?, delayMs?, delayType? }`.

- `primitive`: `'click' | 'thud' | 'spin' | 'quickRise' | 'slowRise' | 'quickFall' | 'tick' | 'lowTick'` (API 30+; `thud`, `spin`, `lowTick` API 31+)
- `scale` (0..1, default 1), `delayMs` (default 0)
- `delayType` (Android 16+): `'pause'` (after the previous primitive ends, default) or `'relativeStartOffset'` (from its start)

If any primitive is unsupported, plays a similar waveform unless `options.fallback` is `false`. Check `getCapabilities().primitives` for support and durations.

**Returns:** Promise<boolean>

#### `playEnvelope(envelope, options?)`

Android 16 envelope effects:

```typescript
// BasicEnvelopeBuilder: perceived intensity and sharpness
{ kind: 'basic', initialSharpness?: number, points: [{ intensity, sharpness, durationMs }] }
// WaveformEnvelopeBuilder: amplitude and frequency
{ kind: 'waveform', initialFrequencyHz?: number, points: [{ amplitude, frequencyHz, durationMs }] }
```

Envelopes start at intensity 0 and ramp to each point over its duration. Native where `getCapabilities().supportsEnvelopeEffects`; otherwise (older Android, or outside the vibrator's limits) a sampled amplitude waveform.

**Returns:** Promise<void>

#### `performHapticFeedback(constant, options?)`

`View.performHapticFeedback` on the current activity's decor view, on the UI thread. It follows the touch-feedback setting and the OEM's tuning, so it's the most "native-feeling" option for UI events.

Constants: `longPress`, `virtualKey`, `keyboardTap`, `clockTick` (21), `contextClick` (23), `keyboardPress`, `keyboardRelease`, `virtualKeyRelease`, `textHandleMove` (27), `gestureStart`, `gestureEnd`, `confirm`, `reject` (30), `toggleOn`, `toggleOff`, `gestureThresholdActivate`, `gestureThresholdDeactivate`, `dragStart`, `segmentTick`, `segmentFrequentTick`, `noHaptics` (34). On older API levels a constant falls back to the nearest older one (e.g. `confirm` → `virtualKey`) unless `options.fallback` is `false`.

**Returns:** Promise<boolean> (whether the view performed it)

#### `cancel()`

Cancels every vibration (all vibrators), including repeating waveforms. iOS: stops every pattern.

**Returns:** Promise<void>

#### `setDefaultVibrationOptions(options)`

Default `usage` / `vibratorIds` for the Android calls above. The default usage is `'unknown'` (no attributes, like 0.1.0); `'touch'` makes vibrations follow the touch-feedback setting.

### Capabilities

#### `getCapabilities()`

**Returns:** HapticCapabilities

#### `HapticCapabilities`

| Field | iOS | Android |
| --- | --- | --- |
| `platform`, `osVersion` | `'ios'`, iOS version | `'android'`, release |
| `apiLevel` | `0` | `Build.VERSION.SDK_INT` |
| `supportsHaptics` | Core Haptics | has a vibrator |
| `supportsAudio` | Core Haptics audio | `false` |
| `supportsPatterns` | Core Haptics | vibrator with amplitude control |
| `hasVibrator`, `hasAmplitudeControl` | = `supportsHaptics` | `Vibrator.hasVibrator()` / `hasAmplitudeControl()` |
| `hasFrequencyControl` | `false` | Android 16+ frequency profile present |
| `supportsPrimitives`, `primitives` | `false`, `[]` | per primitive: `{ primitive, supported, durationMs }` (`arePrimitivesSupported`, `getPrimitiveDurations`) |
| `effects` | `[]` | per effect: `{ effect, support: 'supported' \| 'unsupported' \| 'unknown' }` (`areEffectsSupported`, API 30+) |
| `supportsEnvelopeEffects`, `envelope*` | `false` | `areEnvelopeEffectsSupported()` and `getEnvelopeEffectInfo()` limits (API 36+) |
| `resonantFrequency`, `qFactor` | – | API 34+, when reported |
| `minFrequencyHz`, `maxFrequencyHz`, `maxOutputAccelerationGs` | – | `getFrequencyProfile()` (API 36+) |
| `vibratorIds` | `[]` | `VibratorManager.getVibratorIds()` (API 31+) |
| `hapticFeedbackEnabled` | – | the system touch-feedback setting |

### Types

#### `HapticPattern`

```typescript
type HapticPattern = { events: HapticEvent[]; curves?: HapticCurve[] }

type HapticEvent =
  | { type: 'transient'; time: number; intensity: number; sharpness: number } & HapticEventEnvelope
  | { type: 'continuous'; time: number; duration: number; intensity: number; sharpness: number } & HapticEventEnvelope
  | { type: 'audioContinuous'; time: number; duration: number } & HapticAudioParameters & HapticEventEnvelope
  | { type: 'audioCustom'; time: number; resource: string; duration?: number } & HapticAudioParameters & HapticEventEnvelope

type HapticEventEnvelope = { attackTime?: number; decayTime?: number; releaseTime?: number; sustained?: boolean }
type HapticAudioParameters = { volume?: number; pitch?: number; pan?: number; brightness?: number }

type HapticCurve = {
  parameter:
    | 'intensity' | 'sharpness'
    | 'attackTime' | 'decayTime' | 'releaseTime'
    | 'audioVolume' | 'audioPan' | 'audioPitch' | 'audioBrightness'
  time: number
  points: { time: number; value: number }[]
}
```

- All times and durations are in **seconds**. An event's `time` is from the start of the pattern; a curve point's `time` is from the curve's own `time`.
- `intensity` and `sharpness` are `0..1`. Sharpness runs from soft and round (0) to crisp and clicky (1).
- `attackTime` / `decayTime` / `releaseTime` use Core Haptics' relative `0..1` scale. On Android, `attackTime` / `releaseTime` fade a continuous event in / out over up to half its length.
- **Curves shape continuous (and audio) events only.** Transients always keep their own intensity and sharpness, so taps stay crisp on top of a shaped rumble.
  - `intensity` / `audioVolume`: a multiplier (`0..1`).
  - Everything else: an offset (`-1..1`).
  - Linear between points. Before a curve's first point the parameter is unchanged; after its last point it holds the last value. Curves with more than 16 points are split for Core Haptics automatically.

#### `VibrationOptions`

```typescript
type VibrationOptions = {
  usage?: 'unknown' | 'touch' | 'notification' | 'alarm' | 'ringtone' | 'media'
    | 'communicationRequest' | 'hardwareFeedback' | 'physicalEmulation' | 'accessibility'
  vibratorIds?: number[] // VibratorManager ids (Android 12+)
}
```

`usage` maps to `VibrationAttributes` (Android 13+) or `AudioAttributes` (8-12), which decides which system settings (touch feedback, ring / notification vibration, Do Not Disturb) apply.

## 📖 Usage Examples

### Buttons and toggles

```typescript
import { impact, performHapticFeedback } from 'munim-haptics'
import { Platform } from 'react-native'

export async function onToggle(on: boolean) {
  if (Platform.OS === 'android') {
    // The OEM-tuned toggle haptic (Android 14+; older versions fall back).
    await performHapticFeedback(on ? 'toggleOn' : 'toggleOff')
  } else {
    await impact(on ? 'medium' : 'light')
  }
}
```

### A charging rumble that follows a gesture

```typescript
import { createPlayer } from 'munim-haptics'

const charge = createPlayer({
  events: [{ type: 'continuous', time: 0, duration: 2, intensity: 1, sharpness: 0.2 }],
})
charge.loopEnabled = true

export function onPressIn() {
  charge.start()
}

export function onDrag(progress: number) {
  // 0..1 → stronger and crisper as the user pulls further.
  charge.sendParameters({ intensity: 0.2 + 0.8 * progress, sharpness: progress - 0.5 })
}

export function onRelease() {
  charge.stop()
}
```

### A designed reveal: build-up, then a hit

```typescript
import { createPlayer, impact, isSupported } from 'munim-haptics'

const reveal = createPlayer({
  events: [
    { type: 'continuous', time: 0, duration: 0.64, intensity: 0.9, sharpness: 0.15, attackTime: 0.4 },
    ...[0, 0.11, 0.21, 0.3, 0.38, 0.45, 0.51, 0.56, 0.6, 0.62].map((time, i) => ({
      type: 'transient' as const,
      time,
      intensity: 0.4 + i * 0.05,
      sharpness: 0.3 + i * 0.05,
    })),
    { type: 'transient', time: 0.644, intensity: 1, sharpness: 1 },
  ],
  curves: [
    { parameter: 'intensity', time: 0, points: [{ time: 0, value: 0.15 }, { time: 0.4, value: 0.35 }, { time: 0.64, value: 1 }] },
  ],
})

reveal.onComplete(() => console.log('revealed'))
if (isSupported()) await reveal.start()
else await impact('heavy')
```

### AHAP with sound (iOS)

```typescript
import { setEngineOptions, playAHAPFile, playAHAP, buildAHAP } from 'munim-haptics'

// Audio events need an engine that plays audio.
setEngineOptions({ playsHapticsOnly: false })

// Boing.ahap and Boing.wav in the app bundle (Android plays the haptics only).
await playAHAPFile('Boing.ahap')

// Or build one in code:
await playAHAP(
  buildAHAP({
    events: [
      { type: 'transient', time: 0, intensity: 1, sharpness: 0.8 },
      { type: 'audioContinuous', time: 0, duration: 0.3, volume: 0.6, pitch: -0.4 },
    ],
  })
)
```

### Android primitives with a capability check

```typescript
import { getCapabilities, playPrimitives, vibrate } from 'munim-haptics'

const caps = getCapabilities()
const hasThud = caps.primitives.some((p) => p.primitive === 'thud' && p.supported)

if (hasThud) {
  await playPrimitives([
    { primitive: 'slowRise', scale: 0.5 },
    { primitive: 'thud', scale: 1, delayMs: 50 },
  ], { usage: 'touch' })
} else {
  await vibrate(80, 200)
}
```

### Android 16 envelopes

```typescript
import { playEnvelope } from 'munim-haptics'

// Swell up crisp, fade out soft. Native on Android 16 hardware that supports
// it, a sampled waveform elsewhere, a shaped Core Haptics event on iOS.
await playEnvelope({
  kind: 'basic',
  initialSharpness: 0.3,
  points: [
    { intensity: 1, sharpness: 0.9, durationMs: 150 },
    { intensity: 0, sharpness: 0.2, durationMs: 300 },
  ],
})
```

### A second vibrator (Android 12+)

```typescript
import { getCapabilities, setDefaultVibrationOptions, playWaveform } from 'munim-haptics'

const { vibratorIds } = getCapabilities() // e.g. [0, 1] on a foldable or a controller
setDefaultVibrationOptions({ vibratorIds: vibratorIds.slice(1), usage: 'media' })
await playWaveform([0, 100, 50, 100], [0, 255, 0, 128])
```

### Listening to the engine (iOS)

```typescript
import { addEngineListener } from 'munim-haptics'

const subscription = addEngineListener((event) => {
  if (event.type === 'stopped') console.log('Core Haptics stopped:', event.reason)
})
// later
subscription.remove()
```

## Platform Notes

### iOS

- One `CHHapticEngine` serves the whole app. It keeps running between patterns (no auto-shutdown unless you enable it) so there's no start-up lag; the system stops it when the app goes to the background, and it restarts on the next call.
- Haptics don't play while the app is in the background, or while the app is recording from the microphone.
- The UIKit generators follow the user's **System Haptics** setting. iOS has no public API to read that setting.

### Android

- Patterns are sampled every 10 ms into `VibrationEffect.createWaveform` amplitudes. Transients become 10-20 ms pulses (sharper is shorter); the 10 ms grid can shift a tap by up to 5 ms. Without amplitude control a pattern plays as on / off: transients are full pulses and continuous events are on only where they reach 0.6.
- Android vibrators have no sharpness: sharpness values and curves are ignored (except in Android 16 basic envelopes, which take sharpness natively).
- A new vibration replaces the one playing. Players re-issue the rest of their waveform when you change them, which can restart a primitive mid-way.
- Before API 26 (no `VibrationEffect`), everything plays as on / off timings.
- `performHapticFeedback` needs a foreground activity; it resolves `false` without one.

## 🔍 Troubleshooting

### Common Issues

1. **Nothing plays on iOS**: check that you're on an iPhone 8 or later (not the Simulator or an iPad), that the app is in the foreground, and that `getCapabilities().supportsHaptics` is `true`. Feedback generators are also silent when System Haptics is off.
2. **Audio events are silent**: call `setEngineOptions({ playsHapticsOnly: false })` before playing, and check the ringer switch / volume.
3. **Android feels weak or buzzy**: many devices lack amplitude control or primitives. Check `getCapabilities()` and prefer `performHapticFeedback` or `playPredefined` for UI feedback; they use the OEM's tuned effects.
4. **Android `touch` usage plays nothing**: the user turned touch feedback off (`getCapabilities().hapticFeedbackEnabled`); that's the setting working.
5. **`playAHAPFile` can't find the file**: on iOS add the `.ahap` to the app target (Copy Bundle Resources); on Android put it in `android/app/src/main/assets` or `res/raw`.
6. **A repeating waveform won't stop**: call `cancel()`.

### Expo-Specific Issues

1. **Development Build Required**: This library requires a development build in Expo. Use `npx expo run:ios`, `npx expo run:android`, or an EAS development build. Expo Go is not supported.
2. **Build Errors**: Ensure you're using Expo SDK 50+ and have the latest Expo CLI
3. **Nitro Modules**: Make sure you have `react-native-nitro-modules` installed

## 👏 Contributing

We welcome contributions! Open an issue or a pull request on [GitHub](https://github.com/munimtechnologies/munim-haptics).

```bash
npm install
npm run codegen   # nitrogen + TypeScript build, after changing src/specs
npm test          # Jest: pattern normalization, AHAP, iOS stand-ins
scripts/typecheck-swift.sh   # Swift + Nitro bridge typecheck against the iOS SDK (macOS)
scripts/compile-kotlin.sh    # Kotlin compile check against android.jar (needs kotlinc)
```

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

---

<img alt="Star the Munim Technologies repo on GitHub to support the project" src="https://user-images.githubusercontent.com/9664363/185428788-d762fd5d-97b3-4f59-8db7-f72405be9677.gif" width="50%">
