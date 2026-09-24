# 五类训练与公平切换（2026-09-20）

当前 30 个游戏，分类版本 play-v2；新增记忆连线与顺序猜猜，不改点球小将玩法。分类以 utils/catalog.uts 为唯一来源。每局只归一个主类，不重复累加。

| 展示分类 | 协议 dimensionId | 数量 | gameId |
| --- | --- | --- | --- |
| 观察发现 | selective | 6 | forest-search, color-command, symbol-detective, spot-difference, number-tap, listen-find |
| 记忆辨识 | focused | 6 | light-tracking, spot-change, memory-search, memory-link, audio-sequence, sound-location |
| 反应控制 | sustained | 6 | star-catcher, car-patrol, bird-cloud, red-green, breathing-planet, sky-watcher |
| 逻辑空间 | alternating | 6 | water-sort, pattern-find, puzzle, shape-match, sorting-station, order-guess |
| 切换兼顾 | divided | 6 | magic-rule, number-track, little-driver, dual-track, penalty-kick, sound-filter |

## 服务端需对齐

dimensionId 按上表使用，语义与游戏成员已变；不能仅替换显示名称。服务端计划、成绩和报告全部按新映射实现。客户端计划、结果页及新记录写入统一取目录归属。

项目未上线，不做旧分类兼容、不迁移旧训练记录、不要求报告增加 categoryVersion 字段。测试数据库可以清空重建，联调时旧计划、成绩、汇总及客户端对应测试缓存一起重置，避免混用旧数据；不要重置生产环境。本次未执行数据库或本地数据删除。后端需完成新映射后再联调。

## 声音过滤器

- 气泡连续上浮，到固定有效时长切换目标；可见气泡保留，屏外队列接续。已处理气泡不二次判断。
- 新目标播报期间冻结位置、出题推进、有效时长、计分与点击。播报完成后统一缓冲 0.5 秒，各难度一致。
- 缓冲结束后才使用新规则；旧目标可以成为干扰。不把播报期间的点击算对，也不扣分。
- 手势必须在当前规则开始后按下；跨规则、暂停前按下的手势作废。
- 切换时距离上沿不足 1 秒有效作答时间的气泡淡化、中立退出，既不奖励也不记遗漏。
- 切换时未解决的旧目标不追溯扣分，正常位置按新规则继续；每段以实际点对及正常漏掉的目标为机会分母，点错仍扣 20 分。无有效机会得 0 分，不白送满分。整局取各段平均。
- 音频结束回调触发缓冲；缺音频/错误使用文字等待 2 秒；播放异常无回调最长等待 8 秒后停止音频并走缓冲，避免卡住。旧音频回调不可影响新一局。
- 有效时长不含播报与缓冲。列数、排数、干扰难度保留，不以缩短说明窗口增加难度。

## 验证

tools/test-training-categories.cjs：30 个归属、31 天本地计划、统一归属写入、结果链接；无旧记录迁移、无报告版本门禁。

tools/test-sound-filter.cjs：10 档全对/不点流程、冻结、中立边缘、手势边界、旧语音回调、故障超时、真实页面脚本结算。

实机仍需关注：播报完成与手势点击在 Android/iOS 上的实际体验。
