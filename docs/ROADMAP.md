# 专注星球：后续补充清单

### 2026-10-15 发版决策：去摄像头 + 本地续费通知

按产品确认的三条决策落地（数据导出第一版不上、客服联系方式暂不改）：

- **摄像头从这一版彻底移除**（本版本不支持）。
  - `uni_modules/focus-face-detector/utssdk/app-ios/Info.plist` 与宿主 `Info.plist` 删掉 `NSCameraUsageDescription`，同时删掉已无引用的 `NSPhotoLibraryUsageDescription` / `NSPhotoLibraryAddUsageDescription`；`scratch` 同步脚本 `sync-resources.sh` 每次同步后显式删掉这三个键（HBuilderX 导出会把宿主 plist 重置为模板并可能回填）。
  - `ios/scripts/build-extapi.sh` 不再编译 `uni-camera-*` / `uni-media-*`，也不再链接 `DCloudMediaPicker.xcframework`；宿主机不再链接 `DCloudPermissionCamera.xcframework`（从 pbxproj 删线）。插件 Android 端删掉 `<uses-permission android:name="android.permission.CAMERA" />`。
  - `verify.sh` 新增四道闸：宿主 Info.plist 不得有相机/相册键、宿主不得链接 DCloudPermissionCamera、ExtAPI 二进制不得引用 `AVCaptureDevice`/`UIImagePickerController`/`PHPhotoLibrary`。
  - 实测：ExtAPI 从 39M 降到 **34M**；app 主二进制与全部嵌入 framework 的 `nm -u` 均无相机/相册符号；iPhone 18 Pro 模拟器安装启动正常。修复了此前删除 `DCloudPermissionCamera` 后用 `codesign --deep` 手动重签导致的 SDWebImage 签名无效崩溃（改用正常签名构建）。
- **自动续费到期前 5 天改成本地通知**（轻量，不接第三方推送 SDK）。
  - 插件 `focus-face-detector` 新增 `scheduleRenewalReminder` / `cancelRenewalReminder`：iOS 用 `UNUserNotificationCenter`（新增 `RenewalReminderPresenter` 让前台也弹横幅），Android/Harmony/web 先给无操作 stub。生成桥接把 `number` 映射成 `NSNumber`，所以 Swift 签名用 `NSNumber` 再 `.doubleValue`。
  - `utils/membership.uts` 的 `saveMembership` 调用 `syncRenewalReminder`（导出 `RENEWAL_REMINDER_ID` / `RENEWAL_REMIND_DAYS`）：到期前 5 日提醒；已进入 5 天窗口则稍后立即提醒；未开通/已过期则取消。固定 id，重排时覆盖。
  - `tools/test-membership.cjs` 新增本地通知断言（提醒时间 = 到期前 5 天、窗口内提前提醒、未开通/过期取消、文案含“自动续费/订阅管理”、插件含 `import UserNotifications` 且不再声明相机权限）。全量回归 54 项通过。
  - 保留限制：本地通知只在 App 至少打开过一次后生效，换机/卸载重装会丢；协议里的远程推送提醒仍未实现，需产品确认合规口径。
- `.pi-lens.json` 新增忽略 `uni_modules/*/utssdk/app-ios/*.swift`：插件 Swift 要在 iOS SDK 下编译，SourceKit 在仓库根会报假的 “No such module 'UIKit'”（实际 `build-plugin.sh` 编译通过）；与已有“忽略 `ios/Plugins/**` 里的 Xcode 产物 Swift”同一原因。

### 2026-10-15 上线准备审计与审核账号

- 新增 [上线准备清单](RELEASE_READINESS.md)：分「本仓库已就绪 / 客户端建议处理 / 服务端必须完成 / App Store Connect 配置 / 审核账号与备注 / 出包命令」。
- 已就绪部分均为可复现验证：签名（Team `4N5RUYQ48R` + dev/dis 描述文件）、版本号三处一致（1.0.0/1000）、AppIcon-1024、竖屏锁定、隐私清单 7 类 + 3 个 Required Reason API、Apple 登录与订阅模块、账号注销入口、四份法律文档、包内无测试文案、`LOCAL_TEST_MODE=false`。
- 客户端还建议处理：客服联系方式仍是个人微信（`pages/account/account.uvue:63`）；相机权限文案与当前不触发的端侧能力需要二选一；自动续费到期提醒缺推送模块；第三方清单与 ASC 隐私标签一致性；数据导出无入口；法律外链未过家长门；`[auth-refresh]/[lesson-sync]` 调试日志可选清理。
- 服务端发布前必须：生产域名全量可用；**把审核账号 `18866668888` 加入固定验证码/审核白名单并预置儿童档案 `infoCompleted=true`**；`/vip/products` 对齐 App Store 商品；`/config` 更新接口与渠道链接；注销接口生效。
- 审核账号定为 `18866668888`（暂定）。客户端无需改代码：登录页拿到服务端审核通道返回的 `debugCode` 会自动填入验证码框，审核员只需输入手机号→获取验证码→登录；中英文审核备注模板已写进清单。

### 2026-10-15 准备上线：关闭本地测试入口

- `utils/local-test.uts` 的 `LOCAL_TEST_MODE` 由 `true` 改为 `false`。关掉的是发版前临时开的本地测试通道：
  - 五维页点游戏回到只读图鉴（`pages/dimensions/game-showcase`），不再直进训练页面（`pages/dimensions/dimensions.uvue` 的 `onGameTap`）；
  - 设置页不再渲染「测试难度（仅测试阶段）」卡片（`pages/settings/settings.uvue` 的 `testToolsVisible`）；
  - 启动时不再自动获得 `local-test` 身份，恢复真实登录与手机号验证码流程（`utils/auth.uts`）；
  - 恢复真实 API 调用、成绩离线同步与更新检查（`utils/api-client.uts` / `offline-sync.uts` / `app-update.uts`），存储键也不再带 `_local_test` 后缀（`utils/storage.uts` 等）。
- 不影响测试：`tools/test-local-login.cjs` 在内存里强制两档开关，不读文件当前值；全量回归 54 项与 `check-runtime-assets`（604 引用）仍全通过。
- 验证：HBuilderX 5.26 重新导出 46 页成功、Xcode 资源同步并校验为 current；导出产物中已搜不到「本地测试：点任意游戏直接进入 / 测试难度 / 仅测试阶段 / 当前为本地测试登录 / local-test」任何字样；`ios/scripts/archive.sh` 的 `LOCAL_TEST_MODE = false` 开闸检查通过。手机上要看到效果必须重新安装（只同步文件不会更新已安装包）。
- 遗留提醒：登录/绑定页仍会把服务端返回的 `debugCode` 自动填入验证码框（`pages/login/login.uvue` / `pages/account/account.uvue`）——这是服务端「审核固定验证码」通道，只有服务端下发时才会填；正式取消该通道时客户端会自然变为不填。

### 2026-10-15 试玩不再自动开始 + 说明语音不再和题目音频重叠

- 需求（用户反馈）：不少试玩页一进页面就直接开始试玩，导致 ① 用户本来没打算试玩；② 试玩音频和准备页的说明语音叠在一起听不清。
- **不再自动开始试玩**：`listen-find`（听声捉图形）、`sound-filter`（声音过滤器）、`memory-search`（记忆与搜索）原来在 `onLoad`/`onShow` 里直接 `startDemo()`/`setupTrial()`（会立刻发牌/播报），`motion-challenge`（萤火虫追踪）原来在 `onShow` 里自动跑一遍演示。现在四个页面都停在准备页，必须孩子自己点「先试一下 / 看一遍」才展开试玩；试玩完成后同一个按钮变成「再试一次」。准备页右上角计数从「试玩」改成「准备」，只有真正进入试玩/正式训练才显示「试玩」或轮次。
- **说明语音与题目音频不再重叠**：新增 `utils/training-intro.uts` 用模块级单例承载准备页那句说明语音，`TrainingFrame` 改为调用它（不再各自持有 `InnerAudioContext`）。`useTrainingSession()` 新增 `stopIntro()`，且在 `playFeedback()` 里也会先停说明语音；所有会开口或跑动的试玩入口（listen-find / sound-filter / memory-search / motion-challenge / audio-sequence / breathing-planet / memory-link / order-guess / bird-cloud / car-patrol / little-driver / dual-track / spot-difference）开始试玩时都调用 `training.stopIntro()`。正式训练开始由 `TrainingFrame` 监听 `preparing` 变化自动停掉，无需各页重复处理。
- **试玩/重试入口统一成原生 button**：17 个页面里用 `text` 标签套 `training-preview-secondary` 假装按钮的写法（如「再试一次」）全部换成真正的 `button` 标签（bird-cloud / car-patrol / little-driver / magic-rule / sky-watcher / number-track / shape-match / star-catcher / spot-difference / puzzle / sorting-station / forest-search / color-command / water-sort / pattern-find）。`text` 在原生端撑不出稳定的 200×42 命中区，改成原生按钮后点击区域、行高与视觉与其他试玩入口一致；`sky-watcher` 的 `.demo-replay-row` 高度从 32px 调到 42px 以容纳按钮。
- **准备页“贴边”与“按钮上下连接”（用户第二轮反馈）**：① 主/次按钮原来没有统一间距——`.training-preview-secondary` 没有 `margin-top`，导致「开始训练」和「先试一下/再试一次」在 bird-cloud / car-patrol / little-driver / spot-difference / listen-find / sound-filter 等页直接贴在一起；现在给各页 `.training-preview-secondary` 统一加 `margin-top: 12px`（各页自带的不同上间距会被覆盖成统一值，反而更一致）。② `magic-rule` / `number-track` / `pattern-find` 三页的准备卡只用了无内边距的 `.training-preview-card`（只有圆角+背景），内容与按钮直接贴到卡片左/右/下边缘（“定边”）；给 `.mr-intro` / `.nt-intro` / `.pf-intro` 补上 `padding: 18px 16px 20px`。③ `star-catcher` / `sky-watcher` 原来把「再试一次」放在固定高度 42px 的行里，按钮换成原生 button 后会被割边；去掉 `.sc-demo-replay-row` / `.demo-replay-row` 包装，让按钮直接子节点参与统一间距。④ `bird-cloud` 准备卡下内边距从 8px 补到 18px；`listen-find`/`sound-filter` 的提示与按钮列补上下间距，最后一颗按钮不再贴着页底。⑤ 主按钮保持各页原有 10—25px 上间距，没有统一加 `margin-top`（否则会连同 bird-cloud/car-patrol/little-driver 顶部的试玩跳过按钮一起下移）。用 15 个准备页的浏览器截图逐个复核（500×1000 真实视口）：按钮间距、卡片内边距、页底留白都一致。
- **回归**：`tools/test-training-preview-style.cjs` 新增五条静态断言——① 任何 `text` 标签都不得带 `training-preview-secondary`（试玩入口必须是原生 button）；② 四个自动开始过的页面不得在 `onLoad`/`onShow`/`onReady` 里调用 `startDemo`/`setupTrial`（用括号配平提取回调体判定，负向验证：把 `startDemo()` 加回 `listen-find.onLoad` 立刻报错）；③ 各试玩入口函数体必须包含 `stopIntro`；④ 每个 `.training-preview-secondary` 必须带 `margin-top: 12px`；⑤ `mr-intro`/`nt-intro`/`pf-intro` 必须带 `padding`（负向验证：去掉任一项立刻报错）。`tools/test-listen-find.cjs`、`tools/test-sound-filter.cjs`、`tools/test-memory-search.cjs` 由「进页面就试玩」改成先断言未开始时不出题、不播语音，再显式调 `startDemo()`/`setupTrial()` 继续原有整局校验；`tools/training-test-env.cjs` 与各 preview / page 测试的 `useTrainingSession` 桩补上 `stopIntro`。全量回归 54 项、`check-runtime-assets`（604 引用）通过。

### 2026-10-14 红绿指令：降速 + 停过线不再误判「下一盏灯」的绿灯超时

- 需求：降低车速；停车过线时不能按下一个红绿灯的绿灯超时判罚。
- 车速：`redGreenConfig().speedFactor` 由 **0.11 降到 0.09**（每秒走周长的 9%，约 9s → 11s 一圈）。安全区长度 = 容差 × 车速，所以减速后安全区的**时间宽度不变**，只是整圈更长、看到安全区再点「暂停」的余裕更大（也就是本次过线问题的诱因）。全档仍一致。
- 误判修复：`checkGreenTimeout` 原来“只要车停着就按前方最近那盏灯判”，但**停车过线**时前方最近的灯其实是**下一盏**，玩家还没到它跟前——按它的绿灯窗口扣分是误判（过线本身已扣 8，还会再叠 6）。现在新增 `RedGreenState.stoppedOverLine`：`redGreenPause` 判为 `overLine` 时置真，`redGreenGo` 与行驶中置假，`checkGreenTimeout` 遇真直接返回。
- 保留防拖延：停在**路中间**（stopWrong）时仍照旧按前方那盏灯判绿灯超时（原测试 `state3` 用例继续验证），所以“停在路中间白蹭等待”仍然不成立；停过线虽不判超时，但车不推进圈数，拖下去只会耗掉自己的时间。
- 顺带：过线提示改成「停过线了，要停在安全区里 · 按「启动」继续开」，把孩子下一步该做什么说清楚。
- 回归：`tools/test-red-green.cjs` 新增断言——把「下一盏」设成已过起步窗口的绿灯、再跑若干帧：**过线停车必须零 greenTimeout 且扣分只有过线 8**，启动后 `stoppedOverLine` 复位。负向验证（去掉跳过）：立刻报「停在过线处不应按下一盏灯判绿灯超时，实际 1」「停过线时只扣过线分，实际 14」，并连带把「过线 + 闯红灯 = 两次扣分」污染成 26，说明这个误判确实会串到后续判定。降速后 80 局完美玩家仍然零扣分、卡点 0 次。

### 2026-10-14 找出变化：点错可继续尝试，按点错次数额外扣分

- 需求：点错后可以继续尝试直到找对；每轮分数整体求平均；在现有计算下每次点错额外扣分——原本积分也可以超过 100，现在从「单题只有对错」升级为「错了几次后做对」，分辨更清楚。
- 改法（`pages/game/grid-challenge.uvue`，只动非侦探分支，即找出变化与遗留的 memory-search 兼容分支；记忆与搜索线上已是独立页面，不受影响）：
  - `choose()`：点错不再结算本轮，改为「标红该格 + 计一次 mistakes + 提示『再仔细观察，还能继续找』」，可以一直试到点对（同一个错格重复点不重复计次）；点对后才结算：`timedRoundScore(true, 耗时, 目标, 点错次数)`——沿用原有速度公式（越快越高、上限 200），点错次数作为 mistakes 额外扣分（÷(1+mistakes)）。
  - 新增 `cellClass(index)`：侦探模式照旧标已找对/点错；找出变化只在**本轮结束**（找到或超时）后才亮出正确格，试错过程中只标红点错的格子，**不会提前泄露答案**（原实现用 `feedback != ''` 当结束信号，在可重试流程下第一次点错就会亮出答案，必须改掉）。
  - `prepare()` 顶部统一重置 `foundIndices/wrongIndices/targetIndices`，mistakes 按轮统计（试错记录不跨轮累积）。
  - 每轮分数照旧进 `roundScores`，结果页用 `averageRoundScore` 取平均（0–200），所以「每轮整体求平均」不变；两倍目标时间没找到仍记 0。
- 回归：`tools/test-spot-change.cjs` 新增断言：点错不结算本轮、点错后仍可继续、错格标红、试错中不亮正确格、同一错格不重复计次、错 1 次在半数目标时间内得 100（200÷2）、下一轮试错记录清零（干净命中仍是 200）；原有 10 档梯度、侦探模式、超时记 0、暂停、试玩等全部继续通过。

### 2026-10-14 记忆连线：实时判定 + 绿锁红可撤 + 按错误次数计分

- 需求：每次连线实时给对错（对绿错红）、错的可以取消修正、绿色不允许取消、最终按错误次数计分。
- 改法（`pages/game/memory-link.uvue` + `utils/memory-link.uts`）：
  - 每行实时判定 `rowVerdict(row)`（0 未连 / 1 错 / 2 对），形状与连线颜色随之：对=绿 `#49b57f`、错=红 `#e06b6b`（颜色写进连线内联样式）；数字在正确连线后也标绿。
  - 交互：点图形选中 → 点数字连线；**连对立即变绿并锁定**（点它不再响应，且该数字被锁定、别的行抢不走）；**连错变红并计 1 次错误**，点红色那行（或那个红色数字）取消重连。删除了原来的「连好了」提交按钮。
  - 全部连对后自动进入 1.8 秒回顾（`completeRound(false)`）；作答超时走 `completeRound(true)`，记 0 分并计一次未通过——所以容错上限的语义现在是「连续超时」。
  - 计分改为按错误次数，用与上天入海同口径的「起始分 − 扣分」模型：`memoryLinkScore(errors)` = **max(0, 120 − 10 × errors)**。所以 0/1/2 次错误 = 120/110/100，**错两次仍到过关线（允许小错）**，3 次起低于 100，12 次起为 0；不再按回忆速度加分（零错固定 120，恰好也是环绕动画门槛）。accuracy 改为「一次就连对的比例」= 总对数 ÷（总对数 + 总错误数）。
- 回归：`tools/test-memory-link.cjs` 跟着改（`linkRow`/`wrongLink`/`linkAll` 助手、超时取代原来的“整轮连错”作为失败路径），新增断言：连错立即标红+计次、红色可取消、连对立即标绿且点不掉、连对的数字抢不走、全部连对自动完成、起始 120 与错 1/2/3/12 次 = 110/100/90/0、单轮错 1 次 = 110 分、错 3 次 = 90 分。
- 顺带：记忆阶段的剩余时间改成**进度条**（按本轮记忆总时长从满格递减到空，100ms 更新一次），不再显示数字倒数；新增 `memoryLeftPercent`，用例断言 100→约 50→排空且页面不再出现数字倒数。
- 顺带修一个**测试脆弱点**：`test-training-stats.cjs`/`test-puzzle.cjs`/`test-auth-refresh.cjs` 会把 `utils/local-test.uts` 一起加载，开关打开时存储键变 `_local_test` 后缀、取 token 返回空串，用例会随开关漂移。现在三处都把开关**钉在发布值 `false`**（`test-local-login.cjs` 本来就两值都跑），所以开着开关跑全量也全绿。
- 回归：开关 **on/off 两种状态**下 `tools/test-*.cjs`（53）+ `tests/*.cjs`（3）都全通过；`check-runtime-assets`（604 引用）通过；发布配置导出 + Release `xcodebuild` 通过且包内无测试文案；随后已切回测试配置并重新导出（`点任意游戏直接进入`/`仅测试阶段`/新记忆连线的脚本文案均已进包）。

### 2026-10-14 本地测试：五维页直进 30 个小游戏

- 需求：要逐个验收 30 个小游戏，不想每次先走登录 + 课程流。
- 做法：`pages/dimensions/dimensions.uvue` 的 `openGame()` 加一条 **LOCAL_TEST_MODE 门控**分支——测试模式下点五维列表里任意游戏直接 `getGameRoute(id)` 进游戏；正常配置仍只进只读图鉴。30 个 ready 游戏的 `getGameRoute` 全部指向已注册页面（`grid-challenge` 承载找出变化/图案侦探，`motion-challenge` 承载萤火虫追踪），且**没有任何游戏页在加载时依赖登录或课时上下文**，所以直进可玩。
- 为什么不做成无条件直进：`tools/test-training-categories.cjs` 有一条刻意的产品约束「浏览列表不得直接开始游戏」（训练只能从课程流进）。现在把该断言改成「直进分支必须正好被 LOCAL_TEST_MODE 包住」——发布包行为不变，而且比原断言多了一条「必须带开关」的检查（负向验证：去掉开关立刻报 `browse list may only start a game behind LOCAL_TEST_MODE`）。
- 新增发布闸：`ios/scripts/archive.sh` 在 verify 之后检查 `utils/local-test.uts` 必须为 `false`，否则拒绝出包（测试模式下 `mine`/`settings` 里被开关包住的测试文案会真的进包）。负向验证：开关打开时 `archive exit=1` 且不开始构建。
- 相应放宽：`verify.sh` 的「包内不得有测试文案」哨兵改为**只在发布配置下检查**（测试模式下这些文案本就在产物里，调试需要），发布闸由 `archive.sh` 守住。
- 本地测试步骤：把 `utils/local-test.uts` 的 `LOCAL_TEST_MODE` 改成 `true` → `bash ios/scripts/prepare-xcode.sh`（HBuilderX 真机运行同样可行）→ 五维页顶部会出现黄色提示条「本地测试：点任意游戏直接进入」，点任意游戏行直进游戏。测完改回 `false` 再 `prepare-xcode.sh`。注意测试模式下登录是桩、接口不连服务器，结果页会显示「本次未记录」（没有课时上下文），游戏本体可完整试玩。
- **踩到的编译器坑（重要）**：模板里的 `v-if="LOCAL_TEST_MODE"` 会被编译器**一律按 false 处理**，开关打开也不会显示。实测产物逐条对照：`mine.uvue` 的**脚本层** `if (LOCAL_TEST_MODE)` 文案在（`本地测试登录` 命中），而 `settings.uvue` **模板层**的 `仅测试阶段`/`测试难度` 与刚加的五维提示条**都不在**。
  - 后果一：我最初加的提示条在测试模式下也不会显示，看起来就像“没有入口、都不可点”（当时五维点游戏只能进只读图鉴）。
  - 后果二：顺带暴露一个既有 bug——设置页那张 `LOCAL_TEST_MODE` 卡片（测试难度锁定）**从来没有显示过**，锁难度一直是失效的。
  - 修法：两处都改成**脚本层常量**驱动模板（`const testHint = LOCAL_TEST_MODE ? '…' : ''`、`testToolsVisible/testToolsTitle/testToolsBadge`）。实测：测试模式下 `点任意游戏直接进入`/`测试难度`/`仅测试阶段` 全部进包；切回 `false` 后全部为空（字面量被折叠，发布包不留痕迹）。新增 UI 时应遵循这个写法，不要再在模板里写 `v-if="LOCAL_TEST_MODE"`。
- 回归：`tools/test-*.cjs`（53）+ `tests/*.cjs`（3）全通过；`check-runtime-assets`（604 引用）通过；发布配置下 `prepare-xcode.sh` 与 Release `xcodebuild` 通过，成包无测试文案。

### 2026-10-14 呼吸小星球：松手容差封顶，修正「早边容错过大」

- 现象：松手时机总体偏前，早边容错明显大于晚边。量化后得到证实：旧口径把**按下容差**直接当**松手容差**用（`|releasedAt − 3000| ≤ tolerance`），低档 tolerance=1500ms 时窗口是 [1500, 4500]——早边吃掉吸气的 **50%**（星球刚过半就能松手还算星环），晚边只占呼气的 37.5%；到高档早边占比升到 75%、晚边降到 19%。最小按住只要 1.2s，等于没练到完整吸气。毫秒上是对称的，但**相对各自相位严重偏前**。
- 改法（两轮修正后定稿）：`utils/breathing-planet.uts` 新增 `breathingReleaseWindow(tolerance)`，把松手容错**挂在「呼气提示音」上**：窗口 = 提示音片段（3s 起、约 600ms）前后各 `slack = (容差 − 600ms)/2`，总宽度仍等于该档容差，两边等量；理想松手点从「3 秒瞬间」改成提示音中点（3.3s），`reaction` 也跟着改成相对该中点的偏差。对照表（指令前/指令读完后）：

  | 档 | 容差 | 旧窗口 | 旧：前/后 | 新窗口 | 新：前/后 |
  | --- | --- | --- | --- | --- | --- |
  | 1 | 1500 | [1500,4500] | 1500 / 900ms | [2550,4050] | 450 / 450ms |
  | 6 | 1000 | [2000,4000] | 1000 / 400ms | [2800,3800] | 200 / 200ms |
  | 10 | 750 | [2250,3750] | 750 / 150ms | [2925,3675] | 75 / 75ms |

  按下规则不变（`[0, 容差]`，吸气指令在 0 秒，前面没有可提前的余地）。中间试探过「容差封顶 1000ms」的版本，但那只治了「早边吃进吸气」，没治「容错没挂在指令上」这个根因，已被本方案取代。
- 页面同步：时间轴的松开窗口条、`releaseOnTime` 标记色、「松得刚好/松早/松晚」阈值与文案（改成「等听到『呼气』再松手」）全部用同一个 `breathingReleaseWindow`；另外把时间轴百分比定到 4 位小数，避免 `2550/8000*100` 的浮点尾数（31.874999999999996）写进内联样式。3s/4s/1s 抽成 `BREATHING_INHALE_MS`/`BREATHING_EXHALE_MS`/`BREATHING_FEEDBACK_MS`。
- `tools/test-breathing-planet.cjs` 断言：窗口总宽度 = 容差、前后 slack 相等（L1 450/450、L10 75/75）、1 档 [2550,4050]、10 档 [2925,3675]、`(0,2000,1500)` 不再算星环（旧口径是 2）、`(0,3750,750)` 已超窗；窗口条 `left 31.875% width 18.75%`（L1）与 `left 36.5625% width 9.375%`（L10）。负向验证：把判定换回 `|releasedAt − 3000| ≤ 容差`，立刻报「比窗口再早就不算星环 2 !== 1」。
- 待产品确认：真机试玩后如果觉得「指令前 450ms（1 档）」还是宽，改 `BREATHING_RELEASE_CUE_MS`（提示音时长，当前 600ms）或把 slack 改成非均分即可；两个常量都在 `utils/breathing-planet.uts`。
- 回归：`tools/test-*.cjs`（53）+ `tests/*.cjs`（3）全通过；`check-runtime-assets`（604 引用）通过；`prepare-xcode.sh` 与 Release `xcodebuild` 通过。

### 2026-10-14 登录态总是消失：并发 401 刷新竞态

- 现象：日志显示刚冷启动/回前台就会被踢回登录页。查到客户端有一个确定的竞态：`App.uvue` 的 `onShow` 会同时触发 `/vip/status`（resumeMembership）、`/training/records/sync`（resumeOfflineSync）、首页课程等多个鉴权请求；访问令牌过期时它们**同时拿到 401**，而 `refreshAccessToken` 没有单飞锁，于是**并发发出多个 `/auth/token/refresh`**。只要服务端的刷新令牌是「用一次就换」（或带轮换），后到的请求拿着已作废的旧令牌去换，就被判 UNAUTHORIZED/INVALID_TOKEN → `clearTokens()` → 用户刚打开就被退登。这是客户端侧主因。
- 改法：`utils/api-client.uts` 的 `refreshAccessToken` 改成**单飞**：同一刻只发一个刷新请求，其余请求把 `success`/`failure` 回调排进队列，等同一个结果后各自带新令牌重试；成功时轮换后的 access/refresh 令牌照旧 `saveTokens` 落盘。
- 同时修了「半登录」问题：原 401 路径只调 `clearTokens()`（只删两个令牌），而 `focus_planet_auth_session` 被 `storage/difficulty/course-plan/training-stats/offline-sync/server-api` 等模块**直接读取**，于是会出现「界面已退出、成绩仍写进旧账号」。现在令牌与会话对象一起清（`clearAuthStorage`），并把 `AUTH_SESSION_KEY` 从 `api-client` 导出给 `auth.uts` 共用，不再两处写死。刷新失败只在服务端**明确说刷新令牌无效/过期**时才清会话；网络错误/超时/5xx 保留登录态，避免误踢。
- 新增 `tools/test-auth-refresh.cjs`（挂起队列手动回放响应，不联网）：并发 401 只能触发一次刷新且三个请求都带新令牌重试成功；刷新被拒则 `access/refresh/auth_session` 三个键全部清掉；网络失败保留登录态；没有刷新令牌时不发刷新请求。做过负向验证：去掉单飞后用例立刻报「并发 401 只能发一个刷新请求 3 !== 1」。
- 仍存疑（需确认场景）：若用户指的是**删除重装**，iOS 会清空 App 沙盒，`uni.setStorageSync` 的数据（含令牌）必然全丢，这是系统行为；要在删装后仍保持登录，需把刷新令牌写进 **Keychain**（当前没有），属于原生改动。
- 加了定位日志：`[auth-refresh] start/queued waiters=N`（确认单飞）、`ok ... rotated=true|false`（直接回答服务端刷不轮换刷新令牌）、`failed code=xxx clearedSession=true|false`。全项目自动清登录只有这一条路（其余三处是用户主动退出/注销），所以再复现时看日志就能分清是并发竞态（已修）还是服务端奥真把刷新令牌作废了。
- 回归：`tools/test-*.cjs`（53）+ `tests/*.cjs`（3）全通过；`check-runtime-assets`（604 引用）通过；`prepare-xcode.sh` 与 Release `xcodebuild` 通过。

### 2026-10-13 呼吸小星球：按/松进度条与快慢方向反馈

- 问题定位：星环（满分的一半）要求 `pressedAt <= tolerance`——按下必须在每轮吸气开始后 0.75~1.5s 内，而开局唯一的信号是那段 **1.848s** 的「慢慢吸气。」语音（`ffprobe` 实测），**提示比窗口还长**，孩子跟着语音按下去常常已经超窗，于是只有星光没有星环、整局 50 分上下。而五星门槛是 90 分、`UPGRADE_SCORE=100` 才升档，所以“做得挺对”的孩子拿 2~4 星、不升档，还可能因连续 <60 分降档。同时按在呼气段会被 `press()` 静静吞掉（这一轮直接 0 分），结束页不显示分数、上报的 accuracy 又是星环率，孩子完全感觉不到差在哪。
- 改法（**不动计分口径、不动容差、不动节奏与时长**，`breathingCycleQuality` 与总分公式一行未改）：
  - 页面底部把原来的 7 秒进度条换成 **8 秒时间轴**：蓝＝按住窗口（0~容差）、紫＝松开时间（3s±容差）、灰＝准备（7~8s）；竖线是当前进度，按/松之后把实际时刻标在轴上，准时是绿色、偏了是橙色。孩子既能看到“该在哪按、该在哪松”，也能看到自己实际按/松在哪。
  - **方向反馈**：按下偏晚 →「按晚了 X 秒，吸气一开始就要按住」；松手 →「松得刚好」/「松早了 X 秒」/「松晚了 X 秒」；结算再说明差在哪一侧（按晚 / 按太短 / 松早 / 松晚）。偏差统一报到 0.1 秒。
  - **准备段**：奖励阶段最后 0.5 秒标题变「准备，马上开始」，配灰色准备段，让“该按了”变成可预期事件；在吸气以外按下提示「这一轮要在吸气一开始按住，等下一轮吧」，不再静默。
- `tools/test-breathing-planet.cjs` 增加：按下偏晚 / 松早 / 松晚 三个方向都要有明确文案且拿不到星环；吸气管外按下有原因提示；时间轴窗口宽度随档位容差变化（L1 1500ms=18.75%、L10 750ms=9.375%、松开窗口 3s±容差）。原有 136 轮满分流程、暂停/恢复/不重复发奖、试玩等断言继续通过，证明计分与节奏没被改动。
- 回归：HBuilderX 5.26 导出与 Release `xcodebuild` 通过；`check-runtime-assets`（604 引用）、`tools/test-*.cjs`（52）+ `tests/*.cjs`（3）全通过。真机手感待验收。
- 同日继续（产品拍板）：①**星环专属奖励**——专属星光音 `static/audio/cues/star.mp3` + 金环放大收束动效（`useTrainingTween` 700ms）+ 星环计数跳动，拿到星环的音/画不再和普通星光一样。②**本轮/本局得分展示**——结算反馈附「本轮 100/50 分」，时间轴图例旁显示「本局 X 分」（`runningScore` 与总分同口径 `(星光+星环)/(轮数×2)`）。③**结束页三样都显示**——`pages/result/result.uvue` 新增 `scoreLine`：显示「本局 X 分」，上报了星环的游戏（当前呼吸）再显示「· 星光 X · 星环 X`；`tools/test-star-rating.cjs` 模板断言从「隐藏分数」改为「必须显示分数，accuracy/reaction 仍不上屏」。④**accuracy 口径修正**——accuracy 改为有效轮次占比（星光数/轮数），星环率单列 `precision` 参数上报，做对动作不再是 0–30%。
- 提示音改短（保证音色不变）：`silencedetect` 实测 edge-tts 每段都垫了 **0.19s 开头 + 0.63s 结尾**静音，「慢慢吸气。」1.85s 里真正的语音只有 1.02s。改成 `build-training-intro-voice.cjs` 在 loudnorm 前用 `silenceremove=start_threshold=-45dB:start_duration=0.02:stop_threshold=-45dB:stop_duration=0.05` 剪掉首尾空白，并把文案收短为「吸气。」/「呼气。」——**语速、音色、响度处理都不变**，只去空白。结果：吸气 **0.658s**、呼气 **0.595s**（原 1.85s），都落在最紧的 750ms 按住窗口内；起音 RMS（-29dB）与集成响度（-21.4 LUFS）与旧版一致，没有削字。同时修了脚本里写死的 `/usr/local/bin/ffmpeg`（Apple Silicon 上是 `/opt/homebrew`），改用 `tools/media-tools.cjs` 解析，并新增 `--only=a,b` 只重生成指定片段（避免为两段语音重写其余 30 段）。

### 2026-10-13 倒水小实验：孩子玩时允许混色倒水，避免卡死

- 现象：严格规则下（目标瓶顶端必须同色或为空），孩子一旦把空瓶也填满、每根非空瓶顶端颜色又互不相同，就没有任何合法倒法，这一轮做不下去。
- 改法：`utils/water-sort.uts` 的 `waterSortApply` / `waterSortPour` 增加 `allowDifferentColor` 参数（默认 `false`）。**生成关卡、求解器、最少步数与目标步数全部沿用默认严格规则，一行没改**；只有 `pages/game/water-sort.uvue` 的正式倒水传 `true`，允许把水倒在顶端不同颜色的瓶子上（会混色），仍受目标瓶容量限制。
- 为什么不会把题做死：每种颜色总水量固定、试管数 = 颜色数 + 空瓶数，所以永远有空位；宽松规则下「有空位」就等于「有合法倒法」，孩子不会再遇到无解可走。宽松是严格的超集，严格能倒的那一手结果完全一致，所以最优解法和 100 分门槛都没变；试玩仍用严格规则（两根瓶子只有一个倒法）。
- `tools/test-water-sort.cjs` 增加宽松规则用例：默认仍拒绝不同颜色；宽松允许混色且只搬顶端整段、受容量限制、空瓶/满瓶判定不变；严格能倒的宽松结果必须逐格一致（超集一致性）；并断言正式玩传的是宽松规则。原有的「关卡表 284 关最少步数与预设一致」「精确解 60/60」继续通过，证明生成与最少步数没受影响。
- 顺带：`tools/preview-water-sort.cjs` 的 `?auto=1` 自动倒水改用宽松规则，和真实玩一致。
- 回归：`tools/test-water-sort.cjs`、`check-runtime-assets`（604 引用）、`tools/test-*.cjs`（52）+ `tests/*.cjs`（3）全通过；HBuilderX 5.26 导出与 Release `xcodebuild` 通过。真机手感待验收。

### 2026-10-13 家长验证门恢复：大写数字加减题

- 之前的滑动/长按门（按住跃跃向右滑过三颗星）被产品否掉后一直 `isParentAreaUnlocked()` 直接 `return true`，等于没有门。滑动/长按是纯动作模仿，孩子看一遍就会，苹果文档也明确不认；数学题能挡低龄但挡不住 10 岁以上。现改为**大写数字加减题**：`壹 + 柒 = ？`，家长用数字键盘填阿拉伯数字，如 `8`。
- 判别力：孩子读得懂阿拉伯数字但读不出大写数字，所以低龄（3–8 岁，也是误触/误购的主要来源）过不了；家长看人民币/发票就认得。注意它仍是「能力题」：低年级数学「认识人民币」后就认得了，对 12+ 无效——要真正区分家长（防大孩子自购/注销）仍需 PIN 或设备密码，后续如需要再叠。
- `utils/parent-lock.uts`：`createParentChallenge()` 随机出「大写 ± 大写」（减法保证答案为正，答案 0~18）；通过后 5 分钟会话；连错 3 次锁 60 秒（`focus_planet_parent_fail_count` / `focus_planet_parent_lock_until`）；答错换新题，防止孩子穷举 19 个数字。`isParentAreaUnlocked()` 恢复为真实会话判断。
- `pages/parent-lock/parent-lock.uvue`：滑动门整页替换为大写题 + `type="number"` 数字键盘输入 + 确定/返回；锁定期间显示倒计时。验证通过后的动作（退出登录 / 提交注销 / 返回上级）原样保留，注销仍先过门（`tools/test-legal-pages.cjs` 继续覆盖）。
- 扣费前加门：`pages/membership/membership.uvue` 的 `purchase()` 在 `requestVirtualPayment` 前检查 `isParentAreaUnlocked()`，未解锁先进家长验证页；「恢复购买」不扣费，不挂门。
- 未挂门：法律文档（`<web-view>` 是 App 内页面，不算「离开 App」，且登录页的同意链接必须随时可读）。注销保留二次确认且已过家长门，需留意苹果 5.1.1(v)「注销要容易找到」不是障碍——若审核提出，可考虑把注销从题门上摘掉。
- 新增 `tools/test-parent-gate.cjs`：在 vm 里跑 `utils/parent-lock.uts`，断言门默认关闭且不是常量 true、出题格式/答案/减法为正、连错 3 次锁定与解锁清理、页面用数字键盘且不再有滑动门、扣费前过门而恢复购买不过门、设置/退出/注销入口都过门。做过负向验证：把 `isParentAreaUnlocked` 改回 `return true` 能拦住。
- 回归：HBuilderX 5.26 导出通过（新页面/UTS 编译无误）、Release `xcodebuild` 成功、`verify.sh` 通过；`check-runtime-assets`（604 引用）、`tools/test-*.cjs`（52）+ `tests/*.cjs`（3）全通过。

### 2026-10-13 iOS 打包脚本签名冲突修复与 App 隐私清单补齐

- `ios/scripts/archive.sh` 修复签名风格冲突：原实现只要传 `DEVELOPMENT_TEAM` 就覆盖 `CODE_SIGN_STYLE=Automatic`，与 target 里固定的手动描述文件（`专注星伴dis`）冲突，报 `UniAppX has conflicting provisioning settings ... has been manually specified`，README 的 `DEVELOPMENT_TEAM=… ios/scripts/archive.sh` 实际跑不通。现改为只覆盖 `DEVELOPMENT_TEAM`、保留工程手动签名。实测 Release 构建、Archive、`-exportArchive` 出 IPA 全部成功：产物签名 `Apple Distribution: Shanghai Flapping Information Technology Co., Ltd (4N5RUYQ48R)`、Bundle ID `com.zhuanzhuapp.mate`、嵌 `专注星伴dis`（有效至 2027-05-15，含 `applesignin` 与 `beta-reports-active`）。
- `ios/FocusPlanet/FocusPlanet/PrivacyInfo.xcprivacy` 由空 `<dict/>` 补齐：`NSPrivacyTracking=false` + 7 项 `NSPrivacyCollectedDataTypes`（手机号 / UserID / 昵称 / 其他档案数据 / 训练与陪伴交互 / 订阅交易 / 设备标识，全部 linked、仅 `AppFunctionality`）与 3 项 `NSPrivacyAccessedAPITypes`（UserDefaults `CA92.1`、SystemBootTime `35F9.1`、FileTimestamp `C617.1`）。
- 理由 API 来自对打包后 `FocusPlanet.app/Frameworks` 的 `strings`/`nm` 扫描：`DCloudUniappRuntime` 用 `standardUserDefaults` + `systemUptime`、`DCloudUTSExtAPI` 用 `creationDate` + `_stat`，这两个 framework 不带隐私清单，由 App 级清单代为声明；随包的 SDWebImage / KSCrash / DCloudUTSFoundation 自带 `PrivacyInfo.xcprivacy`，不重复声明。收集类型与 Reason 代码均按 Apple 官方文档取值，收集范围与线上《隐私政策》第二节对齐；麦克风音频（仅端侧、不上传）与尚未接入的友盟 U-APM 不计入。
- 回归：`ios/scripts/verify.sh`、`node tools/check-runtime-assets.mjs`（604 静态引用）通过；Release 构建后 `PrivacyInfo.xcprivacy` 已进包，`codesign --verify --deep --strict` 通过。
- `pages/membership/membership.uvue` 订阅界面内补《用户协议》《隐私政策》入口（复用 `utils/legal.uts` 的 `openLegalDoc`，与设置页同一份线上文案），补齐自动续订对「订阅页可见条款与隐私链接」的要求；`tools/test-membership.cjs`、`tools/test-legal-pages.cjs` 通过。
- iOS 权限文案收敛与竖屏修复：Xcode 工程里的 `INFOPLIST_KEY_NS*`（模板默认 30 条，`通讯录`/`健康`/`位置`/`HomeKit`/`Siri`/`NSUserTrackingUsageDescription` 等）与 `INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone/_iPad` 全部删除。打包产物实际引用的受保护 API 只有 **相机**（`FocusPlanet` 与 `DCloudUTSExtAPI` 都引用 `AVCaptureDevice`）和 **相册**（`DCloudUTSExtAPI` 引用 `PHAsset`/`PHPhotoLibrary`/`UIImagePickerController`），因此只保留 `NSCameraUsageDescription`/`NSPhotoLibraryUsageDescription`/`NSPhotoLibraryAddUsageDescription` 三项，去掉 `NSFaceIDUsageDescription`（未引用 `LAContext`）与 `NSLocalNetworkUsageDescription`（未用 Bonjour/NWBrowser，原文案里的「专注星伴测试服务」也就此消失）。`sync-resources.sh` 改为幂等补这三项并 `plutil -remove` 那两个键；`verify.sh` 新增哨兵：工程里再出现 `INFOPLIST_KEY_NS*`、横屏方向变体或 Info.plist 里的「测试服务/项目真机运行期间」文案就直接报错。
- 竖屏：源码 `Info.plist` 的 `UISupportedInterfaceOrientations=[Portrait]` 已生效，成包不再有 `~iphone`/`~ipad` 横屏变体（此前 `_iPhone` 含左右横屏、`_iPad` 四方向，覆盖了竖屏锁定）。
- 验证：`prepare-xcode.sh`（HBuilderX 5.26 导出 + 同步）通过；Release `xcodebuild` 成功，成包 `plutil` 只剩上述三项权限文案、`UISupportedInterfaceOrientations` 仅 Portrait、无「测试」字样，`codesign --verify --deep --strict` 通过；`node tools/check-runtime-assets.mjs`（604 引用）、`tools/test-*.cjs`（51）与 `tests/*.cjs`（3）全通过。
- 注意：Debug 真机运行若需要连局域网调试服务，`NSLocalNetworkUsageDescription` 需临时补回；发布包不需要。
- 设置页「测试难度 / 仅测试阶段」卡片改为 `v-if="LOCAL_TEST_MODE"`，发布包（`LOCAL_TEST_MODE=false`）不再出现测试文案；难度覆写代码与 `utils/difficulty.uts` 保留给本地调试。
- 上架包内容审计：重新导出并构建后扫描 `FocusPlanet.app`，只剩一处测试文案——`utils/auth.uts` 在服务端返回 `debugCode` 时显示的「本地验证码：」。现已改为：保留服务端审核通道的静默回填（不破坏审核登录），但不展示任何验证码文案；`loginWithWechat` 的「接口待接入」改为「微信登录暂未开放」。`LOCAL_TEST_MODE` 相关的「当前为本地测试登录」「测试难度/仅测试阶段」被编译器常量折叠，本来就未进包。
- `verify.sh` 新增包内文案哨兵：导出产物（`uni-app-x/apps/__UNI__B5780B0`）里出现 `本地验证码|仅测试阶段|本地测试登录|测试服务|项目真机运行期间|临时测试` 就报错并打印命中行，`archive.sh` 在 xcodebuild 前会先跑它。已做过负向验证（往导出目录放一行「本地验证码：123456」能拦住，删除后恢复通过）。
- 最终扫描（Release 成包）：`uni-app-x` 全量、主二进制与全部 framework 的 `strings`、`**/*.plist` 均无上述标记，也无「测试」二字；权限文案三条（相机/相册读/相册写）、方向仅 `Portrait`。
- 版本号统一为 **1.0.0（构建号 1000）**，三处一致：`manifest.json` 的 `versionName`/`versionCode`、Xcode 的 `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION`（Debug 与 Release 都是）、HBuilderX 导出资源 manifest 的 `version.name`/`version.code`；成包 `Info.plist` 为 `CFBundleShortVersionString=1.0.0`、`CFBundleVersion=1000`。`verify.sh` 新增一致性哨兵：三处任一不一致就报错（已做过负向验证：只改 manifest 的 `versionCode=101`、或只改 Release 的 `MARKETING_VERSION=1.0.1` 都能拦住）。客户端不做版本比较，是否提示更新完全由服务端 `POST /config` 的 `minimumVersion`/`latestVersion`/`forceUpdate`/`optionalUpdate` 决定。
- 构建号约定：`1.0.0` 的基础构建号是 **1000**，**同一个小版本重复提交只递增最后一位**（1000 → 1001 → … → 1009），`versionName`/`MARKETING_VERSION` 保持 `1.0.0` 不动；升到 `1.0.1` 时换新基段（如 1010）。这样同一版本可以多次上传而不会被 App Store Connect 以“构建号重复”拒收。改构建号需同时改 `manifest.json` 的 `versionCode` 与 pbxproj 两处 `CURRENT_PROJECT_VERSION`，然后 `prepare-xcode.sh` 重新导出。
- 待确认：若 App Store Connect 隐私标签与上述 7 项收集类型不一致，以 ASC 为准回改本文件；友盟 U-APM / 微信开放 SDK 接入当天需补 `CrashData`/`PerformanceData` 等类型并同步线上政策与 ASC。

- iPad 支持去掉：`TARGETED_DEVICE_FAMILY` 由 `"1,2"` 改为 `"1"`（Debug/Release 两处），第一期只发 iPhone，省掉 iPad 布局验收与 iPad 截图；成包 `Info.plist` 只剩 `UIDeviceFamily = [1]`，方向仍仅 Portrait。以后要上 iPad 再改回并补截图。
- 首页去掉无资格判断的试用文案：`pages/index/index.uvue:19` 非会员时由「新用户7天免费试用」改为中性的「会员可玩全部训练」。首页只有服务端商品（`VipProduct` 无 Apple 优惠资格字段），试用资格来自 StoreKit，只能在会员页判断；不要在首页承诺试用，避免 2.3.1「描述不准」。会员页仍按 `introOfferEligible` 显示「符合资格可免费试用…」。

### 2026-10-12 会员页返回键与恢复购买入口合并

- 会员页左上角返回键改为始终可用。原来 `goBack()` 在 `paying` 为真时直接不响应，而「恢复购买」最长会占住 `paying` 90 秒（看门狗），期间返回、刷新都被挡住——这就是「返回键无效、只能刷新」。现在返回带 `fail` 兜底：`navigateBack` 失败时 `reLaunch` 首页。
- 恢复购买保留页面底部的独立按钮，同时融入两个入口：① 进入会员页后静默核对本机未完成交易与 StoreKit 已购商品（`probePurchases`），命中就自动补开权益，只读本机、不弹 Apple 登录、不写阶段提示，5 分钟节流；② 支付按钮在「购买未确认」时标签变为「检查购买结果」，点击走恢复而不是再次扣费；点击支付前也会先按账号与商品核对 `/vip/status`，已开通就直接补权益、不发起扣费。同时去掉手动「刷新会员与商品」入口（进页面与回前台已自动刷新，刷新链接不再提供）。
- 静默核对复用同一套恢复流程（`restoreUnfinished` / `restoreNext` / `restoreFromStoreKit` / `completeVerification`），用 `restoreSilent` 抑制阶段提示与「购买未确认」状态，不改验单与权益授予规则。
- 回归：`tools/test-membership.cjs` 增加返回键兜底、进页面静默核对、支付按钮接管恢复、无独立恢复按钮的静态断言；`node tools/test-*.cjs` + `node tests/*.cjs` 54 项与 `check-runtime-assets` 通过，HBuilderX 5.26 iOS 导出与编译通过。真机/Sandbox 的「先购买 → 重装/换设备进页面自动补开」仍需验收。
- 待确认：Apple 审核要求非消耗型/订阅必须提供恢复入口；当前「进页面自动核对 + 支付按钮接管」已构成恢复路径，若审核希望有更显式入口，可在订阅条款区保留一行文字链接。

### 2026-10-11 iOS 会员恢复诊断

- 真机恢复购买复测通过：Apple 返回 1 笔交易，原生 StoreKit 找到同一交易的签名，服务端验单、结束交易和权益刷新均完成，最终 `/vip/status` 为 `active=true`。此问题已闭环；无需再次购买。
- 新真机日志精确停在签名查询调用前，调用后及原生入口均未执行。原因是会员页直接导入 `utssdk/app-ios/index.uts`，Vapor 将调用内联为客户端直接访问原生类；已改从 `@/uni_modules/focus-face-detector` 的公开接口调用。导出产物确认改为 UTS 插件 `fetchAppleSignedTransactionByJs` 代理，真机/模拟器 XCFramework 均重建并同步，Xcode 资源校验通过。待真机仅用“恢复购买”验证签名回调和服务端验单，勿重复付款。
- 最新真机日志：DCloud 恢复返回 0 笔，StoreKit 商品签名兜底停住；同次购买出现未监听交易更新警告，尚未见服务端验单调用。客户端增加待完成交易补查、购买阶段日志及 90 秒超时防重复付款；签名桥接调用前后与回调分别记录日志，以便下次真机精确定位。此轮不能宣称会员链路已修复，下一步按日志确认桥接/StoreKit 回调，并补齐交易更新监听。
- 恢复购买增加阶段提示、日志和 90 秒超时退出，迟到回调不再覆盖提示；不改变 Apple 验单或会员授予规则。
- 真机日志确认 App Store 已返回 1 笔交易，但旧版遍历历史读取签名超时；改为按商品读取 StoreKit 最新签名交易，并将原生桥接回调改为单个结果对象，仍由服务端验单决定权益。
- 后续真机日志又连续两次出现 DCloud 恢复接口返回 0 笔、因而跳过验单的客户端漏查路径；已补上 0 笔时逐个按服务端配置商品查询 StoreKit 签名、再调用验单的兜底，并记录验单结果码及最终 VIP 状态（不记录签名）。当前日志尚无服务端验单失败证据。
- 兜底真机复测停在 StoreKit 商品交易查询，且启动时版本检查曾网络超时；原生查询新增入口/开始/回调日志和 25 秒一次性超时，不再无限等待。仅原生 Swift 更新时，Xcode 新鲜度检查改为校验插件源与二进制，而不误报 App 资源过期。待真机日志区分桥接未进入、Apple 查询超时和服务端验单失败。
- iOS 5.26 资源导出、同步及新鲜度校验通过；真机/模拟器插件切片已重建并合成 XCFramework。待真机再走一次“恢复购买”，确认是否进入服务端验单并刷新权益。

### 2026-10-09 客户端 API 域名切换

- 统一请求基址由临时 IP 改为 `https://zhuanzhuapp.com/api/v1`；训练、会员和版本检查继续复用该基址，接口路径与 POST JSON 规则不变。旧 IP 在下文历史联调记录中保留作时间背景。

### 2026-09-29 官网三款固定试玩代码包

- `web-demo/focus-planet-demos/` 提供可独立部署的静态组件：影子配对 3 组、点球小将 3 球、听音节奏固定 3 选 1；复用运行时封面、背景、角色和音效，不接入账号、课程或报告。
- 浏览器已完成配对、三球结算、目标音固定播放两次及选项作答验证；部署仍需目标官网 HTTPS、手机浏览器与真实外放/耳机音量复核。接入方式见该目录 README。

### 2026-09-29 当前文档基线

- 以 `utils/catalog.uts` 为准，现行训练为 30 个、五类各 6 个；旧文档出现的 20/27/28 个训练仅是历史里程碑。
- 每日五题由客户端固定生成，服务端保留和返回成绩事实；普通番茄钟是当前唯一开放的星陪伴功能，相机与坐姿属于隐藏原型。
- 当前入口与边界已集中整理到 [产品总览](PRODUCT_OVERVIEW.md)、[架构](ARCHITECTURE.md)、[客户端课程](CLIENT_LESSON_PLAN.md)、[离线同步](OFFLINE_SYNC.md)。本文件下面的日期条目是过程记录，不自动代表现行功能或最新验收结果。
- 下一步仍需真实账号的跨设备成绩与报告核对、Apple Sandbox/TestFlight 会员闭环、Android/iOS 低龄玩法与音频体验、儿童隐私和上架资质核对。

### 2026-09-23 奇偶轨道切换梯度

- 难度 1～10 的规则切换间隔依次为 6、6、5、5、4、4、3、2、2、1 题；高档连续在数字单双与字母大小写间切换，同时左右轨道规则反转。
- 每次切换先展示新轨道规则 700 毫秒，期间隐藏题目、禁用作答；题目出现后才开始计反应时间，避免高频切换把读规则时间算进成绩。
- 本地玩法与静态资源检查通过；HBuilderX 5.26 iOS Vapor 45 页编译及 App 资源导出成功，已同步到 Xcode 宿主，`ios/scripts/verify.sh` 校验当前资源与 `__UNI__B5780B0` 一致。待 iOS 真机试玩确认手感。

### 2026-09-23 顺序提示与单双轨道修订

- 顺序猜猜取消低档自动公布正确位置；改为主动提示，每次自动放对并固定一张图片，固定位置不可交换。正式训练每次提示计一次尝试，并从整局综合分额外扣 60 分；试玩提示不扣分。
- 奇偶轨道低档始终使用 1～9 的数字，以两两配对点阵解释“单数／双数”；中档起出现两位数并按段加入英文字母大小写。高档的进一步规则混合待体验确认，不先叠加新概念。

### 2026-09-23 训练语音与低龄玩法

- 记忆连线每轮记忆展示时间翻倍，并延长单局上限，避免记忆阶段变长后可完成轮次骤减。
- 30 款训练补齐晓晓音色的简短开场规则语音；通用训练页进入时播报、可点喇叭重听。呼吸小星球每轮在吸气／呼气切换时分别播报，暂停和离页跟随训练音频生命周期。
- 奇偶轨道：未满 6 岁使用一个／两个圆点的左右分类；其余低档保留数字奇偶，高档在数字与英文字母大小写之间按段切换。顺序猜猜最低两档标出一个已放对位置，让孩子有明确的推理起点，较高档保持原规则。
- 本地玩法、计分、音频资源检查通过，HBuilderX 5.26 iOS Vapor 全工程 45 页编译成功。iOS 资源导出在编译成功后的 `appCheck` 阶段失败（磁盘仅余约 1.4GB，尚未证实是否为唯一原因），Xcode 资源保持旧版且新鲜度校验未通过；需释放空间后重跑 `bash ios/scripts/prepare-xcode.sh`，再做 Android/iOS 实机听感与 UI 确认。

### 2026-09-23 每日课程入口与课程号收口

- 每日计划生成时即固化课程号，首课强制从 `lessonNo=1` 开始；开始计划题目时记录课程号、题位和游戏，结算沿用该上下文。
- 首页“五维专注力”分类卡改为只展示、不可进入，正式训练统一从今日计划进入；同步扫描日志改用 `assigned/unassigned` 表示记录数量，并增加课程开始日志。
- 修复直接点击今日计划具体题目时课程项二次匹配可能失败的问题：上下计划入口统一按确定的 `gameId` 启动，并额外写入不依赖活动课程对象/账号存储键的独立课程凭证；结算即使活动课程读取异常，也能保住 `lessonNo`、题位和难度后入队同步。
- 课程、离线同步、接口与计分专项测试通过；HBuilderX 5.26 iOS Vapor 44 页导出、Xcode 资源同步与新鲜度校验通过。

### 2026-09-22 课程成绩同步修复

- 结算页在更新本地 `bestScore` 前判断本次成绩：首次成绩或严格高于同课同游戏本地最高分才进入 `/training/records/sync` 队列；同分、低分只保留本地明细。
- App 启动与回前台会扫描历史版本遗留的课程记录，每个课程/游戏仅恢复最高分到持久化队列；服务端确认后写入本地同步标记，避免反复上传。
- 修复上传过程中新增记录要等待下一次30秒轮询的问题，当前批次结束会立即继续上传剩余成绩。测试服务器已确认新接口在线，测试库修复前 `training_records` 为0；5.26 Vapor全工程编译导出及Xcode资源同步通过。
- 2026-09-23 实机日志确认客户端从未请求 `/training/records/sync`：旧本地记录缺少课程上下文。现可从当前固定课程修复当课无 `lessonNo` 的最高分记录；内部队列编号更名为 `localSyncId`，不会传给服务端。昨天或更早的待同步成绩未获服务器确认时，刷新与点击入口都禁止生成今天的新课。
- 2026-09-23 Xcode 日志进一步定位到旧字段读取在请求前触发 `undefined.submissionId`。新版课程同步链路已完全移除该读取；过期的训练标记可按当前课内唯一游戏恢复课程号，同一天完整匹配5题的旧空课号记录会恢复为上一课并补传。本地专项回归、5.26 Vapor 44页编译导出、Xcode资源同步及新鲜度校验通过，待最新包真机确认服务端入库。

### 2026-09-22 iOS 内购打通：`xingban_month_vip` / `xingban_year_vip`

- 商品 ID 定为 `xingban_month_vip`（月卡）与 `xingban_year_vip`（年卡），同在 `com.zhuanzhuapp.mate` 的一个自动续期订阅组；月卡配 7 天免费试用，年卡配新用户首期 6 折（两者都在 App Store Connect 的「引入优惠」里配，客户端不写死优惠）。
- 会员页不通的根因是服务端没开 Apple IAP：`focus-companion-backend` 原本 `APPLE_IAP_ENABLED=false`、商品 JSON 为空，`/vip/status` 返回 `503 APPLE_IAP_NOT_CONFIGURED`。已在本机 `.env` 与联调服务（`47.103.134.123:8555`）写入 `APPLE_IAP_*`（Sandbox、Bundle ID、Root CA、两个订阅）。
- 排查中发现服务器 `.env.local` 会整体覆盖 `.env`，一度下发拼错的 `month_vip` / `xinban_year_vip`，导致年卡被 StoreKit 判为不存在。已在 `.env.local` 修正为真实 ID；客户端也不再静默丢弃方案，未返回或类型不符的会显示原因与真实商品 ID。
- 验测：重启后启动日志 `apple_iap_configured: true`；`POST /api/v1/vip/status` 返回 `200` + `appAccountToken`（UUID）+ 两个订阅；`/vip/apple/verify` 对无效 JWS 返回 `422 APPLE_TRANSACTION_INVALID`；后端 `tests/test_apple_iap.py`、`tests/test_apple_verifier.py` 共 8 项通过；客户端 `tools/test-membership.cjs` 通过。待真机 Sandbox 完成购买/恢复/到期验证。
- 已开通却显示未开通的两个原因均已修：① 手工授予的交易存的是拼写错的 `xinban_year_vip`，而 `status()` 只统计配置内的商品，已把该行商品 ID 对齐为 `xingban_year_vip`；② 客户端 `cachedMembership()` 对带微秒的 `expiresAt`（`2027-09-22T08:41:42.489230Z`）解析失败会把 `active` 当成 `false`，现改为只在小数秒裁到 3 位后仍能确定过期时才降级。
- 新增主动刷新：`App.uvue onShow`（回前台）与训练列表 `onShow` 调用 `resumeMembership()`，5 分钟节流 + 并发去重 + 失败 30 秒重试；只有成功拿到 `/vip/status` 才记「已同步时间」。

### 2026-09-22 训练历史按服务端最新课程加载

- 历史页先调用 `POST /training/records/max-lesson`；有记录时默认打开最大 `lessonNo`，并提供第 1 课到最新课的横向选择与上一课/下一课切换。
- 服务端返回 `lessonNo: null` 时直接展示“还没有训练数据”和训练入口，不再请求 `/reports/daily`，也不使用本地记录推测服务端课程号。
- 定向接口测试、HBuilderX 5.26 Vapor 全工程 44 页 iOS 编译导出、Xcode 资源同步与新鲜度校验均通过；未做本轮真机 Run。

### 2026-09-22 工具链升级到 HBuilderX / iOS 原生 SDK 5.26

- iOS Vapor 改用正式版 HBuilderX `5.26.2026091802`（`/Applications/HBuilderX.app`），不再使用 5.25 alpha；`ios/scripts/*` 的 SDK 与运行时版本门禁、`Info.plist` 的 `uniRuntimeVersion`、`tools/` 与 `tests/` 内联的 TypeScript 路径、相关文档及 `focus-gradient` 引擎声明统一改为 5.26。
- 校验：本地 `ios/SDK` 与官方 5.26 安装包逐文件比对，6510/6520 个文件 CRC 一致（差异仅为脚本故意去除的 SDWebImage 签名与 `.DS_Store`）；iOS 资源已用 5.26 重新导出并与 Xcode 宿主同步，`DCloudUTSExtAPI.xcframework` 与面部检测插件均按 5.26 重建，`prepare-xcode.sh` / `verify.sh` 通过。未做本轮真机 Run/Archive。

### 2026-09-21 iOS 会员订阅首版

- 关闭本地假登录并恢复强制登录；非会员首页隐藏今日训练计划，顶部/主卡片进入会员页。
- 会员页同时展示月付与年付，进入页面及切换方案均有 Toast 提示；用户点击后调起对应 Apple 付款确认，支持 7 天试用提示和恢复购买。
- 服务端新增会员状态和 Apple 交易验单接口，使用 `appAccountToken` 绑定业务账号，验单成功后才 finish 交易。
- HBuilderX 5.25 Vapor 完整编译/导出已通过；Xcode 精简 ExtAPI 补入 StoreKit 2 模块。App Store Connect 商品、密钥与 Sandbox 真机验收待配置，见 [IOS_MEMBERSHIP.md](IOS_MEMBERSHIP.md)。

### 2026-09-21 客户端确定性课程与服务端成绩闭环

- 5题为1课，`fixed-cycle-v1` 按课次固定生成观察、记忆、反应、逻辑、兼顾各1题；同一课重复生成结果完全一致，不依赖服务端保存“是否生成过”。连续6课轮完每类6个游戏。
- 最近一次同游戏成绩>=100时下一次难度+1；当前同一难度连续3次<50才-1，跨难度或>=50立即中断低分计数。本课难度生成后锁定，调整只作用于下一课再次出现该游戏时。
- 旧课未完成继续旧课；旧课今天补完后显示“开启今日课程”；无未完成课自动生成今日课程；非今日待同步成绩会阻止开新课。课程成绩离线持久化，联网后通过轻量成绩接口补传。
- 最新服务端 `/Users/kangzhou/zk/code/focus-companion-backend` 仅启用最近100条记录与同步一次成绩两个训练接口；同一用户、课程号、训练ID只保留最高分。选课和难度均在客户端，旧 lesson/game 接口仅保留并标记 deprecated。
- 接口与部署说明见 [客户端确定性课程](CLIENT_LESSON_PLAN.md)。测试库应用迁移与双端真机联调仍待执行。

### 2026-09-21 四页试玩与倒水质感修正

- 上天入海原先onReady自动启动试玩，已改为静止准备页，提供先试一轮／直接开始；试玩中也保留开始按钮，结束可再试，正式训练清理试玩碰撞提示。准备页隐藏分数统计和进度，异步启动防重复及卸载回调保护。
- 星星捕手、星空守望员删除试玩内容层重复的半透明卡片，只保留游戏区域原50%白色底板；重试错误态也不再叠加卡片。
- 倒水小实验试玩／正式统一轻玻璃瓶身、双层瓶口、细高光、弧形液面、侧面明暗和瓶底反光。同色连续水层合并渲染，不再画单格分界；容量、颜色顺序、倒水规则、计分和布局尺寸不变，无新增素材包体。
- 杯底补充修正：试玩和正式最底层水独立20px圆角，不只依赖父层裁切；侧面明暗在弧底上方结束，实心白底条改为仅底边细弧反光，显式清零其他边框。
- 上天入海全档及页面流程、倒水全部284题、星空加载与计时、统一暂停／计分／试玩、液层容量守恒与顺序、604项资源校验通过。浏览器复核准备页、星空单层底板和试管试玩／10档小屏渲染；2026-09-21 11:15最新杯底修正已完成iOS 5.25编译导出及Xcode资源同步，双端真机触摸／玻璃透明效果待实测。

### 2026-09-21 记忆换位与新封面

- 记忆连线隐藏连线后，原彩图可见移动换位；右侧数字固定、图形节点不重建。700ms运动可暂停，800ms后才开始作答计时。
- 两张独立封面已用旧拼图／记忆搜索封面作画风及角色参考重绘v2，首版毛绒风仅归档。运行图768×432、质量84，共86268字节。源图和提示词归档于 content/ai-assets/archive/memory-logic-covers-20260921/。
- 记忆600轮、顺序1000轮、暂停、试玩及604资源引用校验通过。首次iOS资源导出失败；2026-09-21 10:47重新执行完整流水线，5.25编译、导出、Xcode同步、资源新鲜度及打包输入校验全部通过。两张v2封面与Xcode内文件逐字节一致，记忆换位改动已随最新编译同步。

### 2026-09-20 新增顺序猜猜

- 逻辑空间新增 `order-guess`，五类各6个，共30游戏／29游戏页。3—6张同组彩图猜固定隐藏顺序，开局精确正确数线索，交换后提交只反馈数量，保留历史；重复排列不扣次数。
- 3—5轮，以平均尝试次数决定过关，不考核速度。可选试玩、统一暂停、结算报告接入，复用桌面背景和规律封面，无新增图片。参数与服务端要求见 [顺序猜猜](ORDER_GUESS.md)。
- 1000轮生成与玩法测试、目录／计分／暂停／试玩／星级／606资源引用校验通过，记忆连线600轮回归通过。浏览器六图布局、交换提交、数量反馈、历史与图片加载复核通过。19:59 iOS 5.25编译、导出、Xcode资源同步与新鲜度校验通过；Android原生编译与双端真机触摸仍待测试。

### 2026-09-20 新增记忆连线

- 记忆辨识新增 `memory-link`，目录29个训练／28个页面，五类6/6/6/5/6。同组彩图与数字记忆后打乱连线，10档3—6个图形，连续失败容错及总时长递进。
- 可选3图试玩、点选／拖动连线、统一提交、公共暂停／退出、轮均0—200计分及报告接入；复用云背景和现有记忆封面，无新增图片资源。配置与后端要求见 [记忆连线](MEMORY_LINK.md)。
- 600轮生成及玩法回归、29游戏目录与计分、28页暂停与试玩、星级、605资源引用校验通过；浏览器检查3图试玩和6图布局、点击连线与彩图加载。19:48 iOS 5.25编译、导出、Xcode同步及新鲜度校验通过；Android编译与双端真机触摸体验待验证。

### 2026-09-20 声音过滤器禁止影子图

- 修正遗漏的第4档起影子干扰配额；删除影子路径、配置、随机替换和页面特殊样式，试玩及10档目标／干扰项一律彩色图案。
- 继续复用影子配对素材库中的彩色原图，不删除其他游戏仍在使用的影子素材；连续流、切换冻结、0.5秒缓冲及评分规则保持不变。新增全档无影子回归约束。
- 试玩及10档×8种随机种子的彩图约束、全部分类素材、连续流公平性、计分、暂停与604项资源引用校验通过。原来不是“影子分类”，而是把其他类别干扰项换成影子；本次已完全删除这条视觉干扰规则。
- 第10档浏览器抽查105个渲染气泡，影子路径为0；19:29 iOS 5.25编译、导出和Xcode资源新鲜度校验通过，已同步。

### 2026-09-20 找茬乐园补齐背景与试玩

- 修正上一轮漏项：复用桌面全屏背景；进入可操作的两处差异试玩，右上角显示实际难度，可以直接开始训练，找齐后停留并允许重试。
- 试玩使用独立旧版野餐示例的洒水壶／皮球两处，不计时、不记误点／分数、不占用150组故事图循环；正式开始清空试玩状态并按真实档位选题。旧图片加载回调不能影响新一局。
- 试玩／正式完整页面回归、500次选题、点击区、循环、12000次互斥配方、统一试玩、暂停、计分和资源校验通过。19:18最终iOS 5.25编译、导出、Xcode同步及新鲜度校验通过，包含全屏蒙层修正；真机触摸效果待实测。
- 编译时发现上轮统一按钮使用原生端不支持的百分比max-width，已从27页共同样式移除；保留200px按钮宽度并加入静态防回归检查。
- 通用暂停／退出弹层移至TrainingFrame根层，45%黑色蒙层覆盖顶部返回键，吞掉触摸和点击；弹层打开时底层返回／暂停按钮禁用。浏览器验证返回键坐标命中蒙层、继续按钮可用，暂停回归通过。

### 2026-09-20 全训练试玩视觉统一与四项界面修正

- 核验28个训练／27个页面；准备和试玩右上角统一显示当前难度，正式训练恢复暂停入口。以呼吸小星球为基准统一半透明圆角卡片、紫色开始训练按钮及浅色试玩按钮，保留玩法与评分。
- 红绿指令换交通公园、倒水换实验台并修正小屏试管布局；森林寻宝换日间树林，奇偶轨道复用桌面，其余背景按玩法保留。拼图工坊替换全新跃跃／暖暖合作拼图封面。4张新增运行图共149178字节，原图已归档。
- 小司机进入准备页不自动开始试玩；修正试玩车位置、选中车道响应、是否躲开反馈，并提供方向箭头／当前小车按钮。
- 604资源引用、统一试玩27页、四屏幕尺寸、暂停、计分、红绿、倒水、呼吸、听音、听声捉图形、声音过滤器、拼图、小鸟、小车、小司机、天空及计时回归通过。浏览器复核呼吸试玩→正式切换、找出变化、倒水与驾驶布局；不等同真机验证。
- 详情及生成提示词见 [界面更新说明](GAME_UI_REFRESH_20260920.md)。iOS 5.25 Vapor最终编译成功，Xcode资源同步、新鲜度及本地打包输入校验通过；Android和iOS真机触摸、字体及屏幕适配仍待实测。

### 2026-09-20 新五类归属与声音过滤器公平切换

- 28 游戏按观察发现6、记忆辨识5、反应控制6、逻辑空间5、切换兼顾6落地；计划、结算及本地记录统一归属。点球玩法不变，未新增游戏。
- 声音过滤器连续流保留可见气泡，切换播报冻结并统一缓冲0.5秒；旧触摸作废，边缘不足1秒的气泡中立，既不罚也不白送分。
- 分类、过滤器10档与页面脚本、暂停、统一计分、星级、计时及静态资源专项通过。现有反馈音总覆盖测试仍因固定26页而实际27页失败，本次没有新增页面、未修改该断言。
- 用户确认未上线：不做旧分类兼容或记录迁移，已移除报告版本门禁；测试库可重置，本次未删除数据。服务端按新归属实现，详见 [落地说明](TRAINING_CATEGORIES_V2.md)。最终版 iOS 5.25 编译、Xcode资源同步及新鲜度校验均通过；Android/iOS触摸与播报体验仍需真机验证。

### 2026-09-14 找茬故事第二章图片生成完成

- SD2-011—020 共10组20张A/B已保存，角色配色修正、来源、提示词及实际差异记录齐备；对照页位于 content/brand/spot-difference-story-v2/chapter-02/review-ab.html。
- 自动循环下一章为第三章SD2-021；不需要用户审核。区域坐标、局部拼接及运行压缩未完成，不计为已接入游戏。

### 2026-09-13 第一章 A/B 预览保存与角色变化规则更新

- 10 组 A/B 已保存，第二幅采用短手臂修正版；对照入口为 content/brand/spot-difference-story-v2/chapter-01/review-ab.html。
- 用户认可已生成图片；后续允许角色表情、动作、小道具和饰品的自然局部变化。
- 待完成：100 个差异候选区域标注、抽取部分差异的拼接验证、运行图压缩；尚未替换游戏资源或启动自动循环。

### 2026-09-13 找茬第二版第一章A图预览（待确认）

内置图片生成完成SD2-001—010共10幅A图，原稿1672×941，存于content/brand/spot-difference-story-v2/chapter-01/；README可逐张查看，提示词与来源清单齐全。第二张多余爪子已修正，旧版保留rejected。仅故事画风审核，B图和10处差异尚未制作，未压缩接入运行资源，未开始第二章。配角形象及道具连续性待确认。

### 2026-09-13 找茬故事与150幅构思第二版（待审阅）

根据“故事优先、已有3组也可放弃”重构15章与150幅A图，低中高各50；新编号SD2-001—150，旧稿标记为历史。增加互动、小意外、角色互相照顾与试玩取舍，不固定保留旧素材。详见 [第二版完整方案](SPOT_DIFFERENCE_STORY_AND_150_V2.md)。仅文档，未启动图片生成或循环任务，未改运行资源。

### 2026-09-13 找茬故事骨架（待审阅）

按用户要求只整理15章故事骨架，对应150幅A图：以筹备星光游园会串联沿途发现，风格欢快、乐观、轻幽默；B图不另设剧情。详见 [故事骨架](SPOT_DIFFERENCE_STORY_OUTLINE.md)。未展开逐幅正文，未启动图片生成，未改动运行资源。

### 2026-09-13 找茬150组构思（待确认）

已列出15章150组A图故事及每组10个候选替换位置，低中高各50组；A承载主线，B仅自然局部变化。保留已有3组，任务1补7组，其后14任务各10组，最终300张。详见 [构思清单](SPOT_DIFFERENCE_150_CONCEPTS.md)。仅规划，未启动生成或循环任务，未更改运行资源。

### 2026-09-13 找茬点击容错

仅扩大隐形判定：通常每边8px、小区域尽量32px，邻区中点限制扩张、原区域优先，图片裁切和标记不放大。30区域/4屏宽边界及500组合玩法回归通过；iOS 5.25编译与Xcode同步通过，待真机手感确认。

### 2026-09-13 找茬安装768压缩版

按用户选择，将低中高三对768×432样张原样替换运行图，六张共185,234字节；原PNG和旧1280运行图均保留。30处差异/500组合/混合轮次与本地循环测试通过，iOS 5.25编译导出及Xcode同步通过，等待真机清晰度反馈。

### 2026-09-13 找茬10MB预算样张

仅输出压缩审核版，不替换运行图：640×360每图目标32KB，三对合计188,168字节，150对外推9.41MB（较原67.46MB减少约86%）；另附768×432同预算比较。细节有损，待用户确认清晰度，未同步Xcode。样张与说明位于 `outputs/image-review/spot-difference-10mb/`。

### 2026-09-13 找茬混合轮次与已展示循环

单次3→5组混合低中高场景，1级2低1中、2级低中高各1、最高1低2中2高；全部完成后平均轮分。新增稳定图组ID注册和本地按档位循环，图片显示加载即记录，未完成也不回退；新内容优先、池用尽再循环。模拟每池50组循环、500出题组合及多轮/计分回归通过，浏览器显示计时验证通过；双端5.25导出及Xcode同步通过。150组300张预计67.46MB（不含PNG原稿），仅估算，未批量生成。详见 [SPOT_DIFFERENCE_V2.md](SPOT_DIFFERENCE_V2.md)。

### 2026-09-13 找茬三对自然场景

内置图像生成：野餐花园/玩具工坊/星空观测站各A/B一对，每对10个替换区域；10档每题2→5处，从A底图局部覆盖选中的B区域，取消字符叠图。六张WebP约1.3MiB，原图/提示词已归档。30区域像素差异、500组合/生命周期、通用音效和计分回归及低/高档浏览器预览通过；Android/iOS 5.25编译导出成功，Xcode资源已同步，待真机验收。见 [SPOT_DIFFERENCE_V2.md](SPOT_DIFFERENCE_V2.md)。

### 2026-09-13 点球方向箭头

三路射门按钮补充↖/↑/↗箭头并保留方向文字，不改点击即时射门和自动力度。方向映射与原操作回归通过；iOS资源已重新导出并同步Xcode。

### 2026-09-13 图案侦探与多目标搜索

字符侦探改名图案侦探，ID不变；复用157张星球/影子彩色素材，桌面风格与四图可选试玩。10档9–48张、1–8目标，最高6列8行，找齐结算，误点扣分，目标时间按数量扩展。多目标/暂停/试玩/原网格模式及素材回归、48格浏览器预览通过；Android/iOS 5.25导出与Xcode同步通过，待真机验收。见 [PATTERN_DETECTIVE.md](PATTERN_DETECTIVE.md)。

### 2026-09-13 能量统一为星数

首页/星小屋从累加原始分数改为逐条累加基础0–5星+过关1星（reportStarCount），每星1能量、每局最多6点，100分上限与200分上限游戏同等封顶。现有记录直接重算，刷新不重复增加。星级边界/两页能量一致性测试通过，iOS 5.25编译导出及Xcode资源同步通过，规则见 [STAR_REWARDS.md](STAR_REWARDS.md)。

### 2026-09-13 点球三路点击与自动力度

取消按住/拖动/松手和双排操作区，改为力度自动往返、左中右三个按钮按点击瞬间力度射门。冻结射门力度、下一轮重启、暂停恢复与连点保护已接入，原10档梯度和计分不变。专项及通用音频/27游戏计分回归通过，Android/iOS 5.25编译导出通过，Xcode资源已同步。详见 [PENALTY_AUTO_POWER.md](PENALTY_AUTO_POWER.md)，待真机操作验收。

### 2026-09-13 错过音效采用方案①错误声

将已试听的 `01-classic-wrong.mp3` 原样安装为通用 `missed.mp3`；正确/错误继续使用方案③。旧错过音可从试听目录previous恢复，重建脚本同步更新。音频专项回归通过，iOS 5.25导出与Xcode资源新鲜度校验通过。

### 2026-09-13 结束页精简与静默升级

移除单独角色名、停止语音按钮、下次难度卡片，保留角色台词/自动语音及后台离开清理；难度更新逻辑不变，静默保存。UI断言、音频生命周期、星级与27游戏计分回归通过，浏览器布局检查通过；iOS 5.25编译导出及Xcode同步/资源新鲜度校验通过。

### 2026-09-13 正确/错误音采用方案③

已直接安装用户选定的温柔玩具型试听文件：正确木琴上扬、错误低音双敲，错过音及结算语音不变。旧文件保留在运行目录外，生成脚本同步更新。24页面覆盖/资源解码/播放生命周期测试通过，iOS 5.25导出与Xcode资源新鲜度校验通过；Android下次运行随主项目资源更新。

### 2026-09-13 双角色三档透明表情

跃跃/暖暖各三张透明表情：开心鼓掌、微笑抱星星手账、温柔捧爱心。按结算台词角色与分数档同步匹配，去掉旧矩形遮挡和圆角裁切；六张WebP约108KiB。透明通道、语音映射及星级动画测试通过，浏览器布局检查通过，Android/iOS 5.25编译导出与Xcode资源同步通过；待真机验收。原图及提示词见 `content/brand/result-expressions/README.md`。

### 2026-09-13 小车巡逻试玩可选

- 入口主按钮为“开始巡逻”，次入口“先试玩”；无需完成试玩即可正式开始。试玩中右上角同样可直接开始。
- 从入口/试玩中/试玩完成进入正式训练均重置试玩波次、计时和成绩；防重复开始和资源就绪检查保留。新增直接开始、途中跳过试玩及资源未就绪测试，回归通过。
- 浏览器验证直接开始及试玩中跳过均正常；Android / iOS 编译通过，iOS 已同步 Xcode，新鲜度检查通过。

### 2026-09-13 小车巡逻长标线透视修正

- 每条分隔线 3→2 段，近处长度约 50→90px，保持 40% 透明度上限。左右标线按道路投影斜率和实际场景宽高旋转，中线保持竖直，底端锚定在各自车道分隔线上。
- 页面就绪、开始/继续及尺寸变化后测量布局，不在每帧触发布局查询；速度、障碍密度、碰撞及训练规则不变。新增左右角度符号、中心角度为零及像素斜率一致性测试，10 级回归通过。
- 四车道浏览器预览确认长标线沿道路汇聚，Android / iOS 资源编译通过，Xcode 同步与新鲜度检查通过；本次同步同时包含图文按钮兼容修复。

### 2026-09-13 蒸汽模式图文按钮兼容

- 11 个页面共 16 处含 text/view/image 的原生 button 改为 `ActionSurface`（view + slot），纯文字 button 保留；图文样式、点击回调和动态 disabled 绑定保留，统一拦截禁用点击。
- 包含 Apple 登录及 10 个游戏页面；增加 `tools/test-action-surface.cjs` 防止原生 button 再出现子元素，并测试禁用/恢复点击。
- 禁用点击及音源游戏回归通过，Android / iOS 资源编译通过，Xcode 同步和新鲜度检查通过。实际原生图文按钮布局/点击仍需真机复核。

### 2026-09-13 小车巡逻长标线对比试版

- 每条车道分隔线从 5 段改为 3 段，近处长度从约 22px 增至约 50px；透明度上限从 45% 调为 40%，保留出入画面渐隐和静止路边标柱。
- 不改变道路推进速度、路锥速度、生成间隔、障碍数量、车道数量和碰撞规则；10 级回归及速度表不变测试通过。舒适度需要真机对比，不宣称消除眩晕。
- 浏览器试玩及四车道视觉检查、Android / iOS 资源编译通过，iOS 已同步 Xcode 并通过新鲜度检查。

### 2026-09-13 蒸汽模式滚动属性兼容

- 13 个页面的 `scroll-y="true"` 改为 `direction="vertical"`，保留滚动容器、样式、滚动定位和事件；业务源码无旧 scroll-x/scroll-y 引用。
- 依据 DCloud scroll-view 文档：https://doc.dcloud.net.cn/uni-app-x/component/scroll-view 。当前蒸汽模式不支持旧属性，后续页面统一使用 direction。
- Android / iOS 5.25 资源编译通过，Xcode 同步及新鲜度检查通过；Android 编译日志未出现该属性警告。长页面滚动需真机复核。

### 2026-09-13 小车巡逻弱化动态效果试版

- 保留全部 10 级速度、生成间隔、车道/障碍数量及碰撞时序，不限速。
- 路边标柱固定且减为每侧 4 个；每条分隔线从 8 段减至 5 段，变细变短，透明度最高 45%，出入画面渐隐。
- 路锥远处略放大便于辨认，缩小远近尺寸差，近处尺寸封顶 60px；仅在碰撞判定结束后渐隐，仍需躲避时不淡化。透视轨迹/接近时间不变。
- 增加原始速度表不变、标柱静止、标线透明度及路锥渐隐边界测试。此为视觉舒适度试版，不代表已验证儿童不会眩晕，仍需实际体验反馈。
- 测试通过，浏览器试玩/换道视觉检查通过；Android / iOS 资源编译通过，Xcode 同步和新鲜度检查通过。

### 2026-09-13 小车巡逻连续驾驶

- 独立 `pages/game/car-patrol.uvue`；目录入口指向新路由，旧 `motion-challenge?gameId=car-patrol` 自动转入。不改变萤火虫及小小驾驶员玩法。
- 沿封面生成晴天小镇道路、跃跃暖暖黄色车尾；固定车身纵向位置，透视标线/路边标柱/路锥迎面移动，随时点车道换道，插值车位判碰撞。新增素材约 113 KiB，源图和提示词存于 `content/brand/car-patrol/`。
- 1–10 级分别为 2/2/2/3/3/3/4/4/4/4 车道；路锥接近时间 6000→2900ms，波次间隔 3900→1650ms，每波阻挡 1→3 条车道，10→20 波。保留安全车道，相邻安全路径最多换一格。
- 单次避障试玩，碰撞前等待孩子主动换道，不计成绩；正式训练连续行驶，碰撞每波最多记一次。切后台/明显卡顿自动暂停，主动继续，暂停时间不计时，退出不提交未完成训练。
- `tools/test-car-patrol.cjs` 通过：10 级时序/密度/车道、10,000 波安全路径、试玩隔离、10 级满分通关、碰撞和暂停清理；运行资源引用检查、Android 5.25 蒸汽模式资源编译通过。浏览器已验证试玩换道及正式训练；原生手感待真机测试。
- iOS 5.25 资源编译、Xcode 同步及新鲜度检查通过；浏览器四车道布局已检查。Xcode 需 Run 重新安装才会更新手机上的版本。

### 2026-09-13 本地模拟登录

- 临时开启 `utils/local-test.uts`：自动“本地测试”身份，可创建/编辑本地档案、进行训练及查看本地报告；家长锁不变。
- 独立测试档案、训练/陪伴记录和难度存储；屏蔽业务 API、成绩同步和更新检查，保留真实登录及数据。正式联调/发布前必须关闭，详见 `docs/LOCAL_TEST_MODE.md`。
- `tools/test-local-login.cjs` 验证模拟身份、请求隔离、真实数据保护及关闭开关后恢复账号，已通过。
- Android / iOS 5.25 蒸汽模式资源编译通过；iOS 已同步 Xcode，新鲜度检查通过。手机需要 Xcode Run 重新安装；尚未进行真机交互验证。

当前版本用于验证核心产品结构与单个游戏闭环。以下内容按落地优先级排列。

### 2026-09-11 守望金色星球改版

- 夜空全屏背景，核心单层 50% 白色半透明底。上方常驻本次指定目标图片，试玩两颗（目标 + 明显不同干扰），试玩不计成绩，目标在本次训练内不变。
- 内置 imagegen 生成 20 款透明星球：4 款金色目标候选、4 款暖色近似干扰、12 款明显不同干扰。512px / WebP 84 运行素材合计 679,896 字节（约 664 KiB）；原图、提示词保存在 `content/brand/sky-planets/`，不进入运行包。
- 改为读取 1–10 级难度。展示时长依次为 2800/2500/2200/1900/1650/1400/1200/1050/900/780ms；间隔 1100/1000/900/820/740/660/580/520/460/400ms。1–3 级只用明显不同干扰；4–6 级加入暖色；7–10 级加入其他金色，近似比例逐级上升，绝不把本次目标当干扰。12→24 次呈现，目标占约 35%。
- 图片加载完成后开始计时；加载失败可重试且不记遗漏；切后台暂停并允许主动继续，已答题不重复计数。试玩误点只提示，正式误点/遗漏沿用原评分含义。
- `tools/test-sky-watcher.cjs` 覆盖 20 资源、10 级时序/干扰池、试玩隔离、加载计时、整局满分、遗漏误点及暂停重试；测试、透明通道和资源引用检查、Android / iOS 资源编译通过，iOS 已同步 Xcode 并通过资源新鲜度验证。难度仍需真机及儿童实测校准。

### 2026-09-11 星星捕手试玩修复与难度校准

- 移除试玩星星圆底及被裁切的角标；成功勾号改在提示文字内，重试行固定高度，核心白底仍为 50%。
- 修复此前未读取等级、全等级参数一致的问题。1–10 级目标数 6→15；星星图宽 84→48px、点击区 108→72px；换星间隔 700→250ms；满反应分阈值 2500→700ms（每级减少 200ms）。低级位置集中，逐级扩大范围；星星始终等到点击，不设置超时消失。
- 评分改为准确率 80% + 按等级计算的反应分 20%，修复旧公式最高仅 88 分的问题；慢于阈值才逐步扣反应分，试玩和换星期间不算误触。旧历史不重算，新旧分数比较需留意口径变化；参数仍需儿童实测校准。
- 10 级 × 3 种屏宽的目标边界、试玩隔离、换星保护和满分阈值测试通过；Android / iOS 资源编译通过，iOS 已同步 Xcode 并通过资源新鲜度验证，真机观感待复核。

### 2026-09-11 点球小将球门与踢飞轨迹

- 球场背景由裁切铺满改为完整映射到横向球场，降低球门视觉高度，横梁固定在约 22% 高度；复用素材，不增包体。
- 过强射门改为接近球门（26%）→ 越过横梁（10%）→ 远处缩小淡出（0%），左右方向不再横飞出屏；保留难度和判定。
- 左中右轨迹与射偏计数测试通过；Android / iOS 资源编译通过，iOS 已同步 Xcode 并通过资源新鲜度验证，真机观感待复核。

### 2026-09-11 星星捕手全屏背景与试玩

- 原夜空背景铺满页面，核心区域改为单层 `rgba(255,255,255,0.5)` 白底；不改变星星本身透明度，标题和统计使用浅色文字。
- 入场增加单颗真实游戏星星试玩：点击放大打勾、可重试或直接开始；试玩独立，不计成绩或反应时间，正式捕获 12 颗规则不变。
- 试玩隔离、重试、重复开始防护与正式捕获测试、资源检查通过；Android / iOS 资源编译通过，iOS 已同步 Xcode 并通过资源新鲜度验证；真机视觉待复核。

### 2026-09-11 数字连点云背景与四格试玩

- 复用云朵天空背景 `shadow-match-sky-v1.webp` 铺满页面，核心棋盘使用 94% 不透明白底，数字保持清晰，不新增图片。
- 试玩四格固定排列为上排「3、1」、下排「2、4」，按 1 → 2 → 3 → 4 点击，支持点错重试、完成后重玩及跳过；试玩不计分、不计时，正式三组难度规则不变。
- 四格顺序、重置、计时计分隔离和重复开始防护测试、资源检查通过；Android / iOS 资源编译通过，iOS 已同步 Xcode 并通过资源新鲜度验证，真机视觉待复核。

### 2026-09-11 点球小将黄猫守门员

- 守门员统一为封面中的暖暖：黄毛、红球衣、白手套，补齐准备、抱球、屏幕左扑和右扑四个透明动作；保持难度与判定不变。
- 运行素材 `game-characters/goalkeeper-cat-*-v1.webp` 合计 98,082 字节；原图和内置 imagegen 提示词归档于 `content/brand/goalkeeper-cat/`，不进入运行资源。
- 资源引用与透明通道检查通过；Android / iOS 资源编译通过，iOS 已同步 Xcode 并通过资源新鲜度验证。真机大小与动作衔接待复核。

### 2026-09-11 萤火虫追踪视觉与示范

- 复用夜林背景铺满页面；核心追踪区进一步提亮为 98% 不透明白色面板、纯白棋盘与近白蓝格子（#f7faff），保留蓝灰边框；试玩格子同步提亮，不增加图片资源。
- 入场展示实际萤火虫素材的“两次观察 → 按顺序点击”简易试玩，支持重播与直接开始，试玩不计分；另外两个共用页面的驾驶游戏保留原玩法。
- 资源检查、试玩状态与计分隔离测试、HBuilderX 5.25 Android / iOS 资源编译通过；iOS 已同步至 Xcode 工程并通过资源新鲜度检查，真机视觉效果待复核。

## P0：发布前必须补充

### 训练内容

- 为五个维度各完成至少 3 个训练游戏
- 为 3–6、7–9、10–12、13–16 岁建立独立难度参数
- 增加训练前教程、暂停、主动退出和异常恢复
- 建立难度自适应规则，避免单纯按年龄固定难度
- 校准评分算法；目前 MVP 分数仅用于流程演示
- 邀请儿童发展、教育或认知训练专业人员审核训练设计

### 儿童与家长体验

- 家长账户、儿童子档案和多儿童切换
- 低龄模式的语音引导与无文字操作
- 家长验证、训练时长限制、休息提醒和夜间限制
- 周报、阶段报告和易于理解的家庭练习建议
- 删除档案、导出数据、撤回授权等隐私操作

### 工程与数据

- 服务端账户、跨设备同步和匿名访客升级
- PostgreSQL 数据库和正式数据模型
- 网络离线、失败重试、版本迁移和数据备份
- iOS、Android、HarmonyOS NEXT 真机兼容性测试
- 自动化测试、崩溃监控、性能与耗电测试
- 正式应用图标、启动图、证书和商店构建配置

### 合规与安全

- 根据实际发行国家或地区完成儿童隐私合规评审
- 家长授权、隐私政策、用户协议和儿童隐私说明
- 数据最小化、传输与存储加密、访问审计
- 第三方 SDK 清单与儿童模式下的行为审查
- 禁止个性化广告、陌生人社交和诱导消费

## P1：完成内容闭环

- [已完成基础闭环] 今日训练计划：热身、主要训练、轻松结束；后续补充跨日参数与中断恢复提示
- 五维能力趋势和训练稳定性指标
- 训练日历、连续练习与可修复的温和打卡
- 星球成长系统、装饰解锁和非随机奖励
- 白噪音、作业专注计时器和阶段休息
- 训练素材管理后台和远程参数配置
- 无障碍：动态字号、色觉方案、旁白与触控范围

## P2：验证后扩展

- 班级或学校版本，但避免公开排名
- 教师布置训练与班级聚合报告
- 平板横屏与大屏适配
- 多语言与海外发行
- 穿戴设备提醒或专注状态联动
- 经充分验证后再考虑订阅和家庭会员

## 20 个游戏的实现状态

| 维度 | 已实现 | 待实现 |
|---|---|---|
| 集中注意 | 星星捕手、影子配对、光点追踪、声音在哪里 | — |
| 持续注意 | 星空守望员、找出变化、小车巡逻、呼吸小星球 | — |
| 选择注意 | 颜色指令、森林寻宝、字符侦探、声音过滤器 | — |
| 转换注意 | 魔法规则、红绿指令、分类车站、奇偶轨道 | — |
| 分配注意 | 上天入海、记忆与搜索、一心二用小司机、听声捉图形 | — |

## 推荐的下一开发批次

规划的 20 个游戏已经全部可玩。下一批进入整体质量优化：

1. 统一 20 个游戏的教程、暂停、主动退出与异常恢复。
2. 完善每日三段式训练的参数配置、中断恢复和跨日提示。
3. 校准评分与原始指标，补充无效局次识别。
4. 统一动效、音效、触感、静音模式和无障碍方案。
5. 执行 Web、Android、iOS、HarmonyOS NEXT 的设备测试矩阵。

## 2026-08-29 精简续作进度

- 已核验并修复 4 个审核通过卡通对象的运行时路径；三个目标游戏统一从 `utils/game-assets.uts` 取图，拒绝版未进入运行时引用。
- 已补齐 AI 素材清单中的 4 个 `approved` 条目。
- 已落地每日三段式训练基础闭环：首页显示当日计划与完成状态，结果页自动衔接下一项。
- 已按 Android UTS 严格布尔规则清理路由参数中的字符串/数字 `||` 兜底写法。
- 已完成 Android `.uvue` 样式兼容清理：页面内仅保留单类选择器，移除百分比 `min-height`，并修复 Kotlin 可空值与函数前置引用问题。
- 已完成第一轮全 App 文案减负：三个主 Tab、建档、结果、报告、设置及主要游戏教程移除重复说明，游戏提示统一为短动词指令；隐私和不可恢复提醒集中到必要位置。
- 已重做“点球小将”1–10 级难度映射：难度同时改变门将移动速度、力量条速度、有效力量窗口和总回合数，并在游戏页显示当前等级。
- 已完成星训练首页首轮卡通化：跃跃与暖暖共同进入主视觉，训练步骤、五维入口和成长数据改用现有审核素材表达，并集中维护游戏缩略图映射。
- 已增加家长锁 MVP：档案、年龄、测试难度和数据清理统一受滑动手势保护；解锁会话 5 分钟有效，并支持主动退出家长模式。
- 已调整家长锁边界：报告、历史和设置页可直接查看，仅编辑、删除和登出动作需要家长手势。
- 已增加访客账户与登录 UI，预留手机验证码、Apple、微信三种登录适配器；当前接口为空实现且访客训练开关保持开放。
- 已根据 Android 首屏实拍修复首页主视觉：移除角色白底贴片叠放，改用主题“双角色＋发光星”组合图；集中注意、星星训练和能量图标统一为品牌笑脸星球，并增加 Tab Bar 安全留白。
- 已完成非首页页面的首轮卡通化与文案减负：档案、登录、陪伴、小屋、报告、历史、结果、设置和家长锁统一接入跃跃、暖暖与主题星球；20 个游戏移除重复教程段落，仅保留动态目标、必要状态、反馈和操作按钮，为后续图形化示范预留空间。Android 34 页面原生编译通过。
- 已完成首轮包体积治理：生成源图、预览图和草稿移出 `static/`，333 张运行时 PNG/JPG 转为跨平台 WebP，9 个 WAV 提示音转为 MP3，TabBar PNG 保持不变；`static/` 从约 70MB 降至约 6.3MB，并新增可重复执行的优化与缺失资源检查脚本。
- 已完成 iOS Xcode 本地打包工程化：原生宿主与检测插件源码进入主线，官方 5.23 SDK 和发行资源由脚本恢复且不入库；arm64 插件与宿主无签名真机构建通过。正式签名 Archive 前只需用 HBuilderX 5.23 生成发行资源并在 Xcode 选择团队。
- 已完成 uni-app x 蒸汽模式迁移并统一到 5.25：开启样式隔离 2.0，`App.uvue` 转为组合式 API，清理层级 CSS 选择器；HBuilderX `5.25.2026082902-alpha` 与 iOS Vapor SDK 5.25 配套使用，Android 35 页面字节码导出成功，iOS 端侧检测插件与 Xcode 宿主链路已就绪。
- 已根据 iPhone 实拍优化“绑定家长手机”页：修正次操作错位与原生按钮样式，收紧表单节奏、精简说明并增强禁用态；390 × 844 并排视觉复核通过，Android 5.25 Alpha 蒸汽模式 35 页面编译通过。
- 已补齐 iOS 资源同步防呆：`prepare-xcode.sh` 统一执行 5.25 Vapor 导出、同步、插件按需重编和校验；Xcode 新增资源新鲜度构建检查，源码或导出资源未同步时会停止构建，避免真机继续显示旧 UI。
- 已完善三主 Tab 的双状态视觉：跃跃、暖暖与星小屋均提供原彩选中态和低饱和未选中态，六张运行时图标的圆形外部已改为真实透明，消除方形灰底；原生 Tab 图标由 31px 放大到 36px，栏高调整为 62px。Android/iOS 5.25 Vapor 资源均已重新导出并验证引用有效。
- 2026-09-11：参照 focus-companion-backend 源码完成现有调用对齐，资料统一 `/me`、`/me/update`，解析 `userId/infoCompleted`；登录恢复服务端资料，停止旧本地资料自动覆盖。训练/报告/陪伴移除旧档案 ID 参数。账号回归与离线补传测试通过，Android/iOS 5.25 Vapor 编译通过，Xcode 资源已同步；真实账号写入和真机业务流程待联调。
- 2026-09-11：更新功能客户端已接入：启动/前台与手动检查、普通提示、卡通强制更新页、版本缓存/跳过节流、路由与新训练拦截、426 处理和原生商店跳转；保留已开始训练的结果落盘路径。更新策略回归通过，后端需按 [APP_UPDATE_DESIGN.md](APP_UPDATE_DESIGN.md) 部署接口并配置真实渠道链接后进行真机验收。
- 2026-09-11：影子配对改用正式题库的苹果与影子做可点击示例，演示不计分；新增与此前 16:9 星空主题关联的浅蓝紫全屏背景（内置 imagegen，WebP 约 13KB，原图及提示词归档在 content/brand/backgrounds），精简反馈文案。示例逻辑与资源检查通过，Android/iOS 5.25 导出成功且 Xcode 资源已同步，布局待真机复核。
- 2026-09-11：按确认方向将影子配对背景切换为俯视浅木桌面（内置 imagegen，WebP 约 29KB），游戏区改为桌面上的白色卡片与浅色影子槽；星空背景保留备用。原图与提示词归档至 content/brand/backgrounds/shadow-match-desk-v1.md。
- 2026-09-11：影子配对核心操作区白底调整为 88% 不透明（12% 透底），弱化木纹干扰；外围桌面和题图自身透明度保持不变。
- 2026-09-13：小鸟穿云复用全屏云背景、核心区白色 50% 不透明，保留点击升降玩法并接入 10 档固定难度（云门宽度/速度/高度变化），支持直接开始或可选试玩。身体与翅膀拆为真实透明 WebP，合计约 13KB；独立扇翅、点击下拍与平缓俯仰共用活动时钟，暂停不动。难度/计分/试玩/帧率/暂停回归与浏览器近似视觉检查通过；Android/iOS 5.25 Vapor 编译导出成功，Xcode 资源同步和新鲜度检查通过，待真机手感复核。素材与提示词见 `content/brand/bird-cloud/README.md`。
- 2026-09-13：全部 24 个游戏页面接入通用暂停框架，统一“继续训练 / 重新训练 / 退出训练”，返回与后台自动暂停。共享可暂停时钟保留题目剩余时间、冻结反应/训练时长和音频，退出/重开不提交未完成成绩；呼吸与足球过渡动画同样按活动时钟插值。暂停、游戏计分及资源回归通过，Android/iOS 5.25 编译导出成功，Xcode 已同步；真机验收清单见 [TRAINING_PAUSE.md](TRAINING_PAUSE.md)。
- 2026-09-13：听音节奏改为目标固定播放2次、候选可试听且随时作答；沿用封面音乐台和夜空背景。接入54段音效（3种合成乐器音色×3音区×6节奏/音长），10档2–5选项，高档更相似但保留明确差异。播放次数、暂停/回调/计分回归、MP3解码及浏览器检查通过，Android/iOS 5.25编译通过，Xcode已同步；设计与真机验收见 [AUDIO_MATCH.md](AUDIO_MATCH.md)。
- 2026-09-13：听音节奏扩为6类合成乐器音色×6音高×6节奏，共216段（原4倍，约2.42MiB）；保留原54段，新增162段。局内8个目标无放回抽取、不重复。216段解码/基音/非静音/无削波与10档选项、80轮计分、通用暂停测试通过；Android/iOS 5.25编译成功，Xcode同步与资源新鲜度校验通过。普通手机外放下的六类音色辨识体验待真机复核。
- 2026-09-13：呼吸小星球改为按住充能/松开释放星光，基础星光、准确星环、连续稳定连线三级反馈；10档64–160秒，逐步收紧操作容差、减少引导，不改变呼吸节奏/不憋气。复用浅色星空与透明卡通星球，136轮及暂停回归、浏览器布局检查通过；Android/iOS 5.25编译导出通过，Xcode已同步。规则与真机验收见 [BREATHING_PLANET.md](BREATHING_PLANET.md)。
- 2026-09-13：27个游戏统一goal-v2，100分过关，竞速轮0–200先封顶再平均，完成型上限100，取消结算页旧加权覆盖及数字连点整局一票否决。找出变化改为10档独立网格/记忆/作答目标，500ms遮挡后仅一格变化，超时记0。未上线，不做历史兼容。27游戏计分边界、竞速页面及找出变化回归通过，Android/iOS 5.25编译通过，Xcode已同步；后端范围/版本联调见 [SCORING_V2.md](SCORING_V2.md)。
- 2026-09-13：结束页隐藏分数，主题0–5星，90分五星、120分触发五颗星环绕星球；报告/历史保留分数和静态0–6星，第六颗独立按100分过关点亮。规则/动画生命周期及原计分回归、浏览器视觉检查通过，Android/iOS 5.25编译成功，Xcode已同步；见 [STAR_REWARDS.md](STAR_REWARDS.md)。
- 2026-09-13：呼吸小星球补充可选一轮试玩，听音节奏补充可选一题双选项试玩（目标两次），可直接开始且试玩不计成绩；找出变化统一桌面大背景、实图前后示范及浅色核心区。相关逻辑/暂停/计分回归与浏览器预览通过，两端5.25编译及Xcode同步通过；前两组收尾进入真机验收，详见 [TRIALS_STYLE_WRAPUP.md](TRIALS_STYLE_WRAPUP.md)。
- 2026-09-13：24个训练页面/27款游戏接入正确、错误、错过三类轻量反馈音，通用结算页随机播放四句中性鼓励语音（本机中文TTS开发试听版），可手动停止，暂停/后台/退出不补播，题目音优先。新增音频共约130KiB；专项生命周期、计分/暂停/听音/呼吸/网格/小车/小鸟/竞速回归通过，两端5.25编译及Xcode同步通过，详见 [TRAINING_AUDIO.md](TRAINING_AUDIO.md)。
- 2026-09-13：找出变化复用影子系列137张彩色图与20张星球图，低档明显差异、高档开放相似组，每局穿插两轮星球，示范同步更新；不新增图片体积。157路径/7200组合及原逻辑回归通过，浏览器预览、Android/iOS 5.25编译导出与Xcode同步通过，见 [SPOT_CHANGE_ASSETS.md](SPOT_CHANGE_ASSETS.md)。
- 2026-09-13：用户选定晓晓，四句结算语音替换为zh-CN-XiaoxiaoNeural，沿用试听语速-8%及响度；三类反馈音不变，旧语音移至运行目录外备份。全部反馈素材约144KiB，资源/播放生命周期测试通过，iOS 5.25导出及Xcode同步/新鲜度校验通过。
- 2026-09-13：双角色结算已落地：跃跃云夏/暖暖晓晓，按<60、60–89、>=90三档分别鼓励/正常/夸奖，每角色每档2句共12句，部分自称。中心星球替换为当次说话角色，>=120五颗星环绕角色；旧四句移至审核备份。15个反馈音频共约480KiB。音频生命周期/60与90边界/角色一致性/星级/27游戏计分回归通过，双端5.25编译及Xcode同步通过，见 [RESULT_CHARACTER_VOICES.md](RESULT_CHARACTER_VOICES.md)。
- 2026-09-16：森林寻宝弃用4张占位卡片，改复用影子系列157张图库（spotChangePool 按难度轮换，每3轮穿插一轮星球），干扰项与目标同组相似图；整体UI改为夜间森林大背景+白色半透明卡片，新增可点击试玩（同组藏2个目标，点齐可重试，不计时不计分）。资源检查与8个计时游戏回归通过，iOS 5.25编译导出与Xcode同步通过，待真机验收。
- 2026-09-16：图案侦探已找到格子改为显示✓（不再只变色）。分类车站重做：改为左右两个车站，拖/点货物进对应车站（影子系列13类图库按难度配对，低难度类别差异大、高难度花朵/树木等相似类别），3–5组每组6–12件，难度由组数/件数与完成速度准确度决定，送错站立即红框报错并计错误；新增点选式试玩。背景暂用占位图 sorting-depot-v1.webp（待客户端生成替换）。8个计时游戏回归通过，iOS 5.25编译导出与Xcode同步通过，待真机验收。
- 2026-09-16：倒水小实验重做：难度改为颜色 2→5、试管 3→7，每局 3–5 轮；过关只看步数（目标步数 = 固定最少步数 + 低档 1 步宽限），单轮达标 100、超出每步扣 12 分，整局按轮等权平均，只有每轮都达标才是 100 分过关。题目改为离线预生成固定最少步数的关卡库（每档固定 4~10 步，共 284 关），运行时随机抽取并随机重映射颜色；试玩固定两根试管、倒一次即完成。界面统一到新 UI（木色实验台背景、白色半透明卡片、目标卡与三项统计），试管尺寸与每行根数随档位和屏幕自适应。新增 `utils/water-sort.uts`、`utils/water-sort-levels.uts`、`tools/generate-water-sort-levels.cjs`、`tools/test-water-sort.cjs`、`tools/preview-water-sort.cjs` 与 [倒水小实验](WATER_SORT.md)，SCORING_V2 同步更新。10 档×6 题必有解且目标步数内可解、关卡表 284 关最少步数校验、计分/暂停/资源检查通过，Android/iOS 5.25 编译导出与 Xcode 资源同步通过；真机触摸手感待验收。
- 2026-09-16：新增「拼图工坊」（选择注意）：素材复用找茬的 34 组 A/B 场景图，按场景去重、图片一显示即记为已看过（同找茬规则）；按 10 档网格 2×2→5×6（4→30 块）在运行时切成拼块放进可横向滑动的托盘，支持点选与拖放，可放空格、可与已占格子交换、可拖回托盘，卡片显示参考图（格子里不给提示，避免降低难度）。拖动只靠手指位移推进、以拼块中心判定落点（不依赖 clientY 零点），固定高度的块加 `flex-shrink: 0` 保证布局常量与真实位置一致。计分走计时超额档（上限 200，目标时间 = 拼块数×4s+4s），失误只统计「从托盘放进错误格子」；轮数 3,3,3,4,4,5,5,4,3,3。拼块用 `overflow: hidden` + 整图负偏移在运行时裁切，不预生成拼块文件，已在 iOS 验证成立。新增 `utils/puzzle.uts`、`utils/puzzle-cycle.uts`、`pages/game/puzzle.uvue`、`tools/preview-puzzle.cjs`、`tools/test-puzzle.cjs`（纯逻辑）、`tools/test-puzzle-page.cjs`（页面级：模板标识符静态检查/布局/裁切数学/格子平铺/落点/滑动/拖动/轮次结算/目标时间口径/小屏）、缩略图与 [拼图工坊](PUZZLE.md)；catalog/pages.json/计分与暂停回归同步（28 游戏/25 页面）。资源检查与相关回归通过；真机拖动手感与无缝整图待验收。
- 2026-09-17：规律小侦探重做：弃用 4 道硬编码题，新增 `utils/pattern-find-levels.uts` 出题器（影子系列 20 张彩色插画 + 星球系列 20 张星球按 10 档组合，低档短规律纯插画，高档长规律混入相似星球；4 档起奇数回合用答案的影子图作干扰项考察转换注意，随机源可注入种子）。UI 接入浅色星空背景与白色半透明卡片，新增“先试一下”可点击演示（不计分），试玩阶段返回不拦截。新增 `tools/preview-pattern-find.cjs` 浏览器试玩页（`node tools/preview-pattern-find.cjs` 后开 `http://127.0.0.1:4179/`，支持 `?start=1&level=1..10` 直接开局与 `?auto=1` 自动答题）与 `tools/test-pattern-find.cjs` 出题回归（10 档题量/规律结构/选项唯一性/影子干扰档位/资源存在性/种子可复现）。出题回归与运行资源检查通过；真机编译与手感待验收。
- 2026-09-17：完成全部 7 张运行时背景逐张审查（结论与证据见 `content/brand/backgrounds/REDO-PROMPTS.md`）：4 张保留（两张影子配对背景、小车城镇、星星夜空）；点球体育场因摄影写实风与全局 soft 2D 卡通脱节且球门与角色区重叠，建议按提示词 A 重做；分类车站背景左下角带“AI 生成”水印，必须按提示词 C 重做；夜晚森林偏暗，附可选提亮提示词 B，不重做可继续使用。三张提示词均含风格锚定（focus-planet-soft-2d-v1）与通用约束（9:16、全幅不透明、无文字水印、中央负空间），生成图走 content/ai-assets 既有审核流程后替换 v2。
- 2026-09-17：规律小侦探难度重做：原设计靠「题量 4→7 + 单元池随机抽」，实测档内方差远大于档间差异（第 7 档一半题与第 1 档同级；低档约 60% 的题两个干扰项一眼可辨）。改为「档位 = 参数」：素材相似度层级（跨类别→同类别→同款细节，启用之前完全未用的 similar/hard 相似组）、规律族池（1→8 族混排，同族配额 + 9/10 档必出影子族）、问号位置（末尾固定相位→末尾随机→序列内任意位置含中段）、选项数 3→4、形近干扰项 0→3、提示强度（框出单元→文字常驻→答错后）、影子维度（9 档影子绑定、10 档影子移动/递增，A 与 A′ 为不同图案）；一局固定 5 题，并新增不计分的入档影子引导题与题面明示。计分在游戏内定义达标线（`patternFindScore`：错 ≤1 题 = 100 分，对齐全局满 100 升档，等价于设计里的 ≥80 升档），每档容错恒定 1 题；难度指标按设计公式实时计算并断言严格递增（4.50→25.00）。新增 [规律小侦探](PATTERN_FIND.md) 与 [难度阶梯任务说明](PATTERN_FIND_DIFFICULTY_BRIEF.md)，SCORING_V2 同步；生成器/页面/回归/预览全部重写，每档抽样 400 局（共 2 万题）验收通过（配置表一致、难度单调、形近项覆盖 100%、状态对干扰 100%、唯一解、零配额违规、零相邻重复），iOS 5.25 导出与 Xcode 资源同步通过；10 格序列与 4 选项在最小屏的观感、以及真人首局通过率待真机验收。
- 2026-09-18：魔法规则、奇偶轨道统一到新 UI 模式：全屏背景图 + 白色半透明卡片 + 页内难度/进度胶囊 + 可点选试玩（不计分不计时，试玩阶段返回不拦截），原有 10 档难度、goal-v2 计时计分与暂停/重试入口保持不变。魔法规则背景暂用夜空 `star-catcher-sky-v1.webp`（魔法主题），试玩用同一张蓝色方形先按颜色分、再换按形状分，直接示范「图没变、规则变了、答案换边」；奇偶轨道背景暂用道路 `car-patrol-town-v1.webp`（轨道主题），试玩先给 3（奇数走左）再给 8（偶数走右）。两张背景均为暂用占位，后续按 `content/brand/backgrounds/` 的候选→审核→发布流程生成 v2 同名替换即可，页面只引用路径。新增 `tools/preview-switch-rules.cjs` 浏览器试玩页（`node tools/preview-switch-rules.cjs` 后开 `http://127.0.0.1:4180/?game=magic-rule|number-track`，支持 `?start=1&level=1..10`、`?auto=1` 整局自动答题、`?debug=1` 打印关键元素尺寸、`?w=&h=` 复核小屏）。8 个计时游戏回归、暂停回归与运行资源检查通过；小屏复核 375×667 / 360×640 不溢出（320×568 非目标机型，试玩页会溢出约 50–70px）；iOS 5.25 编译导出与 Xcode 资源同步通过，真机观感待验收。
- 2026-09-18：声音过滤器重做为「听类型、点气泡流」：气泡排成 **1—5 列**（列数 = 难度）、从场地底部 **连续向上浮动**（52px/s 全档一致，难度不靠提速），每一轮要看过去 **10—15 排**；每次播报一个类型，在这一轮里把同类气泡一路点掉。每排恰好 1 个正确答案、其余为别的类型的干扰（1 列档逐排交替，避免单列每排都有答案），点对盖绿 ✓、点错盖红 ✕、每个气泡只能点一次；点对按份额得分（100/本轮目标数）、点错每个扣 20（低难度同样扣分），漏掉只计数不扣分，单轮 0—100、整局各轮等权平均并沿用仓库统一升档口径（总分 ≥100 升档）。本轮目标全点到就立即收尾，两轮之间只留 0.5 秒换播报，一局 4 轮（1—5 档）/ 3 轮（6—10 档）保持整局约 1—1.5 分钟。进页面先跑一段**可点试玩**（单列 3 排、不扣分、只一轮），看懂规则后再点「开始」。素材用影子系列的 **8 类互斥图库**（93 张彩图，彩图为主、4 档起按 ≤25% 配额混入影子图且只作干扰），刻意排除玩具火箭/玩具帆船/玩具小鸭这类会和「交通工具」「动物」打架的图，避免孩子按常识点对了却被判错。新增 8 句类型播报语音（晓晓声线 edge-tts，ffmpeg loudnorm 转 24kHz/64k MP3，共约 150KiB）；页面只播 `utils/sound-filter-voice.uts` 里登记过的录音，没有录音时显示文字、按钮变「文字播报」，玩法不受影响。UI 换成夜空背景 + 白色半透明卡片 + 自适应气泡圆盘与播报卡，新增 `utils/sound-filter.uts`、`utils/sound-filter-voice.uts`、`tools/build-sound-filter-voice.cjs`、`tools/test-sound-filter.cjs`（类型表/出题/连续上升/判定/计分/整局/页面脚本整局跑通）、`tools/preview-sound-filter.cjs` 与 [声音过滤器](SOUND_FILTER.md)，catalog 摘要同步。回归与运行资源检查通过；顺带修复 `tools/preview-red-green.cjs` 多行 import 未剥离导致预览页运行时报错的问题。iOS 5.25 导出与 Xcode 资源同步通过，真机观感与手感待验收。
- 2026-09-18：记忆与搜索改记忆口径、加语音说明、尺寸收敛：记忆阶段**只亮出本轮新增的目标**（第 k 轮只显示第 k 个），前几轮目标不再重播，要孩子自己回想——旧目标依旧要在当前棋盘上重新找到；试玩同步改成只显示新增的那一个（同一口径）。新增**记忆阶段语音说明**：第 1 轮「记住这个目标，找到它」（2976ms）、之后每轮**短句**「又加了一个目标，前面的也要找齐」（3840ms）（晓晓声线 edge-tts，ffmpeg loudnorm 转 24kHz/64k MP3，约 55KiB），文字提示改成与语音同一口径。按「短句 + 不延长展示」定稿：**记忆展示时长照档位走**（保留「记忆时长随难度递减」旋钮），语音没念完的后半句在寻找阶段继续播、同一音频不打断。**棋盘固定 4 列**（不再随难度 3/4/5 变化），边距与间距沿用原参数——390 宽屏下格子 74px，旧版 5 列只有 57px；**只把新目标展示放大**：按窗口宽度 34% 计算、封顶 132px，明显大于棋盘格子（试玩目标图 42px、✓ 30px）。新增 `newTargets` / `previewTitle` / `previewTip` / `playMemoryVoice`、`tools/build-memory-search-voice.cjs` 与生成物 `utils/memory-search-voice.uts`；顺手给两个语音脚本的 ffmpeg 加 `-y`（此前 `--force` 只是“假装重生成”，音频时长会和文案对不上）。回归补上「记忆阶段只渲染 newTargets」「每档与试玩固定 4 列」「语音清单/短句文案/时长有效」「展示时长 = 档位时长、进入寻找不打断语音」「第 1/2 轮分别播 first/next」「棋盘 74px 与新目标 132px」等断言，并做过负向校验（故意写错断言会失败）。`test-memory-search.cjs`、`test-game-scoring.cjs`、`test-training-pause.cjs`、`test-sound-filter.cjs` 与运行资源检查通过；iOS 5.25 导出与 Xcode 资源同步通过，真机观感与语音节奏待验收。
- 2026-09-18：原「**听声找图**」（`listen-find`，分配注意；旧玩法是「记住一个声音 + 一个目标颜色」）重做为「**听声捉图形**」：画面用十字坐标轴分成左上/右上/左下/右下四区，每区按难度放 1—4 个随机图形（圆形/方形/三角形 × 红/黄/绿/蓝 = 12 种），语音播报「点击 + 半屏 + 描述符」（如「点击左侧方形」「点击下方红色图形」），点出**唯一**符合的图形：点对翻面成 ✓、点错翻面成 ✕ 并锁住（点错扣 10 分、误点容错 8→4），点漏本轮 0 分并亮出答案；图形一轮内不重生成，**下一轮先重新生成整盘再播报**；一局**固定 6 轮**，难度靠「图形变多 + 容错收紧 + 时间放宽（5→11 秒）」。出题保证恰好 1 个答案（同半屏其他图形避开描述符，另一半屏当干扰）。槽位沿用 `listen-find`（历史成绩与难度键名不动），catalog 改名「听声捉图形」、摘要改「听指令，点出对应位置的图形」，`pages.json` 导航标题同步。新增确定性素材 `tools/generate-listen-find-shapes.cjs`（12 个纯 SVG，每个约 200 字节，不用图像模型）、构建期拼接的指令语音 `tools/build-listen-find-voice.cjs`（12 个部件去静音+统一响度后 concat 成 28 句，晓晓声线，1.85—2.38 秒/句，约 528KiB）、`utils/listen-find-shapes.uts`、`utils/listen-find-voice.uts`、重写的 `pages/game/listen-find.uvue`（背景 + 坐标轴 + 四区标注 + 指令卡倒计时 + 可点试玩 + 提示/错误音）、`tools/test-listen-find.cjs`（难度/素材/语音/出题唯一性/判定与计分/6 轮固定/每轮先重生成再播报/页面脚本整局，并断言「声音从哪来」玩法未被动）与 `tools/preview-listen-find.cjs`（`http://127.0.0.1:4182/`），另有 [听声捉图形](LISTEN_FIND.md)；SCORING_V2 计分表、流水线 skill 与 TRAINING_PAUSE 的测试清单同步。**「声音从哪来」（`sound-location`）完全保留**：页面/音效/音效来源页/回归都没动；封面最终各归各位（`listen-find.webp` 彩色圆盘 / `sound-location.webp` 铃铛声波，见下条）。回归、运行资源检查与相关测试通过；iOS 5.25 导出与 Xcode 资源同步通过，真机观感与语音节奏待验收。
- 2026-09-18：「一心二用小司机」重做为**小车巡逻降难度版 + 底部安全滚动条**，并从 `motion-challenge` 里的模式独立成页 `pages/game/little-driver.uvue`（catalog 路由改走默认拼接，`motion-challenge` 只再服务萤火虫追踪）。难度映射：本游戏第 3—10 档**直接取 `getPatrolConfig(1..8)`**（第 10 档 = 小车巡逻第 8 档，逐字段一致），第 1—2 档手调成比小车巡逻最低档更慢、间隔更长、波次更少（6/8 波）。底部新增一条**固定匀速横向滚动**（46px/s，全档一致）的图片带：跃跃/暖暖「端坐」与「探头出车窗」四种小图一张张经过，点到探头图 → **翻成同一个小朋友的端坐图并打勾 ✓**（= 提醒他坐好），点到端坐图 → 打叉 ✕，**每张只能点一次**，探头图飘出没点到计「应点而没点」。一局分 = 完成比例（躲过的路锥 + 点中的探头图）− 误点端坐 ×10，整局 0—100，`roundScores` 传单元素保持累计口径。新增 `utils/little-driver.uts`（复用小车巡逻的几何/配置，只做档位映射与滚动条逻辑）、`tools/test-little-driver.cjs`（档位映射逐字段断言、滚动条匀速与等间距、单次点击、漏掉、计分、页面接线、页面脚本整局）与 `tools/preview-little-driver.cjs`（`http://127.0.0.1:4183/`），另有 [一心二用小司机](LITTLE_DRIVER.md)；catalog 摘要与 pages.json 路由同步，滚动条素材用已加入的 4 张 `*-_small` 图 + 既有 2 张拍手图，**没有新增素材**。点对后翻成的是**同一位小朋友的端坐图**（不是结算页的拍手图），并补上训练开始语音「跃跃、暖暖把头伸出车窗很危险，点一下他们，让他们坐好」（晓晓声线，约 54KiB，念完前不派第一波路锥）与点按文字反馈；修掉「后半段没有路障」：结束条件从「躲过的波次」改成**已结算波次**（撞过的也算结算），顶部计数改为「**经过 X / Y**」（撞没撞都计数，必然走到满）、进度条同步按已结算波次推进，回归补了「一路躲对」与「一直不换道」两个页面级场景，并静态断言收尾口径与顶部计数一致。回归、运行资源检查与相关测试通过；iOS 5.25 导出与 Xcode 资源同步通过，真机手感（换道 + 滚动条同时看）待验收。
- 2026-09-18：「双轨任务」重做并更名为「**上天入海**」（沿用 `dual-track` 槽位）：画面被中线横切两半，上半蓝兔跃跃开火箭躲**小星球**、下半黄猫暖暖开潜艇躲**各种鱼**，两个载具**只能上下移动且不能过中线**（每半 3 个停靠位，点哪格滑哪格、两半独立）；障碍物从右侧匀速 128px/s 进入，难度**只体现在障碍密度**（生成间隔 1100→380ms）+ 时长（60→120 秒，1—2 分钟）；**起始分 150→100**、每次碰撞扣 10、下限 0。素材全部复用现成资源（20 个 `sky-planets` 星球 + 8 条 `hard-sea` 鱼 + `easy-vehicles/rocket` + 跃跃/暖暖透明立绘），潜艇暂由页面 CSS 绘制作占位；新背景图出一份独立说明与生图提示词 [上天入海 · 背景图生成说明](DUAL_TRACK_BACKGROUND_BRIEF.md)。新增 `utils/dual-track.uts`、重写 `pages/game/dual-track.uvue`、`tools/test-dual-track.cjs`（难度参数/中线约束/停靠位/障碍密度与匀速/碰撞扣分/时长结束/页面接线/页面脚本共 9 段）与 [上天入海](DUAL_TRACK.md)；catalog 名称与摘要、`pages.json` 导航标题、SCORING_V2 计分表、PRODUCT_OVERVIEW 游戏清单同步改名，`gameScoreMax` 把 dual-track 归到 200 档（否则 150 的起始分会被结果页夹成 100）。回归、运行资源检查与相关测试通过；iOS 5.25 导出与 Xcode 资源同步通过，真机手感待验收。
- 2026-09-18：听声捉图形按反馈细调：图形**位置改规整**（每区固定居中排布：1 个正中、2 个并排、3 个上二下一、4 个 2×2，不再随机抖动）、**去掉外边框**（12 个 SVG 重新生成为平涂无描边）、**配色换成魔法规则那套柔和粉彩**（蓝 #5b8def / 黄 #ffc857 / 红 #ef7b8a / 绿 #5ec9a5，页面强调色也换成紫系 #9b7ede/#7f66c4）；**去掉「再听一次」按钮**（每轮仍自动播一次指令）。规则改动：**容错改为难度 1 是 3 次、难度 10 是 0 次**（0 容错时点错一次即结算）；**正确答案不再是固定 1 个** —— 上限随难度 1→4，每轮在 1..上限 之间随机（上限不是必须），需要**点齐本轮全部答案**才收尾，超时会把全部答案亮成黄色；提示同步为「第 k 轮：指令（要找 N 个）」/「还有 M 个」。回归 `tools/test-listen-find.cjs` 重写为 10 段（难度/素材无描边与色系/语音/居中排布/多答案唯一性/点齐才收尾/容错 3→0/整局/页面接线/页面脚本），运行资源检查与相关测试通过；iOS 5.25 导出与 Xcode 资源同步通过。
- 2026-09-18：听声捉图形按产品口径**取消判负**：点错只在本轮按 10 分/次扣分，容错归零也不结束整局（只影响最终分数），`utils/listen-find-shapes.uts` 删除 `maxErrors` 与 `listenFindExhausted`，页面统计改为「点对 / 点错 / 漏掉」，回归补上「连错 6 次本轮仍在进行、整局不提前结束、分数按 100 − 点错×10」的守卫。
- 2026-09-18：上天入海换上正式素材：整屏背景 `backgrounds/dual-track-sky-sea-v1.webp`（按本仓生图说明产出，768×1260；生成图左下角带「AI 生成」水印，运行版裁掉底部 85px 去水印，原图留档 `content/ai-assets/archive/`）、载具换成 4:3 整张插画 `dual-track/yueyue-rocket-4x3.webp`（跃跃开火箭）与 `dual-track/nuannuan-submarine-4x3.webp`（暖暖开潜艇），页面删掉下半屏的 CSS 纯色海、CSS 潜艇与角色叠加，改为一张整屏背景 + 两张载具素材（路径统一由 `utils/dual-track.uts` 的常量提供）；回归的素材与页面接线断言同步更新。
- 2026-09-18：封面定稿（换过两次后的结论）：「听声捉图形」与「声音从哪来」**互换封面** ——
  `level-thumbnails/listen-find.webp` 用铃铛声波（配「听声音找图形」）、`level-thumbnails/sound-location.webp` 用彩色圆盘找图（配「听声音找图片」）。
  过程：先换过一次，随后因「真机跑的是旧包、看起来没换成功」又换回原样；确认是旧包造成的错觉后按本节定稿为**互换**。
  封面是打进安装包的静态资源，改封面必须重新出包/装包才会更新；两个游戏槽位、玩法与历史成绩不受影响，`docs/LISTEN_FIND.md` 同步。
- 2026-09-18：上天入海修「载具卡在顶部、点也不动」并加拖动：原因是我把载具纵向位置写成读普通变量 `field` 的 computed，`field` 不是响应式对象，computed 永不重算 → 一直显示在顶部；现改为每帧把位置写回 `rocketTop` / `subTop` 两个 ref 再渲染。移动同时支持**点击停靠位**与**按住上下拖动**（拖动用相对位移判定，走满 0.6 格挪一格，不依赖 clientY 零点；背景/障碍/载具都设 `pointer-events: none`，触摸落到铺满半屏的停靠位带上，拖过之后忽略那一下 click）。障碍物密度**整体降一档**（每档用原来上一档的间隔，最松档 1200ms，最紧档 430ms）。回归补上拖动判定（阈值/方向/夹取）、密度端点 1200→430ms、页面拖动事件与「位置必须写回 ref」的静态断言。
- 2026-09-21：客户端课程与报告对齐轻量服务端协议：成绩同步必传实际 `difficultyLevel`，最近 100 条记录直接用于固定五题课程恢复和升降级；课程历史页按 `lessonNo` 切换，展示总分、综合表现、五维得分、0–6 星、上次同游戏对比和核心指标；成长报告默认近 30 课，可切换近 14 课/全部，展示五维能力与 30 个游戏表现。新报告页已接入首页、小屋和设置入口；Android/iOS HBuilderX 5.25 Vapor 均编译导出成功，iOS Xcode 资源已同步并通过新鲜度校验。
- 2026-09-23：手机号登录的验证码重发改为按号码保存 60 秒倒计时，返回页面仍显示剩余时间；仅发送成功后计时。测试服务端限流排查发现同号一小时内已有 5 次网关接受记录；小时限额或网关失败仍占用冷却/次数的修复已在后端本地通过 74 项测试，因远端新增审核固定验证码登录通道而暂未合并部署。浏览器实测第 1 课第 1 题保存 `assigned=1/unassigned=0`、上传成功且队列清空。
- 2026-09-23：成长报告仅统计完整 5 题课程是已确认规则，第 1 课仅完成 1 题时显示 0 属预期；已撤回扩大报告统计范围的服务端本地改动。客户端删除注册、启动、回前台及上传完成后的后台报告预取，仅用户打开报告页时查询；成绩补传保持不变。
- 2026-09-23：首页五维卡片开放只读图鉴：点击维度进入该维度 6 个游戏的列表，点游戏仅展示封面与一句玩法，不从图鉴启动训练；正式训练继续走每日计划。分类回归、资源检查与离线同步测试通过；iOS 5.26 Vapor 45 页导出、Xcode 同步及 AppID/资源新鲜度校验通过。
- 2026-09-23：针对 iOS 空课号排查，课程题目进入前验证本地课程凭证，缺失时阻止跳转；日志增加凭证写入/读取、结果页归属与同步状态，避免把旧版 `unassigned` 误判成新成绩。课程与离线同步回归、资源检查通过；iOS 5.26 Vapor 45 页导出、Xcode 同步与资源新鲜度校验通过，待真机完成一题确认新日志。
- 2026-09-23：真机确认进入与结算时 lesson=1，但原生存储重读后变 `unassigned`；改为 JSON 字符串持久化成绩数组，兼容旧数组读取，新增同课同游戏本地最高分覆盖与存储回读日志。上传判定只参考已带课号本地成绩及服务端记录，避免旧空课号成绩的 UI bestScore 阻断同步。新旧格式/最高分、课程与离线同步回归及资源检查通过；iOS 5.26 导出、Xcode 同步与资源新鲜度校验通过，待真机复核。
- 2026-09-23：真机后续日志显示两条新课成绩已带 lesson=1、pending=true，但队列回读丢失嵌套字段并被反复删除重建，未发出上传请求。队列改为 JSON 字符串持久化；同步改为逐项校验、失败/无效跳过继续、20 秒单项超时、迟到回调无效，新入队题目在当前批次结束后立即处理；无效项不计入待同步数量，也不阻拦下一课。离线队列回归增加无效、服务端拒绝、丢回调三种不阻塞后续成绩的测试。
- 2026-09-23：无效只允许是旧包遗留/损坏数据，不是正常训练状态。结算成绩保存后回读课号与同步 ID，失败重试一次；新成绩入队前按服务端必需字段校验、入队后回读校验。任一环节失败则回滚本次本地成绩与课程完成状态，结算页显示「本次未记录／重练本题」；网络失败但数据完整仍离线排队。旧队列无效项直接丢弃，不阻塞后续有效成绩。结果事务与离线队列回归、资源检查通过；iOS 5.26 Vapor 45 页导出、Xcode 同步和资源新鲜度校验通过，待真机复核。
- 2026-09-23：星陪伴暂时收敛为普通番茄钟：保留场景选择、时长、专注/暂停/休息及记录；隐藏并停用摄像头坐姿检测和半程坐姿提醒，完成页改为专注与休息摘要，新记录的观察指标固定为 0，个人中心不展示旧观察摘要。坐姿能力源码暂留供以后恢复，不在当前页面运行。专项回归与资源检查通过，iOS/Android 5.26 Vapor 45 页导出成功，Xcode 同步及资源新鲜度校验通过。
- 2026-09-29：法律文档与账号合规入口落地（当前 HEAD `14f774d`）。法律正文不进包：新增 `utils/legal.uts`（统一维护 `zhuanzhuapp.com/legal` 的四个入口：用户协议 / 隐私政策 / 儿童个人信息保护规则 / 第三方信息共享清单=`privacy#sdk`）与 `pages/legal/legal.uvue`（`<web-view>` 承载，加载失败降级为标题+链接+重试），`pages.json` 增加路由，设置页新增「法律与合规」四行。协议点名的路径同时对上线：设置页新增「订阅管理」进会员页（关闭自动续费仍需在 App Store 订阅管理里操作，会员页续费说明已写明），账号页新增「注销账号」→ `POST /me/delete`（先过家长验证 `parent-lock?action=delete`，再二次确认，成功后清本地会话；后端置 `DELETION_PENDING`、撤销刷新 Token，7 天后删除且不可撤销）。登录页把不可点击的「登录即同意用户协议与隐私政策」改为默认不勾选的同意框 + 三个条款链接，未勾选时手机号与 Apple 登录均保持禁用，登录函数内二次校验。iOS 侧把 `<web-view>` 需要的 `uni-web-view-*` 六个源文件加入 `build-extapi.sh` 的 `web-view_sources`，并在 `ios/ExtAPI/uts-config.json` 注册 `UniWebViewElementRegister`（Apple 订阅的 `uni-virtualPayment-*` 原本已在列表内）。新增 `tools/test-legal-pages.cjs` 锁住线上路径、web-view 承载、勾选门禁、订阅管理与注销接线。`node tools/check-runtime-assets.mjs` 通过（604 静态引用）；新增用例与 `tools/test-membership.cjs` 以外的会员链路用例通过。
- 2026-09-29：本批开始前先记录了当前 HEAD 的既有失败（与本次改动无关，已在 `git worktree` 干净检出上复现同样的 11 项）：`test-action-surface`（断言 ActionSurface ≥14，实际 12）、`test-memory-search`、`test-puzzle-page`、`test-training-feedback`、`test-membership`（断言 `pages/dimensions/dimensions.uvue` 有 `onShow(() => resumeMembership())`，该页当前没有 onShow）、`test-game-scoring`/`test-spot-change`（用例引用了已不存在的 `getCachedRecentResults`/`getGameDimensionId`）、`test-audio-match-assets`/`test-result-expressions`/`test-spot-difference-scenes`/`test-story-runtime`（写死 `/usr/local/bin/ffmpeg`，Apple Silicon 上 ffmpeg 在 `/opt/homebrew/bin`，应改用 `tools/media-tools.cjs` 解析）。这批需要单独安排修复，不要为了让套件变绿去改断言。
- 2026-09-29：仍未落地、需要产品/法务决定的合规项：① 用户协议写的「到期前 5 日以应用内消息、推送通知提醒扣费」目前没有实现（`manifest.json` 无推送模块，客户端无相关调用），自动续费提醒是硬性义务，建议与通知权限一起做；② 第三方 SDK 清单里列出的友盟 U-APM、微信开放 SDK、通知权限、麦克风四项当前均未接入，按「第一版不披露不一致、接入当天同步更新清单 + Apple 隐私标签」处理；③ 客服联系方式 App 内仍是个人微信 `jimmy_kangkang`，线上文档是 `support@paidongapp.com`；④ `POST /me/export` 已在后端就绪但客户端没有数据导出入口。
- 2026-09-29：清掉回归套件里长期存在的 11 项失败（先记录后修，避免以后误以为是环境问题）。**原因分三类**：① 用例跟不上实现（`test-memory-search`、`test-puzzle-page` 仍按 play-v2 之前的旧归属断言 `divided`/`selective`，而 catalog 与 `docs/TRAINING_CATEGORIES_V2.md` 已改为 focused/alternating；`test-training-feedback` 仍在找已被课程计划取代的 `updateGameDifficulty` 调用，且 TrainingFrame 页面数已从 26 涨到 29；`test-action-surface` 的 ≥14 是旧快照；`test-puzzle-page` 写死了 `_local_test` 后缀，而 `LOCAL_TEST_MODE` 已改为 false）；② 沙箱桩跟不上页面依赖（`test-game-scoring` 缺 `getCachedRecentResults`/`saveRecords`，且 `addRecord` 只捕获最后一条导致结果页回读校验报 `storage-readback-failed`；`test-spot-change` 缺 `getGameDimensionId`）；③ 环境路径（4 个用例写死 `/usr/local/bin/ffmpeg`）。**顺带修掉一处真实缺口**：`pages/dimensions/dimensions.uvue` 缺 `onShow(() => resumeMembership())`，训练列表回到前台不会刷新会员状态——这是 2026-09-22 就写进路线的行为，属于实现漏做，已补。新增 `tools/media-tools.cjs` 统一解析 ffmpeg/ffprobe/cwebp（环境变量 → PATH → Homebrew 前缀），修好 4 个用例；`throw Error(` 统一改为 `throw new Error(`，`build-story-runtime.cjs`/`update-story-runtime-manifests.cjs` 的 JSON 读取改为带明确报错的 `readJson`。现在 `node tools/test-*.cjs` + `node tests/*.cjs` 共 53 项全部通过，AGENTS.md 的「已知失败」条目已删除并补上沙箱/媒体路径约定。
- 2026-09-29：修掉「iPhone 模拟器启动即闪退」。报错是 `Library not loaded: @rpath/unimoduleFocusFaceDetector.framework/... Reason: incompatible platform (have 'iOS', need 'iOS-simulator')`：`build-plugin.sh` 只归档了 `generic/platform=iOS`，插件产物是纯真机切片，而宿主两个平台都链接并嵌入它。改为真机 + 模拟器两趟 `xcodebuild` 后 `-create-xcframework` 产出 `ios/Plugins/unimoduleFocusFaceDetector.xcframework`，并新增切片平台校验（设备必须是 `IOS`、模拟器必须是 `IOSSIMULATOR`，用 `vtool` 断言），同时删掉旧的单个 `.framework` 产物；宿主工程的文件引用从 `../Plugins/unimoduleFocusFaceDetector.framework`（`wrapper.framework`）改为 `...xcframework`（`wrapper.xcframework`），`verify.sh` 改为检查两条切片并在缺模拟器切片时直接报错，`prepare-xcode.sh` 的插件陈旧判定改用 xcframework 内的真机切片路径，`.gitignore` 与 `ios/README.md` 同步。实测：插件重建出 2.0M 双切片 xcframework；`xcodebuild -scheme UniAppX -destination 'platform=iOS Simulator'` 构建通过，嵌入的插件切片平台为 `IOSSIMULATOR`；模拟器安装启动后进程持续存活（不再闪退），登录页正常渲染并显示新的合规勾选 UI。相机/端侧检测仍以真机为验收环境。
- 2026-09-29：法律文档页支持隐藏 App 顶部。`pages/legal/legal` 由原生导航栏改为 `navigationStyle: custom` + 页面自绘顶部（返回按钮 + 文档标题 + `getWindowInfo().statusBarHeight` 顶部留白），因为 uni-app x 没有 `hideNavigationBar`，只有自绘才能在运行时控制显隐；导航参数 `bar=0` 时顶部整体不渲染，web 内容占满整屏，`utils/legal.uts` 的 `openLegalDoc(id, hideBar)` 负责拼参数（默认 `bar` 不传即显示）。回归用例补上路由必须是自定义导航、页面必须读 `bar` 参数、不允许再依赖原生导航栏标题、`hideBar=true` 必须带 `bar=0` 四条断言。已在模拟器构建运行验证（自绘顶部不影响其它页面）。另注：线上 `zhuanzhuapp.com/legal/*` 自身也带站点头部（标题 + 返回首页 + 目录），经实测站点不支持任何嵌入参数（`?embed=1` 返回完全相同的 HTML）；若也要去掉站点头部，需要在站点侧加开关，或在 web-view 里用 `evalJS` 注入样式隐藏（后者站点改版会失效）。
- 2026-09-29：星训练（首页）与星小屋的数据源改为「服务端优先」。新增 `utils/training-stats.uts` 统一四个数字的口径（今日时长 / 本周次数 / 能量 / 连续天数）与三个累计项（累计训练次数 / 累计时长 / 活跃天数）：窗口类指标取「服务端 `/training/records/latest` 成绩 ∪ 本地记录」并按完成时间+分数+时长去重（本地先落盘、稍后补传时不会重复计数，换设备/重装后的服务端成绩也会算进来），累计项取 `/reports/overview` 的 `allTime`（跨设备正确）；两端都取不到时回落到本地口径那一份代码。缓存按账号隔离（`focus_training_stats_v1_<userId>`）带 30 分钟 TTL，进页先用缓存/本地渲染，服务端回来后覆盖；所有字段一律取「服务端与本地里更大的那个」，避免刚练完刷新数字反而变小。首页不再自己算统计——`syncLesson()` 拿到 `/training/records/latest` 响应后直接 `applyTrainingRecords()` 复用同一份数据，不额外发请求；星小屋在 `onShow` 走 `refreshTrainingStats()`（并发去重 + 失败 30 秒内不重试，两个接口都失败才回调失败并保留本地值）。新增 `tools/test-training-stats.cjs`（口径与 `getWeeklyRecords`/`calculateStreak`/`reportStarCount` 等价、服务端与本地去重、累计项取服务端全量且不被更小响应降级、缓存按账号隔离与 TTL、两页接线），`tools/test-star-rating.cjs` 的「首尾两页能量一致」断言改为校验统一口径（口径收进 training-stats，两页都只展示 `stats.stars`）。回归 54 项全通过，`check-runtime-assets` 604 引用通过，iOS 资源已重新导出同步并校验，模拟器构建运行正常。
- 2026-09-29：遗留的接口缺口（当前用「服务端最近 100 条 + 本地」兜底，长期应补服务端聚合）。`/reports/overview.allTime` 目前只有 `completedLessons` / `completedGames` / `trainingDurationSeconds` / `activeDays`，没有能量（`reportStarCount` 累计）、连续天数、今日时长、本周次数；`/training/records/latest` 上限 100 条，所以重度用户的能量/连续天数只能取到「近 100 局 + 本地记录」的较大值。建议在 `allTime` 增补 `stars`、`streakDays`、`todayDurationSeconds`、`weekSessions` 四个字段（按 `client_completed_at` 的本地日切分即可），客户端就能去掉窗口兜底、彻底服务端化。
- 2026-09-29：档案与设置页去掉两块内容。①「单机数据说明（数据仅保存在本机，卸载后无法恢复）」——训练成绩、报告与陪伴数据已经是服务端优先（见 training-stats 那条），这句描述既不准确也容易误导；②「退出家长模式」按钮——同时删掉随之失效的 `leaveParentMode()` 与 `lockParentArea` 引用。删掉按钮后家长区不再能手动上锁，改成完全依赖 5 分钟会话到期自动失效（`utils/parent-lock.uts` 的 `PARENT_SESSION_MILLISECONDS`）；ROADMAP 里 2026-08 那条「支持主动退出家长模式」属于历史记录，保留不改。页面样式同步清掉 `.privacy-card/.privacy-title/.privacy-copy/.leave-button`，回归 54 项与 `check-runtime-assets` 通过，iOS 资源已重新导出同步。
- 2026-09-29：档案与设置页继续做减法并调整顺序。去掉「训练历史」「清除训练记录」两行（连带失效的 `openHistory()`、`confirmClear()`、`clearTrainingRecords` 引用与 `.danger-title` 样式一并删除；历史入口保留在星小屋与报告页，清理记录改由服务端账号注销流程承担），并把「测试难度」整卡从档案卡下方移到页面最底部；卡片顺序现在是 档案 → 订阅管理 → 法律与合规 → 测试难度，全部沿用原来的卡片类名与样式（`.form-card/.menu-card/.legal-card/.test-card` 共用一套圆角白卡），没有引入新样式。HBuilderX 5.26 编译 46 页通过、iOS 资源重新导出并校验为 current，回归 54 项与 `check-runtime-assets` 通过。
- 2026-09-29：上天入海（`dual-track`）难度整体下调。原来 10 档的参数只保留前 7 档（`LEVEL_DURATION_MS` / `LEVEL_SPAWN_GAP_MS` / `LEVEL_START_SCORE` 各裁到 7 个基准），新的 1—10 档用 `curveValue()` 在这 7 个基准上线性插值铺开，也就是**新的第 10 档 = 原来的第 7 档**：时长 60s→**100s**（原 120s）、障碍生成间隔 1200ms→**640ms**（原 430ms）、起始分 150→**117**（原 100）；档间是连续平滑的一小步而不是整档跳变（回归新增「单档间隔缩短 ≤ 100ms、起始分变化 ≤ 6 分」）。`dualTrackConfig()` 仍返回 1—10 的整数档位，页面上的「难度 N」与难度自增逻辑不变；障碍速度全档恒定（128px/s）、每次碰撞扣 10 的规则不变。同步更新 `docs/DUAL_TRACK.md`（新档位表 + 2026-09-29 说明 + 维护指引改成改基准表）、`docs/SCORING_V2.md` 计分表与 `tools/test-dual-track.cjs`（新端点值 + 平滑性断言）。回归 54 项与运行资源检查通过，iOS 资源已重新导出同步并校验。
- 2026-09-29：听音节奏（`audio-sequence`）两处小改动。①**整条选项变成播放区**：`@click="preview(index)"` 从左侧小音乐键挪到整行 `.option`，左侧 `♪` 由 `button` 改成纯展示的 `view`（保留配色圆角与试听中的 `♫` 状态，样式补上居中对齐），点击体验不再依赖命中一个小图标；②**「选这个」在听过之前不展示**：新增 `listened`（本轮点过试听的选项下标，每轮 `prepareRound` 清空）与 `showChoose(index)`，只有 `choices` 阶段且该条已听过才渲染按钮，反馈阶段只保留正确答案的 ✓；按钮加 `@click.stop` 避免冒泡回整行又播一次。提示文案从「点音乐键试听，点"选这个"作答」改为「点整条试听，听过才能选」，未听过的选项显示「点一下试听」。`tools/test-audio-match.cjs` 补上静态断言（整行可点、stop 冒泡、按 `showChoose` 显隐、提示文案）与一段行为断言（进 choices 时无已听项且所有「选这个」不展示，点过第 2 条后只有它展示）。回归 54 项、`check-runtime-assets`、iOS 资源导出同步与 `verify.sh` 全部通过；`docs/AUDIO_MATCH.md` 规则第 2 条同步更新。
- 2026-09-29：成长报告改用 1000 分制展示。原先报告直接显示服务端返回的 0—100 能力分（综合能力、五维能力、单游戏能力），初期只有十几分，看起来像不及格。现在 `pages/report/report-v2.uvue` 里加 `REPORT_MAX_SCORE = 1000` + `toReportScore(v) = round(v × 10)`，综合能力/五维/单游戏能力统一 ×10 显示，标题旁标 `/ 1000`、五维标题标「满分 1000」，进度条宽度改成按 1000 归一（`score / REPORT_MAX_SCORE * 100`），成长趋势增量也 ×10（`+30` 而不是 `+3`）；维度分数宽度 30→46px 以容纳四位数。**服务端契约不变**（`/reports/overview` 仍返回 0—100 的能力分），只改展示层，所以历史数据、后端算法与其他读取该接口的地方都不受影响；游戏单局得分（`recentAverageScore`、「近期 N 分」）是另一套口径（0—100/200 的计分），保持原样。
