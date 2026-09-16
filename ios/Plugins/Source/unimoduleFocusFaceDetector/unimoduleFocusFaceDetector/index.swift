import DCloudUTSFoundation
import DCloudUniappRuntime
@objc(UTSSDKModulesFocusFaceDetectorFaceFrameResult)
@objcMembers
public class FaceFrameResult : NSObject, UTSObject, Codable {
    public var supported: Bool = false
    public var detected: Bool = false
    public var faceCount: NSNumber!
    public var faceScale: NSNumber!
    public var centerX: NSNumber!
    public var centerY: NSNumber!
    public var yaw: NSNumber!
    public var roll: NSNumber!
    public var pitch: NSNumber!
    public var confidence: NSNumber!
    public var errorMessage: String!
    public subscript(_ key: String) -> Any? {
        get {
            return utsSubscriptGetValue(key)
        }
        set {
            switch(key){
                case "supported":
                    self.supported = try! utsSubscriptCheckValue(newValue)
                case "detected":
                    self.detected = try! utsSubscriptCheckValue(newValue)
                case "faceCount":
                    self.faceCount = try! utsSubscriptCheckValue(newValue)
                case "faceScale":
                    self.faceScale = try! utsSubscriptCheckValue(newValue)
                case "centerX":
                    self.centerX = try! utsSubscriptCheckValue(newValue)
                case "centerY":
                    self.centerY = try! utsSubscriptCheckValue(newValue)
                case "yaw":
                    self.yaw = try! utsSubscriptCheckValue(newValue)
                case "roll":
                    self.roll = try! utsSubscriptCheckValue(newValue)
                case "pitch":
                    self.pitch = try! utsSubscriptCheckValue(newValue)
                case "confidence":
                    self.confidence = try! utsSubscriptCheckValue(newValue)
                case "errorMessage":
                    self.errorMessage = try! utsSubscriptCheckValue(newValue)
                default:
                    break
            }
        }
    }
    public override init() {
        super.init()
    }
    public init(_ obj: UTSJSONObject) {
        self.supported = obj["supported"] as! Bool
        self.detected = obj["detected"] as! Bool
        self.faceCount = obj["faceCount"] as! NSNumber
        self.faceScale = obj["faceScale"] as! NSNumber
        self.centerX = obj["centerX"] as! NSNumber
        self.centerY = obj["centerY"] as! NSNumber
        self.yaw = obj["yaw"] as! NSNumber
        self.roll = obj["roll"] as! NSNumber
        self.pitch = obj["pitch"] as! NSNumber
        self.confidence = obj["confidence"] as! NSNumber
        self.errorMessage = obj["errorMessage"] as! String
    }
    enum CodingKeys: String, CodingKey { case supported; case detected; case faceCount; case faceScale; case centerX; case centerY; case yaw; case roll; case pitch; case confidence; case errorMessage }
    required public init(from decoder: Decoder) throws {
        var container = try decoder.container(keyedBy: CodingKeys.self)
        self.supported = try container.decode(Bool.self, forKey: .supported, decoder)
        self.detected = try container.decode(Bool.self, forKey: .detected, decoder)
        self.faceCount = try container.decode(NSNumber.self, forKey: .faceCount, decoder)
        self.faceScale = try container.decode(NSNumber.self, forKey: .faceScale, decoder)
        self.centerX = try container.decode(NSNumber.self, forKey: .centerX, decoder)
        self.centerY = try container.decode(NSNumber.self, forKey: .centerY, decoder)
        self.yaw = try container.decode(NSNumber.self, forKey: .yaw, decoder)
        self.roll = try container.decode(NSNumber.self, forKey: .roll, decoder)
        self.pitch = try container.decode(NSNumber.self, forKey: .pitch, decoder)
        self.confidence = try container.decode(NSNumber.self, forKey: .confidence, decoder)
        self.errorMessage = try container.decode(String.self, forKey: .errorMessage, decoder)
    }
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(supported, forKey: .supported, encoder)
        try container.encode(detected, forKey: .detected, encoder)
        try container.encode(faceCount, forKey: .faceCount, encoder)
        try container.encode(faceScale, forKey: .faceScale, encoder)
        try container.encode(centerX, forKey: .centerX, encoder)
        try container.encode(centerY, forKey: .centerY, encoder)
        try container.encode(yaw, forKey: .yaw, encoder)
        try container.encode(roll, forKey: .roll, encoder)
        try container.encode(pitch, forKey: .pitch, encoder)
        try container.encode(confidence, forKey: .confidence, encoder)
        try container.encode(errorMessage, forKey: .errorMessage, encoder)
    }
}
public typealias DetectFaceFrame = (_ rgba: ArrayBuffer, _ width: NSNumber, _ height: NSNumber) -> FaceFrameResult
public func openUpdateLink(_ url: String, _ completed: @escaping (_ success: Bool) -> Void) {
    FocusFaceDetectorNative.openUpdateLink(url, completed)
}
public var detectFaceFrame: DetectFaceFrame = {
(_ rgba: ArrayBuffer, _ width: NSNumber, _ height: NSNumber) -> FaceFrameResult in
var value = JSON.parse(FocusFaceDetectorNative.detectRgba(rgba.toData(), width.toInt(), height.toInt()), FaceFrameResult.self)
if (value != nil) {
    return value as! FaceFrameResult
}
return FaceFrameResult(UTSJSONObject([
    "supported": false,
    "detected": false,
    "faceCount": 0 as NSNumber,
    "faceScale": 0 as NSNumber,
    "centerX": 0.5 as NSNumber,
    "centerY": 0.5 as NSNumber,
    "yaw": 0 as NSNumber,
    "roll": 0 as NSNumber,
    "pitch": 0 as NSNumber,
    "confidence": 0 as NSNumber,
    "errorMessage": "iOS 检测结果解析失败"
]))
}
public func openUpdateLinkByJs(_ url: String, _ completed: UTSCallback) {
    return openUpdateLink(url, {
    (success: Bool) -> Void in
    completed(success)
    })
}
public func detectFaceFrameByJs(_ rgba: ArrayBuffer, _ width: NSNumber, _ height: NSNumber) -> FaceFrameResult {
    return detectFaceFrame(rgba, width, height)
}
@objc(UTSSDKModulesFocusFaceDetectorIndexSwift)
@objcMembers
public class UTSSDKModulesFocusFaceDetectorIndexSwift : NSObject {
    public static func s_openUpdateLinkByJs(_ url: String, _ completed: UTSCallback) {
        return openUpdateLinkByJs(url, completed)
    }
    public static func s_detectFaceFrameByJs(_ rgba: ArrayBuffer, _ width: NSNumber, _ height: NSNumber) -> FaceFrameResult {
        return detectFaceFrameByJs(rgba, width, height)
    }
}
