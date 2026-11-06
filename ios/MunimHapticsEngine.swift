//
//  MunimHapticsEngine.swift
//  munim-haptics
//
//  One shared CHHapticEngine for the whole process. It starts lazily (or on
//  prepare()), stays running so patterns play with no start-up lag, and
//  restarts after the system resets or stops it.
//

import CoreHaptics
import Foundation

enum MunimHapticsError: LocalizedError {
    case unsupported

    var errorDescription: String? {
        switch self {
        case .unsupported:
            return "This device does not support Core Haptics."
        }
    }
}

/// All mutable state is only touched on the serial `queue`.
final class MunimHapticsEngine: @unchecked Sendable {
    static let shared = MunimHapticsEngine()

    /// Core Haptics allows at most 16 control points per parameter curve.
    private static let maxCurvePoints = 16

    let supportsHaptics: Bool = CHHapticEngine.capabilitiesForHardware().supportsHaptics

    private let queue = DispatchQueue(label: "com.munimhaptics.engine")
    private var engine: CHHapticEngine?
    private var isRunning = false
    private var players: [CHHapticPatternPlayer] = []

    private init() {}

    // MARK: - Public (all calls hop onto the serial queue)

    func prepare(completion: @escaping (Error?) -> Void) {
        queue.async {
            do {
                _ = try self.runningEngine()
                completion(nil)
            } catch {
                completion(error)
            }
        }
    }

    func play(_ pattern: NativeHapticPattern, completion: @escaping (Error?) -> Void) {
        queue.async {
            do {
                try self.playOnQueue(pattern)
                completion(nil)
            } catch {
                completion(error)
            }
        }
    }

    func stop(completion: @escaping () -> Void) {
        queue.async {
            self.stopPlayers()
            completion()
        }
    }

    // MARK: - Engine

    private func runningEngine() throws -> CHHapticEngine {
        guard supportsHaptics else { throw MunimHapticsError.unsupported }
        let engine = try self.engine ?? makeEngine()
        if !isRunning {
            try engine.start()
            isRunning = true
        }
        return engine
    }

    private func makeEngine() throws -> CHHapticEngine {
        let engine = try CHHapticEngine()
        engine.playsHapticsOnly = true
        // Keep it running between patterns: restarting costs a noticeable
        // delay on the first tap. The system still stops it when the app
        // goes to the background (stoppedHandler below).
        engine.isAutoShutdownEnabled = false
        engine.stoppedHandler = { [weak self] _ in
            self?.queue.async {
                self?.isRunning = false
                self?.players.removeAll()
            }
        }
        engine.resetHandler = { [weak self] in
            // The haptic server restarted: every player is gone and the
            // engine must be started again.
            self?.queue.async {
                guard let self else { return }
                self.players.removeAll()
                self.isRunning = false
                if let engine = self.engine, (try? engine.start()) != nil {
                    self.isRunning = true
                }
            }
        }
        self.engine = engine
        return engine
    }

    private func stopPlayers() {
        for player in players {
            try? player.stop(atTime: CHHapticTimeImmediate)
        }
        players.removeAll()
    }

    // MARK: - Playing

    private func playOnQueue(_ pattern: NativeHapticPattern) throws {
        let engine = try runningEngine()
        stopPlayers()

        // Parameter curves act on every event in their player, so continuous
        // events (with the curves) and transients go to two players started
        // together: the curves shape the rumble but never the taps.
        var started: [CHHapticPatternPlayer] = []
        let continuous = try Self.continuousPattern(pattern)
        let transients = try Self.transientPattern(pattern)
        for hapticPattern in [continuous, transients].compactMap({ $0 }) {
            let player = try engine.makePlayer(with: hapticPattern)
            started.append(player)
        }
        do {
            for player in started {
                try player.start(atTime: CHHapticTimeImmediate)
            }
        } catch {
            for player in started {
                try? player.stop(atTime: CHHapticTimeImmediate)
            }
            throw error
        }
        players = started
    }

    private static func eventParameters(intensity: Double, sharpness: Double) -> [CHHapticEventParameter] {
        [
            CHHapticEventParameter(parameterID: .hapticIntensity, value: Float(clamp(intensity, 0, 1))),
            CHHapticEventParameter(parameterID: .hapticSharpness, value: Float(clamp(sharpness, 0, 1))),
        ]
    }

    private static func transientPattern(_ pattern: NativeHapticPattern) throws -> CHHapticPattern? {
        let events = pattern.events
            .filter { $0.type == .transient }
            .map {
                CHHapticEvent(
                    eventType: .hapticTransient,
                    parameters: eventParameters(intensity: $0.intensity, sharpness: $0.sharpness),
                    relativeTime: max(0, $0.time)
                )
            }
        if events.isEmpty { return nil }
        return try CHHapticPattern(events: events, parameters: [])
    }

    private static func continuousPattern(_ pattern: NativeHapticPattern) throws -> CHHapticPattern? {
        let events = pattern.events
            .filter { $0.type == .continuous && $0.duration > 0 }
            .map {
                CHHapticEvent(
                    eventType: .hapticContinuous,
                    parameters: eventParameters(intensity: $0.intensity, sharpness: $0.sharpness),
                    relativeTime: max(0, $0.time),
                    duration: $0.duration
                )
            }
        if events.isEmpty { return nil }
        let curves = pattern.curves.flatMap { parameterCurves($0) }
        return try CHHapticPattern(events: events, parameterCurves: curves)
    }

    /// One curve, split into curves of at most 16 points that pick up where
    /// the previous one left off.
    private static func parameterCurves(_ curve: HapticCurve) -> [CHHapticParameterCurve] {
        // An if, not a switch: Nitro's enums are C++ enums seen from Swift,
        // which Swift may not treat as exhaustive.
        let isSharpness = curve.parameter == .sharpness
        let parameterID: CHHapticDynamicParameter.ID = isSharpness ? .hapticSharpnessControl : .hapticIntensityControl
        let minValue: Double = isSharpness ? -1 : 0
        let points = curve.points.sorted { $0.time < $1.time }
        if points.isEmpty { return [] }

        var result: [CHHapticParameterCurve] = []
        var start = 0
        while start < points.count {
            let end = min(start + maxCurvePoints, points.count)
            let chunk = Array(points[start..<end])
            let origin = max(0, chunk[0].time)
            let controlPoints = chunk.map {
                CHHapticParameterCurve.ControlPoint(
                    relativeTime: max(0, $0.time - origin),
                    value: Float(clamp($0.value, minValue, 1))
                )
            }
            result.append(
                CHHapticParameterCurve(
                    parameterID: parameterID,
                    controlPoints: controlPoints,
                    relativeTime: max(0, curve.time) + origin
                )
            )
            if end == points.count { break }
            // The next chunk starts on this chunk's last point.
            start = end - 1
        }
        return result
    }

    private static func clamp(_ value: Double, _ low: Double, _ high: Double) -> Double {
        guard value.isFinite else { return low }
        return min(high, max(low, value))
    }
}
