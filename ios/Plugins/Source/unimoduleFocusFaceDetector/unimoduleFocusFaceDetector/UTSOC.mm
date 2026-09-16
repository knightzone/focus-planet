//
//  UTSOC.m
//
//  Created by DCloud on 2022/10/25.
//

#import "UTSOC.h"
#import <DCloudUniappRuntime/DCloudUniappRuntime.h>
#import <DCloudUniappRuntime/DCloudUniappRuntime-Swift.h>


@implementation UTSOC

@end

@implementation DCloudUTSConfig

+ (void)load {
    
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        NSBundle *bundle = [NSBundle bundleForClass:[self class]];
        NSString *filePath = [bundle pathForResource:@"uts-config.json" ofType:nil];
        if (filePath) {
            NSData *data = [NSData dataWithContentsOfFile:[bundle pathForResource:@"uts-config.json" ofType:nil]];
            if (data) {
                NSDictionary *dict = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
                if (dict && [dict isKindOfClass:NSDictionary.class]) {
                    NSArray *components = [dict objectForKey:@"components"];
                    if (components && [components isKindOfClass:NSArray.class]) {
                        for (NSDictionary *item in components) {
                            if ([item isKindOfClass:NSDictionary.class]) {
                                NSString *className = [UniConvert NSString:[item objectForKey:@"delegateClass"]];
                                Class aClass = NSClassFromString(className);
                                if (aClass) {
                                    SEL aSelector = NSSelectorFromString(@"registerComponent");
                                    if ([aClass respondsToSelector:aSelector]) {
                                        NSMethodSignature *methodSignature = [aClass methodSignatureForSelector:aSelector];
                                        NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:methodSignature];
                                        [invocation setTarget:aClass];
                                        [invocation setSelector:aSelector];
                                        [invocation invoke];
                                    }
                                }
                            }
                        }
                    }
                    NSArray *hooksClasses = dict[@"hooksClasses"];
                    if (hooksClasses && [hooksClasses isKindOfClass:NSArray.class]) {
                        for (NSString *item in hooksClasses) {
                            if ([item isKindOfClass:NSString.class]) {
                                Class aclass = NSClassFromString(item);
                                if (aclass) {
                                    id instance = [[aclass alloc] init];
                                    [UniRuntimeService registerHookProxy:instance];
                                }
                            }
                        }
                    }
                    NSArray *providers = dict[@"providers"];
                    if (providers && [providers isKindOfClass:NSArray.class]) {
                        for (NSDictionary *providerDic in providers) {
                            if (providerDic && [providerDic isKindOfClass:[NSDictionary class]]) {
                                NSString *service = [UniConvert NSString: providerDic[@"service"]];
                                NSString *name = [UniConvert NSString: providerDic[@"name"]];
                                NSString *provider = [UniConvert NSString: providerDic[@"class"]];
                                if (service && name && provider) {
                                    Class aClass = NSClassFromString(provider);
                                    if (aClass) {
                                        id aProvider = [[aClass alloc] init];
                                        [UniProviderManager.shared registerProviderWithService:service providerName:name provider:aProvider];
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });
}

@end
