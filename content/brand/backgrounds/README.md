# 影子配对背景 v1

2026-09-11，使用内置 imagegen 生成。参考用户此前提供的 16:9 蓝兔、黄猫、星星跳台图（`exec-9d1c297f-0d2f-4bac-9b9c-e8d6761e835f.png`）；仅提取浅蓝紫星球、云朵的主题关联，不复制角色或密集星点。

原图：`shadow-match-sky-v1.png`；运行资源：`static/images/runtime/backgrounds/shadow-match-sky-v1.webp`。使用 cwebp，宽 768px、质量 84，约 13KB。原图不放入运行包。

提示词（内置工具，参考图用于风格与世界观）：

> Create a production background bitmap for the portrait interior of a children's shadow-matching game. Reference image role: style and world reference only, the blue-purple cloud and planet world of the existing exterior 16:9 banner. Generate a NEW simple portrait 9:16 illustration. Very pale powder blue and lavender atmosphere, near-white expansive empty center covering the middle 75% of canvas, delicate pastel clouds only along bottom and extreme corners, one small softly shaded lavender ringed planet in upper right outer corner, a tiny pale golden four-point glimmer in bottom left. Related to the reference's soft 3D cartoon shading, but MUCH quieter, lighter and less detailed. NO rabbit, NO cat, NO face, NO text, NO platform, NO floating objects in the center, NO starfield speckles, NO UI elements, NO border. This will sit behind high-contrast draggable pictures and dark silhouettes: central negative space must be essentially clean pale blue. Full bleed opaque art, no transparency or checkerboard. Portrait 1024x1792 if possible.

引导直接使用现有 `easy-fruits/apple.webp`、`apple-shadow.webp`、`banana-shadow.webp`，与正式题图同源；演示状态与正式成绩独立，无额外图像生成。
