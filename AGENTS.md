# 专注星伴（uni-app x）工程约定

## 工程位置

- 本目录 `outputs/focus-planet-mvp` 是**可运行工程与 git 仓库，只在这里改代码**。
- 上一级 `../../`（`wo/`）是早期 MVP 快照（无 `static/`、`components/`、`.git`），除明确要求外不要改动，也不要把它当工程根。
- 技术栈：uni-app x（蒸汽模式 + 样式隔离 2.0）/ Vue 3 组合式 API / UTS；目标端 iOS、Android、HarmonyOS NEXT。
- 产品面向 3–16 岁儿童，文案与视觉保持儿童友好、正向、无压力；不输出医学或智力结论。

## 本机工具链（已配好）

- HBuilderX **5.26.2026091802**（正式版）：`/Applications/HBuilderX.app`。iOS Vapor 不再使用 alpha，且 HBuilderX 与 iOS 原生 SDK 版本必须同为 5.26，不能混用。
- Node v24 / npm 11；Python 3.13，Pillow 装在 `~/Library/Python/3.13`（Homebrew Python 有 PEP 668 保护，装包用 `pip3 install --user --break-system-packages <pkg>`）。
- 可用：`rg` `jq` `ffmpeg` `cwebp` `xcodebuild` `plutil` `swiftc` `pod`。`carthage`/`xcodegen` 未安装，但脚本不需要。
- **根目录没有 package.json**，不要在本工程跑 `npm install`。

## pi / AI 工具配置

- 本工程约定即本文件；资源流水线与回归/iOS 流程的按需说明在 `.pi/skills/focus-planet-pipeline/`（已加入用户级 `settings.json` 的 `skills`，任意目录启动 pi 都可用）。
- `.pi-lens.json` 关掉了 pi-lens 的 `format` 与 `autofix`：本仓库无格式化配置且 `.uvue`/`.uts` 非标准 JS/TS，避免插件自动改写文件。诊断与 LSP 仍启用；需要格式化时手动执行并自行核对 diff。

## 常用命令

```bash
node tools/check-runtime-assets.mjs    # 提交前必跑：静态资源引用 + 影子配对素材完整性
node tests/*.cjs                       # 账号 / App 更新 / 离线同步回归
node tools/test-*.cjs                  # 各游戏、计分、暂停、音频生命周期回归
bash ios/scripts/verify.sh             # iOS 打包输入校验（SDK、插件、资源新鲜度）
bash ios/scripts/prepare-xcode.sh      # 改过 .uvue/.uts/static 后同步资源到 Xcode
bash tools/optimize-runtime-assets.sh  # 图片转 WebP、音频转 MP3、源图归档（需 cwebp、ffmpeg）
cd backend/asset-service && npm start  # 素材审核服务，127.0.0.1:4310，零第三方依赖
```

- 已知失败：`node tools/test-action-surface.cjs` 断言 `ActionSurface >= 14`，当前实际 12（工作区在研改动所致）。这是**代码状态问题，不是环境问题**，不要为了让它变绿去改断言。

## 代码约定

- 页面 `pages/**/*.uvue`，逻辑 `utils/**/*.uts`，共享组件 `components/*.uvue`。
- Android 编译限制：页面内**只用单类选择器**，禁止层级/后代选择器；不要用百分比 `min-height`；路由参数避免 `字符串 || 数字` 这类混合类型兜底。
- 本地存储统一 `uni.setStorageSync`，键名 `focus_planet_*`。
- 服务端调用只经 `utils/api-client.uts`（`API_BASE_URL`，当前为局域网联调地址）+ `utils/server-api.uts`；一律 POST + `application/json`，无参数时发 `{}`，不拼路径或查询参数。
- 原生 UTS 插件：`uni_modules/focus-face-detector`（端侧人脸/姿态）、`uni_modules/focus-gradient`。**改动原生代码后必须重新制作/运行自定义基座，热更新无效。**
- 新增游戏：在 `utils/catalog.uts` 加元数据 → 在 `pages/game/` 加页面或复用通用引擎 → 结束统一写入 `TrainingRecord`；报告只按 `dimensionId` 聚合，不感知具体游戏。
- 每个游戏只有一个主维度（可带次维度），成长分只计入主维度，避免同一局重复计算。
- 只保存原始指标与演示分数；不要包装成医学、智力或诊断结论。

## 资源与包体积

- `static/` 会被**整体复制进安装包**（当前约 15MB），只放运行时真正需要的资源：图片用 WebP、TabBar 图标保留 PNG、提示音用 MP3。
- 生成源图、预览图、草稿放 `content/ai-assets/archive/`；提示词与素材说明放 `content/brand/`。未经审核的素材不要进 `static/`。
- 素材状态走 `content/` 的候选 → 审核 → 发布结构；新增或重新生成 PNG 后执行 `tools/optimize-runtime-assets.sh`，提交前跑 `node tools/check-runtime-assets.mjs`。
- 不要用官方全量 `DCloudUTSExtAPI.framework`，iOS 侧统一由 `ios/scripts/build-extapi.sh` 按需编译。

## 禁止手改 / 禁止提交

`unpackage/`、`ios/SDK`、`ios/CustomFrameworks`、`ios/TemporarySampleFramework`、`ios/Plugins/*.framework`、`ios/.derived/`、`ios/FocusPlanet/FocusPlanet/uni-app-x/apps/*`、`build/ios/`、`*.ipa`、`*.xcarchive`。这些由脚本或 HBuilderX 生成，`.gitignore` 已覆盖。

## Git 约定

- 当前工作区有约 1800 项未提交改动，属于**正常在研状态**：不要 `git checkout` / `reset` / `stash` / `clean` 去“清理”它们，也不要未经确认就 commit 或 push。
- 提交信息用中文，风格参照 `feat: 完善专注星伴品牌、训练体系与核心游戏体验`。
- 改完先跑上面的检查命令（至少 `check-runtime-assets.mjs` + 受影响的 `tools/test-*.cjs`），并在回复里给出实际结果。

## 文档索引

`README.md`（当前能力与目录）· `docs/PRODUCT_OVERVIEW.md`（产品全貌与上线重点）· `docs/ARCHITECTURE.md`（领域结构）· `docs/ROADMAP.md`（进度流水与决策记录）· `docs/SERVER_API_DESIGN.md`（服务端接口讨论稿）· `docs/ON_DEVICE_OBSERVATION.md`（端侧观察隐私边界）· `docs/TRAINING_PAUSE.md`、`docs/SCORING_V2.md`、`docs/STAR_REWARDS.md`（训练框架规则）· `ios/README.md`（iOS 打包流程）。
