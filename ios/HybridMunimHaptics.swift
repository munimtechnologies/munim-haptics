//
//  HybridMunimHaptics.swift
//  munim-haptics
//
//  Nitro entry point. Core Haptics calls delegate to the process-wide
//  MunimHapticsEngine (so the engine survives JavaScript reloads), feedback
//  calls to the shared UIKit generators. The Android-only calls are
//  emulated in JavaScript on iOS; natively they resolve without effect.
//

import Foundation
import NitroModules
import UIKit

final class HybridMunimHaptics: HybridMunimHapticsSpec {
    private let engine = MunimHapticsEngine.shared
    private let feedback = FeedbackGenerators.shared

    // MARK: - 0.1.0

    func isSupported() throws -> Bool {
        engine.supportsHaptics
    }

    func prepare() throws -> Promise<Void> {
        promise { self.engine.prepare(completion: $0) }
    }

    func playPattern(pattern: NativeHapticPattern) throws -> Promise<Void> {
        promise { self.engine.play(pattern, completion: $0) }
    }

    func stop() throws -> Promise<Void> {
        let promise = Promise<Void>()
        engine.stop { promise.resolve(withResult: ()) }
        return promise
    }

    // MARK: - Capabilities

    func getCapabilities() throws -> HapticCapabilities {
        let haptics = engine.supportsHaptics
        return HapticCapabilities(
            platform: "ios",
            osVersion: UIDevice.current.systemVersion,
            apiLevel: 0,
            supportsHaptics: haptics,
            supportsAudio: engine.supportsAudio,
            supportsPatterns: haptics,
            hasVibrator: haptics,
            hasAmplitudeControl: haptics,
            hasFrequencyControl: false,
            supportsPrimitives: false,
            primitives: [],
            effects: [],
            supportsEnvelopeEffects: false,
            envelopeMaxControlPoints: nil,
            envelopeMaxDurationMs: nil,
            envelopeMinControlPointDurationMs: nil,
            envelopeMaxControlPointDurationMs: nil,
            resonantFrequency: nil,
            qFactor: nil,
            minFrequencyHz: nil,
            maxFrequencyHz: nil,
            maxOutputAccelerationGs: nil,
            vibratorIds: [],
            hapticFeedbackEnabled: nil
        )
    }

    // MARK: - Feedback generators

    func impact(style: ImpactStyle, intensity: Double) throws -> Promise<Void> {
        resolved { self.feedback.impact(style, intensity: intensity, completion: $0) }
    }

    func notification(type: NotificationFeedbackType) throws -> Promise<Void> {
        resolved { self.feedback.notification(type, completion: $0) }
    }

    func selection() throws -> Promise<Void> {
        resolved { self.feedback.selection(completion: $0) }
    }

    func prepareImpact(style: ImpactStyle) throws -> Promise<Void> {
        resolved { self.feedback.prepareImpact(style, completion: $0) }
    }

    func prepareNotification() throws -> Promise<Void> {
        resolved { self.feedback.prepareNotification(completion: $0) }
    }

    func prepareSelection() throws -> Promise<Void> {
        resolved { self.feedback.prepareSelection(completion: $0) }
    }

    // MARK: - AHAP and players

    func playAHAP(ahap: String) throws -> Promise<Void> {
        promise { self.engine.playAHAP(ahap, completion: $0) }
    }

    func playAHAPFile(path: String) throws -> Promise<Void> {
        promise { self.engine.playAHAPFile(path, completion: $0) }
    }

    func readTextFile(path: String) throws -> Promise<String> {
        Promise.async {
            guard let url = MunimHapticsEngine.resolveURL(path, defaultExtension: "ahap") else {
                throw MunimHapticsError.fileNotFound(path)
            }
            return try String(contentsOf: url, encoding: .utf8)
        }
    }

    func createPlayer(pattern: NativeHapticPattern) throws -> (any HybridHapticPlayerSpec) {
        let engine = self.engine
        return try engine.queue.sync {
            _ = try engine.runningEngine()
            return try HybridHapticPlayer {
                try engine.makePatterns(pattern, alignEnds: true)
            }
        }
    }

    func createPlayerFromAHAP(ahap: String) throws -> (any HybridHapticPlayerSpec) {
        let engine = self.engine
        return try engine.queue.sync {
            _ = try engine.runningEngine()
            return try HybridHapticPlayer {
                [MunimHapticsEngine.BuiltPattern(pattern: try MunimHapticsEngine.pattern(fromAHAP: ahap), takesCurves: true)]
            }
        }
    }

    // MARK: - Engine

    func startEngine() throws -> Promise<Void> {
        promise { self.engine.startEngine(completion: $0) }
    }

    func stopEngine() throws -> Promise<Void> {
        promise { self.engine.stopEngine(completion: $0) }
    }

    func setEngineOptions(options: HapticEngineOptions) throws {
        engine.setOptions(options)
    }

    func getEngineState() throws -> HapticEngineState {
        engine.state()
    }

    func setEngineListener(listener: @escaping (HapticEngineEvent) -> Void) throws {
        engine.setListener(listener)
    }

    // MARK: - Android only (emulated in JavaScript on iOS)

    func vibrate(durationMs: Double, amplitude: Double, options: NativeVibrationOptions) throws -> Promise<Void> {
        Promise.resolved(withResult: ())
    }

    func playWaveform(timingsMs: [Double], amplitudes: [Double], repeatIndex: Double, options: NativeVibrationOptions) throws -> Promise<Void> {
        Promise.resolved(withResult: ())
    }

    func playPredefined(effect: AndroidPredefinedEffect, fallback: Bool, options: NativeVibrationOptions) throws -> Promise<Bool> {
        Promise.resolved(withResult: false)
    }

    func playPrimitives(steps: [NativePrimitiveStep], fallback: Bool, options: NativeVibrationOptions) throws -> Promise<Bool> {
        Promise.resolved(withResult: false)
    }

    func playEnvelope(envelope: NativeHapticEnvelope, options: NativeVibrationOptions) throws -> Promise<Void> {
        Promise.resolved(withResult: ())
    }

    func performHapticFeedback(feedback: AndroidHapticFeedback, fallback: Bool) throws -> Promise<Bool> {
        Promise.resolved(withResult: false)
    }

    func cancel() throws -> Promise<Void> {
        try stop()
    }

    // MARK: - Helpers

    private func promise(_ start: (@escaping (Error?) -> Void) -> Void) -> Promise<Void> {
        let promise = Promise<Void>()
        start { error in
            if let error {
                promise.reject(withError: error)
            } else {
                promise.resolve(withResult: ())
            }
        }
        return promise
    }

    private func resolved(_ start: (@escaping () -> Void) -> Void) -> Promise<Void> {
        let promise = Promise<Void>()
        start { promise.resolve(withResult: ()) }
        return promise
    }
}
