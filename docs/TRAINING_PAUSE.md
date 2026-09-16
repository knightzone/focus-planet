# 通用训练暂停

2026-09-13，覆盖 `pages/game` 下全部 24 个可玩页面（共享页面的多种游戏模式一并覆盖）；音效来源说明页不属于训练。

同日补充：暂停已移入右上角导航栏，未开始/试玩阶段直接返回。该版本 Android/iOS 5.25 已重新编译导出，Xcode 最新资源同步校验通过；导航位置及两种返回行为已完成浏览器近似检查与自动回归。

## 用户行为

- 所有游戏使用同一行自定义导航栏：左侧返回、居中游戏名、右侧 `Ⅱ 暂停`，不再额外占一行。状态栏高度单独适配；24 页关闭重复原生导航栏，共用主题星球暂停卡片。
- **继续训练**：保留本题、分数、剩余展示时间和播放进度。
- **重新训练**：关闭旧页面并以相同路径及完整参数重新进入；清空本局分数，读取当前难度，回到该游戏初始状态。有开始/试玩入口的游戏重新显示入口，不强制试玩。
- **退出训练**：返回上一页；独立进入时回星训练首页。不进入结果页，不提交未完成成绩。
- 准备页及可选试玩尚未进入正式训练，左上角/系统返回键直接返回；正式开始后返回键先打开暂停面板。无开始按钮、进入即训练的游戏保留暂停拦截。切后台自动暂停，回来后必须主动继续。面板不透出题目，防止暂停期间继续观察记忆题。
- 重复点击导航按钮有防重；导航失败保留暂停状态，可继续或重试。

## 接入约定

- `components/TrainingFrame.uvue`：统一入口、遮罩及三项操作，游戏放在默认插槽中。
- `utils/training-session.uts`：每页创建一次 `useTrainingSession()`；处理生命周期、返回键及路由。通过 `setStartedCheck` 注册实际开始状态；自定义返回入口调用 `back()`，与系统返回保持同一规则。
- `utils/training-clock.uts`：页面必须通过独立 `training.clock` 使用 `setTimeout/setInterval/clearTimeout/clearInterval/now`。禁止游戏再次直接使用原生计时器或 `Date.now()` 计算反应/训练时长。
- 暂停清掉原生定时器但保留剩余延迟；恢复重新排队，interval 不补发积压帧；卸载统一取消，包含没有单独保存 ID 的延迟任务。
- 音频通过 `clock.createAudio()` 创建，原有页面销毁逻辑改用 `clock.destroyAudio()`。只恢复暂停前正在播放或暂停中刚开始加载成功的音频。
- 输入处理函数检查 `trainingPaused`，防止原生触摸结束事件在暂停后提交答案；点球蓄力在暂停时取消，恢复后重新按住操作。
- 呼吸缩放、足球/守门员关键过渡使用 `utils/training-tween.uts`，与计时时钟一致，避免 CSS transition 在暂停中继续跑完。其他 JS 动画由统一时钟自然冻结。
- 新游戏必须套用此框架，并加入覆盖检查。不要另外创建暂停弹窗、独立后台恢复逻辑或延迟结算计时器。

## 验证

已通过：

- `node tools/test-training-pause.cjs`：24 页接入覆盖、剩余延迟、重复暂停、活动时长、取消/卸载、音频/插值冻结、返回拦截、重开参数保留和导航失败。
- `node tools/test-bird-cloud.cjs`、`node tools/test-car-patrol.cjs`、`node tools/test-sky-watcher.cjs`、`node tools/test-sound-source.cjs`：原游戏难度和计分、暂停恢复、声音回调回归。
- `node tools/test-action-surface.cjs`、`node tools/test-local-login.cjs`、`node tools/check-runtime-assets.mjs`。
- 浏览器近似布局与继续/重开交互检查。Android/iOS HBuilderX 5.25 Vapor 编译导出通过，Xcode 资源已同步且新鲜度校验通过。

仍需真机验收：iOS/Android 返回键/侧滑及切后台；记忆展示中暂停；播放声音一半暂停；射门蓄力和飞行中暂停；呼吸缩放中暂停；重新训练后成绩归零、退出不新增报告。浏览器检查不替代真机触摸/音频验证。

平台依据：[UniPage 路由与 options](https://doc.dcloud.net.cn/uni-app-x/api/unipage.html)、[页面返回生命周期](https://doc.dcloud.net.cn/uni-app-x/page.html)。
