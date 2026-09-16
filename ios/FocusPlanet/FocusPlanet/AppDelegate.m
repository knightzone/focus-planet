//
//  AppDelegate.m
//  FocusPlanet
//
//  Created by kangkang on 2024/6/27.
//

#import "AppDelegate.h"
#import "FocusPlanet-Swift.h"
@interface AppDelegate ()

@end

@implementation AppDelegate


- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    // UniApp X must finish its native bootstrap before the host controller becomes visible.
    // Starting the container from viewDidAppear before this call has completed can leave the
    // runtime alive on a blank host view without ever entering App.uvue.
    NSLog(@"[FocusPlanet] bootstrap UniApp X SDK");
    [UniAppBridge applicationDidFinishLaunchingWithOptions:application :launchOptions];

    return YES;
}

- (UISceneConfiguration *)application:(UIApplication *)application
        configurationForConnectingSceneSession:(UISceneSession *)connectingSceneSession
        options:(UISceneConnectionOptions *)options API_AVAILABLE(ios(13.0)) {
    return [[UISceneConfiguration alloc] initWithName:@"Default Configuration"
                                          sessionRole:connectingSceneSession.role];
}

- (void)applicationDidBecomeActive:(UIApplication *)application{
    [UniAppBridge applicationDidBecomeActive:application];
}

- (void)applicationDidEnterBackground:(UIApplication *)application{
    [UniAppBridge applicationDidEnterBackground:application];
}
- (void)applicationWillEnterForeground:(UIApplication *)application{
    [UniAppBridge applicationWillEnterForeground:application];
}
- (void)applicationWillResignActive:(UIApplication *)application{
    [UniAppBridge applicationWillResignActive:application];
}

- (BOOL)application:(UIApplication *)app openURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options{
    [UniAppBridge applicationOpenURLOptions:app :url :options];
    return YES;
}

- (BOOL)application:(UIApplication *)application continueUserActivity:(NSUserActivity *)userActivity restorationHandler:(void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler{
    [UniAppBridge applicationContinueUserActivityRestorationHandler:application :userActivity :restorationHandler];
    return YES;
}

/** 使用推送添加**/
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken{
    [UniAppBridge didRegisterForRemoteNotifications:deviceToken];
}
- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error{
    [UniAppBridge didFailToRegisterForRemoteNotifications:error];
}

- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler{
    [UniAppBridge applicationDidReceiveRemoteNotificationCompletionHandler:application :userInfo :completionHandler];
}


@end
