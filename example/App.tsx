import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import {
  addEngineListener,
  buildAHAP,
  cancel,
  compilePattern,
  createPlayer,
  createPlayerFromAHAP,
  createRealtimeHaptic,
  getCapabilities,
  getEngineState,
  impact,
  isSupported,
  notification,
  performHapticFeedback,
  playAHAP,
  playEnvelope,
  playPattern,
  playPredefined,
  playPreset,
  playPrimitives,
  playWaveform,
  preloadPresets,
  presetNames,
  selection,
  startEngine,
  stopEngine,
  vibrate,
  type AndroidHapticFeedback,
  type AndroidPredefinedEffect,
  type CompiledHapticPattern,
  type HapticCapabilities,
  type HapticPattern,
  type HapticPlayer,
  type ImpactStyle,
} from 'munim-haptics'
import { runBenchmark, type BenchResult } from './bench'

const REVEAL: HapticPattern = {
  events: [
    { type: 'continuous', time: 0, duration: 0.6, intensity: 1, sharpness: 0.3 },
    { type: 'transient', time: 0.62, intensity: 1, sharpness: 1 },
  ],
  curves: [
    {
      parameter: 'intensity',
      time: 0,
      points: [
        { time: 0, value: 0.1 },
        { time: 0.6, value: 1 },
      ],
    },
  ],
}

const PLAYER_PATTERN: HapticPattern = {
  events: [
    { type: 'continuous', time: 0, duration: 2, intensity: 0.8, sharpness: 0.4 },
    { type: 'transient', time: 0.5, intensity: 1, sharpness: 1 },
    { type: 'transient', time: 1, intensity: 1, sharpness: 1 },
    { type: 'transient', time: 1.5, intensity: 1, sharpness: 1 },
  ],
}

const IMPACTS: ImpactStyle[] = ['light', 'medium', 'heavy', 'soft', 'rigid']
const PREDEFINED: AndroidPredefinedEffect[] = ['click', 'doubleClick', 'tick', 'heavyClick']
const VIEW_FEEDBACK: AndroidHapticFeedback[] = [
  'confirm',
  'reject',
  'toggleOn',
  'toggleOff',
  'longPress',
  'keyboardTap',
  'clockTick',
  'segmentTick',
  'segmentFrequentTick',
  'gestureThresholdActivate',
  'dragStart',
]

const yesNo = (value: boolean | undefined) => (value === undefined ? 'n/a' : value ? 'yes' : 'no')

export default function App() {
  return (
    <SafeAreaProvider>
      <Screen />
    </SafeAreaProvider>
  )
}

function Screen() {
  const [message, setMessage] = useState('Tap anything to feel it.')
  const [capabilities, setCapabilities] = useState<HapticCapabilities>(() => getCapabilities())
  const [engineLog, setEngineLog] = useState<string[]>([])
  const [bench, setBench] = useState<BenchResult | null>(null)
  const [benchRunning, setBenchRunning] = useState(false)
  const [loop, setLoop] = useState(false)
  const [rate, setRate] = useState(1)
  const [realtime, setRealtime] = useState({ intensity: 0, sharpness: 0, active: false })
  const player = useRef<HapticPlayer | null>(null)
  const compiled = useRef<CompiledHapticPattern | null>(null)
  const realtimeHaptic = useMemo(() => createRealtimeHaptic(), [])

  useEffect(() => {
    const subscription = addEngineListener((event) =>
      setEngineLog((log) => [`${event.type} (${event.reason})`, ...log].slice(0, 5))
    )
    return () => {
      subscription.remove()
      player.current?.release()
      compiled.current?.release()
      realtimeHaptic.stop().catch(() => {})
    }
  }, [realtimeHaptic])

  /** Runs an action and shows its result (or error) in the status line. */
  const run = (label: string, action: () => Promise<unknown> | unknown) => async () => {
    try {
      const result = await action()
      setMessage(result === undefined ? label : `${label}: ${String(result)}`)
    } catch (error) {
      setMessage(`${label} failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const ensurePlayer = () => {
    if (!player.current) {
      const created = createPlayer(PLAYER_PATTERN)
      created.onComplete((error) => setMessage(error ? `Player failed: ${error}` : 'Player finished'))
      player.current = created
    }
    return player.current
  }

  const onPad = (event: GestureResponderEvent, layout: { width: number; height: number }) => {
    const { locationX, locationY } = event.nativeEvent
    const sharpness = Math.min(1, Math.max(0, locationX / layout.width))
    const intensity = Math.min(1, Math.max(0, 1 - locationY / layout.height))
    realtimeHaptic.set(intensity, sharpness)
    setRealtime({ intensity, sharpness, active: true })
  }
  const padLayout = useRef({ width: 1, height: 1 })

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>Munim Haptics</Text>
        <Text style={styles.status} testID="status">
          {message}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Capabilities">
          <Text style={styles.mono} testID="capabilities">
            {[
              `platform ${capabilities.platform} ${capabilities.osVersion}${
                capabilities.apiLevel ? ` (API ${capabilities.apiLevel})` : ''
              }`,
              `isSupported ${yesNo(isSupported())}  haptics ${yesNo(capabilities.supportsHaptics)}  feedback ${yesNo(
                capabilities.supportsFeedback
              )}`,
              `patterns ${yesNo(capabilities.supportsPatterns)}  audio ${yesNo(capabilities.supportsAudio)}`,
              `vibrator ${yesNo(capabilities.hasVibrator)}  amplitude ${yesNo(
                capabilities.hasAmplitudeControl
              )}  frequency ${yesNo(capabilities.hasFrequencyControl)}`,
              `primitives ${
                capabilities.primitives
                  .filter((p) => p.supported)
                  .map((p) => `${p.primitive}${p.durationMs ? ` ${p.durationMs}ms` : ''}`)
                  .join(', ') || 'none'
              }`,
              `effects ${capabilities.effects.map((e) => `${e.effect}:${e.support}`).join(', ') || 'none'}`,
              `envelopes ${yesNo(capabilities.supportsEnvelopeEffects)}${
                capabilities.envelopeMaxControlPoints ? ` (max ${capabilities.envelopeMaxControlPoints} points)` : ''
              }`,
              `resonance ${capabilities.resonantFrequency?.toFixed(1) ?? 'n/a'} Hz  Q ${
                capabilities.qFactor?.toFixed(1) ?? 'n/a'
              }`,
              `frequency range ${
                capabilities.minFrequencyHz !== undefined
                  ? `${capabilities.minFrequencyHz.toFixed(0)}-${capabilities.maxFrequencyHz?.toFixed(0)} Hz`
                  : 'n/a'
              }  response points ${capabilities.frequencyResponse.length}`,
              `vibrators [${capabilities.vibratorIds.join(', ')}]  touch feedback ${yesNo(
                capabilities.hapticFeedbackEnabled
              )}`,
            ].join('\n')}
          </Text>
          <Button label="Refresh" onPress={() => setCapabilities(getCapabilities())} />
        </Section>

        <Section title="Feedback">
          <Row>
            {IMPACTS.map((style) => (
              <Button key={style} label={style} onPress={run(`impact ${style}`, () => impact(style))} />
            ))}
            <Button label="medium @ 0.3" onPress={run('impact medium 0.3', () => impact('medium', 0.3))} />
          </Row>
          <Row>
            <Button label="success" onPress={run('notification success', () => notification('success'))} />
            <Button label="warning" onPress={run('notification warning', () => notification('warning'))} />
            <Button label="error" onPress={run('notification error', () => notification('error'))} />
            <Button label="selection" onPress={run('selection', () => selection())} />
          </Row>
        </Section>

        <Section title="Presets">
          <Row>
            {presetNames.map((name) => (
              <Button key={name} label={name} onPress={run(`preset ${name} played`, () => playPreset(name))} />
            ))}
          </Row>
          <Button label="Preload all presets" onPress={run('presets preloaded', () => preloadPresets())} />
        </Section>

        <Section title="Patterns">
          <Row>
            <Button label="Play reveal" onPress={run('playPattern', () => playPattern(REVEAL))} />
            <Button
              label="Play reveal (on/off fallback)"
              onPress={run('playPattern fallback', () => playPattern(REVEAL, { fallback: true }))}
            />
          </Row>
          <Row>
            <Button
              label="Compile reveal"
              onPress={run('compiled, duration (s)', () => {
                compiled.current?.release()
                compiled.current = compilePattern(REVEAL, { fallback: true })
                return compiled.current.duration.toFixed(2)
              })}
            />
            <Button
              label="Play compiled"
              onPress={run('compiled play', () => (compiled.current ?? compilePattern(REVEAL)).play())}
            />
            <Button label="Stop compiled" onPress={run('compiled stop', () => compiled.current?.stop())} />
          </Row>
          <Row>
            <Button label="Play as AHAP" onPress={run('playAHAP', () => playAHAP(buildAHAP(REVEAL)))} />
            <Button
              label="AHAP player (loop 2x)"
              onPress={run('AHAP player started', async () => {
                const ahapPlayer = createPlayerFromAHAP(buildAHAP(REVEAL))
                ahapPlayer.loopEnabled = true
                await ahapPlayer.start()
                await ahapPlayer.stop(ahapPlayer.duration * 2)
              })}
            />
          </Row>
        </Section>

        <Section title="Player">
          <Row>
            <Button label="Start" onPress={run('player start', () => ensurePlayer().start())} />
            <Button label="Pause" onPress={run('player pause', () => ensurePlayer().pause())} />
            <Button label="Resume" onPress={run('player resume', () => ensurePlayer().resume())} />
            <Button label="Stop" onPress={run('player stop', () => ensurePlayer().stop())} />
            <Button label="Seek 1 s" onPress={run('player seek', () => ensurePlayer().seek(1))} />
          </Row>
          <Row>
            <Button
              label={`Loop ${loop ? 'on' : 'off'}`}
              onPress={() => {
                ensurePlayer().loopEnabled = !loop
                setLoop(!loop)
              }}
            />
            {[0.5, 1, 2].map((value) => (
              <Button
                key={value}
                label={`${value}x${rate === value ? ' *' : ''}`}
                onPress={() => {
                  ensurePlayer().playbackRate = value
                  setRate(value)
                }}
              />
            ))}
          </Row>
          <Row>
            <Button
              label="Intensity 0.3"
              onPress={run('intensity 0.3', () => ensurePlayer().sendParameters({ intensity: 0.3 }))}
            />
            <Button
              label="Intensity 1"
              onPress={run('intensity 1', () => ensurePlayer().sendParameters({ intensity: 1 }))}
            />
            <Button
              label="Fade-out curve"
              onPress={run('curve scheduled', () =>
                ensurePlayer().scheduleParameterCurve({
                  parameter: 'intensity',
                  time: 0,
                  points: [
                    { time: 0, value: 1 },
                    { time: 0.8, value: 0 },
                  ],
                })
              )}
            />
            <Button
              label="Release"
              onPress={() => {
                player.current?.release()
                player.current = null
                setMessage('player released')
              }}
            />
          </Row>
        </Section>

        <Section title="Real-time">
          <Text style={styles.note}>
            Hold and drag: up = stronger, right = sharper (sharpness is iOS only).{'\n'}
            {realtime.active
              ? `intensity ${realtime.intensity.toFixed(2)}  sharpness ${realtime.sharpness.toFixed(2)}`
              : 'idle'}
          </Text>
          <View
            style={styles.pad}
            testID="realtime-pad"
            onLayout={(event) => {
              padLayout.current = event.nativeEvent.layout
            }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(event) => {
              const { locationX, locationY } = event.nativeEvent
              const { width, height } = padLayout.current
              const intensity = Math.min(1, Math.max(0, 1 - locationY / height))
              const sharpness = Math.min(1, Math.max(0, locationX / width))
              setRealtime({ intensity, sharpness, active: true })
              realtimeHaptic.start(intensity, sharpness).catch((error: unknown) => setMessage(String(error)))
            }}
            onResponderMove={(event) => onPad(event, padLayout.current)}
            onResponderRelease={() => {
              setRealtime((value) => ({ ...value, active: false }))
              realtimeHaptic.stop().catch(() => {})
            }}
            onResponderTerminate={() => {
              setRealtime((value) => ({ ...value, active: false }))
              realtimeHaptic.stop().catch(() => {})
            }}
          />
        </Section>

        <Section title={`Android vibrator${Platform.OS === 'ios' ? ' (iOS stand-ins)' : ''}`}>
          <Row>
            {PREDEFINED.map((effect) => (
              <Button
                key={effect}
                label={effect}
                onPress={run(`predefined ${effect} played`, () => playPredefined(effect))}
              />
            ))}
          </Row>
          <Row>
            <Button
              label="Primitives"
              onPress={run('primitives played', () =>
                playPrimitives([
                  { primitive: 'slowRise', scale: 0.6 },
                  { primitive: 'click', scale: 1, delayMs: 30 },
                  { primitive: 'thud', scale: 0.8, delayMs: 80 },
                ])
              )}
            />
            <Button
              label="Primitives (no fallback)"
              onPress={run('primitives played', () =>
                playPrimitives([{ primitive: 'spin' }, { primitive: 'lowTick', delayMs: 50 }], { fallback: false })
              )}
            />
          </Row>
          <Row>
            <Button
              label="Basic envelope"
              onPress={run('envelope', () =>
                playEnvelope({
                  kind: 'basic',
                  initialSharpness: 0.2,
                  points: [
                    { intensity: 1, sharpness: 0.8, durationMs: 200 },
                    { intensity: 0.4, sharpness: 0.3, durationMs: 300 },
                    { intensity: 0, sharpness: 0.3, durationMs: 200 },
                  ],
                })
              )}
            />
            <Button
              label="Waveform envelope"
              onPress={run('envelope', () =>
                playEnvelope({
                  kind: 'waveform',
                  initialFrequencyHz: 80,
                  points: [
                    { amplitude: 1, frequencyHz: 200, durationMs: 250 },
                    { amplitude: 0, frequencyHz: 80, durationMs: 250 },
                  ],
                })
              )}
            />
          </Row>
          <Row>
            <Button label="Vibrate 200 ms" onPress={run('vibrate', () => vibrate(200, 160))} />
            <Button
              label="Repeating waveform"
              onPress={run('waveform (cancel to stop)', () =>
                playWaveform([0, 80, 120, 40, 360], [0, 255, 0, 120, 0], 1)
              )}
            />
            <Button label="Cancel" onPress={run('cancelled', () => cancel())} />
          </Row>
          <Row>
            {VIEW_FEEDBACK.map((constant) => (
              <Button
                key={constant}
                label={constant}
                onPress={run(`view feedback ${constant} played`, () => performHapticFeedback(constant))}
              />
            ))}
          </Row>
        </Section>

        <Section title="Core Haptics engine (iOS)">
          <Row>
            <Button label="Start engine" onPress={run('engine started', () => startEngine())} />
            <Button label="Stop engine" onPress={run('engine stopped', () => stopEngine())} />
            <Button label="State" onPress={run('engine', () => JSON.stringify(getEngineState()))} />
          </Row>
          <Text style={styles.mono}>{engineLog.length ? engineLog.join('\n') : 'no engine events yet'}</Text>
        </Section>

        <Section title="Benchmark">
          <Text style={styles.note}>
            Plays the same 65-event pattern (faint) 50 times with playPattern, then 50 times compiled. Mean ms
            until each call resolves.
          </Text>
          <Button
            label={benchRunning ? 'Running…' : 'Run benchmark'}
            onPress={async () => {
              if (benchRunning) return
              setBenchRunning(true)
              try {
                setBench(await runBenchmark())
              } catch (error) {
                setMessage(`benchmark failed: ${String(error)}`)
              } finally {
                setBenchRunning(false)
              }
            }}
          />
          {bench ? (
            <Text style={styles.mono} testID="benchmark">
              {[
                `normalizePattern  ${bench.normalizeMs.toFixed(3)} ms`,
                `playPattern       ${bench.playPatternMs.toFixed(3)} ms`,
                `compile (once)    ${bench.compileMs.toFixed(3)} ms`,
                `compiled.play()   ${bench.compiledPlayMs.toFixed(3)} ms`,
                `speed-up          ${(bench.playPatternMs / Math.max(bench.compiledPlayMs, 0.001)).toFixed(1)}x`,
              ].join('\n')}
            </Text>
          ) : null}
        </Section>
      </ScrollView>
    </SafeAreaView>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      testID={`button-${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0d0f14' },
  header: { paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#232733' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 8 },
  status: { color: '#8fd3ff', marginTop: 4, minHeight: 20 },
  content: { padding: 16, paddingBottom: 48, gap: 16 },
  section: { backgroundColor: '#161a23', borderRadius: 12, padding: 12, gap: 8 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { backgroundColor: '#2b3242', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  buttonPressed: { backgroundColor: '#3d475e' },
  buttonText: { color: '#e8ecf5', fontSize: 14 },
  mono: { color: '#c9d1e3', fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 12 },
  note: { color: '#9aa3b5', fontSize: 13 },
  pad: { height: 180, borderRadius: 12, backgroundColor: '#20283a', borderWidth: 1, borderColor: '#3d475e' },
})
