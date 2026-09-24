# iOS 会员订阅接入

## 已实现

- 未开通会员时，首页不展示今日训练计划，顶部和主卡片进入「开通会员」。
- 会员页通过 StoreKit 2 实时读取 App Store 本地化价格、订阅周期和新用户初始优惠资格；进入页面及切换方案时会弹 Toast 说明当前选择。
- 月付仅在 Apple 判定符合资格且 App Store Connect 返回 7 天免费试用时展示「7天免费」；年付折扣由 Apple 返回的月价与年价动态计算，不在客户端写死。
- StoreKit 商品读取与业务会员状态并行；12 秒没有回调会结束加载并显示可重试提示，不会永久停留在「正在读取」。
- 用户点击订阅后，才打开该方案的 Apple 付款确认页。
- Apple 交易先由服务端向 App Store Server API 验证，验证成功后才在本机结束交易。
- 支持「恢复购买」，并使用 `appAccountToken` 防止一笔订阅被绑到不同业务账号。
- Android 等其他平台暂不调起支付，仅给出提示。

## 当前商品（暂时只支持 2 个自动续订订阅）

| 商品 ID | 说明 | 类型 | 引入优惠（App Store Connect） |
| --- | --- | --- | --- |
| `xingban_month_vip` | VIP 月卡（39） | `subscription` | 7 天免费试用 |
| `xingban_year_vip` | VIP 年卡（399） | `subscription` | 新用户首期 6 折 |

- 两个商品必须建在**同一个自动续期订阅组**，Bundle ID 为 `com.zhuanzhuapp.mate`。
- 商品 ID **不在客户端写死**：客户端只拿服务端 `/vip/status` 返回的 `products` 去问 StoreKit。商品增删只改服务端（和 App Store Connect），不用重发客户端。
- 优惠也不在客户端写死：免费试用/首期折扣的可用性、资格、价格全部来自 StoreKit 的 `introductoryOffer` 与 `isEligibleForIntroOffer`。页面只在**该 Apple ID 符合资格**时把优惠写进方案说明（免费试用显示“符合资格可免费试用 N 天/月”，折扣显示“新用户首期 <Apple 返回的价格>”）。
- 同一订阅组内优惠资格是共用判定的，所以两个商品要么都能享受、要么都不能。

## 服务端配置（会员页能不能通的先决条件）

服务端 `focus-companion-backend` 必须打开 Apple IAP 并列出这两个商品，否则 `/vip/status` 直接返回 `503 APPLE_IAP_NOT_CONFIGURED`，会员页只能显示错误：

```dotenv
APPLE_IAP_ENABLED=true
APPLE_IAP_BUNDLE_ID=com.zhuanzhuapp.mate
APPLE_IAP_ENVIRONMENT=Sandbox
APPLE_IAP_ROOT_CERTIFICATE_PATH=app/data/AppleRootCA-G3.cer
APPLE_IAP_PRODUCTS_JSON={"xingban_month_vip":{"name":"星伴会员月卡","type":"subscription"},"xingban_year_vip":{"name":"星伴会员年卡","type":"subscription"}}
```

`APPLE_IAP_PRODUCTS_JSON` 的 key 必须与 App Store Connect 商品 ID 逐字一致，`type` 用 `subscription`；`APPLE_IAP_ENVIRONMENT` 联调期为 `Sandbox`，与 Apple 交易的 `environment` 字段不符会被判为「Apple 交易环境不匹配」。

**配置优先级坑**：`app/config.py` 的 `env_file = (".env", ".env.local")`，后读的 `.env.local` 会整体覆盖 `.env` 里的同名键。服务器上两个文件都有 `APPLE_IAP_*` 时，生效的是 `.env.local`；改了 `.env` 没生效先看这里（改完必须重启 uvicorn）。

2026-09-22 已在联调服务（`47.103.134.123:8555`）启用并实测：`POST /api/v1/vip/status` 返回 `200`，带 `appAccountToken`（UUID）与上面两个商品。

## `/vip/status` 的调用时机与刷新策略

| 触发点 | 行为 |
| --- | --- |
| App 启动 / 回到前台（`App.uvue onShow`） | `resumeMembership()`：距上次成功同步 ≥ 5 分钟才拉一次 |
| 训练列表（`pages/dimensions` onShow） | 同上，避免陈旧缓存把刚开通的用户拦回会员页 |
| 首页（`pages/index` onShow） | 每次显示都刷新（同时决定今日计划是否展示） |
| 会员页（onShow / 购买成功后 / 恢复购买后） | 重新拉状态与商品 |

本地缓存规则：

- **只有成功拿到响应才写「已同步时间」**；失败不算成功，30 秒后才允许重试，离线时不会每次进页面都打服务端。
- 并发去重：上一次刷新还没返回时不重复发请求。
- 缓存**只在确定过期时**把 `active` 降级；`expiresAt` 解析不出时间时保留服务端结论（fail-open），等下一次刷新纠正。服务端返回的是带微秒的 `2027-09-22T08:41:42.489230Z`，客户端先把小数秒裁到 3 位再解析，不依赖运行时的 6 位小数秒支持。
- 状态变化会 `uni.$emit('focus-membership-updated')`，首页等已挂载页面即时更新。
- 权益最终由服务端判定，客户端缓存只影响界面。

## App Store Connect 配置

1. 在同一个自动续期订阅组中创建：
   - `xingban_month_vip`
   - `xingban_year_vip`
2. 为需要的商品配置「初始优惠」，类型为免费试用，时长 7 天。试用资格与实际价格以 Apple 付款页为准。
3. 确认 App ID / 描述文件的「App 内购买」能力已开启，且已签署付费 App 协议（否则 StoreKit 查不到商品）。
4. 创建 App Store Connect API 密钥，将 Issuer ID、Key ID 和 `.p8` 私钥放入服务端的秘密配置，不放入 Git。
5. 使用 Sandbox Apple ID 在真机验证购买、取消、恢复与到期流程。

## 「会员页不通 / 只有一个月卡 / 没有免费试用」排查顺序

会员页现在会把服务端下发的**每一个**商品都画成卡片，StoreKit 没返回或类型不符的会标「暂不可购买」并写明原因，所以先看卡片：

1. 一个方案都没显示，或提示「Apple VIP 内购暂未配置」/「会员商品暂未配置」→ 服务端 `APPLE_IAP_*` 没配、商品 JSON 里没有对应 ID，或 `.env.local` 覆盖了 `.env`（见上一节）。
2. 卡片写「App Store 未返回 xingban_xxx」（带真实 ID）→ 服务端已经下发了，但 StoreKit 没查到：核对商品 ID 拼写（最容易错一个字母）、是否同一订阅组、商品是否可购买、真机是否已登录 Sandbox Apple ID。Apple 的元数据变更最长要 1 小时才在沙盒生效。
3. 卡片写「App Store 中此商品不是自动续期订阅」→ ASC 里建成了非续期订阅/非消耗型，或服务端 `type` 写错。
4. 卡片写「App Store 未配置引入优惠」→ ASC 商品没配「引入优惠」（免费试用或首期折扣）。
5. 卡片写「当前 Apple ID 不符合优惠资格」→ ASC 配了优惠，但这个 Apple ID 已经享受过同订阅组的优惠（沙盒账号常见；清购买记录也不保证重置 `isEligibleForIntroOffer`）。
6. 不要用 Xcode 的 StoreKit 本地配置文件联调：那种交易的 `environment` 是 `Xcode`，服务端只接受 `Sandbox` / `Production`，验单一定失败。
7. 提示「Apple 交易没有绑定到当前账号」→ 购买的 Apple 账号与服务端 `appAccountToken` 不匹配，用原购买账号「恢复购买」。
8. **服务端已开通但客户端显示未开通** → 先看 `/vip/status` 返回的 `isVip`：`AppleIapService.status()` 只统计 `product_id` 在当前 `APPLE_IAP_PRODUCTS_JSON` 里的交易，改了商品 ID 却没同步已存在的交易/手工授予记录，权益会被静默过滤掉（已踩过一次：`xinban_year_vip` 拼写错误）。若 `isVip` 正常但界面仍旧，检查客户端缓存时间与上行刷新节流。

## 本地构建

每次修改会员页、`manifest.json` 或 iOS 扩展 API 后执行：

```bash
ios/scripts/prepare-xcode.sh
```

该脚本会导出 HBuilderX 5.26 蒸汽模式资源，并在需要时重建包含 StoreKit 2 的精简 `DCloudUTSExtAPI.xcframework`。

## 上线前必做

- 接入 App Store Server Notifications V2（端点 `POST /api/v1/vip/apple/notifications` 已实现并在联调服务开启，还需在 App Store Connect 里把通知 URL 指向它）。
- 用 TestFlight/Sandbox 验证两个商品的展示、价格、试用资格、验单和恢复购买。
- 确认 App Store 审核截图和隐私/订阅条款页已就绪。
