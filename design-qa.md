# 绑定家长手机 UI 视觉验收

- Source visual truth path: `/Users/kangzhou/Downloads/截屏 2026-09-10 16.36.59.jpeg`
- Implementation route: `http://127.0.0.1:4173/#/pages/account/account?onboarding=1&needsProfile=0`
- Implementation screenshot path: Codex 内置浏览器本轮 inline capture；并排复核页为 `unpackage/dist/build/web/__qa_compare.html`
- Viewport: 390 × 844 CSS px，deviceScaleFactor 1
- Source pixels: 1170 × 2532（3× iPhone 真机截图，归一化为 390 × 844 CSS px）
- Implementation pixels: 390 × 844（Web 移动视口）
- State: Apple 登录后的可选手机号绑定页，手机号和验证码为空，提交按钮禁用

## Full-view comparison evidence

- 已在同一浏览器画布中并排展示原始真机截图和优化后实现；两侧均按 390 × 844 归一化。
- 真机截图包含 iOS 状态栏和 Home Indicator，Web 页面不模拟系统 UI；比较时仅判断应用内容区域。
- 优化后保持浅蓝背景、黄色品牌引导卡、白色表单卡和蓝色主操作层级，并消除了底部次操作的左偏与半宽问题。

## Focused region comparison evidence

- 表单区：手机号、验证码、获取验证码与主按钮在 390px 宽度下边缘对齐，按钮不再出现浏览器/系统默认描边和内阴影。
- 次操作区：“稍后再说”改为 48px 高的整行居中触控区域，文字中心与表单卡中心一致。
- 品牌区：继续使用现有 `duo-star-v1.webp`，无 Emoji、CSS 图形或临时占位资源。

## Findings

- 当前无可执行的 P0/P1/P2 视觉问题。
- [P3] Web 预览不包含 iOS 系统状态栏和底部 Home Indicator；这是宿主差异，不属于页面实现缺失，需在下次 iOS 真机运行时复核安全区。

## Required fidelity surfaces

- Fonts and typography: 使用项目现有系统字体与字重；标题、卡片标题、辅助说明和按钮形成四级清晰层级，无异常换行或截断。
- Spacing and layout rhythm: 顶部、品牌卡、表单卡与次操作间距已收紧；表单内部采用 10–16px 节奏，左右边缘统一。
- Colors and visual tokens: 延续品牌蓝、浅蓝背景、暖黄色引导卡；禁用态仍可辨识且与可用态有明确差异。
- Image quality and asset fidelity: 复用审核通过的双角色星星 WebP，裁切完整、清晰，无白边与拉伸。
- Copy and content: 辅助文案压缩为“可选，不影响使用”，验证码占位改为“6 位验证码”，没有增加不必要说明。

## Interaction verification

- 空表单下主按钮保持禁用视觉。
- 输入 11 位手机号和 6 位验证码后，主按钮正确切换为品牌蓝可用态；未触发真实验证码或绑定请求。
- Android HBuilderX 5.25 Alpha 蒸汽模式 35 页面字节码资源编译通过。
- Web 构建完成；存在项目已有的 `@dcloudio/uni-app` 生命周期导出警告，无新增构建失败。

## Comparison history

1. 首轮发现 P1：底部“稍后再说”为原生按钮，半宽左对齐；P2：验证码和主按钮出现原生边框/内阴影，禁用态过淡。
2. 修复：次操作改为整行自绘触控区；验证码和主按钮改为 `view + text` 自绘控件；统一圆角、间距、背景和文字状态。
3. 复核：同画布并排比较中，错位、原生边框和过淡禁用态均已消失；无剩余 P0/P1/P2。

## Follow-up polish

- 下一次 iOS 真机运行时补验刘海/灵动岛设备的顶部安全区和键盘弹起后的表单可见性。

final result: passed
