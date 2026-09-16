# 专注星伴 MVP

面向 3–16 岁儿童与学生的跨平台专注力训练应用原型。工程采用 uni-app x，目标平台为 iOS、Android 与 HarmonyOS NEXT。

## 当前 MVP

找茬乐园已接入首批34组故事图（68张WebP，统一质量30，约2.21 MiB），具备239处局部候选、按档位本地轮换、2—5处随机差异及加载失败重试。后续图片自动生成已暂停。规则与维护见 [找茬运行接入说明](docs/SPOT_DIFFERENCE_RUNTIME.md)。

- 出生年月、性别、昵称、三款宠物头像档案与四档年龄模式
- 今日训练首页
- 三 Tab 一级结构：星训练、星陪伴、星小屋，并配套蓝兔、黄猫与角色小屋卡通图标
- 可用的“星陪伴”闭环：模式与时长选择、倒计时、暂停、休息、自检提醒、本机记录，以及 Android/iOS 可选端侧观察
- 每日三段式训练计划（热身、主训练、轻松结束），按当天完成记录自动续练
- 五维专注力训练目录
- 20 个可玩训练，完整覆盖规划目录；网格型与运动型游戏复用基础引擎并保留独立规则
- 方位听觉、声音过滤和双线索训练，以及跨平台本地提示音素材
- 训练结果与本地历史记录
- 五维成长报告骨架
- 20 个训练游戏的可扩展配置
- 可编辑儿童档案、真实连续训练天数与本周统计
- 完整训练历史与本机数据清理
- AI 游戏素材的候选、审核与发布结构
- 森林寻宝、网格异同/记忆搜索、分类车站已统一使用审核通过的卡通对象素材

## 运行方式

1. 工程已开启 uni-app x 蒸汽模式和样式隔离 2.0；iOS Vapor 本地打包固定使用 HBuilderX `5.25.2026082902-alpha` 与原生 SDK 5.25，二者不能混用版本。
2. 选择“运行”并运行到浏览器、Android、iOS 或鸿蒙设备。
3. 鸿蒙构建需要按照 DCloud 的 uni-app x 鸿蒙开发指南配置 DevEco Studio 与证书。

首次打开会先创建本地儿童档案；登录成功后自动创建或更新服务端档案。年龄由出生年月动态计算。训练结果与陪伴记录会通过 `uni.setStorageSync` 保存在本机。陪伴默认不启用相机；家长主动开启“端侧观察”后，只在内存中抽样分析相机帧，不录像、不保存或上传图像，也不做人脸身份识别。

## 本地服务联调

- API 地址集中配置在 `utils/api-client.uts`，当前真机联调地址为 `http://192.168.3.71:8002/api/v1`。
- 业务接口统一使用 POST + `application/json`，无参数时发送 `{}`；档案、计划及陪伴 ID 和报告筛选条件均放入 JSON 请求体，不再拼接路径或查询参数。
- `utils/api-client.uts` 统一处理设备标识、Bearer Token、401 自动刷新、服务端响应与错误；`utils/server-api.uts` 按登录、儿童档案、训练计划、成绩、报告和陪伴数据提供业务接口。
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
  settings/     档案与本地数据管理
static/         仅包含会进入安装包的运行资源
utils/          年龄、游戏目录与本地存储
docs/           产品结构与后续路线
content/        AI 素材任务、提示词、源图与审核状态
static/images/  已审核运行时素材（图片优先使用 WebP）
backend/        AI 素材任务与审核服务
```

详细的未完成事项见 [docs/ROADMAP.md](docs/ROADMAP.md)。登录后的每日 5 项训练、最佳成绩、多维报告与资源包异步补全接口讨论稿见 [docs/SERVER_API_DESIGN.md](docs/SERVER_API_DESIGN.md)。

Android/iOS 端侧观察的信号定义、阈值、隐私边界与真机测试方法见 [docs/ON_DEVICE_OBSERVATION.md](docs/ON_DEVICE_OBSERVATION.md)。

iOS 已提供可直接打开的 Xcode 原生宿主。日常修改后执行 `ios/scripts/prepare-xcode.sh` 即可完成 5.25 资源导出、同步、插件按需重编与校验；Xcode 构建阶段也会阻止陈旧资源继续打包，详见 [ios/README.md](ios/README.md)。

完整产品定位、功能结构、视觉语言、当前完成度与上线重点见 [docs/PRODUCT_OVERVIEW.md](docs/PRODUCT_OVERVIEW.md)。App Icon 与核心角色素材见 [content/brand/](content/brand/)。

## 包体积维护

- `static/` 会被整体复制进 App，只允许放置运行时实际需要的资源；生成源图、预览图和草稿统一放在 `content/ai-assets/archive/`。
- 运行图片使用 WebP，TabBar 图标保留 PNG。新增或重新生成 PNG 素材后执行 `tools/optimize-runtime-assets.sh`。
- 提交前执行 `node tools/check-runtime-assets.mjs`，确认静态路径和影子配对动态素材完整。
- 2026-09-09 首轮优化将 `static/` 从约 70MB 降至约 6.3MB；源图完整保留，但不进入安装包。
- iOS 使用 `ios/scripts/build-extapi.sh` 从 5.25 Vapor SDK 源码构建按需扩展框架；不要重新接入官方全量示例框架。
- Android 正式构建固定为 `arm64-v8a` 并保持 SO 压缩；不要用“运行到设备”生成的调试基座评估商店包体积。
- 2026-09-10 已完成蒸汽模式迁移：iOS 已升级到 HBuilderX/原生 SDK 5.25，并使用 UIScene 生命周期启动 Vapor 宿主。
