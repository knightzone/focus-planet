# 小车巡逻素材与生成记录

使用内置 imagegen（非 CLI），参考 `static/images/runtime/level-thumbnails/car-patrol.webp` 的晴天小镇、黄色小车、跃跃/暖暖主题。

## 最终素材

- `town-source-v2.png`：二次修正道路透视后的原图。运行版本 `static/images/runtime/backgrounds/car-patrol-town-v1.webp`，768px 宽，WebP 84，85,662 字节。
- `car-rear-source-v1.png`：真正透明车尾原图；去掉四周无效透明留白后编码为 `static/images/runtime/car-patrol/car-rear-v1.webp`，384px 宽，WebP 84 / alpha 100，28,966 字节。
- 路锥为代码原生 SVG，`static/images/runtime/car-patrol/cone-v1.svg`，843 字节。新增运行素材合计 115,471 字节（约 113 KiB）。

## Prompt set

Background initial: Production portrait 2:3 game background inspired by the attached cover's polished soft 3D sunny village, cheerful green hills, blue sky, cottages and flowers. Straight symmetric empty grey-lavender road; no characters, cars, cones, obstacles, lane dividers, text or UI. Requested horizon y24%, road x40–60% at horizon and x2–98% at bottom. First output widened too early and was not used at runtime.

Background refinement: Keep the generated sunny village style, but make the road much narrower, with green grass shoulders visible on both sides down to the bottom. Requested straight edges from (40%,24%) to (2%,100%) and (60%,24%) to (98%,100%). Road must not reach either image edge halfway down; preserve empty matte lavender-gray asphalt, no markings, cones, cars, figures or text. Final geometry visually checked; animation projection uses the actual approximate y23% vanishing point.

Car: Single transparent-alpha game sprite, same rounded yellow convertible and blue bunny / yellow kitten from cover, viewed directly from behind and slightly above, driving away toward top. Symmetric rear view with red tail lights, cream bumper, chunky tires, yellow body and star emblem. Backs of blue bunny with long ears in left seat and golden kitten in right seat. Premium soft 3D cartoon; no floor, scene, shadow outside sprite, circle, checkerboard or text. Original alpha preserved during WebP conversion.
