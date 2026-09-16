# App 提示更新与强制更新设计

日期：2026-09-11。状态：客户端已接入版本检查和更新拦截；服务端需实现下述接口并配置真实商店链接，才能对用户触发更新。

### 当前实现与联调入口

- 启动/回前台检查、星小屋“检查更新”、普通提示可跳过、卡通更新页、强制路由/新训练入口拦截已启用。
- 普通更新第一层使用系统提示框，点击“查看更新”进入卡通更新页；强制更新直接进入该页。强制状态禁止返回和侧滑，撤回/到期/安装了受支持版本后解除。
- 已开局游戏允许先进入结果页保存；陪伴在完成或取消后显示更新。不会清空原有账号、训练记录与补传队列。
- 更新请求使用独立的 5 秒超时匿名请求，不走 Token 刷新。业务请求附加版本请求头并识别 426。
- 当前 iOS 渠道固定 `appstore`；Android 固定 `android_official`。发布其他渠道前同步修改 `utils/app-update.uts` 的 `updateChannel` 和 `utils/api-client.uts` 中请求头渠道配置。
- iOS URL 白名单为 `apps.apple.com`；Android 为 `appgallery.huawei.com`、`app.mi.com`、`sj.qq.com`。Android 官方下载域名尚未提供，上线前须在 `validUpdateLink` 中加入真实 HTTPS 域名，否则相应策略会被拒绝。
- iOS/Android 外部浏览器跳转通过现有原生模块新增的 `openUpdateLink` 实现，不调用摄像头；沿用已有 Xcode 原生插件同步/重建流程。Android 自定义基座也需包含更新后的原生模块，不能只替换前端资源。
- 检查接口未提供时自动检查静默放行，手动检查提示暂不可用；不会把 404 误当“已经是最新版本”。
- 自动回归：`node tests/app-update.cjs`，覆盖版本边界、非法 URL、游戏完成落盘、路由拦截、断网保留、非法策略、撤回及跳过节流。正式商店跳转和安装后返回仍需真机验收。

联调使用当前版本号 100：下发 latest=120/min=100 测普通更新；latest=120/min=110 测强制更新；返回 `data: null` 测撤回。测试策略必须有真实可打开链接和未来 24 小时内的 `expiresAt`。不要将示例假商店 ID 用于真实用户。

## 1. 用户看到的效果

沿用现有跃跃、暖暖与主题星星素材，不新增大图，不增加 Tab。

| 场景 | 展示 | 操作 |
| --- | --- | --- |
| 有新版本，当前版本仍受支持 | 当前页面居中的圆角卡片，顶部双星图；标题“星伴有新版本啦”；版本号和最多三条更新摘要 | 主按钮“立即更新”，次按钮“稍后再说” |
| 当前版本低于最低支持版本 | 独立全屏更新页，隐藏 Tab；标题“更新后，继续探索”；短说明“请家长帮忙更新一下” | “立即更新”“重新检查”；没有跳过、返回或关闭按钮 |
| 手动检查，无更新 | 提示“已经是最新版本” | 关闭 |
| 手动检查失败 | 提示“暂时无法检查，请稍后再试” | 重试 |
| 更新链接打开失败 | 在原更新界面展示“暂时打不开更新页面” | “重试打开”“复制更新链接”“重新检查” |

设置/星小屋底部增加“检查更新”和当前版本；查看版本、检查更新不需要家长锁。前往商店不等于购买或安装，具体安装授权由操作系统处理。

更新卡片只保留必要文案。普通更新摘要最多三条，每条最多 40 字；超出不扩大弹窗。强制更新页可以滚动查看摘要，但操作按钮须始终可达。支持大字体、安全区和小屏设备。

## 2. 何时检查

- 冷启动首页就绪后检查一次，无需登录；公开接口不携带用户资料或 Token。
- 回到前台距离上次成功检查超过 6 小时，再检查一次。请求超时 5 秒；检查失败不写成功时间。
- 设置中的“检查更新”绕过 6 小时缓存。强制更新页点击“重新检查”，以及从商店返回时，立即重新检查；同一时刻只允许一个请求。
- 普通更新点击“稍后再说”后，同一目标版本 24 小时内不主动提示；发现更高版本可以重新提示；手动检查不受忽略记录限制。
- 登录授权、家长验证、相机授权和进行中的训练/陪伴不弹普通更新，记录结果后延迟到安全页面展示。
- 已开始的训练先完成并本地保存，再进入强制更新页；确认强制更新后，禁止开启下一次训练、陪伴或编辑流程。不得直接 reLaunch 中断正在保存的结果。

启动期或切换页面时的异步响应必须集中处理；多个页面不能各自弹窗。强制状态需守住训练入口和路由切换，不能只做一个 `showCancel: false` 弹框。Android 返回键和 iOS 侧滑都不能进入业务页；关闭 App 后重新启动仍进行检查。

## 3. 服务端接口

新增 `POST /api/v1/app/version/check`，保持现有 POST JSON 和 `requestId/data/error` 包装约定。公开、只读、无鉴权，可做匿名限流，不创建账号、不发短信。

请求：

```json
{
  "appId": "__UNI__B5780B0",
  "platform": "ios",
  "channel": "appstore",
  "versionName": "0.1.0",
  "versionCode": 100,
  "osVersion": "18.6"
}
```

| 字段 | 类型 | 约束与用途 |
| --- | --- | --- |
| appId | string | 必填，DCloud AppID，当前固定 `__UNI__B5780B0` |
| platform | enum | 必填：`ios`、`android`；预留 `harmony`；Web 不检查原生安装包 |
| channel | enum | 必填：`appstore`、`android_official`、`huawei`、`xiaomi`、`oppo`、`vivo`、`honor`、`testflight`、`internal`；由安装包构建配置决定 |
| versionName | string | 必填，1–32 字符，用户可读版本 |
| versionCode | integer | 必填，正整数，真正用于比较；同一平台/渠道单调递增 |
| osVersion | string | 必填，1–32 字符，用于判断目标版本能否在此系统安装 |

第一版不做用户分组灰度，无需 deviceId。后续若要灰度再单独增加策略，不复用登录身份作为公开接口的必需条件。

有更新响应示例：

```json
{
  "requestId": "req_example",
  "data": {
    "policyId": "ios-appstore-20260918-1",
    "policyRevision": 3,
    "platform": "ios",
    "channel": "appstore",
    "latestVersionName": "0.2.0",
    "latestVersionCode": 120,
    "minSupportedVersionCode": 110,
    "title": "星伴有新版本啦",
    "releaseNotes": ["陪伴更贴心", "训练体验更流畅"],
    "updateUrl": "https://apps.apple.com/cn/app/id<真实AppStoreID>",
    "delivery": "store",
    "publishedAt": "2026-09-18T02:00:00Z",
    "expiresAt": "2026-09-19T02:00:00Z"
  }
}
```

示例商店 ID 是占位符，不能直接上线；App Store 的数字 ID 与 DCloud AppID 不同。

没有适用发布版本、关闭更新策略或请求渠道尚未配置时，返回 200：

```json
{
  "requestId": "req_example",
  "data": null
}
```

客户端将 `data: null`（以及当前通用请求封装转换后的空对象）视为没有更新策略并清除旧强制状态；HTTP 错误、超时和非法 JSON 不能被当作策略撤回。

响应字段规则：

- `policyId` 字符串，1–80 字符；`policyRevision` 为正整数；每次发布、撤回、调整最低版本必须更新 revision。
- `latestVersionCode` 与 `minSupportedVersionCode` 均为正整数，且最低支持版本不能高于最新版本。
- `latestVersionName` 长度 1–32；`title` 可选、最多 32 字；`releaseNotes` 为最多三条字符串的数组。
- `delivery` 枚举 `store` 或 `download_page`。iOS App Store 渠道必须为 `store`；Android 可按渠道选择。
- `updateUrl` 必须为 HTTPS。App Store 渠道限定 `apps.apple.com`；Android 限定构建时配置的商店和官方站点域名；不接受任意脚本协议或从后端动态放宽域名白名单。
- `expiresAt` 为 RFC3339 UTC 时间，建议最长缓存 24 小时。无效、过期或字段不完整的响应不得建立新强制状态。
- 服务端先筛选系统兼容且已经对该渠道公开可下载的目标版本，再返回策略。没有可安装目标时不能强制升级。
- 参数校验失败沿用当前服务 `error.code/message/details.fields`；限流返回 429。未部署接口的 404 按检查失败处理，不阻断现有 App。

## 4. 唯一版本判断规则

不用字符串大小比较版本名称，也不另加容易矛盾的 `forceUpdate` 布尔字段。

```text
无有效策略                         → 不提示
当前 versionCode >= latestVersionCode → 不提示（包含测试版高于线上版）
当前 versionCode < minSupportedVersionCode → 强制更新
其余较旧版本                        → 可跳过更新
```

以上例而言，100 强制更新，110/119 普通更新，120/121 不提示。

平台和渠道的版本号分别比较；不得拿 Android 版本号决定 iOS 是否升级。服务端必须保证返回的 platform/channel 与请求匹配。

## 5. 断网、撤回与服务端兜底

首次检查失败且无缓存：继续使用。有效缓存判定为普通更新时，不因断网强制拦截。

已命中过强制更新且缓存仍有效：断网仍留在强制页，并提供重新检查。策略到期后按失败开放处理，防止发布配置错误或后端长时间故障把用户永久锁住；服务端能通过返回新有效策略或 `data: null` 撤回。

客户端拦截属于体验控制。若旧版本存在数据协议不兼容，服务端须对训练计划获取、开始新业务和资料修改等接口增加最低版本校验，返回 HTTP 426：

```json
{
  "requestId": "req_example",
  "error": {
    "code": "APP_UPDATE_REQUIRED",
    "message": "请更新到受支持的版本",
    "details": { "versionCheckPath": "/api/v1/app/version/check" }
  }
}
```

客户端接到 426 后触发公开版本检查，不执行 Token 刷新、不无限重试原请求。如果版本检查仍失败，显示可重试的服务暂不可用提示；不能凭一条 426 构造缺少更新链接的永久强制页。

为此后续业务请求统一增加 `X-App-Platform`、`X-App-Channel`、`X-App-Version-Code`。旧版本可能没有这些请求头，后端需明确迁移期兼容策略，不能默认都属于最新版本。请求头可被修改，不作为安全身份凭证。

离线训练记录/成绩补传应尽可能保留向后兼容窗口。即使服务拒绝旧协议，客户端也必须保留原始记录、submissionId 和队列，更新后继续补传，不能在强制更新时清空缓存、退出账号或删除 App 数据。

## 6. 两端更新方式

- iOS 正式版：使用系统打开 App Store HTTPS 链接；App Store 完成安装。首版不做应用内下载 IPA 或热替换代码。
- Android：使用系统打开该渠道商店/官方 HTTPS 下载页；安装交给系统。首版不实现后台下载、未知来源授权、APK 安装器与下载进度，避免引入额外原生权限。
- 从更新入口回到 App 后读取当前安装版本并重新检查，不能仅因点击过“立即更新”就判为完成。
- TestFlight/internal 单独配置策略。新版本审核中、仅测试用户可见或尚未覆盖该渠道时，禁止给正式用户下发强制更新。

如果以后改成 Android 应用内下载 APK，需另补包大小、SHA-256、签名及安装失败恢复，不属于本期。

## 7. 客户端接入位置与版本来源

现状：`manifest.json` 为 `0.1.0` / `100`，项目已配置 Android/iOS 5.25 Vapor，已有 iOS Xcode 资源同步脚本。

建议实现：

1. `utils/app-update.uts`：请求、字段验证、版本判定、策略缓存、提示节流和统一更新状态。
2. `App.uvue`：冷启动与回到前台触发检查，避免重复请求。
3. `pages/update/update.uvue`：强制更新页；普通更新使用共享卡片；页面导航集中守卫。
4. 星小屋/设置：手动检查入口与当前版本；训练和陪伴入口检查强制状态。
5. `utils/api-client.uts`：版本请求头与 426 处理；版本检查自身不可递归触发。

`uni.getAppBaseInfo()` 可读取 manifest 应用版本信息，但 iOS 本地宿主另有 CFBundleShortVersionString/CFBundleVersion。发布流程应强制核对 manifest、导出资源和原生宿主版本一致；Android versionCode 也须一致。客户端比较整数 versionCode，展示 versionName。渠道必须来自构建配置，不能从手机号、系统品牌或服务端随意推断。

参考：[uni.getAppBaseInfo](https://uniapp.dcloud.net.cn/uni-app-x/api/get-app-base-info.html)、[uni-link 外部链接与 openSchema 依赖](https://doc.dcloud.net.cn/uni-app-x/component/uni-ui-x/uni-link.html)。使用外部跳转插件时需一起接入 Xcode 本地宿主并验证，不能只验证网页预览。

## 8. 发布与验收

后端配置至少包括：平台、渠道、最新版本名/号、最低支持号、支持的系统范围、已公开发布状态、更新链接、摘要、策略 revision、有效期、开关。先确认商店实际可更新，再提高最低支持版本；撤回须立即生效。

必测：

- 无策略、同版本、测试版更高、普通更新、强制更新；字符串 `0.10.0` 不参与数值排序。
- 普通更新跳过 24 小时、手动检查、新目标版本重新提示。
- 强制页 Android 返回键/iOS 侧滑、回前台、冷启动；训练中结果先落盘。
- 首次断网、有效强制缓存断网、缓存过期、后端 404/429/500、非法响应、策略撤回。
- 空链接/非白名单链接、打开失败、从商店返回但未安装、安装完成后解除强制状态。
- 旧成绩队列升级后仍存在且能补传；双端真实版本号、渠道与安装包一致。

联调完成标准：后端提供测试策略，客户端在 Android/iOS 真机分别验证三种状态及恢复路径，再开启正式渠道策略。
