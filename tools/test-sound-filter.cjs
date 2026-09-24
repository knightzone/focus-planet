// 声音过滤器（听类型、点气泡流）回归：类型表完整性、难度参数、出题规则、连续上升与轮次推进、点击判定、计分、整局流程、页面脚本。
// 用法：node tools/test-sound-filter.cjs
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root = path.resolve(__dirname, '..')

function loadModule(file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8')
  return text.replace(/^import[\s\S]*?from\s*'[^']*';?/gm, '').replace(/^export /gm, '')
}

const source = loadModule('utils/sound-filter.uts')
const voiceSource = loadModule('utils/sound-filter-voice.uts')
const exposed = [
  'SOUND_FILTER_TYPES', 'RISE_SPEED', 'WRONG_PENALTY', 'MAX_BUBBLE_SIZE', 'MIN_BUBBLE_SIZE',
  'soundFilterConfig', 'soundFilterDemoConfig', 'soundFilterTypeById', 'soundFilterLabel', 'soundFilterAnnouncement',
  'soundFilterVoicePath', 'soundFilterRoundScore', 'soundFilterProgress', 'soundFilterFinished', 'soundFilterRoundSeconds',
  'soundFilterAnnouncementEnded', 'soundFilterStartRound', 'soundFilterCreate', 'soundFilterTap', 'soundFilterStep', 'soundFilterNextRound', 'soundFilterSessionScore'
]
const ctx = { Math, JSON, console }
vm.createContext(ctx)
vm.runInContext(ts.transpile(source + '\n' + voiceSource + '\nglobalThis.api = {' + exposed.join(', ') + '}\nglobalThis.voices = SOUND_FILTER_VOICE_FILES', { target: ts.ScriptTarget.ES2020 }), ctx)
const api = ctx.api
const voices = ctx.voices

let failures = 0
function check(ok, message) { if (!ok) { failures += 1; console.error('  ✗ ' + message) } }

function seededRand(seed) {
  let state = Math.floor(seed) % 2147483647
  if (state <= 0) state += 2147483646
  return () => { state = (state * 16807) % 2147483647; return (state - 1) / 2147483646 }
}

const FIELD = { width: 358, height: 380 }
const DT = 1 / 30
const COLUMNS = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]
const ROWS = [10, 10, 11, 11, 12, 12, 13, 13, 14, 15]
const ROUNDS = [4, 4, 4, 4, 4, 3, 3, 3, 3, 3]
const targetsPerRound = (config) => config.columns == 1 ? Math.ceil(config.rowsPerRound / 2) : config.rowsPerRound

// ---------- 类型表 ----------
{
  const types = api.SOUND_FILTER_TYPES
  check(types.length == 8, '类型数量应为 8，实际 ' + types.length)
  const ids = new Set(), labels = new Set(), assetOwners = new Map()
  let total = 0
  for (const type of types) {
    check(!ids.has(type.id), '类型 id 重复：' + type.id)
    ids.add(type.id)
    check(!labels.has(type.label), '类型名重复：' + type.label)
    labels.add(type.label)
    check(type.assets.length >= 5, type.id + ' 素材过少（' + type.assets.length + '）')
    for (const asset of type.assets) {
      total += 1
      check(!assetOwners.has(asset.id), '素材属于多个类型：' + asset.id)
      assetOwners.set(asset.id, type.id)
      check(fs.existsSync(path.join(root, asset.path)), '彩图缺失：' + asset.path)
      check(asset.path.indexOf('-shadow') < 0, '彩图路径不应带影子后缀：' + asset.path)
    }
  }
  const of = (id) => assetOwners.get(id)
  check(of('medium-toys/rocket') != 'toy', '玩具火箭与「交通工具」冲突，不应归入玩具')
  check(of('medium-toys/sailboat') != 'toy', '玩具帆船与「交通工具」冲突，不应归入玩具')
  check(of('medium-toys/train') != 'toy', '玩具火车与「交通工具」冲突，不应归入玩具')
  check(of('medium-playground-toys/duck') != 'toy', '玩具小鸭与「动物」冲突，不应归入玩具')
  check(of('medium-farm-animals/cow') == 'animal', '牛应归入动物')
  check(of('high-similar-airplanes/airplane-1') == 'vehicle', '飞机应归入交通工具')
  check(of('medium-trees/tree-1') == 'tree', '大树应独立成类')
  console.log('PASS: 类型表（8 类互斥、' + total + ' 张彩图全部存在、歧义图已排除）')
}

// ---------- 语音与文字兜底 ----------
{
  let recorded = 0
  for (const type of api.SOUND_FILTER_TYPES) {
    const audio = path.join(root, api.soundFilterVoicePath(type.id))
    const listed = voices.indexOf(api.soundFilterVoicePath(type.id)) >= 0
    check(listed == fs.existsSync(audio), type.id + ' 的语音登记与文件不一致')
    if (listed) recorded += 1
    check(api.soundFilterAnnouncement(type.id) == '找一找，' + type.label, type.id + ' 播报文案')
  }
  for (const file of voices) check(fs.existsSync(path.join(root, file)), '语音清单里有不存在的文件：' + file)
  check(api.soundFilterAnnouncement('nope') == '', '未知类型返回空文案')
  check(api.soundFilterTypeById('nope') == null, '未知类型返回 null')
  console.log('PASS: 播报（' + recorded + '/8 有录音，其余走文字兜底；文案与语音清单一致）')
}

// ---------- 难度参数 ----------
{
  for (let level = 1; level <= 10; level++) {
    const config = api.soundFilterConfig(level)
    check(config.level == level, 'L' + level + ' level 字段')
    check(config.columns == COLUMNS[level - 1], 'L' + level + ' 列数应为 ' + COLUMNS[level - 1] + '，实际 ' + config.columns)
    check(config.columns >= 1 && config.columns <= 5, 'L' + level + ' 列数应在 1—5')
    check(config.rowsPerRound == ROWS[level - 1], 'L' + level + ' 一轮排数应为 ' + ROWS[level - 1] + '，实际 ' + config.rowsPerRound)
    check(config.rowsPerRound >= 10 && config.rowsPerRound <= 15, 'L' + level + ' 一轮排数应在 10—15')
    check(config.rounds == ROUNDS[level - 1], 'L' + level + ' 一局轮数应为 ' + ROUNDS[level - 1])
    check(config.riseSpeed == api.RISE_SPEED, 'L' + level + ' 上升速度必须全档一致（难度不靠提速）')
    check(config.wrongPenalty == api.WRONG_PENALTY, 'L' + level + ' 点错扣分一致（低难度同样扣分）')
    check(!config.demo, 'L' + level + ' 正式配置不应是试玩')
  }
  for (let level = 2; level <= 10; level++) {
    const previous = api.soundFilterConfig(level - 1), current = api.soundFilterConfig(level)
    check(current.columns >= previous.columns, 'L' + level + ' 列数不应减少')
    check(current.rowsPerRound >= previous.rowsPerRound, 'L' + level + ' 排数不应减少')
  }
  const demo = api.soundFilterDemoConfig()
  check(demo.demo && demo.columns == 1 && demo.rowsPerRound == 3 && demo.rounds == 1, '试玩应为单列 3 排 1 轮')
  check(demo.wrongPenalty == 0, '试玩不扣分')
  check(api.soundFilterCreate(demo, FIELD.width, FIELD.height, Math.random).bubbles.every(b => !b.path.includes('-shadow')), '试玩也只能出现彩图')
  console.log('PASS: 难度参数（列数 1→5、每轮 10→15 排、一局 4→3 轮、速度与扣分全档一致）')
}

// ---------- 出题规则 ----------
{
  for (let level = 1; level <= 10; level++) {
    for (let seed = 1; seed <= 8; seed++) {
      const config = api.soundFilterConfig(level)
      const field = api.soundFilterCreate(config, FIELD.width, FIELD.height, seededRand(seed))
      const bubbles = field.bubbles
      const expected = config.rowsPerRound * config.columns
      check(bubbles.length == expected, 'L' + level + '/' + seed + ' 气泡总数应为 ' + expected + '，实际 ' + bubbles.length)
      check(field.roundHits == 0, 'L' + level + '/' + seed + ' 本轮目标数应为 ' + targetsPerRound(config) + '，实际 ' + field.roundHits)
      check(bubbles.filter((bubble) => bubble.isTarget).every((bubble) => bubble.typeId == field.typeId), 'L' + level + '/' + seed + ' 目标类型应为播报类型')
      check(bubbles.filter((bubble) => !bubble.isTarget).every((bubble) => bubble.typeId != field.typeId), 'L' + level + '/' + seed + ' 干扰不得同类型')
      check(config.bubbleSize >= api.MIN_BUBBLE_SIZE && config.bubbleSize <= api.MAX_BUBBLE_SIZE, 'L' + level + ' 气泡尺寸应自适应在 ' + api.MIN_BUBBLE_SIZE + '—' + api.MAX_BUBBLE_SIZE)
      check(config.rowGap > config.bubbleSize, 'L' + level + ' 排间距应大于气泡直径（不重叠）')
      check(config.bubbleSize * config.columns <= FIELD.width, 'L' + level + ' ' + config.columns + ' 列不应超出场地宽度')
      for (let row = 0; row < config.rowsPerRound; row++) {
        const inRow = bubbles.filter((bubble) => bubble.row == row)
        check(inRow.length == config.columns, 'L' + level + '/' + seed + ' 第 ' + row + ' 排气泡数')
        const hits = inRow.filter((bubble) => bubble.isTarget).length
        const expectedHits = config.columns == 1 ? (row % 2 == 0 ? 1 : 0) : 1
        check(hits == expectedHits, 'L' + level + '/' + seed + ' 第 ' + row + ' 排目标数应为 ' + expectedHits)
        const columns = new Set(inRow.map((bubble) => bubble.column))
        check(columns.size == config.columns, 'L' + level + '/' + seed + ' 第 ' + row + ' 排列不重叠')
        const assets = new Set(inRow.map((bubble) => bubble.assetId))
        check(assets.size == inRow.length, 'L' + level + '/' + seed + ' 同一排不重复用图')
      }
      // 连续上升：整条气泡流按排依次入场，第一排在场地底部，最后一排最深
      const sorted = bubbles.slice().sort((left, right) => left.row - right.row)
      for (let row = 1; row < sorted.length; row++) {
        if (sorted[row].row != sorted[row - 1].row) {
          check(Math.abs((sorted[row].y - sorted[row - 1].y) - config.rowGap) < 1e-6, 'L' + level + '/' + seed + ' 相邻两排间距应等于 rowGap')
        }
      }
      check(bubbles.filter((bubble) => bubble.row == 0).every((bubble) => bubble.y == FIELD.height + config.bubbleSize / 2), 'L' + level + '/' + seed + ' 第一排应从场地底部进入')
      const lastRow = bubbles.filter((bubble) => bubble.row == config.rowsPerRound - 1)
      check(lastRow.every((bubble) => bubble.y > FIELD.height + config.bubbleSize / 2), 'L' + level + '/' + seed + ' 最后一排应在场地下方排队')
      check(bubbles.every(bubble => !bubble.path.includes('-shadow') && !('shadowPath' in bubble) && !('isShadow' in bubble)), 'L' + level + '/' + seed + ' 所有目标和干扰项只使用彩图')
    }
  }
  console.log('PASS: 出题规则（每排 1 个正确答案、1 列时逐排交替、干扰跨类型、同排不重复、按排连续入场、10档全部彩图）')
}

// ---------- 公平切换与完整流程 ----------
function resume(field, rand) {
  api.soundFilterAnnouncementEnded(field)
  for(let i=0;i<15;i++) api.soundFilterStep(field, DT, rand)
  check(field.phase === 'play', '所有档位固定 0.5 秒缓冲')
}
{
 const rand=seededRand(7), f=api.soundFilterCreate(api.soundFilterConfig(5),358,380,rand)
 const before=JSON.stringify(f)
 for(let i=0;i<100;i++) {
   api.soundFilterStep(f,DT,rand)
   check(api.soundFilterTap(f,f.bubbles[0].id)==='ignored','播报期间点击忽略')
 }
 check(JSON.stringify(f)===before,'播报期间状态、坐标、时间、得分完全冻结')
 api.soundFilterAnnouncementEnded(f)
 const y=f.bubbles[0].y
 for(let i=0;i<14;i++) api.soundFilterStep(f,DT,rand)
 check(f.phase==='buffer' && f.elapsed===0 && f.bubbles[0].y===y,'缓冲不足半秒不得恢复')
 check(api.soundFilterTap(f,f.bubbles[0].id)==='ignored','缓冲点击忽略')
 api.soundFilterStep(f,DT,rand)
 check(f.phase==='play' && f.elapsed===0,'半秒后恢复，不提前移动')
 check(api.soundFilterTap(f,f.bubbles[0].id)==='ignored','屏外不能提前作答')
 const carried=f.bubbles.slice(0,3)
 carried[0].y=50;carried[1].y=160;carried[2].y=280
 const epoch=f.inputEpoch, oldType=f.typeId
 api.soundFilterNextRound(f,rand)
 check(f.phase==='announce' && f.inputEpoch>epoch && f.typeId!==oldType,'换类冻结并作废旧手势')
 check(carried.every(b=>f.bubbles.includes(b)),'保留可见气泡，不清屏')
 check(carried[0].neutral && !carried[1].neutral,'顶端作答不足一秒的气泡中立，正常位置继续判定')
 check(carried.every(b=>b.isTarget===(b.typeId===f.typeId)),'保留气泡按新规则判断')
 resume(f,rand)
 check(api.soundFilterTap(f,carried[0].id)==='ignored','中立气泡点击不计分')
 const misses=f.missed
 carried[0].isTarget=true;carried[0].y=-f.config.bubbleSize/2
 api.soundFilterStep(f,DT,rand)
 check(f.missed===misses,'中立目标飘走不记漏掉')
}
for (let level=1;level<=10;level++) {
 for(const perfect of [false,true]) {
  const rand=seededRand(level*13), config=api.soundFilterConfig(level)
  const f=api.soundFilterCreate(config,358,380,rand)
  let guard=0, endings=0, switches=0
  while(f.phase!=='done' && guard++<60000) {
   if(f.phase==='announce') resume(f,rand)
   if(perfect) for(const b of f.bubbles) if(b.isTarget) api.soundFilterTap(f,b.id)
   for(const e of api.soundFilterStep(f,DT,rand)) {
    if(e.kind==='finished') endings++
    if(e.kind==='roundStart') switches++
   }
  }
  check(f.phase==='done' && endings===1 && switches===config.rounds-1,'L'+level+'完整连续流程')
  check(f.roundScores.length===config.rounds,'轮数一致')
  check(f.roundScores.every(s=>s===(perfect?100:0)),'L'+level+'全对100/不点0，无白送分')
  check(!perfect || (f.wrong===0 && f.missed===0),'全对无漏判')
  check(f.elapsed>=50 && f.elapsed<=150,'有效时长合理 '+f.elapsed)
 }
}
check(api.soundFilterRoundScore(0,0,0,20)===0,'无有效目标不能白送满分')
check(api.soundFilterRoundScore(2,3,0,20)===67,'漏答降低完成比例')
check(api.soundFilterRoundScore(3,3,1,20)===80,'点错扣分不变')

// 页面真实回调、触摸和故障兜底
{
 const pageSource=fs.readFileSync(path.join(root,'pages/game/sound-filter.uvue'),'utf8')
 const script=pageSource.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1].replace(/^import[\s\S]*?from\s*'[^']*';?/gm,'')
 let now=1000, id=0, redirect='', onload
 const tasks=new Map(), audios=[]
 const clock={now:()=>now,setInterval:()=>0,clearInterval(){},setTimeout:(cb,ms)=>{tasks.set(++id,{cb,at:now+ms});return id},clearTimeout:id=>tasks.delete(id),
 createAudio:()=>{const a={src:'',onEnded(cb){this.end=cb},onError(cb){this.error=cb},play(){},stop(){}};audios.push(a);return a},destroyAudio(){}}
 const paused={value:false}
 const c={Math,JSON,console,ref:value=>({value}),computed:cb=>({get value(){return cb()}}),nextTick:cb=>cb(),watch(){},
 onLoad:cb=>onload=cb,onUnload(){},onResize(){},getGameDifficulty:()=>5,
 averageRoundScore:s=>Math.round(s.reduce((a,b)=>a+b,0)/s.length),scoreQuery:()=>'',
 useTrainingSession:()=>({clock,paused,navigating:{value:false},setStartedCheck(){},playFeedback(){}}),
 uni:{getWindowInfo:()=>({windowWidth:390,windowHeight:844,statusBarHeight:47}),getElementById:()=>null,redirectTo:o=>redirect=o.url}}
 vm.createContext(c)
 vm.runInContext(ts.transpile(source+'\n'+voiceSource+'\n'+script+'\nglobalThis.p={begin,tick,tapBubble,armBubble,replayAnnouncement,getField:()=>field,getSwitch:()=>switching.value}',{target:ts.ScriptTarget.ES2020}),c)
 const p=c.p
 const advance=ms=>{for(let n=0;n<ms;n+=33){now+=33;for(const [i,t] of [...tasks]) if(t.at<=now){tasks.delete(i);t.cb()}p.tick()}}
 onload()
 const stale=audios[0]
 p.begin()
 stale.end()
 check(p.getField().phase==='announce','旧语音回调不能结束新播报')
 audios.at(-1).end()
 advance(528)
 const f=p.getField(), b=f.bubbles[0];b.y=180
 p.tapBubble(b.id)
 check(!b.tapped,'没有当前手势不可答题')
 p.armBubble(b.id);f.inputEpoch++;p.tapBubble(b.id)
 check(!b.tapped,'跨规则手势不可答题')
 p.armBubble(b.id);p.tapBubble(b.id)
 check(b.tapped,'当前有效手势可答题')
 p.begin();audios.at(-1).error();advance(2640)
 check(p.getField().phase==='play','音频失败用文字等待后恢复')
 p.begin();advance(8646)
 check(p.getField().phase==='play','无 ended 回调仍有超时兜底')
 p.begin()
 let guard=0
 while(!redirect && guard++<20000){
  if(p.getField().phase==='announce') audios.at(-1).end()
  for(const bubble of p.getField().bubbles) if(bubble.isTarget){p.armBubble(bubble.id);p.tapBubble(bubble.id)}
  advance(33)
 }
 check(redirect.includes('dimensionId=divided') && redirect.includes('&score=100'),'页面连续整局正确结算到切换兼顾')
}
if(failures){console.error('失败 '+failures+' 项');process.exit(1)}
console.log('PASS: 连续流 / 播报冻结 / 0.5秒缓冲 / 中立边缘 / 跨规则触摸 / 10档计分 / 页面语音兜底与整局')
