# iOS Xcode 本地打包

本目录是“专注星伴”的 iOS 原生宿主。Xcode target/scheme 固定为 `UniAppX`，AppID 为 `__UNI__B5780B0`，Bundle ID 为 `com.zhuanzhuapp.mate`，最低系统版本为 iOS 15。

## 首次配置

1. 使用 HBuilderX **5.26** 打开已启用蒸汽模式的项目。在“发行 → 原生App-本地打包”中选择“生成本地打包App资源”。iOS 蒸汽模式要求 5.26 及以上，HBuilderX 与原生 SDK 必须使用相同版本。
2. 安装官方 SDK：

   ```bash
   ios/scripts/install-sdk.sh
   ```

   已下载并解压 SDK 时，也可执行 `ios/scripts/install-sdk.sh /path/to/UniAppXSDK-iOS-Vapor@5.26`。
3. 首次安装 SDK 后，用一个命令生成 5.26 iOS Vapor 资源、同步到 Xcode，并按需重编面部/坐姿检测插件：

   ```bash
   ios/scripts/prepare-xcode.sh
   ```

   如果首次配置还没有精简 ExtAPI 框架，脚本也会自动构建。HBuilderX 安装位置不同，可通过 `HBUILDERX_CLI=/实际路径/cli` 指定。
4. 打开 [FocusPlanet.xcodeproj](FocusPlanet/FocusPlanet.xcodeproj)，在 target `UniAppX` 的 Signing & Capabilities 中选择开发团队，然后连接 iPhone 运行。

## 日常同步规则

修改 `.uvue`、`.uts`、页面配置、插件或 `static/` 资源后，在 Xcode 运行前执行：

```bash
ios/scripts/prepare-xcode.sh
```

Xcode target 内置了 `Check uni-app x resources` 构建阶段。若源码比已同步资源新、AppID/编译器版本不符，或导出目录与 Xcode 资源不一致，构建会停止并提示运行上述命令，因此不会再静默安装旧 UI。

## Archive 与上传

Xcode 中选择 `Any iOS Device (arm64)`，再执行 Product → Archive。也可以使用：

```bash
DEVELOPMENT_TEAM=你的10位TeamID ios/scripts/archive.sh
```

Archive 完成后在 Organizer 中执行 Validate App 和 Distribute App。命令行上传时，复制 `ExportOptions-AppStore.plist.example` 为本机配置文件，再使用 `xcodebuild -exportArchive`。

## 约束

- `ios/SDK`、`ios/CustomFrameworks`、`ios/TemporarySampleFramework`、编译出的插件 Framework、DerivedData 和 Archive 都不提交 Git；换电脑后由脚本恢复。
- `uni-app-x/apps/__UNI__B5780B0` 是 HBuilderX 的发行产物，不手工编辑，也不提交 Git。
- 不要把官方示例中包含全部 API 的 `DCloudUTSExtAPI.framework` 直接放进主工程；`build-extapi.sh` 只编译本项目需要的提示、存储、系统信息、网络、音频、相机、Apple 登录、Apple 订阅与 `<web-view>`（法律文档页）模块，可显著降低安装体积。
- `<web-view>` 在 iOS 上是按需 ExtAPI 元素：`build-extapi.sh` 的 `web_view_sources` 与 `ios/ExtAPI/uts-config.json` 的 `UniWebViewElementRegister` 必须同时保留，少一个 iOS 上就渲染不出法律文档页（Android 由运行时自带）。改动这两处后 `prepare-xcode.sh` 会自动重编 ExtAPI，HBuilderX 侧需重新制作/运行自定义基座，热更新不会带上新的原生框架。
- 插件源代码会提交。`sync-resources.sh` 会用当前 HBuilderX 生成的 `index.swift` 更新桥接层，再由 `build-plugin.sh` 编译出真机（arm64）与模拟器（arm64/x86_64）双切片的 `Plugins/unimoduleFocusFaceDetector.xcframework`。
- 插件必须是 xcframework：真机与模拟器切片同为 arm64 但平台不同，单个 `.framework` 装不下。只有真机切片时模拟器启动会因 `Library not loaded ... incompatible platform (have 'iOS', need 'iOS-simulator')` 闪退；`verify.sh` 会提前报缺切片。
- 模拟器可以构建并运行 UI（终端 `xcodebuild -scheme UniAppX -destination 'platform=iOS Simulator,name=...'`），模拟器使用 ad-hoc 签名、不需要 Team。相机与端侧检测仍以真机为准。
- 不直接运行 `sync-resources.sh` 作为日常入口；统一运行 `prepare-xcode.sh`，确保“导出、同步、插件按需重编、校验”是一条完整链路。
