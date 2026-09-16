# 听听是谁：音效候选与授权记录

核对日期：2026-09-11。

试听加工进展：猫叫 6 段自然版已获用户认可；猫叫轻度卡通版为对比实验。其余 19 类的卡通化试听与逐段授权记录位于 `outputs/audio-review/cartoon-library-v1/`，仍待用户逐段试听确认，未接入游戏。下方“尚未下载”等状态指最初候选登记，不代表这些后续独立试听目录的状态。

扩展候选见 [20 类对象 / 60 个音效来源](./SOUND_CANDIDATES_60.md) 及 [结构化清单](./SOUND_CANDIDATES_60.json)。扩展清单优先使用真实鸭叫，以下首批卡通鸭叫只保留为历史备选，不计入新清单的 60 条。两份清单均不是已发布素材清单。

状态：以下是已核对来源页授权的候选，尚未下载、剪辑、试听验收或集成到游戏。它们不是本项目新生成的 AI 音效。不能把本清单当作已发布素材清单；正式采用后再在 App 的素材鸣谢中展示对应条目。

## 首批候选

各来源页均标注 Creative Commons 0（CC0）。原始时长来自来源页；质量备注是基于作者描述的筛选意见，不代表已完成听觉验收。

| 对象 | 原作品 / 作者 | 来源与试听页 | 原始时长 | 候选处理与注意事项 |
| --- | --- | --- | --- | --- |
| 猫 | cat meow / tuberatanka | https://freesound.org/people/tuberatanka/sounds/110011/ | 1.544 秒 | 单次猫叫候选，试听确认无明显背景声 |
| 鸭 | Cartoon - Duck Quack / Breviceps | https://freesound.org/people/Breviceps/sounds/445960/ | 0.383 秒 | 卡通鸭叫，不标注为真实动物录音；判断是否过短、是否像玩具挤压声 |
| 牛 | Cow moo #7 / spurioustransients | https://freesound.org/people/spurioustransients/sounds/513561/ | 10.446 秒 | 作者描述含一近一远两只牛的叫声；截取单次清晰叫声，不保留远处回应 |
| 羊 | Sheep bleat.wav / mikewest | https://freesound.org/people/mikewest/sounds/414342/ | 41.053 秒 | 选择独立叫声片段，可筛选多个真实变化样本 |
| 马 | horse.mp3 / 3bagbrew | https://freesound.org/people/3bagbrew/sounds/59569/ | 10.045 秒 | 选择一次完整嘶鸣，试听确认背景与响度适合儿童 |
| 小鼓 | SD1.wav / Tristan | https://freesound.org/people/Tristan/sounds/16789/ | 0.500 秒 | 真实军鼓单击采样；对应鼓图片，不用于背景配乐 |

Freesound 部分素材原文件下载需要登录。当前仅完成来源与授权记录，没有绕过登录下载。

## 对应已有图片

图片根目录：`static/images/runtime/illustrations/shadow-match/`。

- 猫：`hard-similar-cats/cat-1.webp`，同一题仅出现一只猫，不靠叫声区分猫的外观。
- 鸭：`medium-farm-animals/duck.webp`。
- 牛：`medium-farm-animals/cow.webp`。
- 羊：`medium-farm-animals/sheep.webp`。
- 马：`medium-farm-animals/horse.webp`。
- 小鼓：`medium-musical-instruments/drum.webp`。

## 授权说明

- CC0 1.0：https://creativecommons.org/publicdomain/zero/1.0/
- Freesound 授权说明：https://freesound.org/help/faq/
- CC0 允许复制、修改和商业使用，不要求署名；我们仍自愿保存来源与作者记录。不暗示作者为本 App 背书。
- CC0 不提供权利保证，也不自动解决商标、隐私或肖像等其他权利。若发现第三方歌曲、人声或来源争议，暂停使用。
- 本次不采用 CC BY-NC、授权不明或仅限个人使用的素材。
- 若后续采用 CC BY，逐条记录准确版本、作者、作品名、来源链接、许可链接与实际修改内容；不能仅写“来源于网络”。

## 正式采用后的鸣谢模板

建议位置：星小屋 → 关于 / 素材鸣谢，不在儿童训练界面添加说明文字。

> 部分音效来自 Freesound 社区，以 CC0 1.0 发布。感谢以下作者。素材可能经过适配处理，具体修改记录见各条目。原作者不代表对本产品的认可或背书。

条目格式（只列实际采用的素材）：

> 《cat meow》— tuberatanka
> 来源：https://freesound.org/people/tuberatanka/sounds/110011/
> 许可：CC0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/
> 修改：按实际情况填写，如“截取、单声道转换、响度调整”；未修改则写“无”。

其他五项按上表填写，不能提前声称做过剪辑或响度调整。

## 入库与试听验收

1. 合规下载原文件，保存原文件名、下载日期、原文件 SHA-256 与当时授权页面证据。
2. 保留原始录音，将游戏衍生版本单独保存；记录截取时间段和处理参数。
3. 优先选清晰、非惊吓、单一声源片段；无提示答案的人声、音乐或无关动物叫声。
4. 统一主观响度，保留自然音色；按实际播放设备试听，不靠音量大制造难度。
5. 通过手机扬声器验证，不依赖耳机或左右声道。猫/牛/小鼓先用于差异明显的入门题。
6. 当前六个候选不足以证明 1–10 级声音相似度设计成立；每种物体还需 3–5 个验收通过的变化片段，不通过变调制造虚假的物种差异。
7. 上线前把实际文件、作者、许可、处理记录逐一对应，再将正式条目放入 App 鸣谢页。
