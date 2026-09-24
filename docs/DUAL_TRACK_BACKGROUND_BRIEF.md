# 上天入海（双轨任务）· 背景图生成说明

2026-09-18。给图像生成模型用的说明文件，**沿用 `content/brand/backgrounds/REDO-PROMPTS.md` 的风格锚定与通用约束**，可直接把「主提示词」整段投喂。

游戏运行时会把整块场地**从中间横着切成两半**：上半是天空（蓝兔跃跃开火箭躲小星球），下半是大海（黄猫暖暖开潜艇躲鱼），中线由游戏自己画一条白线。
所以这张背景只负责两件事：上半给「夜空 / 高空」氛围、下半给「水下」氛围，并且**两半的中部都要留出干净、低对比的负空间**——障碍物（星球、鱼）和载具都是游戏素材叠上去的。

## 通用约束（所有提示词共用）

- 风格锚定 `focus-planet-soft-2d-v1`：柔和 3D 卡通渲染、圆润造型、粉彩低饱和、轻微体积光，与现有 `car-patrol-town-v1`、`shadow-match-sky-v1`、`firefly-night-forest-v1` 同世界。
- 竖屏 9:16，建议 1024×1792 或以上；进运行时按既有流程缩到 **宽 768px、高 1345px**（本图按整屏使用，保持 9:16 即可），cwebp 质量 84 转 WebP。
- 全幅不透明，**不要透明通道、不要棋盘格**。
- **不要任何文字、水印、logo、二维码**（尤其不要 “AI 生成” 字样）。
- **不要人物、不要动物、不要飞行器/潜水艇**：跃跃、暖暖、火箭、潜艇、星球、鱼都是游戏素材，背景画了会打架。
- **画面正中那条横向中线（高度 48%—52%）必须干净**：只有极淡的过渡，不要画地平线、浪花、云带、光斑——游戏要在那里画中线。
- 上半（0—48%）与下半（52%—100%）的**中间区域对比度要低**：障碍物会横向飞过，需要一眼看清。
- 生成后放 `content/ai-assets/archive/` 走 候选→审核→发布，再放进 `static/images/runtime/backgrounds/`，跑 `bash tools/optimize-runtime-assets.sh` 与 `node tools/check-runtime-assets.mjs`。

## 主提示词：`dual-track-sky-sea-v1`（推荐）

> 生成一张儿童双任务小游戏用的竖屏背景图，比例 9:16。柔和 3D 卡通渲染风格，圆润造型、粉彩低饱和、轻微体积光，优质儿童 App 插画质感，不要照片写实。
> 画面**从正中间水平分成上下两半**：上半是安静的夜空高空，深蓝到靛蓝的渐变，点缀稀疏、柔和的远星与两三个小小的星云团（都在靠近上边缘与左右边缘，不要压到中央）；下半是清亮的海水，蓝绿到深蓝的垂直渐变，靠近左右边缘有几束柔和的阳光光柱和水草、珊瑚剪影（同样只在边缘，不要伸进中央）。
> 上半与下半的交界处（画面高度 48%—52% 的一条横带）保持**干净、低对比、没有实体**：只有从夜空到海水的极淡渐变过渡，不要画地平线、不要画波浪、不要画水面反光带。
> 上半天与下半天的**中部区域**（左右各留约 20% 边缘装饰，中间 60%）都保持大片干净、低对比的空间，方便叠放飞行物与鱼群。
> 整体安静、柔和、友好，适合 3–8 岁儿童；不要出现人物、动物、火箭、潜水艇、星球（除远处极小的星点）、鱼、文字、水印、logo；全幅不透明，无透明通道。

## 变体 B：`dual-track-sky-sea-bright-v1`（明亮日间版，可与上一版二选一）

> 生成一张儿童双任务小游戏用的竖屏背景图，比例 9:16。柔和 3D 卡通渲染风格，圆润造型、粉彩低饱和、明亮通透。
> 画面上半是晴朗的**日间高空**：浅蓝渐变、几朵圆润的小白云都在边缘；下半是**浅海**：清透的青蓝渐变、左右边缘有柔和的沙底与水草剪影。
> 中间 48%—52% 的横带干净、低对比、无实体（游戏自己画中线）。
> 不要地平线、不要浪花、不要水面反光带、不要太阳直射光斑；不要人物、动物、飞行器、潜水艇、鱼、文字、水印；全幅不透明，无透明通道。

## 状态：已交付（2026-09-18）

- 生成结果就是主提示词这一版：`static/images/runtime/backgrounds/dual-track-sky-sea-v1.webp`（768×1260）。
- 生成图**左下角带「AI 生成」水印**：运行版裁掉底部 85px 去掉水印（上半天空 / 下半大海的氛围与干净中线都保留），
  原图（带水印）存在 `content/ai-assets/archive/dual-track-sky-sea-v1-original-watermarked.webp`。
  按仓库规则带水印应重做，重新生成无水印版本时直接覆盖同名文件即可，页面不用改。
- 页面已按下面第 2 步接入（整屏一张 `image`），`.dt-sky` / `.dt-sea` 两个占位节点已删除。

## 接入方式（生成并审核通过后）

1. 文件放到 `static/images/runtime/backgrounds/dual-track-sky-sea-v1.webp`（或变体 B 的名字）。
2. 页面 `pages/game/dual-track.uvue` 里把当前占位实现换成单张整屏图：
   - 现在：`.dt-sky`（上半，用 `star-catcher-sky-v1.webp`）+ `.dt-sea`（下半，CSS 纯色）。
   - 换成：加一个铺满 `.dt-field` 的 `image`（`mode="aspectFill"`，`left/top:0`、`width/height:100%`）指向新图，并删掉 `.dt-sky` 与 `.dt-sea` 两个节点（中线 `.dt-center-line` 保留，游戏自己画）。
3. 跑 `bash tools/optimize-runtime-assets.sh`、`node tools/check-runtime-assets.mjs`、`node tools/test-dual-track.cjs`，再 `bash ios/scripts/prepare-xcode.sh` 同步。

## 其它素材（都已存在，不需要生成）

- 小星球：`static/images/runtime/sky-planets/*.webp`（20 个，透明底）——上半的障碍物。
- 鱼：`static/images/runtime/illustrations/shadow-match/hard-sea/*.webp`（8 条，透明底）——下半的障碍物。
- 火箭：`static/images/runtime/illustrations/shadow-match/easy-vehicles/rocket.webp`；跃跃：`result-characters/yueyue-normal-v1.webp`；暖暖：`result-characters/nuannuan-normal-v1.webp`。
- 潜艇：目前是**页面用 CSS 画的**（黄色艇身 + 潜望镜 + 舷窗，暖暖坐在里面）。如果之后要换成真实素材，加一张透明底
  `dual-track/nuannuan-submarine-v1.webp`（朝右、艇身在画面中央）并把 `.dt-sub` 那三块 CSS 换成一张 `image` 即可。
