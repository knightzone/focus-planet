import Foundation
import CoreGraphics
import ImageIO
import Vision
import UIKit
import StoreKit

public class FocusFaceDetectorNative {
    /// Read Apple's signed verification result, never reconstruct a JWS from client JSON.
    @available(iOS 15.0, *)
    public static func fetchSignedTransaction(_ transactionId: String, _ completed: @escaping (String, String) -> Void) {
        Task {
            for await result in Transaction.all {
                switch result {
                case .verified(let transaction):
                    if String(transaction.id) == transactionId {
                        let jws = result.jwsRepresentation
                        await MainActor.run { completed(jws, "") }
                        return
                    }
                case .unverified(let transaction, _):
                    if String(transaction.id) == transactionId {
                        await MainActor.run { completed("", "Apple 交易签名未通过本机校验，请恢复购买后重试") }
                        return
                    }
                }
            }
            await MainActor.run { completed("", "未找到 Apple 签名交易，请恢复购买后重试") }
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
            return "{\"supported\":false,\"detected\":false,\"faceCount\":0,\"faceScale\":0,\"centerX\":0.5,\"centerY\":0.5,\"yaw\":0,\"roll\":0,\"pitch\":0,\"confidence\":0,\"errorMessage\":\"iOS result encoding failed\"}"
        }
        return json
    }
}
