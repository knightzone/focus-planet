# 专注星球 MVP

面向 3–16 岁儿童与学生的跨平台专注力训练应用原型。工程采用 uni-app x，目标平台为 iOS、Android 与 HarmonyOS NEXT。

## 当前 MVP

- 年龄档案与四档年龄模式
- 今日训练首页
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

1. 使用最新版 HBuilderX 打开本目录。
2. 选择“运行”并运行到浏览器、Android、iOS 或鸿蒙设备。
3. 鸿蒙构建需要按照 DCloud 的 uni-app x 鸿蒙开发指南配置 DevEco Studio 与证书。

首次打开会要求创建儿童档案。完成“星星捕手”后，结果会通过 `uni.setStorageSync` 保存在本机。

## 目录

```text
index.html      Web/Vue 3 入口
pages/
  profile/      年龄档案
  index/        今日训练首页
  dimensions/   五维训练目录
  game/         MVP 训练游戏
  result/       单次训练结果
  report/       五维成长报告
  history/      完整训练历史
  settings/     档案与本地数据管理
static/         静态资源占位目录
utils/          年龄、游戏目录与本地存储
docs/           产品结构与后续路线
content/        AI 素材任务、提示词与审核状态
static/images/  草稿与已审核运行时素材
backend/        AI 素材任务与审核服务
```

详细的未完成事项见 [docs/ROADMAP.md](docs/ROADMAP.md)。
