# 小鸟穿云：云背景与扇翅动画

2026-09-13。使用内置 imagegen 编辑现有小鸟；未使用 CLI/API fallback。

- 身体原图：`body-v2.png`；翅膀原图：`wing-v2.png`，均已核验 RGBA alpha 0–255。
- 运行时：`static/images/runtime/game-characters/tap-bird-body-v2.webp`（宽 256）与 `tap-bird-wing-v2.webp`（宽 160）；WebP quality 84，alpha quality 100。仅裁剪空白及压缩，保留真实透明。
- 背景复用 `static/images/runtime/backgrounds/shadow-match-sky-v1.webp`，核心区白色 50% 不透明。
- 首次生成的伪透明棋盘格图位于 `rejected/checkerboard-bird.png`，禁止运行时引用。

## 最终提示词

### 身体

Use case: precise-object-edit. Input image is edit target. Create an animation body layer from this same right-facing yellow cartoon bird: remove ONLY the large teal near wing and complete the yellow body underneath it. Keep eye, orange beak, yellow tail, proportions, friendly 3D style unchanged. Output isolated full bird BODY without near wing on actual transparent alpha background, not a rendered checkerboard. Tight centered square composition. No background, shadow, border or text.

### 翅膀

Use case: precise-object-edit. Input image is edit target. Extract ONLY its teal feathered near wing as a separate game animation layer. Remove all yellow bird body, eye, beak, tail and background. Keep the wing shape: rounded attachment at lower right, feather tips extending upper left; glossy teal cartoon style identical to reference. One isolated wing tightly centered in square, actual transparent alpha background, not a rendered checkerboard. No text, no other objects.

## 行为与验证

身体随升降平缓倾斜，翅膀独立旋转/收拢；点击触发 320ms 下拍回收，平时轻扇。共用固定步长活动时钟，暂停/后台不继续动画，不新增定时器，不用缩放整体图片伪装扇翅。点击力度与碰撞判定不受视觉动画影响。

1–10 级云门宽度 210→120（390 高逻辑坐标）、速度 0.8→1.6（每32ms移动的屏宽百分比）、云门中心最大偏移 30→102；一局内不再自动加速。可直接开始，也可先试玩一扇云门。真实设备手感仍需复核。

回归命令：`node tools/test-bird-cloud.cjs`、`node tools/test-action-surface.cjs`、`node tools/check-runtime-assets.mjs`。浏览器近似预览：`PREVIEW_GAME=bird-cloud node tools/preview-car-patrol.cjs`，不替代原生真机检查。

