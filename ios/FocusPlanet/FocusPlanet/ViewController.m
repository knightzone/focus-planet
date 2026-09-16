//
//  ViewController.m
//  FocusPlanet
//
//  Created by kangkang on 2024/6/27.
//

#import "ViewController.h"
#import "FocusPlanet-Swift.h"
@interface ViewController ()
@property (nonatomic, assign) BOOL didStartUniApp;
@end

@implementation ViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    // Do any additional setup after loading the view.
    
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(handleNotification:) name:@"com.ios.notification.uvuetonative" object:nil];
    self.view.backgroundColor = [UIColor colorWithRed:0.96 green:0.97 blue:1.0 alpha:1.0];
}

- (void)viewDidAppear:(BOOL)animated {
    [super viewDidAppear:animated];
    [self.navigationController setNavigationBarHidden:YES animated:NO];
    if (!self.didStartUniApp) {
        self.didStartUniApp = YES;
        NSLog(@"[FocusPlanet] host visible; schedule UniApp X start");
        // Let UIKit finish presenting the host controller before the SDK replaces it.
        // This avoids a launch-time push racing the initial navigation transition.
        dispatch_async(dispatch_get_main_queue(), ^{
            [UniAppBridge pushWithoutAnimationWithRootViewController:self];
        });
    }
}

- (void)handleNotification:(NSNotification *)notification{
    NSDictionary *userInfo = notification.userInfo;
    NSString *msg = userInfo[@"msg"];
    [self showAlert:msg];
}

- (void)showAlert:(NSString *)message{
    UIAlertController *alertController = [UIAlertController alertControllerWithTitle:message message:message preferredStyle:UIAlertControllerStyleAlert];
    UIAlertAction *okAction = [UIAlertAction actionWithTitle:@"点击向SDK发消息" style:UIAlertActionStyleDefault handler:^(UIAlertAction * _Nonnull action) {
        [UniAppBridge postMessage:@"com.ios.notification.nativetouvue" message:@"原生宿主向SDK内发送的消息"];
    }];

    [alertController addAction:okAction];
    [self presentViewController:alertController animated:YES completion:nil];
}

@end
