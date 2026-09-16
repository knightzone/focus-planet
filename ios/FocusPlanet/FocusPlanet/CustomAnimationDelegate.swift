//
//  CustomAnimationDelegate.swift
//  FocusPlanet
//
//  Created by kangkang on 2024/12/19.
//

import Foundation
import UIKit
import DCloudUniappRuntime

@objc
@objcMembers
public class CustomAnimationDelegate: NSObject, UniAppXSDKCustomAnimationDelegate {
    
    public func customEnterAnimation(fromVC: UIViewController, toVC: UIViewController, completion: @escaping (Bool) -> Void) {
        // 检查是否有导航控制器
        if let navController = fromVC.navigationController {
            // Push 模式: 添加到导航控制器
            navController.view.addSubview(toVC.view)
            toVC.view.frame = navController.view.bounds
            
            // 简单翻页效果：从右侧滑入 + 缩放
            toVC.view.transform = CGAffineTransform(translationX: navController.view.bounds.width, y: 0)
                .concatenating(CGAffineTransform(scaleX: 0.8, y: 0.8))
            toVC.view.alpha = 0.7
            
            // 执行翻页动画
            UIView.animate(withDuration: 0.6, delay: 0, options: .curveEaseInOut) {
                toVC.view.transform = .identity
                toVC.view.alpha = 1.0
            } completion: { finished in
                navController.pushViewController(toVC, animated: false)
                toVC.view.removeFromSuperview()
                completion(finished)
            }
        } else {
            // Present 模式: 添加到当前视图控制器
            fromVC.view.addSubview(toVC.view)
            toVC.view.frame = fromVC.view.bounds
            
            // 简单翻页效果：从右侧滑入 + 缩放
            toVC.view.transform = CGAffineTransform(translationX: fromVC.view.bounds.width, y: 0)
                .concatenating(CGAffineTransform(scaleX: 0.8, y: 0.8))
            toVC.view.alpha = 0.7
            
            // 执行翻页动画
            UIView.animate(withDuration: 0.6, delay: 0, options: .curveEaseInOut) {
                toVC.view.transform = .identity
                toVC.view.alpha = 1.0
            } completion: { finished in
                fromVC.present(toVC, animated: false)
                toVC.view.removeFromSuperview()
                completion(finished)
            }
        }
    }
    
    
    public func customExitAnimation(currentVC: UIViewController, completion: @escaping (Bool) -> Void) {
        // 检查是否有导航控制器
        if let navController = currentVC.navigationController {
            // Push 模式的退出动画：简单翻页效果
            let viewControllers = navController.viewControllers
            if viewControllers.count > 1 {
                // 先执行 pop，让前一个页面显示出来
                navController.popViewController(animated: false)
                
                // 然后将当前视图添加到导航控制器上（用于动画）
                navController.view.addSubview(currentVC.view)
                currentVC.view.frame = navController.view.bounds
                
                // 执行翻页动画：向左侧滑出 + 缩放
                UIView.animate(withDuration: 0.6, delay: 0, options: .curveEaseInOut) {
                    currentVC.view.transform = CGAffineTransform(translationX: -navController.view.bounds.width, y: 0)
                        .concatenating(CGAffineTransform(scaleX: 0.8, y: 0.8))
                    currentVC.view.alpha = 0.7
                } completion: { finished in
                    currentVC.view.removeFromSuperview()
                    completion(finished)
                }
            } else {
                completion(true)
            }
        } else {
            // Present 模式的退出动画：简单翻页效果
            if let presentingVC = currentVC.presentingViewController {
                // 先执行 dismiss，让前一个页面显示出来
                presentingVC.dismiss(animated: false) {
                    // 然后将当前视图添加到前一个视图控制器上（用于动画）
                    presentingVC.view.addSubview(currentVC.view)
                    currentVC.view.frame = presentingVC.view.bounds
                    
                    // 执行翻页动画：向左侧滑出 + 缩放
                    UIView.animate(withDuration: 0.6, delay: 0, options: .curveEaseInOut) {
                        currentVC.view.transform = CGAffineTransform(translationX: -presentingVC.view.bounds.width, y: 0)
                            .concatenating(CGAffineTransform(scaleX: 0.8, y: 0.8))
                        currentVC.view.alpha = 0.7
                    } completion: { finished in
                        currentVC.view.removeFromSuperview()
                        completion(finished)
                    }
                }
            } else {
                completion(true)
            }
        }
    }
}
