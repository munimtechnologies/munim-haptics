//
//  HybridCompiledHapticPattern.swift
//  munim-haptics
//
//  A pattern built into Core Haptics objects once. play() reuses the same
//  CHHapticPattern(s) and players, so a replay costs no conversion, no
//  bridge copy of the events and no player allocation. After the haptic
//  server resets (or the engine is rebuilt) they are made again on the next
//  play, from the closure that built them.
//

import CoreHaptics
import Foundation
import NitroModules

final class HybridCompiledHapticPattern: HybridCompiledHapticPatternSpec, @unchecked Sendable {
    private let engine = MunimHapticsEngine.shared
    /// Builds the patterns (again, after a reset). Called on the engine queue.
    private let build: () throws -> [CHHapticPattern]
    private let patternDuration: Double
    private let eventCount: Int

    // Only touched on the engine queue.
    private var patterns: [CHHapticPattern]
    private var players: [CHHapticPatternPlayer] = []
    private var generation: Int

    /// Call on the engine queue, with the engine running.
    init(eventCount: Int, build: @escaping () throws -> [CHHapticPattern]) throws {
        self.build = build
        self.eventCount = eventCount
        let built = try build()
        guard !built.isEmpty else {
            throw MunimHapticsError.invalidAHAP("the pattern has no events")
        }
        patterns = built
        patternDuration = built.map { $0.duration }.max() ?? 0
        // Not `engine`: self isn't fully initialized yet.
        generation = MunimHapticsEngine.shared.generation
        super.init()
    }

    var duration: Double { patternDuration }

    // Roughly what Core Haptics keeps per event, so the JS GC sees large patterns.
    var memorySize: Int { eventCount * 256 }

    func play() throws -> Promise<Void> {
        let promise = Promise<Void>()
        engine.queue.async {
            do {
                let engine = try self.engine.runningEngine()
                if self.generation != self.engine.generation {
                    self.patterns = try self.build()
                    self.players = []
                    self.generation = self.engine.generation
                }
                if self.players.isEmpty {
                    self.players = try self.patterns.map { try engine.makePlayer(with: $0) }
                }
                try self.engine.startReplacingCurrent(players: self.players)
                promise.resolve(withResult: ())
            } catch {
                promise.reject(withError: error)
            }
        }
        return promise
    }

    func stop() throws -> Promise<Void> {
        let promise = Promise<Void>()
        engine.queue.async {
            self.engine.stopPlayers(self.players)
            promise.resolve(withResult: ())
        }
        return promise
    }

    func dispose() {
        engine.queue.async {
            self.engine.stopPlayers(self.players)
            self.players = []
        }
    }
}
