import Foundation
import CoreGraphics
import ImageIO
import Vision
import UIKit
import StoreKit
import UserNotifications

// 本地通知（不发远程推送、不接任何第三方推送 SDK）。App 在前台时也把提醒横幅弹出来。
// 用 UNUserNotificationCenter 的本地通知，不需要推送证书或 APNs 能力。
private final class RenewalReminderPresenter: NSObject, UNUserNotificationCenterDelegate {
    static let shared = RenewalReminderPresenter()
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .list])
    }
}

private final class SignedTransactionCompletion: @unchecked Sendable {
    private let lock = NSLock()
    private var delivered = false
    private let callback: (String) -> Void

    init(_ callback: @escaping (String) -> Void) {
        self.callback = callback
    }

    func finish(_ jws: String, _ errorMessage: String, stage: String) {
        lock.lock()
        let shouldDeliver = !delivered
        if shouldDeliver { delivered = true }
        lock.unlock()
        if !shouldDeliver {
            NSLog("[vip-restore-native] ignored late result: %@", stage)
            return
        }
        let value = ["jws": jws, "errorMessage": errorMessage]
        let data = try? JSONSerialization.data(withJSONObject: value)
        let json = data.flatMap { String(data: $0, encoding: .utf8) } ?? "{\"jws\":\"\",\"errorMessage\":\"Apple 签名交易序列化失败\"}"
        NSLog("[vip-restore-native] callback: %@", stage)
        DispatchQueue.main.async { self.callback(json) }
    }
}

public class FocusFaceDetectorNative {
    /// Read Apple's signed verification result, never reconstruct a JWS from client JSON.
    @available(iOS 15.0, *)
    public static func fetchSignedTransaction(_ transactionId: String, _ productId: String, _ completed: @escaping (String) -> Void) {
        NSLog("[vip-restore-native] bridge entered; product configured: %@", productId.isEmpty ? "no" : "yes")
        let delivery = SignedTransactionCompletion(completed)
        DispatchQueue.main.asyncAfter(deadline: .now() + 25) {
            delivery.finish("", "Apple 交易查询超过 25 秒；请检查 App Store 网络或测试账号后重试", stage: "StoreKit timeout")
        }
        Task {
            NSLog("[vip-restore-native] StoreKit latest query started")
            guard let result = await Transaction.latest(for: productId) else {
                delivery.finish("", "Apple 未找到此商品的签名交易，请核对购买时的 Apple ID", stage: "no transaction")
                return
            }
            switch result {
            case .verified(let transaction):
                NSLog("[vip-restore-native] signed transaction found; same ID: %@", String(transaction.id) == transactionId ? "yes" : "no")
                delivery.finish(result.jwsRepresentation, "", stage: "signed transaction")
            case .unverified(_, _):
                delivery.finish("", "Apple 交易签名未通过本机校验，请稍后重试", stage: "unverified transaction")
            }
        }
    }

    @available(iOS 15.0, *)
    public static func fetchStoreProducts(_ productIds: [String], _ completed: @escaping (String) -> Void) {
        Task {
            do {
                let products = try await Product.products(for: productIds)
                var values: [[String: Any]] = []
                for product in products {
                    var periodUnit = ""
                    var periodValue = 0
                    var introAvailable = false
                    var introEligible = false
                    var introPaymentMode = ""
                    var introDisplayPrice = ""
                    var introPeriodUnit = ""
                    var introPeriodValue = 0
                    var introPeriodCount = 0
                    if let subscription = product.subscription {
                        periodUnit = unitName(subscription.subscriptionPeriod.unit)
                        periodValue = subscription.subscriptionPeriod.value
                        introEligible = await subscription.isEligibleForIntroOffer
                        if let offer = subscription.introductoryOffer {
                            introAvailable = true
                            introPaymentMode = paymentModeName(offer.paymentMode)
                            introDisplayPrice = offer.displayPrice
                            introPeriodUnit = unitName(offer.period.unit)
                            introPeriodValue = offer.period.value
                            introPeriodCount = offer.periodCount
                        }
                    }
                    values.append([
                        "productId": product.id,
                        "displayName": product.displayName,
                        "displayPrice": product.displayPrice,
                        "price": NSDecimalNumber(decimal: product.price).doubleValue,
                        "periodUnit": periodUnit,
                        "periodValue": periodValue,
                        "introOfferAvailable": introAvailable,
                        "introOfferEligible": introEligible,
                        "introOfferPaymentMode": introPaymentMode,
                        "introOfferDisplayPrice": introDisplayPrice,
                        "introOfferPeriodUnit": introPeriodUnit,
                        "introOfferPeriodValue": introPeriodValue,
                        "introOfferPeriodCount": introPeriodCount
                    ])
                }
                completeStoreProducts(["success": true, "products": values, "errorMessage": ""], completed)
            } catch {
                completeStoreProducts(["success": false, "products": [], "errorMessage": error.localizedDescription], completed)
            }
        }
    }

    @available(iOS 15.0, *)
    private static func unitName(_ unit: Product.SubscriptionPeriod.Unit) -> String {
        switch unit {
        case .day: return "day"
        case .week: return "week"
        case .month: return "month"
        case .year: return "year"
        @unknown default: return ""
        }
    }

    @available(iOS 15.0, *)
    private static func paymentModeName(_ mode: Product.SubscriptionOffer.PaymentMode) -> String {
        switch mode {
        case .freeTrial: return "freeTrial"
        case .payAsYouGo: return "payAsYouGo"
        case .payUpFront: return "payUpFront"
        default: return ""
        }
    }

    private static func completeStoreProducts(_ value: [String: Any], _ completed: @escaping (String) -> Void) {
        let data = try? JSONSerialization.data(withJSONObject: value)
        let json = data == nil ? nil : String(data: data!, encoding: .utf8)
        DispatchQueue.main.async { completed(json ?? "{\"success\":false,\"products\":[],\"errorMessage\":\"App Store data encoding failed\"}") }
    }

    public static func openUpdateLink(_ link: String, _ completed: @escaping (Bool) -> Void) {
        guard let url = URL(string: link), url.scheme == "https" else { completed(false); return }
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:], completionHandler: completed)
        }
    }

    /// 安排一条本地续费提醒：先在通知日（到期前 5 天）提醒一次；若已经进入提醒窗口则稍后立即提醒。
    public static func scheduleRenewalReminder(_ identifier: String, _ title: String, _ body: String, _ atEpochMs: NSNumber, _ completed: @escaping (Bool) -> Void) {
        let center = UNUserNotificationCenter.current()
        center.delegate = RenewalReminderPresenter.shared
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            guard granted else {
                DispatchQueue.main.async { completed(false) }
                return
            }
            center.removePendingNotificationRequests(withIdentifiers: [identifier])
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = body
            content.sound = .default
            let fireAt = Date(timeIntervalSince1970: atEpochMs.doubleValue / 1000)
            // 已过提醒日时至少等一小段再弹，避免当场打断；未到时按真实提醒日排。
            let interval = max(5, fireAt.timeIntervalSinceNow)
            let request = UNNotificationRequest(identifier: identifier, content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false))
            center.add(request) { error in
                DispatchQueue.main.async { completed(error == nil) }
            }
        }
    }

    /// 取消已排的续费提醒（会员失效或尚未开通时调用）。
    public static func cancelRenewalReminder(_ identifier: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])
    }
    public static func detectRgba(_ rgba: Data, _ width: Int, _ height: Int) -> String {
        guard width >= 2, height >= 2, rgba.count >= width * height * 4 else {
            return makeResult(supported: false, detected: false, errorMessage: "相机帧尺寸无效")
        }
        guard let provider = CGDataProvider(data: rgba as CFData) else {
            return makeResult(supported: false, detected: false, errorMessage: "无法读取相机帧")
        }
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue)
        guard let image = CGImage(
            width: width,
            height: height,
            bitsPerComponent: 8,
            bitsPerPixel: 32,
            bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: bitmapInfo,
            provider: provider,
            decode: nil,
            shouldInterpolate: false,
            intent: .defaultIntent
        ) else {
            return makeResult(supported: false, detected: false, errorMessage: "无法转换相机帧")
        }
        let orientations: [CGImagePropertyOrientation] = [.up, .right, .left, .down]
        var bestFaces: [VNFaceObservation] = []
        var bestPrimary: VNFaceObservation?
        var bestArea = 0.0
        do {
            for orientation in orientations {
                let request = VNDetectFaceRectanglesRequest()
                let handler = VNImageRequestHandler(cgImage: image, orientation: orientation, options: [:])
                try handler.perform([request])
                let faces = request.results ?? []
                guard let primary = faces.max(by: {
                    $0.boundingBox.width * $0.boundingBox.height < $1.boundingBox.width * $1.boundingBox.height
                }) else { continue }
                let area = primary.boundingBox.width * primary.boundingBox.height
                if area > bestArea {
                    bestArea = area
                    bestFaces = faces
                    bestPrimary = primary
                }
            }
            guard let primary = bestPrimary else {
                return makeResult(supported: true, detected: false)
            }
            let box = primary.boundingBox
            let yaw = (primary.yaw?.doubleValue ?? 0) * 180 / Double.pi
            let roll = (primary.roll?.doubleValue ?? 0) * 180 / Double.pi
            var pitch = 0.0
            if #available(iOS 15.0, *) {
                pitch = (primary.pitch?.doubleValue ?? 0) * 180 / Double.pi
            }
            return makeResult(
                supported: true,
                detected: true,
                faceCount: bestFaces.count,
                faceScale: box.width,
                centerX: box.midX,
                centerY: box.midY,
                yaw: yaw,
                roll: roll,
                pitch: pitch,
                confidence: Double(primary.confidence)
            )
        } catch {
            return makeResult(supported: false, detected: false, errorMessage: error.localizedDescription)
        }
    }

    private static func makeResult(
        supported: Bool,
        detected: Bool,
        faceCount: Int = 0,
        faceScale: Double = 0,
        centerX: Double = 0.5,
        centerY: Double = 0.5,
        yaw: Double = 0,
        roll: Double = 0,
        pitch: Double = 0,
        confidence: Double = 0,
        errorMessage: String = ""
    ) -> String {
        let value: [String: Any] = [
            "supported": supported,
            "detected": detected,
            "faceCount": faceCount,
            "faceScale": faceScale,
            "centerX": centerX,
            "centerY": centerY,
            "yaw": yaw,
            "roll": roll,
            "pitch": pitch,
            "confidence": confidence,
            "errorMessage": errorMessage
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: value), let json = String(data: data, encoding: .utf8) else {
            return [
                "{\"supported\":false,\"detected\":false,\"faceCount\":0,\"faceScale\":0,\"centerX\":0.5,",
                "\"centerY\":0.5,\"yaw\":0,\"roll\":0,\"pitch\":0,\"confidence\":0,",
                "\"errorMessage\":\"iOS result encoding failed\"}"
            ].joined()
        }
        return json
    }
}
