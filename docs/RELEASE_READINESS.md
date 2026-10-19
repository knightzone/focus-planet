# 上线准备清单（iOS 首发，2026-10-15）

范围：iOS 首发打包与 App Store 审核。Android / HarmonyOS 后续单独走各自商店。

## 结论

客户端打包链路**已经就绪**：签名、版本号、图标、启动屏、隐私清单、权限文案、Apple 登录与订阅模块、包内无测试文案、本地测试开关已关。真正还差的是**服务端配置 + App Store Connect 配置 + 几条产品/法务决策**，不是代码没写完。

---

## A. 本仓库已就绪（可用命令复现）

| 项 | 状态 | 证据 |
| --- | --- | --- |
| 本地测试入口 | 已关闭 | `utils/local-test.uts` 的 `LOCAL_TEST_MODE = false` |
| 包内测试文案 | 无 | `ios/scripts/verify.sh` 文案哨兵；导出产物搜 `本地验证码/仅测试阶段/本地测试登录/测试服务/临时测试` 均 0 命中 |
| 签名 | 已配置（手动签名） | pbxproj：Team `4N5RUYQ48R`，Debug 描述文件「专注星伴dev」、Release「专注星伴dis」 |
| 版本号三处一致 | 是 | `manifest.json` 1.0.0/1000 = pbxproj `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` = 导出资源 manifest（`verify.sh` 校验） |
| App 图标 / 启动屏 | 有 | `Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png`、`UILaunchScreen` + `LaunchBackground` |
| 方向锁定 / 多余权限 | 已锁竖屏、无模板残留权限文案 | `verify.sh` 拦截 `INFOPLIST_KEY_NS*` 与 `UISupportedInterfaceOrientations_iPad/_iPhone` |
| 隐私清单 | 有 | `FocusPlanet/PrivacyInfo.xcprivacy`：7 类收集数据 + 3 个 Required Reason API，`NSPrivacyTracking=false` |
| 出口合规 | 已声明 | `Info.plist` `ITSAppUsesNonExemptEncryption=false` |
| Apple 登录 | 已接入 | entitlements `com.apple.developer.applesignin`；`uni-oauth.apple` |
| Apple 订阅 | 已接入 | `uni-virtualPayment`；会员页读服务端商品并用 StoreKit 展示价格 |
| 统计 / 追踪 | 关闭 | `uniStatistics.enable=false`，无 IDFA/追踪 |
| 账号注销（Apple 硬性要求） | 有入口 | `pages/account/account.uvue` 注销账号 → `POST /me/delete`，先过家长锁 |
| 法律文档 | 四份 | 设置页 → 用户协议 / 隐私政策 / 儿童个人信息保护规则 / 第三方信息共享清单 |
| 更新检查 | 已接入 | `utils/app-update.uts` → `POST /config`（无推送模块） |

一条命令确认打包输入：`bash ios/scripts/prepare-xcode.sh`（导出 → 同步 → 插件按需重编 → `verify.sh`）。

---

## B. 本仓库剩余项（客户端，2026-10-15 更新）

1. **客服联系方式**：`pages/account/account.uvue:63` 仍显示「微信 jimmy_kangkang」——本轮产品确认**暂不改**。上线时需保证 App Store Connect 的支持 URL 与线上文档（`support@paidongapp.com`）一致。
2. **摄像头：已移除（本版本不支持）**。`NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` / `NSPhotoLibraryAddUsageDescription` 已从宿主与插件 Info.plist 删掉；`build-extapi.sh` 不再编译 `uni-camera` / `uni-media`，也不再链接 `DCloudMediaPicker`；宿主机不再链接 `DCloudPermissionCamera.xcframework`；插件 Android 端删掉 `CAMERA` 权限声明。`verify.sh` 新增四道闸（权限键、宿主链接、ExtAPI 符号、模板回填）。实测：ExtAPI 从 39M 降到 **34M**，所有嵌入 framework 的 `nm -u` 已无 `AVCaptureDevice` / `UIImagePicker` / `PHPhoto`；模拟器启动正常。同步脚本 `sync-resources.sh` 每次同步后会把模板回填的相机/相册权限键删掉。
3. **自动续费到期提醒：已实现（本地通知）**。会员状态写入时（`utils/membership.uts` 的 `saveMembership`）调 `syncRenewalReminder`：到期前 **5 天**用 `UNUserNotificationCenter` 排一条本地通知；已进入 5 天窗口则稍后立即提醒；未开通/已过期则取消。插件 `focus-face-detector` 新增 `scheduleRenewalReminder` / `cancelRenewalReminder`（原生 Swift + 各平台 stub），**不接任何第三方推送 SDK、不需要推送证书或 APNs 能力**。前台也会弹横幅（`RenewalReminderPresenter`）。**限制**：本地通知只在 App 至少打开过一次后生效，换机/卸载重装会丢；协议里说的远程推送（服务端定时）仍未实现，需产品确认是否接受“本地通知兜底”的合规口径。
4. **第三方信息共享清单一致性**：清单里友盟 U-APM / 微信开放 SDK / 通知 / 麦克风当前都未接入。按之前约定第一版不披露不一致，但请确认 ASC 隐私标签与 `PrivacyInfo.xcprivacy` 的 7 类（Phone Number / User ID / Name / Other Data / Product Interaction / Purchase History / Device ID，均 Linked、App Functionality、不追踪）完全一致。注意：本地通知已接入，清单里的“通知权限”要从“未接入”改成“已接入（本地通知，非远程推送）”。
5. **数据导出**：后端 `POST /me/export` 已就绪，本轮产品确认**第一版不上**客户端入口。
6. **家长门覆盖**：购买已过家长门（`membership.uvue` → `parent-lock?action=purchase`）；法律文档的 `<web-view>` 外链**没有**家长门。若 App Store 选「儿童」分类，需确认外链是否也要家长门（Apple 5.1.4）。
7. **调试日志**（可选）：`utils/api-client.uts`、`utils/offline-sync.uts`、`utils/course-plan.uts`、`pages/result/result.uvue` 有 `[auth-refresh]` / `[lesson-sync]` 的 `console.log`，不含 token/密码，但发版前可移除或降级。

---

## C. 服务端必须在发版前完成

1. 生产域名 `https://zhuanzhuapp.com/api/v1` 全量可用：验证码、`/me`、`/training`、`/reports`、`/vip`、`/config`。
2. **审核通道**：把 `18866668888`（会员）与 `18866669999`（非会员）加入固定验证码/审核白名单（服务端 `REVIEW_PHONES`）；两个账号都预置完整儿童档案（`infoCompleted = true`，服务端已对审核号自动补档），审核员登录后直接进首页；`18866669999` 保持非会员。
3. `/vip/products` 返回真实 App Store 商品 ID，且与 ASC 的订阅组、商品状态、销售范围一致。
4. `/config` 更新策略接口部署 + 真实 App Store 渠道链接。
5. 账号注销 `POST /me/delete` 生效（置 `DELETION_PENDING`、撤销 refresh token，7 天后删除）。
6. 短信服务商与频率限制按生产配置（小时限额、网关失败不要占用冷却/次数）。

---

## D. App Store Connect 配置清单

- App 记录：Bundle ID `com.zhuanzhuapp.mate`，名称「专注星伴」。
- 分类与年龄分级问卷；若选「儿童」分类，按 5.1.4 复核外链/购买家长门。
- 隐私标签：与 `PrivacyInfo.xcprivacy` 的 7 类一致。
- 隐私政策 URL、支持 URL（`zhuanzhuapp.com/legal/...`，支持邮箱 `support@paidongapp.com`）。
- 订阅：自动续订订阅商品 + 订阅组 + 沙盒测试账号；续费条款与隐私链接。
- 出口合规：已在 Info.plist 声明非豁免加密 = false。
- App Review Information：需要登录、审核账号、审核备注（见下）。
- TestFlight 内测 + Apple Sandbox 订阅闭环验收（产品总览里标记为「页面可见 ≠ 支付上线」）。

---

## E. 审核账号与审核备注

App 启动即要求登录（当前没有游客模式），因此需要**两个**审核账号，一个带会员、一个不带，审核员才能同时看到免费体验和付费墙：

| 账号 | 权益 | 预置数据 | 用途 |
| --- | --- | --- | --- |
| `18866668888` | 已开通会员（VIP） | 儿童档案 `infoCompleted = true` | 验证会员页、成长报告、已解锁内容 |
| `18866669999` | **非会员（免费账号）** | 儿童档案 `infoCompleted = true`，**不开通会员** | 验证免费体验与付费墙/订阅入口（审核员看不到付费墙会被判功能不完整） |

客户端行为（无需改代码）：登录页输入手机号 → 点「获取验证码」→ 服务端审核通道返回的 `debugCode` 会被客户端**自动填入**验证码框 → 点「登录」即可。见 `utils/auth.uts:60`（`requestPhoneCode` 静默回填）与 `pages/login/login.uvue:167`。客户端没有硬编码的测试手机号，白名单完全在服务端。

服务端要求（必须）：审核通道要识别 `18866668888` 与 `18866669999` 两个号、都下发固定验证码（或返回 `debugCode`），两个账号都 `infoCompleted = true`；`18866668888` 预置有效会员、`18866669999` **保持非会员**（不要顺手开通，否则付费墙又看不到了）。

### 审核备注模板（中文）

```text
审核账号（会员）：18866668888
审核账号（非会员）：18866669999
验证码：点「获取验证码」后页面会自动填入（审核通道）；如未自动填入，请使用固定验证码 <后端确认，例如 123456>。
两个账号都已预置儿童档案，登录后可直接体验每日训练与成长报告；
用 18866668888 可查看会员权益，用 18866669999 可查看未开通时的免费体验与订阅入口。
会员购买走 Apple 沙盒；相机权限当前不会触发（星陪伴的端侧检测已关闭）。
```

### App Review Notes (English)

```text
Demo account (VIP): 18866668888
Demo account (free, non-VIP): 18866669999
Verification code: after tapping "Get code" the code is auto-filled via our review channel. If not auto-filled, use the fixed code <confirm with backend, e.g. 123456>.
Both accounts already have a child profile, so you can start training and open the growth report right away.
Use 18866668888 to see the membership experience, and 18866669999 to see the free experience and the subscription entry point.
Membership purchases use Apple Sandbox. The camera permission is not triggered in the current build (on-device posture detection is disabled).
```

---

## F. 出包命令备忘

```bash
bash ios/scripts/prepare-xcode.sh                 # 导出 + 同步 + 校验
DEVELOPMENT_TEAM=4N5RUYQ48R bash ios/scripts/archive.sh   # 出包（不带 Team 只会做无签名校验归档）
```

Xcode：选 `Any iOS Device (arm64)` → Product → Archive → Organizer 里 Validate App / Distribute App。
