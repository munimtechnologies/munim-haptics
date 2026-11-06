//
//  HybridHapticPlayer.swift
//  munim-haptics
//
//  An advanced pattern player: one or two CHHapticAdvancedPatternPlayers
//  (two when the pattern's curves must not shape its transients) driven
//  together. If the haptic server resets, the players are rebuilt from the
//  pattern on the next call, with the same loop / rate / mute settings.
//

import CoreHaptics
import Foundation
import NitroModules

final class HybridHapticPlayer: HybridHapticPlayerSpec, @unchecked Sendable {
    private struct Part {
        let player: CHHapticAdvancedPatternPlayer
        let takesCurves: Bool
    }

    private let engine = MunimHapticsEngine.shared
    /// Builds the patterns again (after a reset). Called on the engine queue.
    private let build: () throws -> [MunimHapticsEngine.BuiltPattern]
    private let patternDuration: Double

    // Only touched on the engine queue.
    private var parts: [Part] = []
    private var generation = -1
    private var pendingCompletions = 0

    private let stateLock = NSLock()
    private var _loopEnabled = false
    private var _loopEnd: Double = 0
    private var _playbackRate: Double = 1
    private var _isMuted = false
    private var completionListener: ((HapticPlayerCompletion) -> Void)?

    /// Call on the engine queue.
    init(build: @escaping () throws -> [MunimHapticsEngine.BuiltPattern]) throws {
        self.build = build
        let built = try build()
        guard !built.isEmpty else {
            throw MunimHapticsError.invalidAHAP("the pattern has no events")
        }
        patternDuration = built.map { $0.pattern.duration }.max() ?? 0
        super.init()
        try makeParts(from: built)
    }

    // MARK: - Properties

    var duration: Double { patternDuration }

    var loopEnabled: Bool {
        get { locked { _loopEnabled } }
        set {
            locked { _loopEnabled = newValue }
            apply { $0.loopEnabled = newValue }
        }
    }

    var loopEnd: Double {
        get { locked { _loopEnd } }
        set {
            let value = newValue.isFinite ? max(0, newValue) : 0
            locked { _loopEnd = value }
            apply { $0.loopEnd = value }
        }
    }

    var playbackRate: Double {
        get { locked { _playbackRate } }
        set {
            let value = newValue.isFinite && newValue > 0 ? newValue : 1
            locked { _playbackRate = value }
            apply { $0.playbackRate = Float(value) }
        }
    }

    var isMuted: Bool {
        get { locked { _isMuted } }
        set {
            locked { _isMuted = newValue }
            apply { $0.isMuted = newValue }
        }
    }

    func setCompletionListener(listener: @escaping (HapticPlayerCompletion) -> Void) throws {
        locked { completionListener = listener }
    }

    // MARK: - Playback

    func start(atTime: Double) throws -> Promise<Void> {
        perform(atTime) { parts, time in
            self.pendingCompletions = parts.count
            for part in parts { try part.player.start(atTime: time) }
        }
    }

    func stop(atTime: Double) throws -> Promise<Void> {
        perform(atTime) { parts, time in
            for part in parts { try part.player.stop(atTime: time) }
        }
    }

    func pause(atTime: Double) throws -> Promise<Void> {
        perform(atTime) { parts, time in
            for part in parts { try part.player.pause(atTime: time) }
        }
    }

    func resume(atTime: Double) throws -> Promise<Void> {
        perform(atTime) { parts, time in
            self.pendingCompletions = parts.count
            for part in parts { try part.player.resume(atTime: time) }
        }
    }

    func seek(offset: Double) throws -> Promise<Void> {
        let offset = offset.isFinite ? max(0, offset) : 0
        return perform(0) { parts, _ in
            for part in parts { try part.player.seek(toOffset: offset) }
        }
    }

    func cancel() throws -> Promise<Void> {
        perform(0) { parts, _ in
            for part in parts { try part.player.cancel() }
        }
    }

    func sendParameters(parameters: [HapticDynamicParameter], atTime: Double) throws -> Promise<Void> {
        let dynamic = parameters.map { parameter -> CHHapticDynamicParameter in
            let (id, low) = MunimHapticsEngine.dynamicParameterID(parameter.parameter)
            return CHHapticDynamicParameter(
                parameterID: id,
                value: Float(MunimHapticsEngine.clamp(parameter.value, low, 1)),
                relativeTime: 0
            )
        }
        return perform(atTime) { parts, time in
            for part in parts { try part.player.sendParameters(dynamic, atTime: time) }
        }
    }

    func scheduleParameterCurve(curve: HapticCurve, atTime: Double) throws -> Promise<Void> {
        let curves = MunimHapticsEngine.parameterCurves(curve, extraOffset: 0)
        return perform(atTime) { parts, time in
            let targets = parts.filter { $0.takesCurves }
            for part in targets.isEmpty ? parts : targets {
                for chunk in curves {
                    try part.player.scheduleParameterCurve(chunk, atTime: time)
                }
            }
        }
    }

    // MARK: - Internals

    private func locked<T>(_ body: () -> T) -> T {
        stateLock.lock()
        defer { stateLock.unlock() }
        return body()
    }

    /// Applies a setting to every current player, on the engine queue.
    private func apply(_ body: @escaping (CHHapticAdvancedPatternPlayer) -> Void) {
        engine.queue.async {
            for part in self.parts { body(part.player) }
        }
    }

    /// Runs `body` on the engine queue with valid players (rebuilt after a
    /// reset) and the engine time for `atTime`.
    private func perform(
        _ atTime: Double,
        _ body: @escaping ([Part], TimeInterval) throws -> Void
    ) -> Promise<Void> {
        let promise = Promise<Void>()
        engine.queue.async {
            do {
                _ = try self.engine.runningEngine()
                if self.generation != self.engine.generation {
                    try self.makeParts(from: try self.build())
                }
                try body(self.parts, self.engine.engineTime(after: atTime))
                promise.resolve(withResult: ())
            } catch {
                promise.reject(withError: error)
            }
        }
        return promise
    }

    /// Call on the engine queue, with the engine running.
    private func makeParts(from built: [MunimHapticsEngine.BuiltPattern]) throws {
        let engine = try self.engine.runningEngine()
        let (loopEnabled, loopEnd, rate, muted) = locked { (_loopEnabled, _loopEnd, _playbackRate, _isMuted) }
        var made: [Part] = []
        for item in built {
            let player = try engine.makeAdvancedPlayer(with: item.pattern)
            player.loopEnabled = loopEnabled
            player.loopEnd = loopEnd
            player.playbackRate = Float(rate)
            player.isMuted = muted
            player.completionHandler = { [weak self] error in
                self?.partCompleted(error)
            }
            made.append(Part(player: player, takesCurves: item.takesCurves))
        }
        parts = made
        generation = self.engine.generation
    }

    private func partCompleted(_ error: Error?) {
        engine.queue.async {
            if error == nil {
                self.pendingCompletions -= 1
                if self.pendingCompletions > 0 { return }
            }
            self.pendingCompletions = 0
            let listener = self.locked { self.completionListener }
            listener?(HapticPlayerCompletion(error: error?.localizedDescription ?? ""))
        }
    }
}
