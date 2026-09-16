import CoreGraphics
import DCloudUTSFoundation
import DCloudUniappRuntime
import QuartzCore
import UIKit
@objc(UTSSDKModulesFocusGradientNativeGradient)
@objcMembers
public class NativeGradient : NSObject {
    private var element: UniNativeViewElement
    private var host: UIView? = nil
    private var gradient: CAGradientLayer? = nil
    public init(_ element: UniNativeViewElement){
        self.element = element
        super.init()
        self.bindView()
    }
    private func bindView() {
        var hostView = UIView()
        hostView.isUserInteractionEnabled = false
        var gradientLayer = CAGradientLayer()
        gradientLayer.frame = CGRect(x: 0.0, y: 0.0, width: 52.0, height: 170.0)
        gradientLayer.colors = [
            UIColor(red: 0.30980392, green: 0.49803922, blue: 0.89019608, alpha: 1.0).cgColor,
            UIColor(red: 0.30980392, green: 0.49803922, blue: 0.89019608, alpha: 0.72).cgColor,
            UIColor(red: 0.30980392, green: 0.49803922, blue: 0.89019608, alpha: 0.0).cgColor
        ]
        gradientLayer.locations = [
            0.0,
            0.34,
            1.0
        ]
        gradientLayer.startPoint = CGPoint(x: 0.0, y: 0.5)
        gradientLayer.endPoint = CGPoint(x: 1.0, y: 0.5)
        hostView.layer.addSublayer(gradientLayer)
        self.host = hostView
        self.gradient = gradientLayer
        self.element.bindIOSView(hostView)
    }
    public func destroy() {
        self.gradient?.removeFromSuperlayer()
        self.gradient = nil
        self.host = nil
        UTSiOS.destroyInstance(self)
    }
}
@objc(UTSSDKModulesFocusGradientNativeGradientByJs)
@objcMembers
public class NativeGradientByJs : NativeGradient {
    public func destroyByJs() {
        return self.destroy()
    }
}
