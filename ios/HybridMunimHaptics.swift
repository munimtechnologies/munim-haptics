//
//  HybridMunimHaptics.swift
//  munim-haptics
//
//  Nitro entry point. Every call delegates to the process-wide
//  MunimHapticsEngine so the engine survives JavaScript reloads.
//

import Foundation
import NitroModules

final class HybridMunimHaptics: HybridMunimHapticsSpec {
    private let engine = MunimHapticsEngine.shared

    func isSupported() throws -> Bool {
        engine.supportsHaptics
    }

    func prepare() throws -> Promise<Void> {
        let promise = Promise<Void>()
        engine.prepare { error in
            if let error {
                promise.reject(withError: error)
            } else {
                promise.resolve(withResult: ())
            }
        }
        return promise
    }

    func playPattern(pattern: NativeHapticPattern) throws -> Promise<Void> {
        let promise = Promise<Void>()
        engine.play(pattern) { error in
            if let error {
                promise.reject(withError: error)
            } else {
                promise.resolve(withResult: ())
            }
        }
        return promise
    }

    func stop() throws -> Promise<Void> {
        let promise = Promise<Void>()
        engine.stop {
            promise.resolve(withResult: ())
        }
        return promise
    }
}
