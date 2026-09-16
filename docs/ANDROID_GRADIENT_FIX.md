# Android 首页渐变模块未注册

2026-09-13。HBuilderX 运行日志在 `new NativeGradient(...)` 报 `UTS module focus-gradient is not registered`：页面资源调用了当前 Android 基座中未注册的原生模块。资源编译成功并不能保证基座包含对应原生实现。

首页边缘渐变仅为装饰，已替换为 `static/images/runtime/brand/hero-edge-blend-v1.svg`，保持 52×170 尺寸、#4f7fe3 颜色、0/34%/100% 位置的 1/0.72/0 透明度。各端统一用普通 image 渲染，不再实例化 NativeGradient。原插件源文件保留但首页不再引用；iOS 同步/校验不再强制要求渐变原生源码或类。

验证：`node tools/test-home-gradient.cjs`、运行资源检查、Android 5.25 Vapor 编译导出通过；Android 导出中不再包含 focus-gradient 的原生模块源码。此修复不改动端侧人脸检测插件及其自定义基座要求。

iOS 5.25 Vapor 同样编译导出通过，Xcode 资源同步及新鲜度校验通过。

手机操作：停止旧运行任务，重新运行当前主项目到 Android。若仍出现旧组件行号，清理项目的运行缓存后重新运行；无需清除用户数据，也无需仅为首页渐变制作自定义基座。
