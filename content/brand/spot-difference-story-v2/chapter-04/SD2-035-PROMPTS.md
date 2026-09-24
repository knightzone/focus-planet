# SD2-035 叶子是大转弯

2026-09-19 修订：以031—034已认可图片与提示词为基准。使用内置 image_gen，A为新场景，B仅编辑对应A；不使用其他图像服务或旧模型脚本作为默认流程。

生成后按下面清单继续：来源记录写入 manifest.json，对照实际图片标注 runtime-regions.json，运行 tools/build-story-runtime.cjs。

实际传入的参考图：chapter-04/sd2-032-a.png（暖暖身份与画风）、chapter-04/sd2-033-a.png（跃跃身份与溪边棚架画风）。033没有黄猫，不能单独承担暖暖的角色参考。不复用参考图构图。先读取参考图，再将路径实际传给内置工具，不能只在提示词里写“reference”。

## 画风与复杂度约束（与下方A提示词一起使用）

Use the two supplied images as character/style references only: Image 1 SD2-032 for golden kitten Nuannuan; Image 2 SD2-033 for blue rabbit Yueyue and creekside style. Match their rounded stylized toy-like storybook proportions, saturated blue rabbit, blue rabbit nose, golden kitten without tabby forehead stripes, clean softly textured surfaces and short natural limbs. Do not reinterpret them as realistic furry baby animals. Expressions and gestures may change naturally. Keep ears fully within frame. Medium OVERALL scene complexity: one readable table activity, spaced props and a broad calm water area; simplified soft distant creek and greenery, restrained wood grain and ripples. Avoid dense fine fur, busy bokeh foliage, elaborate reflections and added decorative clutter. The ten anchors can be colors/patterns on existing objects; do not add ten extra objects merely to reach ten differences.

## A 完整提示词

Use case: illustration-story. Generate ONE independent landscape 16:9 A image SD2-035 'The leaf makes a big turn', no collage. Reference image for polished soft 3D cartoon storybook style and blue rabbit Yueyue identity only; do not repeat its scene. On a safe dry creekside pavilion, golden kitten Nuannuan and blue rabbit Yueyue lean over a wide shallow turquoise water tray on a low wooden table. Kitten Nuannuan: golden-yellow fur, brown eyes, cream muzzle and chest, pink nose, fluffy curled tail with cream tip; she kneels at the left side and gently steadies ONE wide green leaf floating flat in the middle of the water as an obstacle island. Rabbit Yueyue: soft blue fur, blue eyes, cream muzzle and belly, tall ears with peach-cream inner; he stands at the right side holding ONE small handheld paper fan angled toward the water, adjusting the breeze. TWO different folded paper boats float separated by the leaf: one red paper boat left of the leaf, one cream paper boat right of the leaf, faint curved ripples around them. Slight elevated midwide view, both characters fully visible with natural short arms, clear expressive friendly focused faces. Sunny lush creek and low wooden railing softly behind. Provide ten naturally distributed separate sizable details for later local spot-difference editing: red paper boat, cream paper boat, wide green leaf obstacle, green handheld fan, white daisy emblem on a green mug at left, blue striped folded towel at front edge, orange top sheet in an open paper box at right, red heart emblem on the box front, single pinecone on a lower right shelf, round blue knob on a table drawer. Keep these details separated, large and unobscured, not clutter. No text, letters, numbers, watermark, split panels, additional characters, malformed limbs. This is A only.

## B 完整提示词

Use case: precise-object-edit. Create ONE independent B image for this spot-difference game, same size and framing. Keep camera, characters, poses, anatomy, lighting, scenery, all geometry and every unlisted pixel as unchanged as possible. Make exactly ten localized independent changes: 1 red paper boat to blue, including its local colored reflection; 2 cream paper boat to pale pink, including its local colored reflection; 3 wide green leaf obstacle to warm orange; 4 green handheld fan to purple, keep handle; 5 white daisy emblem on green mug to white crescent, keep actual flowers unchanged; 6 towel blue stripes to orange; 7 orange top paper sheet in box to purple; 8 red heart on box front to red five-point star; 9 remove pinecone from lower right shelf; 10 round blue drawer knob to round green knob. Do not move objects. Do not add difference markers, text, borders or panels. Preserve the original soft polished 3D cartoon style. Preserve wood and water textures as closely as possible.

## 差异设计说明

十处候选与 033/034 保持同一锚点词汇体系（船色、叶色、扇色、杯徽、毛巾纹、纸色、盒徽、松果移除、抽屉钮），便于沿用既有区域标注与抽取经验。两只船各自与倒影合并为一个候选区域；叶障碍位于画面中心、面积最大，作为中档主差异。实际可运行候选数以对照真实图片标注为准，不预设全部十处均可抽取。

## 状态

2026-09-19首轮035 A/B仅保存为风格候选：`content/ai-assets/archive/spot-difference-story-v2/chapter-04-candidates/sd2-035-{a,b}-style-draft.png`。该轮A未实际传入角色参考，偏写实绒毛且兔鼻颜色偏离既有形象；不计为正式完成，不进运行资源。036生成调用被用户中断，未确认交付。后续应按本修订说明重新生成035，不把候选图作为角色参考。

- [x] A 图生成与目检（修正版实际提示词见 SD2-035-GENERATED-PROMPTS.md）
- [x] B 图生成与目检（十处候选可见、肢体自然、构图对齐）
- [x] manifest.json 登记（来源、变化清单、notes）
- [ ] runtime-regions.json 标注（百分比坐标、互不重叠、至少5处）
- [ ] build-story-runtime.cjs 构建 + 四项测试
- [ ] runtime-review/index.html 人工核对
