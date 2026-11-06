//
//  FeedbackGenerators.swift
//  munim-haptics
//
//  UIKit feedback generators (impact, notification, selection), created
//  once per kind and reused so a prepared generator stays warm. UIKit wants
//  them on the main thread. They follow the user's System Haptics setting.
//

import Foundation
import UIKit

final class FeedbackGenerators: @unchecked Sendable {
    static let shared = FeedbackGenerators()

    // Only touched on the main thread.
    private var impacts: [UIImpactFeedbackGenerator.FeedbackStyle: UIImpactFeedbackGenerator] = [:]
    private var notificationGenerator: UINotificationFeedbackGenerator?
    private var selectionGenerator: UISelectionFeedbackGenerator?

    private init() {}

    /// `intensity` < 0: the generator's default strength.
    func impact(_ style: ImpactStyle, intensity: Double, completion: @escaping () -> Void) {
        onMain {
            let generator = self.impactGenerator(Self.uiStyle(style))
            if intensity >= 0, intensity.isFinite {
                generator.impactOccurred(intensity: CGFloat(min(1, intensity)))
            } else {
                generator.impactOccurred()
            }
            completion()
        }
    }

    func notification(_ type: NotificationFeedbackType, completion: @escaping () -> Void) {
        onMain {
            self.notification().notificationOccurred(Self.uiType(type))
            completion()
        }
    }

    func selection(completion: @escaping () -> Void) {
        onMain {
            self.selection().selectionChanged()
            completion()
        }
    }

    func prepareImpact(_ style: ImpactStyle, completion: @escaping () -> Void) {
        onMain {
            self.impactGenerator(Self.uiStyle(style)).prepare()
            completion()
        }
    }

    func prepareNotification(completion: @escaping () -> Void) {
        onMain {
            self.notification().prepare()
            completion()
        }
    }

    func prepareSelection(completion: @escaping () -> Void) {
        onMain {
            self.selection().prepare()
            completion()
        }
    }

    // MARK: - Generators (main thread)

    private func impactGenerator(_ style: UIImpactFeedbackGenerator.FeedbackStyle) -> UIImpactFeedbackGenerator {
        if let generator = impacts[style] { return generator }
        let generator = UIImpactFeedbackGenerator(style: style)
        impacts[style] = generator
        return generator
    }

    private func notification() -> UINotificationFeedbackGenerator {
        if let notificationGenerator { return notificationGenerator }
        let generator = UINotificationFeedbackGenerator()
        notificationGenerator = generator
        return generator
    }

    private func selection() -> UISelectionFeedbackGenerator {
        if let selectionGenerator { return selectionGenerator }
        let generator = UISelectionFeedbackGenerator()
        selectionGenerator = generator
        return generator
    }

    private func onMain(_ body: @escaping () -> Void) {
        if Thread.isMainThread {
            body()
        } else {
            DispatchQueue.main.async(execute: body)
        }
    }

    // If-chains: Nitro enums are C++ enums seen from Swift.
    private static func uiStyle(_ style: ImpactStyle) -> UIImpactFeedbackGenerator.FeedbackStyle {
        if style == .light { return .light }
        if style == .heavy { return .heavy }
        if style == .soft { return .soft }
        if style == .rigid { return .rigid }
        return .medium
    }

    private static func uiType(_ type: NotificationFeedbackType) -> UINotificationFeedbackGenerator.FeedbackType {
        if type == .warning { return .warning }
        if type == .error { return .error }
        return .success
    }
}
