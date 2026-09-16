# 专注星伴品牌素材包 V1

## 文件

- `app-icon/focus-planet-app-icon-master-v1.png`：图像生成原始尺寸，全底色方形版本。
- `app-icon/focus-planet-app-icon-1024-v1.png`：iOS/App Store 主交付尺寸。
- `app-icon/focus-planet-app-icon-512-v1.png`：Android 商店与文档预览尺寸。
- `characters/blue-bunny-v1.png`：跃跃，训练与探索角色。
- `characters/yellow-kitten-v1.png`：暖暖，陪伴与成长角色。
- `elements/star-home-v1.png`：星小屋基础元素。
- `elements/focus-star-planet-v1.png`：发光星星与蓝色星球组合，可用于启动页、空状态、完成反馈和品牌文档；当前版本为浅色实体背景，不应按透明切图使用。

App Icon 的核心图形为蓝兔、黄猫和发光星星，蓝色满版背景由系统在不同平台自行裁切。不要在源文件上再次增加圆角、文字、描边或透明边缘。

## 角色命名

- 蓝兔日常名：`跃跃`；完整角色名：`星跃`。
- 黄猫日常名：`暖暖`；完整角色名：`星暖`。
- 组合正式名：`星伴双星`。
- 日常组合称呼：`跃跃和暖暖`。

界面、教程和语音优先使用小名，保持亲切和简短；完整角色名只用于首次角色介绍、品牌故事或角色档案。组合名适合角色合影、活动主题、周边和品牌传播，不必频繁放进功能文案。

Android 自适应图标正式接入时，应另外输出纯色/渐变背景层和透明角色前景层；当前 V1 可作为商店图标、传统图标及视觉方向确认稿。

## App Icon 最终生成提示词

```text
Use case: logo-brand
Asset type: production mobile app icon master, exact square 1:1
Primary request: a polished icon for a children's focus training and gentle study companion app, featuring the referenced blue bunny and yellow kitten together with one glowing yellow focus star
Scene/backdrop: full-bleed rich periwinkle-to-royal-blue field covering every pixel including all four corners
Subject: simplified close-up faces of the blue bunny and yellow kitten leaning together behind one large central glowing five-point star with a subtle mint orbital curve
Style/medium: premium soft 3D cartoon, rounded child-friendly forms, clean app-store icon
Composition/framing: bold centered emblem, readable at 48 px, safe margin, sharp outer canvas corners
Constraints: no pre-rounded square, no white corners, no border, no transparency, no text, no watermark
```

生成方式：Codex 内置图像生成工具；蓝兔与黄猫运行时素材作为角色参考。

## 星伴星球元素提示词

```text
Use case: stylized-concept
Asset type: reusable brand element for a children's focus-training mobile app
Primary request: a friendly glowing five-point yellow star character floating above a small soft periwinkle-blue planet, wrapped by one thin mint orbital ring
Style/medium: premium soft 3D cartoon, rounded child-friendly forms, clean polished edges
Color palette: sunshine yellow, periwinkle blue, mint, cream highlights
Constraints: exactly one star character and one planet; no bunny, no cat, no text, no watermark
```
