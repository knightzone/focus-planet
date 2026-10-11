# 专注星伴 MVP

面向 3–16 岁儿童、学生及家长的游戏化专注练习与番茄计时应用。工程采用 uni-app x，目标平台为 iOS、Android 与 HarmonyOS NEXT。本文记录 2026-09-29 的当前工程状态；产品全貌见 [产品总览](docs/PRODUCT_OVERVIEW.md)。

## 当前 MVP

- 三 Tab：星训练、星陪伴、星小屋；手机号验证码和 Apple 登录接入，本地假登录关闭。
- 30 个可玩训练，五维各 6 个；五维目录进入的是游戏图鉴，不是自由训练入口。
- 客户端按课号固定生成每日五题，跨天续做；难度按同游戏历史成绩升降，课程内冻结。课程成绩先落本机，最佳分排队同步。
- 结束页展示角色、语音与星级；训练历史按课查询，成长报告提供全部、近 30 课、近 14 课三个范围。
- iOS 月/年自动续订会员客户端和服务端验单链路已接入，支持恢复购买；非会员首页不展示今日计划。价格与优惠资格取自 StoreKit，仍需 Sandbox/TestFlight 完整验收，见 [iOS 会员订阅接入](docs/IOS_MEMBERSHIP.md)。
- 星陪伴当前仅开放普通番茄钟：三种场景、1/10/15/20/25 分钟、暂停、休息和本机记录。相机及坐姿观察暂不在页面开放。
- 找茬和拼图使用已审核运行素材；素材生产及运行包分离。具体数量、候选及抽取规则见 [找茬运行说明](docs/SPOT_DIFFERENCE_RUNTIME.md)。
- 设置页可打开用户协议、隐私政策、儿童个人信息保护规则和第三方信息共享清单；正文由 App 内网页加载线上 `zhuanzhuapp.com/legal/`，登录前须主动勾选同意。账号页提供需家长验证的注销入口，调用 `POST /me/delete`。
- 首页与星小屋统计以服务端记录为优先口径：近期成绩与本地记录去重合并，累计项取成长报告的 `allTime`；本地数据用于首帧展示和离线兜底，见 `utils/training-stats.uts`。

## 运行方式

1. 工程已开启 uni-app x 蒸汽模式和样式隔离 2.0；iOS Vapor 本地打包固定使用 HBuilderX `5.26.2026091802` 与原生 SDK 5.26，二者不能混用版本。
2. 选择“运行”并运行到浏览器、Android、iOS 或鸿蒙设备。
3. 鸿蒙构建需要按照 DCloud 的 uni-app x 鸿蒙开发指南配置 DevEco Studio 与证书。

当前需先登录，再创建或读取儿童档案；年龄由出生年月动态计算。训练结果与陪伴记录先通过 `uni.setStorageSync` 保存在本机。当前陪伴页不启用相机，也不录像或上传图像；端侧观察原型保留在代码与历史方案中，不是目前对用户开放的功能。

## 本地服务联调

- API 地址集中配置在 `utils/api-client.uts`，当前统一使用 `https://zhuanzhuapp.com/api/v1`。
- 业务接口统一使用 POST + `application/json`，无参数时发送 `{}`；档案、计划及陪伴 ID 和报告筛选条件均放入 JSON 请求体，不再拼接路径或查询参数。
- `utils/api-client.uts` 统一处理设备标识、Bearer Token、401 自动刷新、服务端响应与错误；`utils/server-api.uts` 提供登录、档案、训练记录、报告、会员及陪伴接口。当前五题和难度由客户端确定，不由服务端下发计划。
- 本地开发短信会把验证码返回为 `debugCode`，登录页会自动填入，方便联调。
- `127.0.0.1` 适用于 Web 和 iOS 模拟器；Android 模拟器通常需改为 `http://10.0.2.2:8080/api/v1`，真机需改为电脑的局域网地址，并让服务端监听 `0.0.0.0`。

## 目录

```text
index.html      Web/Vue 3 入口
pages/
  profile/      首次宝宝档案
  index/        “星训练”Tab 与今日训练首页
  companion/    “星陪伴”Tab 与独立专注工具入口
  mine/         “星小屋”Tab、成长与档案入口
  dimensions/   五维训练目录
  game/         MVP 训练游戏
  result/       单次训练结果
  report/       五维成长报告
  history/      完整训练历史
  membership/   会员订阅（StoreKit 购买、恢复购买、方案展示）
  settings/     档案与本地数据管理
  legal/        法律文档 web 页（web-view 承载线上站点）
static/         仅包含会进入安装包的运行资源
utils/          年龄、游戏目录与本地存储
docs/           产品结构与后续路线
content/        AI 素材任务、提示词、源图与审核状态
static/images/  已审核运行时素材（图片优先使用 WebP）
backend/        AI 素材任务与审核服务
web-demo/       官网三款固定关卡试玩代码包（独立于 App）
```

当前课程与接口以 [客户端课程规则](docs/CLIENT_LESSON_PLAN.md)、[离线同步](docs/OFFLINE_SYNC.md)、[服务端调用](utils/server-api.uts) 为准。[早期服务端接口讨论稿](docs/SERVER_API_DESIGN.md) 只保留历史设计参考，不可按其服务端下发计划方案实施。进度及待办见 [路线图](docs/ROADMAP.md)。

Android/iOS 端侧观察的原型与隐私边界见 [历史方案](docs/ON_DEVICE_OBSERVATION.md)；目前星陪伴仅开放普通番茄钟。

iOS 已提供可直接打开的 Xcode 原生宿主。日常修改后执行 `ios/scripts/prepare-xcode.sh` 即可完成 5.26 资源导出、同步、插件按需重编与校验；Xcode 构建阶段也会阻止陈旧资源继续打包，详见 [ios/README.md](ios/README.md)。

完整产品定位、功能结构、视觉语言、当前完成度与上线重点见 [产品总览](docs/PRODUCT_OVERVIEW.md)；可分享的图文版见 [产品总览 V2 Word](docs/专注星伴产品总览V2.0.docx)。旧 V1 Word 保留作为历史版本。App Icon 与核心角色素材见 [content/brand/](content/brand/)。

官网静态试玩组件及部署说明见 [web-demo/focus-planet-demos/README.md](web-demo/focus-planet-demos/README.md)；它不接入 App 课程、账号或报告。

## 包体积维护

- `static/` 会被整体复制进 App，只允许放置运行时实际需要的资源；生成源图、预览图和草稿统一放在 `content/ai-assets/archive/`。
- 运行图片使用 WebP，TabBar 图标保留 PNG。新增或重新生成 PNG 素材后执行 `tools/optimize-runtime-assets.sh`。
- 提交前执行 `node tools/check-runtime-assets.mjs`，确认静态路径和影子配对动态素材完整。
- 2026-09-09 首轮优化将 `static/` 从约 70MB 降至约 6.3MB；源图完整保留，但不进入安装包。
- iOS 使用 `ios/scripts/build-extapi.sh` 从 5.26 Vapor SDK 源码构建按需扩展框架；不要重新接入官方全量示例框架。
- Android 正式构建固定为 `arm64-v8a` 并保持 SO 压缩；不要用“运行到设备”生成的调试基座评估商店包体积。
- 2026-09-10 完成蒸汽模式迁移；当时使用的 5.25 已由后续 5.26 正式版替代。
- 2026-09-22 工具链再升级：HBuilderX 与 iOS 原生 SDK 同为 5.26 正式版，不再使用 5.25 alpha，`ios/scripts`、tools/tests 与文档已全部指向 5.26。

### VIP 接口联调

会员客户端统一使用 POST /vip/status 与 POST /vip/apple/verify，不再使用 legacy /membership 接口或缓存。商品列表由服务端 products 下发，支持 subscription 和 non_consumable；实际价格、订阅周期和试用资格从 StoreKit 获取。后端未开启 IAP 或未配置商品时展示错误并阻止购买，不使用写死的商品兜底。

购买时先获取当前账号 appAccountToken。原生桥接按交易 ID 从 StoreKit 2 VerificationResult 读取 jwsRepresentation，作为 signedTransaction 验单；仅验单成功后 finishTransaction，再重新查询完整 VIP 状态。恢复购买使用同一链路，不结束其他账号或非白名单商品的交易。验单响应不是完整 status，不能用它覆盖商品与账号 token。

本次增加了原生 Swift/UTS 桥接，须重新制作自定义基座并重新运行 iOS，热更新无效。Apple 沙盒购买/退款/续订仍需启用后端 APPLE_IAP_ENABLED、配置真实商品、证书及环境后真机验收。不要将客户端 jsonRepresentation 当作签名 JWS。

用户协议第八节点名的两条路径已在客户端对齐：设置页「订阅管理」进会员页（会员状态、方案、恢复购买；关闭自动续费仍需到 App Store 的订阅管理中操作，会员页会写明），账号页「注销账号」调 `POST /me/delete`（家长验证 + 二次确认，提交后 7 天删除且不可撤销）。三份协议正文与第三方信息共享清单在设置页「法律与合规」用 `<web-view>` 打开线上页面，不在包内维护副本。
