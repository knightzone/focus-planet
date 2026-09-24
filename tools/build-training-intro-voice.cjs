// One short, game-specific spoken rule on the preview screen. Same Xiaoxiao voice
// and mastering as the existing memory-search instructions.
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const cp = require('node:child_process')
const root = path.resolve(__dirname, '..')
const out = path.join(root, 'static/audio/training-intro')
const cli = process.env.EDGE_TTS_CLI || path.join(os.homedir(), 'Library/Python/3.13/bin/edge-tts')
const lines = [
  ['star-catcher','看到星星就轻轻点它。'],['sound-location','先听声音，再找到对应的图片。'],
  ['shape-match','看看彩色图片，找到它的影子。'],['light-tracking','记住萤火虫走过的路线，再按顺序点出来。'],
  ['number-tap','按数字顺序，一个一个点亮它们。'],['penalty-kick','看准方向和力度，踢出足球。'],
  ['sky-watcher','记住金色星球，看到它就点一下。'],['car-patrol','左右换车道，避开前面的障碍物。'],
  ['spot-change','仔细看画面，发现变化就点出来。'],['breathing-planet','按住星球慢慢吸气，松开时缓缓呼气。'],
  ['audio-sequence','先听目标声音，再试听选项，找出一样的声音。'],['bird-cloud','轻轻点击，让小鸟穿过云门。'],
  ['forest-search','看看要找的东西，再从森林里找到它。'],['color-command','听清颜色指令，再点对应的颜色。'],
  ['sound-filter','听清这轮要找什么，再点对的气泡。'],['symbol-detective','找出所有不一样的图片。'],
  ['spot-difference','比较两幅画，点出不一样的地方。'],['puzzle','看着参考图，把拼块放回原位。'],
  ['magic-rule','注意规则会变化，选对颜色或形状。'],['sorting-station','看看现在的分类规则，把物品送到正确车站。'],
  ['number-track','看看左右轨道的规则，再把图案送过去。'],['red-green','绿灯出发，红灯停进安全区。'],
  ['water-sort','把同一种颜色的水倒到一起。'],['pattern-find','观察前面的图案，找出下一个。'],
  ['order-guess','先看有几个位置放对了，再交换图片猜顺序。'],['little-driver','一边躲开路锥，一边留意车窗外。'],
  ['listen-find','听清要找的图形，再点正确的位置。'],['memory-search','先记住目标，再把它们找齐。'],
  ['memory-link','先记住图片和数字，打乱后重新连起来。'],['dual-track','同时照看上面和下面，避开障碍。'],
  ['breathing-inhale','慢慢吸气。'],['breathing-exhale','缓缓呼气。']
]
if (!fs.existsSync(cli)) throw new Error('edge-tts unavailable: ' + cli)
fs.mkdirSync(out, {recursive:true})
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'training-intro-'))
try {
  for (const [id, text] of lines) {
    const target = path.join(out, id + '.mp3')
    if (fs.existsSync(target) && !process.argv.includes('--force')) continue
    const raw = path.join(tmp, id + '-raw.mp3')
    cp.execFileSync(cli, ['--voice','zh-CN-XiaoxiaoNeural','--rate=-8%','--text',text,'--write-media',raw], {timeout:60000})
    cp.execFileSync('/usr/local/bin/ffmpeg', ['-y','-v','error','-i',raw,'-af','loudnorm=I=-21:TP=-3:LRA=7','-ar','24000','-ac','1','-c:a','libmp3lame','-b:a','64k',target], {timeout:20000})
    fs.unlinkSync(raw)
    console.log(id)
  }
} finally { fs.rmSync(tmp,{recursive:true,force:true}) }
console.log('Training voice clips ready: ' + lines.length)
