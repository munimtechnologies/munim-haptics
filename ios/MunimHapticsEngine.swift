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
    case invalidAHAP(String)
    case fileNotFound(String)
    case androidOnly(String)

    var errorDescription: String? {
        switch self {
        case .unsupported:
            return "This device does not support Core Haptics."
        case .invalidAHAP(let reason):
            return "Invalid AHAP: \(reason)"
        case .fileNotFound(let path):
            return "File not found: \(path)"
        case .androidOnly(let name):
            return "\(name) is only available on Android."
        }
    }
}

/// All mutable state is only touched on the serial `queue`.
final class MunimHapticsEngine: @unchecked Sendable {
    static let shared = MunimHapticsEngine()

    /// Core Haptics allows at most 16 control points per parameter curve.
    static let maxCurvePoints = 16

    let supportsHaptics: Bool
    let supportsAudio: Bool

    let queue = DispatchQueue(label: "com.munimhaptics.engine")
    private var engine: CHHapticEngine?
    private(set) var isRunning = false
    /// Players started by playPattern / playAHAP (the "current pattern").
    private var players: [CHHapticPatternPlayer] = []
    /// Bumped whenever players made earlier stop being valid (new engine or reset).
    private(set) var generation = 0
    private var audioResources: [String: CHHapticAudioResourceID] = [:]

    // Engine options (applied when the engine is created, or live where possible).
    private var playsHapticsOnly = true
    private var playsAudioOnly = false
    private var isMutedForHaptics = false
    private var isMutedForAudio = false
    private var autoShutdown = false

    private let listenerLock = NSLock()
    private var listener: ((HapticEngineEvent) -> Void)?

    private init() {
        let capabilities = CHHapticEngine.capabilitiesForHardware()
        supportsHaptics = capabilities.supportsHaptics
        supportsAudio = capabilities.supportsAudio
    }

    // MARK: - Public (all calls hop onto the serial queue)

    func prepare(completion: @escaping (Error?) -> Void) {
        run(completion) { _ = try self.runningEngine() }
    }

    func play(_ pattern: NativeHapticPattern, completion: @escaping (Error?) -> Void) {
        run(completion) {
            let engine = try self.runningEngine()
            let patterns = try self.makePatterns(pattern, alignEnds: false)
            try self.startReplacingCurrent(patterns.map { $0.pattern }, on: engine)
        }
    }

    func playAHAP(_ ahap: String, completion: @escaping (Error?) -> Void) {
        run(completion) {
            let engine = try self.runningEngine()
            let pattern = try Self.pattern(fromAHAP: ahap)
            try self.startReplacingCurrent([pattern], on: engine)
        }
    }

    func playAHAPFile(_ path: String, completion: @escaping (Error?) -> Void) {
        run(completion) {
            let engine = try self.runningEngine()
            let pattern = try Self.pattern(fromAHAPFile: path)
            try self.startReplacingCurrent([pattern], on: engine)
        }
    }

    func stop(completion: @escaping () -> Void) {
        queue.async {
            self.stopPlayers()
            completion()
        }
    }

    func startEngine(completion: @escaping (Error?) -> Void) {
        prepare(completion: completion)
    }

    func stopEngine(completion: @escaping (Error?) -> Void) {
        queue.async {
            self.stopPlayers()
            guard let engine = self.engine, self.isRunning else {
                completion(nil)
                return
            }
            engine.stop { error in
                self.queue.async {
                    self.isRunning = false
                    completion(error)
                }
            }
        }
    }

    func setOptions(_ options: HapticEngineOptions) {
        queue.sync {
            var needsNewEngine = false
            if let value = options.playsHapticsOnly, value != playsHapticsOnly {
                playsHapticsOnly = value
                needsNewEngine = true
            }
            if let value = options.playsAudioOnly, value != playsAudioOnly {
                playsAudioOnly = value
                needsNewEngine = true
            }
            if let value = options.isMutedForHaptics { isMutedForHaptics = value }
            if let value = options.isMutedForAudio { isMutedForAudio = value }
            if let value = options.autoShutdown { autoShutdown = value }

            if needsNewEngine {
                // These two can only be set before the engine starts.
                tearDownEngine()
            } else if let engine {
                engine.isMutedForHaptics = isMutedForHaptics
                engine.isMutedForAudio = isMutedForAudio
                engine.isAutoShutdownEnabled = autoShutdown
            }
        }
    }

    func state() -> HapticEngineState {
        queue.sync {
            HapticEngineState(
                isRunning: isRunning,
                playsHapticsOnly: playsHapticsOnly,
                playsAudioOnly: playsAudioOnly,
                isMutedForHaptics: isMutedForHaptics,
                isMutedForAudio: isMutedForAudio,
                autoShutdown: autoShutdown
            )
        }
    }

    func setListener(_ listener: ((HapticEngineEvent) -> Void)?) {
        listenerLock.lock()
        self.listener = listener
        listenerLock.unlock()
    }

    // MARK: - For players (call on `queue`)

    /// The running engine, started if needed. Call on `queue`.
    func runningEngine() throws -> CHHapticEngine {
        guard supportsHaptics else { throw MunimHapticsError.unsupported }
        let engine = try self.engine ?? makeEngine()
        if !isRunning {
            try engine.start()
            isRunning = true
        }
        return engine
    }

    /// `atTime` in seconds from now, as an engine time. Call on `queue`.
    func engineTime(after delay: Double) -> TimeInterval {
        guard delay.isFinite, delay > 0, let engine else { return CHHapticTimeImmediate }
        return engine.currentTime + delay
    }

    private func run(_ completion: @escaping (Error?) -> Void, _ body: @escaping () throws -> Void) {
        queue.async {
            do {
                try body()
                completion(nil)
            } catch {
                completion(error)
            }
        }
    }

    private func emit(_ event: HapticEngineEvent) {
        listenerLock.lock()
        let listener = self.listener
        listenerLock.unlock()
        listener?(event)
    }

    // MARK: - Engine

    private func makeEngine() throws -> CHHapticEngine {
        let engine = try CHHapticEngine()
        engine.playsHapticsOnly = playsHapticsOnly
        if #available(iOS 16.0, *) {
            engine.playsAudioOnly = playsAudioOnly
        }
        engine.isMutedForHaptics = isMutedForHaptics
        engine.isMutedForAudio = isMutedForAudio
        // Off by default: restarting costs a noticeable delay on the first
        // tap. The system still stops it when the app goes to the background
        // (stoppedHandler below).
        engine.isAutoShutdownEnabled = autoShutdown
        engine.stoppedHandler = { [weak self] reason in
            guard let self else { return }
            self.queue.async {
                self.isRunning = false
                self.players.removeAll()
            }
            self.emit(HapticEngineEvent(type: .stopped, reason: Self.stopReason(reason)))
        }
        engine.resetHandler = { [weak self] in
            // The haptic server restarted: every player is gone and the
            // engine must be started again.
            guard let self else { return }
            self.queue.async {
                self.players.removeAll()
                self.audioResources.removeAll()
                self.generation += 1
                self.isRunning = false
                if let engine = self.engine, (try? engine.start()) != nil {
                    self.isRunning = true
                }
            }
            self.emit(HapticEngineEvent(type: .reset, reason: HapticEngineStopReason.none))
        }
        self.engine = engine
        generation += 1
        audioResources.removeAll()
        return engine
    }

    private func tearDownEngine() {
        stopPlayers()
        if let engine {
            engine.stoppedHandler = { _ in }
            engine.resetHandler = {}
            engine.stop(completionHandler: nil)
        }
        engine = nil
        isRunning = false
        audioResources.removeAll()
        generation += 1
    }

    private static func stopReason(_ reason: CHHapticEngine.StoppedReason) -> HapticEngineStopReason {
        switch reason {
        case .audioSessionInterrupt: return .audiosessioninterrupt
        case .applicationSuspended: return .applicationsuspended
        case .idleTimeout: return .idletimeout
        case .notifyWhenFinished: return .notifywhenfinished
        case .engineDestroyed: return .enginedestroyed
        case .gameControllerDisconnect: return .gamecontrollerdisconnect
        case .systemError: return .systemerror
        @unknown default: return .unknown
        }
    }

    private func stopPlayers() {
        for player in players {
            try? player.stop(atTime: CHHapticTimeImmediate)
        }
        players.removeAll()
    }

    private func startReplacingCurrent(_ patterns: [CHHapticPattern], on engine: CHHapticEngine) throws {
        stopPlayers()
        var started: [CHHapticPatternPlayer] = []
        for pattern in patterns {
            started.append(try engine.makePlayer(with: pattern))
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

    // MARK: - Audio resources

    private func audioResource(_ path: String) throws -> CHHapticAudioResourceID {
        if let id = audioResources[path] { return id }
        guard let engine else { throw MunimHapticsError.unsupported }
        guard let url = Self.resolveURL(path, defaultExtension: nil) else {
            throw MunimHapticsError.fileNotFound(path)
        }
        let id = try engine.registerAudioResource(url, options: [:])
        audioResources[path] = id
        return id
    }

    // MARK: - Patterns

    struct BuiltPattern {
        let pattern: CHHapticPattern
        /// Whether parameter curves (and scheduled curves) belong on this one.
        let takesCurves: Bool
    }

    /// Builds the Core Haptics pattern(s) for a pattern. Call on `queue`,
    /// after `runningEngine()` (audio resources need the engine).
    ///
    /// Parameter curves act on every event in their player, so when a pattern
    /// has curves, continuous and audio events (with the curves) and
    /// transients go to two players started together: the curves shape the
    /// rumble but never the taps. With `alignEnds`, both get a silent marker
    /// at the same end time so they have equal durations and loop together.
    func makePatterns(_ pattern: NativeHapticPattern, alignEnds: Bool) throws -> [BuiltPattern] {
        let transients = pattern.events.filter { $0.type == .transient }
        let others = pattern.events.filter { $0.type != .transient }
        let curves = pattern.curves.flatMap { Self.parameterCurves($0, extraOffset: 0) }

        if curves.isEmpty || transients.isEmpty || others.isEmpty {
            let events = try pattern.events.compactMap { try makeEvent($0) }
            if events.isEmpty { return [] }
            // Curves never shape transients, so a transients-only pattern drops them.
            let built = try CHHapticPattern(events: events, parameterCurves: transients.isEmpty ? curves : [])
            return [BuiltPattern(pattern: built, takesCurves: true)]
        }

        var transientEvents = try transients.compactMap { try makeEvent($0) }
        var otherEvents = try others.compactMap { try makeEvent($0) }
        if alignEnds {
            let end = Self.endTime(pattern)
            transientEvents.append(Self.silentMarker(at: end))
            otherEvents.append(Self.silentMarker(at: end))
        }
        var result: [BuiltPattern] = []
        if !otherEvents.isEmpty {
            result.append(BuiltPattern(pattern: try CHHapticPattern(events: otherEvents, parameterCurves: curves), takesCurves: true))
        }
        if !transientEvents.isEmpty {
            result.append(BuiltPattern(pattern: try CHHapticPattern(events: transientEvents, parameters: []), takesCurves: false))
        }
        return result
    }

    private static func silentMarker(at time: Double) -> CHHapticEvent {
        CHHapticEvent(
            eventType: .hapticTransient,
            parameters: [CHHapticEventParameter(parameterID: .hapticIntensity, value: 0)],
            relativeTime: time
        )
    }

    private static func endTime(_ pattern: NativeHapticPattern) -> Double {
        var end = 0.0
        for event in pattern.events {
            end = max(end, max(0, event.time) + max(0, event.duration))
        }
        for curve in pattern.curves {
            let last = curve.points.map { $0.time }.max() ?? 0
            end = max(end, max(0, curve.time) + max(0, last))
        }
        return end
    }

    private func makeEvent(_ event: NativeHapticEvent) throws -> CHHapticEvent? {
        let time = max(0, event.time)
        let duration = max(0, event.duration)
        var parameters: [CHHapticEventParameter] = []
        func add(_ id: CHHapticEvent.ParameterID, _ value: Double?, _ low: Double, _ high: Double) {
            guard let value else { return }
            parameters.append(CHHapticEventParameter(parameterID: id, value: Float(Self.clamp(value, low, high))))
        }
        add(.attackTime, event.attackTime, 0, 1)
        add(.decayTime, event.decayTime, 0, 1)
        add(.releaseTime, event.releaseTime, 0, 1)
        if let sustained = event.sustained {
            parameters.append(CHHapticEventParameter(parameterID: .sustained, value: sustained ? 1 : 0))
        }

        // An if-chain, not a switch: Nitro's enums are C++ enums seen from
        // Swift, which Swift may not treat as exhaustive.
        let type = event.type
        if type == .transient || type == .continuous {
            add(.hapticIntensity, event.intensity, 0, 1)
            add(.hapticSharpness, event.sharpness, 0, 1)
            if type == .transient {
                return CHHapticEvent(eventType: .hapticTransient, parameters: parameters, relativeTime: time)
            }
            if duration <= 0 { return nil }
            return CHHapticEvent(eventType: .hapticContinuous, parameters: parameters, relativeTime: time, duration: duration)
        }

        add(.audioVolume, event.audioVolume, 0, 1)
        add(.audioPitch, event.audioPitch, -1, 1)
        add(.audioPan, event.audioPan, -1, 1)
        add(.audioBrightness, event.audioBrightness, -1, 1)
        if type == .audiocontinuous {
            if duration <= 0 { return nil }
            return CHHapticEvent(eventType: .audioContinuous, parameters: parameters, relativeTime: time, duration: duration)
        }
        guard let resource = event.resource, !resource.isEmpty else { return nil }
        let id = try audioResource(resource)
        if duration > 0 {
            return CHHapticEvent(audioResourceID: id, parameters: parameters, relativeTime: time, duration: duration)
        }
        return CHHapticEvent(audioResourceID: id, parameters: parameters, relativeTime: time)
    }

    static func dynamicParameterID(_ parameter: HapticCurveParameter) -> (CHHapticDynamicParameter.ID, Double) {
        if parameter == .intensity { return (.hapticIntensityControl, 0) }
        if parameter == .sharpness { return (.hapticSharpnessControl, -1) }
        if parameter == .attacktime { return (.hapticAttackTimeControl, -1) }
        if parameter == .decaytime { return (.hapticDecayTimeControl, -1) }
        if parameter == .releasetime { return (.hapticReleaseTimeControl, -1) }
        if parameter == .audiovolume { return (.audioVolumeControl, 0) }
        if parameter == .audiopan { return (.audioPanControl, -1) }
        if parameter == .audiopitch { return (.audioPitchControl, -1) }
        return (.audioBrightnessControl, -1)
    }

    /// One curve, split into curves of at most 16 points that pick up where
    /// the previous one left off. `extraOffset` is added to every start time.
    static func parameterCurves(_ curve: HapticCurve, extraOffset: Double) -> [CHHapticParameterCurve] {
        let (parameterID, minValue) = dynamicParameterID(curve.parameter)
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
                    relativeTime: max(0, curve.time) + origin + max(0, extraOffset)
                )
            )
            if end == points.count { break }
            // The next chunk starts on this chunk's last point.
            start = end - 1
        }
        return result
    }

    // MARK: - AHAP

    static func pattern(fromAHAP ahap: String) throws -> CHHapticPattern {
        guard let data = ahap.data(using: .utf8) else {
            throw MunimHapticsError.invalidAHAP("not UTF-8")
        }
        return try pattern(fromAHAPData: data)
    }

    static func pattern(fromAHAPData data: Data) throws -> CHHapticPattern {
        let json: Any
        do {
            json = try JSONSerialization.jsonObject(with: data, options: [])
        } catch {
            throw MunimHapticsError.invalidAHAP(error.localizedDescription)
        }
        guard let object = json as? [String: Any] else {
            throw MunimHapticsError.invalidAHAP("the top level must be an object")
        }
        var dictionary: [CHHapticPattern.Key: Any] = [:]
        for (key, value) in object {
            dictionary[CHHapticPattern.Key(rawValue: key)] = value
        }
        return try CHHapticPattern(dictionary: dictionary)
    }

    static func pattern(fromAHAPFile path: String) throws -> CHHapticPattern {
        guard let url = resolveURL(path, defaultExtension: "ahap") else {
            throw MunimHapticsError.fileNotFound(path)
        }
        if #available(iOS 16.0, *) {
            // Resolves audio paths relative to the file.
            return try CHHapticPattern(contentsOf: url)
        }
        return try pattern(fromAHAPData: try Data(contentsOf: url))
    }

    /// A path, a `file://` URI, or the name of a resource in the main bundle.
    static func resolveURL(_ path: String, defaultExtension: String?) -> URL? {
        if path.hasPrefix("file://") {
            return URL(string: path)
        }
        if path.hasPrefix("/") {
            return URL(fileURLWithPath: path)
        }
        let name = path as NSString
        let ext = name.pathExtension
        if !ext.isEmpty, let url = Bundle.main.url(forResource: name.deletingPathExtension, withExtension: ext) {
            return url
        }
        if let defaultExtension, let url = Bundle.main.url(forResource: path, withExtension: defaultExtension) {
            return url
        }
        return Bundle.main.url(forResource: path, withExtension: nil)
    }

    static func clamp(_ value: Double, _ low: Double, _ high: Double) -> Double {
        guard value.isFinite else { return low }
        return min(high, max(low, value))
    }
}
