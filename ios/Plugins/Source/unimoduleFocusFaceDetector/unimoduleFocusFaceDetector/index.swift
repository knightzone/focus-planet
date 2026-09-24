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
@objc(UTSSDKModulesFocusFaceDetectorAppleStoreProduct)
@objcMembers
public class AppleStoreProduct : NSObject, UTSObject, Codable {
    public var productId: String!
    public var displayName: String!
    public var displayPrice: String!
    public var price: NSNumber!
    public var periodUnit: String!
    public var periodValue: NSNumber!
    public var introOfferAvailable: Bool = false
    public var introOfferEligible: Bool = false
    public var introOfferPaymentMode: String!
    public var introOfferDisplayPrice: String!
    public var introOfferPeriodUnit: String!
    public var introOfferPeriodValue: NSNumber!
    public var introOfferPeriodCount: NSNumber!
    public subscript(_ key: String) -> Any? {
        get {
            return utsSubscriptGetValue(key)
        }
        set {
            switch(key){
                case "productId":
                    self.productId = try! utsSubscriptCheckValue(newValue)
                case "displayName":
                    self.displayName = try! utsSubscriptCheckValue(newValue)
                case "displayPrice":
                    self.displayPrice = try! utsSubscriptCheckValue(newValue)
                case "price":
                    self.price = try! utsSubscriptCheckValue(newValue)
                case "periodUnit":
                    self.periodUnit = try! utsSubscriptCheckValue(newValue)
                case "periodValue":
                    self.periodValue = try! utsSubscriptCheckValue(newValue)
                case "introOfferAvailable":
                    self.introOfferAvailable = try! utsSubscriptCheckValue(newValue)
                case "introOfferEligible":
                    self.introOfferEligible = try! utsSubscriptCheckValue(newValue)
                case "introOfferPaymentMode":
                    self.introOfferPaymentMode = try! utsSubscriptCheckValue(newValue)
                case "introOfferDisplayPrice":
                    self.introOfferDisplayPrice = try! utsSubscriptCheckValue(newValue)
                case "introOfferPeriodUnit":
                    self.introOfferPeriodUnit = try! utsSubscriptCheckValue(newValue)
                case "introOfferPeriodValue":
                    self.introOfferPeriodValue = try! utsSubscriptCheckValue(newValue)
                case "introOfferPeriodCount":
                    self.introOfferPeriodCount = try! utsSubscriptCheckValue(newValue)
                default:
                    break
            }
        }
    }
    public override init() {
        super.init()
    }
    public init(_ obj: UTSJSONObject) {
        self.productId = obj["productId"] as! String
        self.displayName = obj["displayName"] as! String
        self.displayPrice = obj["displayPrice"] as! String
        self.price = obj["price"] as! NSNumber
        self.periodUnit = obj["periodUnit"] as! String
        self.periodValue = obj["periodValue"] as! NSNumber
        self.introOfferAvailable = obj["introOfferAvailable"] as! Bool
        self.introOfferEligible = obj["introOfferEligible"] as! Bool
        self.introOfferPaymentMode = obj["introOfferPaymentMode"] as! String
        self.introOfferDisplayPrice = obj["introOfferDisplayPrice"] as! String
        self.introOfferPeriodUnit = obj["introOfferPeriodUnit"] as! String
        self.introOfferPeriodValue = obj["introOfferPeriodValue"] as! NSNumber
        self.introOfferPeriodCount = obj["introOfferPeriodCount"] as! NSNumber
    }
    enum CodingKeys: String, CodingKey { case productId; case displayName; case displayPrice; case price; case periodUnit; case periodValue; case introOfferAvailable; case introOfferEligible; case introOfferPaymentMode; case introOfferDisplayPrice; case introOfferPeriodUnit; case introOfferPeriodValue; case introOfferPeriodCount }
    required public init(from decoder: Decoder) throws {
        var container = try decoder.container(keyedBy: CodingKeys.self)
        self.productId = try container.decode(String.self, forKey: .productId, decoder)
        self.displayName = try container.decode(String.self, forKey: .displayName, decoder)
        self.displayPrice = try container.decode(String.self, forKey: .displayPrice, decoder)
        self.price = try container.decode(NSNumber.self, forKey: .price, decoder)
        self.periodUnit = try container.decode(String.self, forKey: .periodUnit, decoder)
        self.periodValue = try container.decode(NSNumber.self, forKey: .periodValue, decoder)
        self.introOfferAvailable = try container.decode(Bool.self, forKey: .introOfferAvailable, decoder)
        self.introOfferEligible = try container.decode(Bool.self, forKey: .introOfferEligible, decoder)
        self.introOfferPaymentMode = try container.decode(String.self, forKey: .introOfferPaymentMode, decoder)
        self.introOfferDisplayPrice = try container.decode(String.self, forKey: .introOfferDisplayPrice, decoder)
        self.introOfferPeriodUnit = try container.decode(String.self, forKey: .introOfferPeriodUnit, decoder)
        self.introOfferPeriodValue = try container.decode(NSNumber.self, forKey: .introOfferPeriodValue, decoder)
        self.introOfferPeriodCount = try container.decode(NSNumber.self, forKey: .introOfferPeriodCount, decoder)
    }
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(productId, forKey: .productId, encoder)
        try container.encode(displayName, forKey: .displayName, encoder)
        try container.encode(displayPrice, forKey: .displayPrice, encoder)
        try container.encode(price, forKey: .price, encoder)
        try container.encode(periodUnit, forKey: .periodUnit, encoder)
        try container.encode(periodValue, forKey: .periodValue, encoder)
        try container.encode(introOfferAvailable, forKey: .introOfferAvailable, encoder)
        try container.encode(introOfferEligible, forKey: .introOfferEligible, encoder)
        try container.encode(introOfferPaymentMode, forKey: .introOfferPaymentMode, encoder)
        try container.encode(introOfferDisplayPrice, forKey: .introOfferDisplayPrice, encoder)
        try container.encode(introOfferPeriodUnit, forKey: .introOfferPeriodUnit, encoder)
        try container.encode(introOfferPeriodValue, forKey: .introOfferPeriodValue, encoder)
        try container.encode(introOfferPeriodCount, forKey: .introOfferPeriodCount, encoder)
    }
}
@objc(UTSSDKModulesFocusFaceDetectorAppleStoreProductsResult)
@objcMembers
public class AppleStoreProductsResult : NSObject, UTSObject, Codable {
    public var success: Bool = false
    public var products: [AppleStoreProduct]!
    public var errorMessage: String!
    public subscript(_ key: String) -> Any? {
        get {
            return utsSubscriptGetValue(key)
        }
        set {
            switch(key){
                case "success":
                    self.success = try! utsSubscriptCheckValue(newValue)
                case "products":
                    self.products = try! utsSubscriptCheckValue(newValue)
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
        self.success = obj["success"] as! Bool
        self.products = obj["products"] as! [AppleStoreProduct]
        self.errorMessage = obj["errorMessage"] as! String
    }
    enum CodingKeys: String, CodingKey { case success; case products; case errorMessage }
    required public init(from decoder: Decoder) throws {
        var container = try decoder.container(keyedBy: CodingKeys.self)
        self.success = try container.decode(Bool.self, forKey: .success, decoder)
        self.products = try container.decode([AppleStoreProduct].self, forKey: .products, decoder)
        self.errorMessage = try container.decode(String.self, forKey: .errorMessage, decoder)
    }
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(success, forKey: .success, encoder)
        try container.encode(products, forKey: .products, encoder)
        try container.encode(errorMessage, forKey: .errorMessage, encoder)
    }
}
public typealias FetchAppleStoreProducts = (_ productIds: [String], _ completed: @escaping (_ result: AppleStoreProductsResult) -> Void) -> Void
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
public var fetchAppleStoreProducts: FetchAppleStoreProducts = {
(_ productIds: [String], _ completed: @escaping (_ result: AppleStoreProductsResult) -> Void) -> Void in
FocusFaceDetectorNative.fetchStoreProducts(productIds, {
(_ json: String) -> Void in
var value = JSON.parse(json, AppleStoreProductsResult.self)
if (value != nil) {
    completed(value!)
    return
}
completed(AppleStoreProductsResult(UTSJSONObject([
    "success": false,
    "products": [],
    "errorMessage": "App Store 商品信息解析失败"
])))
})
}
public func fetchAppleSignedTransaction(_ transactionId: String, _ completed: @escaping (_ jws: String, _ error: String) -> Void) {
    FocusFaceDetectorNative.fetchSignedTransaction(transactionId, completed)
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
public func fetchAppleStoreProductsByJs(_ productIds: [String], _ completed: UTSCallback) -> Void {
    return fetchAppleStoreProducts(productIds, {
    (result: AppleStoreProductsResult) -> Void in
    completed(result)
    })
}
public func fetchAppleSignedTransactionByJs(_ transactionId: String, _ completed: UTSCallback) {
    return fetchAppleSignedTransaction(transactionId, {
    (jws: String, error: String) -> Void in
    completed(jws, error)
    })
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
    public static func s_fetchAppleStoreProductsByJs(_ productIds: [String], _ completed: UTSCallback) -> Void {
        return fetchAppleStoreProductsByJs(productIds, completed)
    }
    public static func s_fetchAppleSignedTransactionByJs(_ transactionId: String, _ completed: UTSCallback) {
        return fetchAppleSignedTransactionByJs(transactionId, completed)
    }
}
