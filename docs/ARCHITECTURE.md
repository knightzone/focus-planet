# 当前技术与数据结构

> 2026-09-29 快照。接口讨论的旧版“服务端下发训练日”方案已废弃；以当前客户端代码和实际服务端契约为准。

## 运行边界

```text
登录账号 + 儿童档案
  → 会员状态
  → 客户端固定五题课程（lessonNo，五类各一题）
  → 游戏结果与本地最佳成绩
  → 持久化上传队列 → 服务端按用户/课号/游戏保留最佳成绩
  → 按课历史 / 成长报告

独立星陪伴 → 普通番茄钟 → 本机陪伴记录
```

- `utils/catalog.uts` 是 30 个游戏、五个展示分类及主归属的来源；每个游戏只计入一个主维度。
- `utils/course-plan.uts` 管理 `fixed-cycle-v1`、课号、难度、跨天续做和进入课程题目的凭证。课号从 1 开始；五题内容不从服务端下发。
- `utils/storage.uts` 将本地成绩按账号保存。相同课号、相同游戏只保留最高分；原始指标与难度跟随获胜记录。
- `utils/offline-sync.uts` 持久化上传队列，启动、回前台、恢复网络及运行中轮询补传。旧日未确认成绩阻止开启新课；无效队列项丢弃且不阻塞后续有效项。
- `utils/api-client.uts` 和 `utils/server-api.uts` 统一 POST JSON、鉴权与业务接口。训练主要使用 `/training/records/latest` 与 `/training/records/sync`；历史另查最大课号及 `/reports/daily`，成长用 `/reports/overview`。
- `utils/membership.uts` 管理会员状态；iOS StoreKit 商品和交易校验路径见 [iOS 会员接入](IOS_MEMBERSHIP.md)。服务端是会员权益的最终判定方。

## 本地数据与报告

- 儿童档案由 `focus_planet_profile` 存储；出生年月用于动态计算年龄。成绩使用按账号区分的 `focus_planet_records_<userId>`；活动课程、最近成绩缓存和上传队列也按账号区分。
- 课程成绩带 `lessonNo`、`slotNo`、`gameId`、实际难度、0–200 综合分、正确率、反应时间、耗时及可选误答/漏答等指标。`localSyncId` 仅用于本地队列追踪，不是服务端成绩字段。
- 课程生成时难度按同游戏最近成绩计算并锁定：上一成绩 ≥100 升一级；当前难度连续三次 <50 降一级；范围 1–10。[完整规则](CLIENT_LESSON_PLAN.md)
- 历史页使用 `/training/records/max-lesson` 和按课 `/reports/daily`，可查看本课成绩及上次同游戏的比较。成长页使用 `/reports/overview` 的全部、近 30 课和近 14 课数据；服务端目前只统计五题做满的课程。
- 游戏结束页仅展示 0–5 星和角色反馈，报告/历史展示分数与 0–6 星，第六颗表示过关。100 分为本档目标，不代表所有游戏都能超过 100。[计分](SCORING_V2.md) · [星级](STAR_REWARDS.md)

## 页面与平台

`pages.json` 注册三 Tab 和课程、会员、图鉴、结果、报告、历史、档案等页面。五维列表点入 `game-showcase` 只看介绍；正式训练通过首页课程项写入题目凭证后进入游戏。星陪伴页面当前只运行计时状态机；相机/坐姿插件是未开放的实验能力，不应在产品说明中称为现行功能。

工程采用 uni-app x Vapor。日常源代码位于 `pages/`、`utils/`、`components/`，运行素材位于 `static/`；原稿、候选和审核资源位于 `content/`。iOS Xcode 宿主由 5.26 工具链导出资源，修改 UTS、页面或素材后必须重新同步并运行校验。[iOS 构建说明](../ios/README.md)

## 发布前仍需验证

跨端同课一致性、真实登录账号的断网补传与报告刷新、Apple Sandbox/TestFlight 购买/恢复/续期、Android/iOS/HarmonyOS 真机表现，以及儿童隐私和适用备案，均不可由静态检查代替。
