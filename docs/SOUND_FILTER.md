# 声音过滤器（听类型、点气泡流）

2026-09-18 重做。选择注意训练（`selective`），入口 `/pages/game/sound-filter`。
逻辑 `utils/sound-filter.uts`，播报清单 `utils/sound-filter-voice.uts`，页面 `pages/game/sound-filter.uvue`，
回归 `tools/test-sound-filter.cjs`，预览 `tools/preview-sound-filter.cjs`，语音生成 `tools/build-sound-filter-voice.cjs`。

## 玩法

- 气泡**排成一列列，从场地底部连续向上浮动**（速度固定 52px/s，全档一致）。
- **列数 = 难度**（1—5 列）；每轮要看的气泡流长度是 **10—15 排**。
- 每次播报一个**类型**，在这一轮里把属于这一类的气泡一路点掉。
- 每排**恰好 1 个**正确答案，其余是别的类型的干扰；**1 列时逐排交替**（否则单列每排都是答案，闭着眼点就行）。
- 一局 4 轮（1—5 档）或 3 轮（6—10 档），保持整局约 1—1.5 分钟；相邻两轮类型不重复，
  判定始终以**最新一次播报**为准。
- 进页面先跑一段**可点试玩**（单列 3 排、不扣分、只一轮），看懂「听类型 → 点同类 → 打勾打叉」后再点「开始」。

## 难度表

| 档 | 列数 | 每轮排数 | 一局轮数 | 单轮时长（约） |
| --- | --- | --- | --- | --- |
| 1–2 | 1 | 10 | 4 | 22s |
| 3–4 | 2 | 11 | 4 | 24s |
| 5–6 | 3 | 12 | 4 / 3 | 25s |
| 7–8 | 4 | 13 | 3 | 27s |
| 9–10 | 5 | 14–15 | 3 | 29s |

- 上升速度、排间距与点错扣分**全档一致**；难度只由列数（同时要看几条）与那一轮的排数（要看多久）组成。
- 气泡尺寸与排间距按列宽自适应（1 列最大 64px，5 列自动缩到约 57px），保证不重叠、不超出场地。
- 全部10档及试玩只使用彩色图案，目标和干扰项都不混入影子。已删除旧影子配额、路径及渲染分支，难度仅通过列数／排数等现有参数控制。

## 判定与计分

| 情形 | 表现 | 计分 |
| --- | --- | --- |
| 点到本轮类型的图 | 图上盖绿色 ✓ | 每个正确答案记 100/本轮目标数 |
| 点到别的类型 | 图上盖红色 ✕ | 每个扣 20（低难度同样扣分） |
| 目标气泡飘出屏幕没点 | 计数「漏掉」 | 不扣分，但那一份分拿不到 |
| 再点一次同一个气泡 | 无反应 | 不重复计分、不重复扣分 |

- 单轮分 = `round(100 × 本轮点对 / 本轮目标数) − 点错 × 20`，夹在 0—100。
- 一局分 = 各轮等权平均（`averageRoundScore`，仓库 goal-v2 口径），进结算页。
- 本轮目标全部找到就立刻收尾（不让孩子继续乱点吃扣分），否则等这一轮气泡全飘完；
  两轮之间只留 0.5 秒换播报，气泡流是连续的。
- 难度升降沿用仓库统一口径（`utils/difficulty.uts`，总分 ≥100 升档）。

## 类型表（8 类，刻意互斥）

| 类型 | 素材来源（`static/images/runtime/illustrations/shadow-match/`） |
| --- | --- |
| 动物 | easy-animals、medium-farm-animals、medium-forest-animals、medium-puppies |
| 交通工具 | easy-vehicles、medium-similar-cars、high-similar-airplanes、high-similar-rockets、medium-similar-sailboats |
| 水果 | easy-fruits |
| 甜点 | easy-foods |
| 乐器 | medium-musical-instruments |
| 花 | medium-similar-flowers |
| 大树 | medium-trees |
| 玩具 | medium-toys（机器人、摇摇马、泰迪熊）、medium-playground-toys（积木、风筝、滑板车、陀螺） |

互斥是刻意设计的：玩具火箭/玩具帆船/玩具火车归「交通工具」，玩具小鸭不入「玩具」（会和「动物」打架）。
宁可少几类，也不要让孩子按常识点对了却被判错。也不做「鱼」这类和「动物」重叠的类别。

## 语音播报

- 8 类各一句「找一找，<类型>」，晓晓声线（edge-tts `zh-CN-XiaoxiaoNeural`，`--rate=-8%`，
  与结算语音同一人声），ffmpeg `loudnorm=I=-21:TP=-3:LRA=7` 转 24kHz 单声道 64k MP3。
- 页面只播 `utils/sound-filter-voice.uts` 里登记过的录音；**没登记的只显示文字**
  （播报卡上始终有「找一找，XX」文字，按钮会变成「文字播报」并禁点），玩法不受影响。
- 重新生成：`node tools/build-sound-filter-voice.cjs [--force]`，依赖 edge-tts 与 ffmpeg；
  CLI 不在默认路径时用 `EDGE_TTS_CLI=/path/to/edge-tts` 指定。

## UI 与背景

- 背景用夜空云朵 `shadow-match-sky-v1.webp`（与听音定位等听音类游戏同一家族），全屏铺底 + 白色半透明卡片。
- 气泡是白色半透明圆，内含素材图；✓/✕ 是盖在气泡上的整圆遮罩，用颜色区分对错。
- 试玩与正式训练共用同一块场地与同一套渲染，不跳页、不换布局。
- 遵守 Android 限制：只用单类选择器、不用百分比 `min-height`（回归里有静态检查）。

## 待定

- 背景是否要出专用图（例如「声波泡泡」主题）待定；现在的方案不新增素材体积。
- 点错扣分固定 20；要「低难度扣得少、高难度扣得多」改一张表即可。
- 漏掉目前只有计数、无提示音；需要的话可在 `escaped` 事件里补。
- 1 列档（1—2 档）目标逐排交替，一轮 5 个目标；如果觉得太慢可以把排数降到 8—10。

## 命令

```bash
node tools/test-sound-filter.cjs                          # 回归：类型表/出题/连续上升/判定/计分/整局/页面脚本
node tools/preview-sound-filter.cjs                       # 浏览器近似预览 http://127.0.0.1:4181/
node tools/build-sound-filter-voice.cjs                   # 补生成缺失的类型播报语音
node tools/check-runtime-assets.mjs                       # 提交前资源检查
```
