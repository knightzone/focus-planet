//
//  UniAppBridge.swift
//  FocusPlanet
//
//  Created by kangkang on 2024/6/27.
//

import Foundation
import UIKit
import DCloudUniappRuntime

@objc
@objcMembers
public class UniAppBridge : NSObject{
    
    static var customDelegate : CustomAnimationDelegate? = nil
    
    public static func applicationDidFinishLaunchingWithOptions(_ application: UIApplication?, _ launchOptions: [UIApplication.LaunchOptionsKey : Any]? ) {
        NSLog("[FocusPlanet] UniAppXSDK.initSDK begin")
        UniAppXSDK.initSDK()
        UniAppXSDK.applicationDidFinishLaunchingWithOptions(application, launchOptions)
        NSLog("[FocusPlanet] UniAppXSDK bootstrap complete")
    }
    
    public static func applicationOpenURLOptions(_ application: UIApplication?, _ url: URL, _ options: [UIApplication.OpenURLOptionsKey : Any]? ) {
        UniAppXSDK.applicationOpenURLOptions(application, url, options)
    }
    
    public static func applicationWillResignActive(_ application: UIApplication?) {
        UniAppXSDK.applicationWillResignActive(application)
    }
    
    public static func applicationDidBecomeActive(_ application: UIApplication?) {
        UniAppXSDK.applicationDidBecomeActive(application)
//        UniAppPermissionManager.getGgbs() //框架获取idfa权限
    }
    
    public static func applicationDidEnterBackground(_ application: UIApplication?) {
        UniAppXSDK.applicationDidEnterBackground(application)
    }
    
    public static func applicationWillEnterForeground(_ application: UIApplication?) {
        UniAppXSDK.applicationWillEnterForeground(application)
    }
    
    public static func applicationContinueUserActivityRestorationHandler(_ application: UIApplication?, _ userActivity: NSUserActivity?, _ restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) {
        UniAppXSDK.applicationContinueUserActivityRestorationHandler(application, userActivity, restorationHandler)
    }
    
    public static func didFailToRegisterForRemoteNotifications(_ error: Error?) {
        UniAppXSDK.didFailToRegisterForRemoteNotifications(error)
    }

    public static func didRegisterForRemoteNotifications(_ deviceToken: Data?) {
        UniAppXSDK.didRegisterForRemoteNotifications(deviceToken)
    }

    public static func applicationDidReceiveRemoteNotificationCompletionHandler(_ application: UIApplication?, _ userInfo: [AnyHashable : Any], _ completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        UniAppXSDK.applicationDidReceiveRemoteNotificationCompletionHandler(application, userInfo, completionHandler)
    }
    
    public static func pushUniViewController(rootViewController: UIViewController){
        
        if UTSiOS.getCurrentApp() == nil {
            // uni.exit() 方法会销毁app，所以在这里需要判断currentApp是否为空
            UniSDKEngine.shared.getAppManager()?.create()
        }
        let viewController = UniAppRootViewController()
        rootViewController.navigationController?.pushViewController(viewController, animated: true)
        
    }
    
    public static func postMessage(_ name:String, message: String){
        let userInfo: [AnyHashable: Any] = [
            "msg": message // 你可以在这里放置任何需要传递的信息
        ]
        NotificationCenter.default.post(name: Notification.Name(name), object: nil, userInfo: userInfo)
    }
    
    /// Push + 系统默认动画
    public static func pushWithDefaultAnimation(rootViewController: UIViewController) {
        let options = UniAppXSDKStartOptions()
        options.openType = .push
        options.animationType = .auto
        options.viewController = rootViewController
        
        UniAppXSDK.start(options: options)
    }

    /// Cold launch should not animate the UniApp root over the temporary host view.
    public static func pushWithoutAnimation(rootViewController: UIViewController) {
        NSLog("[FocusPlanet] UniAppXSDK.start begin")
        let options = UniAppXSDKStartOptions()
        options.openType = .push
        options.animationType = .none
        options.viewController = rootViewController

        UniAppXSDK.start(options: options)
        NSLog("[FocusPlanet] UniAppXSDK.start returned")
    }
    
    /// Present + 系统默认动画
    public static func presentWithDefaultAnimation(rootViewController: UIViewController) {
        let options = UniAppXSDKStartOptions()
        options.openType = .present
        options.animationType = .auto
        options.viewController = rootViewController
        
        UniAppXSDK.start(options: options)
    }
    
    /// Push + 滑动动画
    public static func pushWithSlideAnimation(rootViewController: UIViewController) {
        let options = UniAppXSDKStartOptions()
        options.openType = .push
        options.animationType = .slideInRight
        options.animationDuration = 0.5
        options.viewController = rootViewController
        
        UniAppXSDK.start(options: options)
    }
    
    /// 自定义酷炫动画
    public static func customAnimation(rootViewController: UIViewController) {
        let options = UniAppXSDKStartOptions()
        options.animationType = .custom
        options.viewController = rootViewController
        customDelegate = CustomAnimationDelegate()
        options.customAnimationDelegate = customDelegate
        
        UniAppXSDK.start(options: options)
    }
    
    /// 退出 UniApp
    public static func exitUniApp() {
        UniAppXSDK.exit()
    }
    
    
}
