import Foundation
import CoreGraphics
import ImageIO
import Vision
import UIKit

public class FocusFaceDetectorNative {
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
