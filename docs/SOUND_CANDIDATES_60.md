# 听听是谁：20 类对象 / 60 个音效候选

核对日期：2026-09-11。

## 当前交付

- 20 类对象，每类 3 个不同的 Freesound 文件，共 60 个唯一来源；并非将同一文件变调后计为多个。
- 54 个来源页标注 CC0 1.0，6 个 MTG 乐器样本标注 CC BY 3.0 Unported。
- 已做来源页/搜索返回原站正文的授权与描述初筛；**尚未下载、试听、裁剪或接入游戏**。作者描述不能替代实际听觉验收。
- 18 类已有插画可复用，另 2 类（自行车铃、电话铃）需补图。飞机插画还要核对是否与螺旋桨声音匹配。
- 每类的 3 个样本是随机变化素材，不等于三个难度；同一动物或乐器的不同声音对应同一答案。
- [机器可读清单](./SOUND_CANDIDATES_60.json) 保存稳定 ID、来源、许可与待处理状态；不是运行时资源配置。

## 短音效处理标准

目标通常为 0.3–2 秒，只保留一声完整核心声音。马嘶鸣等必要时可放宽至 3 秒；原本短于 0.3 秒的鸭叫/鼓点不硬拉长，以试听能否辨认为准。下表时长是**原文件**长度，不是计划在游戏里完整播放的长度。

裁剪必须保留起音和必要尾音，去除无关人声、空白、背景音乐及其他答题对象声音。轻微淡入淡出防爆音，统一主观响度，避免过度降噪和失真。不要用突然变大声、左右声道定位或刻意变调制造难度。具体截取起止时间必须下载试听后填写，当前不编造时间点。

## 候选明细

所有作品名链接均可进入原站试听/来源页。部分原文件下载需要 Freesound 登录。每组的备注为待验证项，不代表已通过。

### 1. 猫

图片：`static/images/runtime/illustrations/shadow-match/hard-similar-cats/cat-1.webp`。

保留一次完整喵叫，去掉人声和长停顿。

| ID | 作品 / 来源页 | 作者 | 许可 | 原时长（秒） |
| --- | --- | --- | --- | ---: |
| cat-1 | [cat meow](https://freesound.org/people/tuberatanka/sounds/110011/) | tuberatanka | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 1.544 |
| cat-2 | [Kitten meows](https://freesound.org/people/Luke100000/sounds/476918/) | Luke100000 | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 61.584 |
| cat-3 | [cat meowing](https://freesound.org/people/nekoninja/sounds/414042/) | nekoninja | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 10.182 |

### 2. 狗

图片：`static/images/runtime/illustrations/shadow-match/medium-puppies/puppy-1.webp`。

选择普通短吠，不选低吼或连续狂吠；前两条是同一作者的不同录音文件。

| ID | 作品 / 来源页 | 作者 | 许可 | 原时长（秒） |
| --- | --- | --- | --- | ---: |
| dog-1 | [Dog bark 1](https://freesound.org/people/Sadiquecat/sounds/850822/) | Sadiquecat | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0.606 |
| dog-2 | [Dog bark 3](https://freesound.org/people/Sadiquecat/sounds/850824/) | Sadiquecat | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0.433 |
| dog-3 | [Dog Bark1.wav](https://freesound.org/people/esperri/sounds/118961/) | esperri | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0.770 |

### 3. 牛

图片：`static/images/runtime/illustrations/shadow-match/medium-farm-animals/cow.webp`。

截一声哞叫；第三条远距离录音需确认手机上仍清楚。

| ID | 作品 / 来源页 | 作者 | 许可 | 原时长（秒） |
| --- | --- | --- | --- | ---: |
| cow-1 | [Cow moo #7](https://freesound.org/people/spurioustransients/sounds/513561/) | spurioustransients | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 10.446 |
| cow-2 | [Cow moos](https://freesound.org/people/JosephSardin/sounds/177253/) | JosephSardin | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 14.291 |
| cow-3 | [Cow - Moo (distant) - 96kHz.wav](https://freesound.org/people/JarredGibb/sounds/233145/) | JarredGibb | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 8.047 |

### 4. 羊

图片：`static/images/runtime/illustrations/shadow-match/medium-farm-animals/sheep.webp`。

保留单次咩叫，第三条避免响度过大或尖锐。

| ID | 作品 / 来源页 | 作者 | 许可 | 原时长（秒） |
| --- | --- | --- | --- | ---: |
| sheep-1 | [Sheep bleat.wav](https://freesound.org/people/mikewest/sounds/414342/) | mikewest | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 41.053 |
| sheep-2 | [sheep bleat](https://freesound.org/people/Yuval/sounds/210511/) | Yuval | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 30.180 |
| sheep-3 | [Loud Sheep Bah](https://freesound.org/people/Breviceps/sounds/644830/) | Breviceps | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 8.860 |

### 5. 马

图片：`static/images/runtime/illustrations/shadow-match/medium-farm-animals/horse.webp`。

保留嘶鸣的辨识段，不截得只剩呼吸声；必要时允许 2–3 秒。

| ID | 作品 / 来源页 | 作者 | 许可 | 原时长（秒） |
| --- | --- | --- | --- | ---: |
| horse-1 | [horse.mp3](https://freesound.org/people/3bagbrew/sounds/59569/) | 3bagbrew | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 10.045 |
| horse-2 | [Horse](https://freesound.org/people/madklown/sounds/184503/) | madklown | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 1.712 |
| horse-3 | [horse](https://freesound.org/people/dontwanttobehere/sounds/656661/) | dontwanttobehere | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 6.377 |

### 6. 猪

图片：`static/images/runtime/illustrations/shadow-match/medium-farm-animals/pig.webp`。

取温和哼哼声；第二条只考虑低沉咕噜段，尖叫部分淘汰。

| ID | 作品 / 来源页 | 作者 | 许可 | 原时长（秒） |
| --- | --- | --- | --- | ---: |
| pig-1 | [pig grunting and foraging.wav](https://freesound.org/people/odilonmarcenaro/sounds/121949/) | odilonmarcenaro | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 26.723 |
| pig-2 | [Angry Pig Oinking](https://freesound.org/people/Jofae/sounds/352698/) | Jofae | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 8.079 |
| pig-3 | [A pig grunting, grumbling and falling asleep (France, Limousin)](https://freesound.org/people/felix.blume/sounds/158746/) | felix.blume | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 122.808 |

### 7. 鸡

图片：`static/images/runtime/illustrations/shadow-match/medium-farm-animals/chicken.webp`。

选清楚咯咯声；第三条含其他鸟声，只能取无干扰片段，否则淘汰。

| ID | 作品 / 来源页 | 作者 | 许可 | 原时长（秒） |
| --- | --- | --- | --- | ---: |
| chicken-1 | [Chicken clucking](https://freesound.org/people/Breviceps/sounds/456803/) | Breviceps | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 14.953 |
| chicken-2 | [Feeding chickens](https://freesound.org/people/Breviceps/sounds/484722/) | Breviceps | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 9.889 |
| chicken-3 | [Chicken Alarm Call full with Occasional bird sound](https://freesound.org/people/Rudmer_Rotteveel/sounds/316921/) | Rudmer_Rotteveel | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 25.084 |

### 8. 鸭

图片：`static/images/runtime/illustrations/shadow-match/medium-farm-animals/duck.webp`。

同一作者的三条真实鸭叫文件；第三条仅 0.25 秒，试听确认能辨认，不人工拉长。

| ID | 作品 / 来源页 | 作者 | 许可 | 原时长（秒） |
| --- | --- | --- | --- | ---: |
| duck-1 | [Duck Quack](https://freesound.org/people/OwennewO/sounds/719111/) | OwennewO | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0.627 |
| duck-2 | [Duck Quacking Twice](https://freesound.org/people/OwennewO/sounds/719109/) | OwennewO | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0.540 |
| duck-3 | [Soft Duck Quack](https://freesound.org/people/OwennewO/sounds/719105/) | OwennewO | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0.250 |

### 9. 小鸟

图片：`static/images/runtime/illustrations/shadow-match/medium-similar-birds/bird-1.webp`。

按泛称“小鸟”出题，不让儿童通过叫声区分图片上不同鸟种。

| ID | 作品 / 来源页 | 作者 | 许可 | 原时长（秒） |
| --- | --- | --- | --- | ---: |
| bird-1 | [Bird Chirp](https://freesound.org/people/swiftoid/sounds/182507/) | swiftoid | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 4.727 |
| bird-2 | [Bird Chirp.wav](https://freesound.org/people/hmoosher/sounds/393655/) | hmoosher | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 23.753 |
| bird-3 | [Happy Bird Chirp](https://freesound.org/people/se2001/sounds/510314/) | se2001 | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 3.560 |

### 10. 汽车

图片：`static/images/runtime/illustrations/shadow-match/easy-vehicles/car.webp`。

均取一小段喇叭声；第三条原为汽车警报，去掉循环，不用于吓人。

| ID | 作品 / 来源页 | 作者 | 许可 | 原时长（秒） |
| --- | --- | --- | --- | ---: |
| car-1 | [Car Honking](https://freesound.org/people/MicktheMicGuy/sounds/434878/) | MicktheMicGuy | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0.871 |
| car-2 | [honkhonk.wav](https://freesound.org/people/Mihacappy/sounds/827215/) | Mihacappy | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0.516 |
| car-3 | [horn.wav](https://freesound.org/people/guitarguy1985/sounds/54086/) | guitarguy1985 | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 4.597 |

### 11. 火车

图片：`static/images/runtime/illustrations/shadow-match/easy-vehicles/train.webp`。

取单次汽笛/鸣笛核心段；不同车型都是“火车”，先做认识环节。

| ID | 作品 / 来源页 | 作者 | 许可 | 原时长（秒） |
| --- | --- | --- | --- | ---: |
| train-1 | [Train.wav](https://freesound.org/people/foxen10/sounds/149022/) | foxen10 | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 28.596 |
| train-2 | [Steam-Train Molli - with whistle and arrival](https://freesound.org/people/7z7/sounds/277496/) | 7z7 | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 55.956 |
| train-3 | [Trainwhistle SBB Re 420 euroblues.wav](https://freesound.org/people/euroblues/sounds/20065/) | euroblues | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 5.168 |

### 12. 飞机

图片：`static/images/runtime/illustrations/shadow-match/easy-vehicles/airplane.webp`。

三条为螺旋桨飞机。需核对图片机型；截取稳定引擎段，第三条避开开头人声。

| ID | 作品 / 来源页 | 作者 | 许可 | 原时长（秒） |
| --- | --- | --- | --- | ---: |
| airplane-1 | [Propeller plane](https://freesound.org/people/Breviceps/sounds/515293/) | Breviceps | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 29.656 |
| airplane-2 | [Propeller Plane](https://freesound.org/people/clif_creates/sounds/251971/) | clif_creates | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 30.447 |
| airplane-3 | [propeller plane.wav](https://freesound.org/people/Blahoslav/sounds/276492/) | Blahoslav | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 58.993 |

### 13. 吉他

图片：`static/images/runtime/illustrations/shadow-match/medium-musical-instruments/guitar.webp`。

只保留一次拨弦/扫弦，不播放长乐句。

| ID | 作品 / 来源页 | 作者 | 许可 | 原时长（秒） |
| --- | --- | --- | --- | ---: |
| guitar-1 | [Acoustic Guitar Chords](https://freesound.org/people/eqavox/sounds/683953/) | eqavox | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 27.745 |
| guitar-2 | [guitar pluck.wav](https://freesound.org/people/FenrirFangs/sounds/234739/) | FenrirFangs | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 12.831 |
| guitar-3 | [Acoustic Guitar D Major Chord Short](https://freesound.org/people/spitefuloctopus/sounds/315705/) | spitefuloctopus | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0.662 |

### 14. 小鼓

图片：`static/images/runtime/illustrations/shadow-match/medium-musical-instruments/drum.webp`。

单击保留自然尾音；第三条极短，需验证可辨识性。

| ID | 作品 / 来源页 | 作者 | 许可 | 原时长（秒） |
| --- | --- | --- | --- | ---: |
| drum-1 | [SD1.wav](https://freesound.org/people/Tristan/sounds/16789/) | Tristan | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0.500 |
| drum-2 | [Single drum hits 17inch dry](https://freesound.org/people/wolfdoctor/sounds/553876/) | wolfdoctor | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 46.822 |
| drum-3 | [snare.wav](https://freesound.org/people/Hanbaal/sounds/178668/) | Hanbaal | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0.179 |

### 15. 沙锤

图片：`static/images/runtime/illustrations/shadow-match/medium-musical-instruments/maracas.webp`。

取一次或两次摇动，勿只留瞬间噪声；第一条需检查左右声道差异。

| ID | 作品 / 来源页 | 作者 | 许可 | 原时长（秒） |
| --- | --- | --- | --- | ---: |
| maracas-1 | [maracas](https://freesound.org/people/nathanmanaker/sounds/486950/) | nathanmanaker | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 4.660 |
| maracas-2 | [maracas](https://freesound.org/people/emapuree/sounds/848750/) | emapuree | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0.587 |
| maracas-3 | [Maracas Multiple Variants](https://freesound.org/people/el_boss/sounds/625654/) | el_boss | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 31.402 |

### 16. 钢琴

图片：`static/images/runtime/illustrations/shadow-match/medium-musical-instruments/piano.webp`。

保留起音与自然衰减；第三条需试听确认是单一钢琴、不含合奏。后两条直接打开失败，依据搜索返回的来源页正文初筛，下载时复核。

| ID | 作品 / 来源页 | 作者 | 许可 | 原时长（秒） |
| --- | --- | --- | --- | ---: |
| piano-1 | [Piano Single Note.wav](https://freesound.org/people/owstu/sounds/508800/) | owstu | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 3.079 |
| piano-2 | [Upright Piano Remeau 12 E4](https://freesound.org/people/Sadiquecat/sounds/794370/) | Sadiquecat | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 10.231 |
| piano-3 | [Piano 93](https://freesound.org/people/Tian_Yueyao/sounds/775510/) | Tian_Yueyao | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 9.750 |

### 17. 小提琴

图片：`static/images/runtime/illustrations/shadow-match/medium-musical-instruments/violin.webp`。

真实单音，保留拉弓起音；两条 A4 是不同样本，不要求孩子辨音高。需署名。

| ID | 作品 / 来源页 | 作者 | 许可 | 原时长（秒） |
| --- | --- | --- | --- | ---: |
| violin-1 | [Violin - A4](https://freesound.org/people/MTG/sounds/356180/) | MTG | [CC-BY-3.0](https://creativecommons.org/licenses/by/3.0/) | 3.358 |
| violin-2 | [Violin - E5](https://freesound.org/people/MTG/sounds/356026/) | MTG | [CC-BY-3.0](https://creativecommons.org/licenses/by/3.0/) | 3.000 |
| violin-3 | [Violin - A4](https://freesound.org/people/MTG/sounds/356075/) | MTG | [CC-BY-3.0](https://creativecommons.org/licenses/by/3.0/) | 3.438 |

### 18. 小号

图片：`static/images/runtime/illustrations/shadow-match/medium-musical-instruments/trumpet.webp`。

真实单音，控制尖锐度；同一种乐器的不同音高均为正确类别。需署名。

| ID | 作品 / 来源页 | 作者 | 许可 | 原时长（秒） |
| --- | --- | --- | --- | ---: |
| trumpet-1 | [Trumpet - Fsharp4](https://freesound.org/people/MTG/sounds/357545/) | MTG | [CC-BY-3.0](https://creativecommons.org/licenses/by/3.0/) | 3.626 |
| trumpet-2 | [Trumpet - Asharp3](https://freesound.org/people/MTG/sounds/357589/) | MTG | [CC-BY-3.0](https://creativecommons.org/licenses/by/3.0/) | 4.160 |
| trumpet-3 | [Trumpet - E4](https://freesound.org/people/MTG/sounds/357544/) | MTG | [CC-BY-3.0](https://creativecommons.org/licenses/by/3.0/) | 4.103 |

### 19. 自行车铃

图片：待新增。

需要新增自行车/车铃图片；截取一声叮铃，保留尾音。

| ID | 作品 / 来源页 | 作者 | 许可 | 原时长（秒） |
| --- | --- | --- | --- | ---: |
| bicycle-1 | [Bicycle bell](https://freesound.org/people/AdrienPola/sounds/387884/) | AdrienPola | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 30.419 |
| bicycle-2 | [Bicycle_Bell.wav](https://freesound.org/people/nikiforov5000/sounds/330956/) | nikiforov5000 | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 22.863 |
| bicycle-3 | [bell.wav](https://freesound.org/people/13gkopeckak/sounds/378911/) | 13gkopeckak | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 4.599 |

### 20. 电话铃

图片：待新增。

需要新增固定电话图片；取一个振铃周期，不使用品牌音乐铃声。

| ID | 作品 / 来源页 | 作者 | 许可 | 原时长（秒） |
| --- | --- | --- | --- | ---: |
| telephone-1 | [Telephone Ring](https://freesound.org/people/meisterleise/sounds/332073/) | meisterleise | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 5.172 |
| telephone-2 | [fetap-ring.wav](https://freesound.org/people/DrNI/sounds/164036/) | DrNI | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 18.770 |
| telephone-3 | [telephone ring.wav](https://freesound.org/people/xyzr_kx/sounds/79440/) | xyzr_kx | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 23.057 |

## 授权与鸣谢

[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) 允许修改和商业使用，不强制署名；仍保存作者和来源，不暗示作者背书。CC0 不保证上传者拥有全部权利。

[CC BY 3.0 Unported](https://creativecommons.org/licenses/by/3.0/) 允许商业使用和改编，但需保留适当署名、作品名、来源和许可链接，说明衍生修改；不得附加限制许可权利的法律条款或技术措施。上架前还要核对分发方式，不能只写一句“素材来自网络”。

本次需要署名的 6 条为 violin-1/2/3 与 trumpet-1/2/3，作者均为 MTG（Music Technology Group, Universitat Pompeu Fabra），来自 Good-sounds 项目。建议最终放在“星小屋 → 关于 → 素材鸣谢”，不增加训练界面文字。只列实际采用的素材：

> 《Violin - A4》— MTG / Music Technology Group, Universitat Pompeu Fabra  
> 来源：https://freesound.org/people/MTG/sounds/356180/  
> 许可：CC BY 3.0 Unported — https://creativecommons.org/licenses/by/3.0/  
> 修改：待实际处理后填写；当前尚未修改。  
> 原作者不代表对本 App 的认可或背书。

其他五条应使用上表各自的作品名和来源 URL，不能因为作者相同遗漏条目。更多留档流程见 [授权记录](./SOUND_ASSET_CREDITS.md)。

## 下载后的验收门槛

1. 重新核对源页许可和来源说明，保存下载日期、原文件哈希、授权证据。不采用 NC、ND、授权不明或有上游权利争议的文件。
2. 每条试听确认真实内容、声源是否单一、是否适合儿童；不合格就替换，不为凑 60 条勉强采用。重点复核猪叫、鸡叫、远处牛叫、极短鼓点和 Piano 93。
3. 保存原文件，衍生文件单独存放，填入 JSON 的实际本地路径、截取起止时间、处理记录及试听状态。
4. 在手机扬声器上验收，包括 iOS / Android 的播放、重复播放和响度；普通音频资源不依赖 iOS 专属 API，鸿蒙也需最终真机/模拟器验证。
5. 先做一次图像与声音认识，再随机播放每类的不同样本，避免测试儿童是否见过某个物品。
6. 1–10 级优先增加选项个数，再增加候选之间的相似度；牛/羊、鸡/鸭等相似组必须实测后分级，不把未知物品知识当成注意力难度。

本次未改动训练逻辑、运行时素材或 iOS 打包资源。

