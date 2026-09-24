---
name: focus-planet-pipeline
description: 专注星伴（uni-app x）工程的资源流水线、回归测试与 iOS 打包同步流程。在需要新增/替换图片或音频素材、生成影子配对与找茬题库、跑训练游戏回归、做提交前校验，或把改动同步到 iOS Xcode 宿主时使用。
---

# 专注星伴资源流水线与验证流程

工程根：本仓库根目录（`outputs/focus-planet-mvp`）。所有命令默认在工程根执行。先读根目录 `AGENTS.md` 的工具链与禁止事项。

## 1. 改动后的验证顺序

```bash
node tools/check-runtime-assets.mjs    # 必须通过：静态引用 + 影子配对动态素材完整
node tests/*.cjs                       # 账号 / App 更新 / 离线同步
node tools/test-*.cjs                  # 按改动面挑相关的跑，全跑也可
```

受改动影响时对应的专项回归：

| 改动面 | 测试 |
| --- | --- |
| 计分、过关、星级 | `test-game-scoring.cjs` `test-star-rating.cjs` |
| 暂停、退出、后台恢复 | `test-training-pause.cjs` `test-timed-games.cjs` |
| 影子配对 / 找茬 | `test-spot-difference-*.cjs` `test-spot-change*.cjs` |
| 听音节奏 | `test-audio-match.cjs` `test-audio-match-assets.cjs` |
| 语音、反馈音 | `test-training-feedback.cjs` `test-result-expressions.cjs` `test-sound-source.cjs` |
| 听声捉图形（原听声找图） | `test-listen-find.cjs` |
| 小鸟穿云 / 小车 / 天空 / 呼吸 | `test-bird-cloud.cjs` `test-car-patrol.cjs` `test-sky-watcher.cjs` `test-breathing-planet.cjs` |
| 故事图运行时 | `test-story-runtime.cjs` |
| 通用按钮组件 | `test-action-surface.cjs`（**当前已知失败**：断言 ≥14，实际 12，属在研改动，不要改断言） |

`tools/preview-*.cjs` 是浏览器近似视觉预览脚本，会临时调用 HBuilderX 内置 TypeScript/Vue：

- `TYPESCRIPT_PATH`（默认 `/Applications/HBuilderX.app/.../unicloud/node_modules/typescript/lib/typescript.js`）
- `VUE_BROWSER_PATH`（默认同上 `uniapp-cli-vite/node_modules/vue/dist/vue.global.js`）

HBuilderX 装在别处时用这两个环境变量覆盖。

## 2. 图片素材

规则：运行时图只能是 WebP（TabBar 图标例外，保留 PNG）；生成源图/预览/草稿放 `content/ai-assets/archive/`，不进 `static/`。

```bash
# 新增或重生成 PNG 后：转 WebP + 把源图移到归档目录
bash tools/optimize-runtime-assets.sh

# 影子配对分类素材（生成脚本直接写 static/images/runtime/shadow-match）
node tools/generate_shadow_match_category_assets.mjs
node tools/generate_shape_match_assets.mjs

# 从生成大图切分/清洗影子配对题图（需 Pillow）
python3 tools/process_generated_shadow_match.py

# 萤火虫、点球素材处理（均 import process_generated_shadow_match 的 normalize）
python3 tools/process_firefly_asset.py
python3 tools/process_penalty_kick_assets.py
```

- 素材状态流转：`content/ai-assets/`（任务、提示词、源图、审核状态）→ 通过后才进 `static/images/runtime/`。被拒绝的素材放 `content/ai-assets/rejected/`，不进入运行时引用。
- 运行时取图统一走 `utils/game-assets.uts`，不要在页面里硬编码路径。
- 影子配对/找茬题库细节见 `docs/SPOT_DIFFERENCE_RUNTIME.md`、`docs/SPOT_CHANGE_ASSETS.md`、`docs/SPOT_DIFFERENCE_STORY_AND_150_V2.md`。

## 3. 音频素材

```bash
node tools/build-audio-match.cjs          # 216 段合成乐器音（6 音色 × 6 音高 × 6 节奏），已存在则跳过
node tools/build-training-feedback.cjs    # correct / wrong / missed 三类反馈音
node tools/build-story-runtime.cjs        # 故事图运行时素材
node tools/build-character-dialogues.cjs  # 跃跃/暖暖、三档分数、每档两句结算语音
node tools/build-xiaoxiao-finish.cjs      # 晓晓声线试听版
python3 tools/install-sound-source.py     # 把审核通过的音效装到 static/audio/sound-source（需 ffmpeg）
```

TTS 脚本依赖 edge-tts，默认读 `EDGE_TTS_CLI`。当前只有临时 venv `/private/tmp/focus-natural-voice-env/bin/edge-tts`（重启即失效），需要时重建：

```bash
python3 -m venv /private/tmp/focus-natural-voice-env
/private/tmp/focus-natural-voice-env/bin/pip install edge-tts
EDGE_TTS_CLI=/private/tmp/focus-natural-voice-env/bin/edge-tts node tools/build-character-dialogues.cjs
```

音频规则：题目音优先于反馈音；暂停、后台、退出不补播；提示音跨平台只用普通音频资源，不依赖 iOS 专属 API。参考 `docs/TRAINING_AUDIO.md`、`docs/RESULT_CHARACTER_VOICES.md`、`docs/SOUND_ASSET_CREDITS.md`。

## 4. 故事图（找茬）题库生成

`tools/generate-story-pair.cjs` 从 `content/brand/spot-difference-story-v2/chapter-XX/SD2-0NN-PROMPTS.md` 读提示词生成 A/B 图，**默认不绑定任何 provider**，需显式给环境变量，禁止在代码里写死 key：

```bash
STORY_IMAGE_BASE=https://api.openai.com/v1 \
STORY_IMAGE_KEY=... \
STORY_IMAGE_MODEL=gpt-image-1 \
node tools/generate-story-pair.cjs
```

审核流程：`node tools/review-story-pairs.cjs` → `runtime-regions.json` 标注局部差异 → `node tools/build-story-runtime.cjs` 只把标注区域写进运行时 B 图。

## 5. 端侧人脸插件

`uni_modules/focus-face-detector` 含 Kotlin / Swift 原生实现。改动后：

- Android/iOS 都必须**重新制作或运行自定义基座**，标准基座里原生配置不生效。
- 只返回面部数量、画面占比、中心位置、头部角度、置信度；**不写文件、不入库、不上传原始帧，不做人脸身份识别**。产品层只能表述为“稳定在屏/距离/偏转”。
- 阈值、隐私边界与真机测试方法见 `docs/ON_DEVICE_OBSERVATION.md`。

## 6. iOS 同步与打包

改动 `.uvue` / `.uts` / `pages.json` / `manifest.json` / 插件 / `static/` 之后，运行 Xcode 前必须：

```bash
bash ios/scripts/prepare-xcode.sh    # 5.26 资源导出 → 同步 → 插件按需重编 → 校验
bash ios/scripts/verify.sh           # 只做输入校验，不导出
```

- 不要直接跑 `ios/scripts/sync-resources.sh`，`prepare-xcode.sh` 才是日常入口。
- HBuilderX 装在别处用 `HBUILDERX_CLI=/实际路径/cli` 覆盖。
- Archive：`DEVELOPMENT_TEAM=十位TeamID bash ios/scripts/archive.sh`，随后在 Organizer 走 Validate/Distribute。
- Xcode 有资源新鲜度构建检查：源码比已同步资源新时会**中断构建**，这是预期行为，不是环境故障。
- 详见 `ios/README.md`。

## 7. 联调

- API 地址集中在 `utils/api-client.uts`；`127.0.0.1` 只适用于 Web 和 iOS 模拟器，Android 模拟器用 `http://10.0.2.2:<port>/api/v1`，真机用电脑局域网地址且服务端监听 `0.0.0.0`。
- 本地开发短信会把验证码返回为 `debugCode`，登录页自动填入。
- 素材审核服务：`cd backend/asset-service && npm start`（127.0.0.1:4310，无第三方依赖）。
