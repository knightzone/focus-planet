// 一心二用小司机（原「控制路线 + 路边目标」重做）回归：
// 难度映射（第 10 档 = 小车巡逻第 8 档，第 1—2 档更松）、底部滚动条规则、点击判定、计分、页面接线与页面脚本。
// 用法：node tools/test-little-driver.cjs
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root = path.resolve(__dirname, '..')

function readModule(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
    .replace(/^import[\s\S]*?from\s*'[^']*';?/gm, '')
    .replace(/^export /gm, '')
}

const patrol = readModule('utils/car-patrol.uts')
const driver = readModule('utils/little-driver.uts')
const voiceSource = readModule('utils/little-driver-voice.uts')
const page = fs.readFileSync(path.join(root, 'pages/game/little-driver.uvue'), 'utf8')
const pageCode = page.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1]
  .replace(/^import[\s\S]*?from\s*'[^']*';?/gm, '')
  .replace(/^export /gm, '')

const EXPOSED = [
  'getPatrolConfig', 'makePatrolWave', 'patrolDepth', 'patrolY', 'patrolX', 'patrolRoadWidth', 'patrolOverlaps', 'patrolConeSize', 'patrolConeOpacity',
  'littleDriverConfig', 'littleDriverDemoConfig', 'stripKindOf', 'stripChildOf', 'stripImagePath', 'stripSeatedPath',
  'littleDriverScore', 'littleDriverProgress', 'littleDriverFinished', 'littleDriverCreate', 'littleDriverTapStrip',
  'littleDriverStepStrip', 'littleDriverRecordWave', 'littleDriverFinish', 'littleDriverSessionScore', 'STRIP_SPEED', 'STRIP_WRONG_PENALTY'
]
const ctx = { Math, Number, JSON, parseFloat, Array, Object, String, Set, console }
vm.createContext(ctx)
vm.runInContext(ts.transpile(patrol + '\n' + driver + '\nglobalThis.api = {' + EXPOSED.join(', ') + '}', { target: ts.ScriptTarget.ES2020 }), ctx)
const api = ctx.api

function seeded(seed) {
  let state = Math.floor(seed) % 2147483647
  if (state <= 0) state += 2147483646
  return () => { state = (state * 16807) % 2147483647; return (state - 1) / 2147483646 }
}
const STRIP = { width: 360, height: 78 }

// ---------- 难度映射：第 10 档 = 小车巡逻第 8 档；第 1—2 档更松 ----------
{
  const levels = []
  for (let level = 1; level <= 10; level++) levels.push(api.littleDriverConfig(level))
  const cp8 = api.getPatrolConfig(8)
  const top = levels[9]
  assert.equal(top.patrolLevel, 8, '第 10 档映射到小车巡逻第 8 档')
  assert.equal(top.lanes, cp8.lanes, '第 10 档车道数 = 小车巡逻第 8 档')
  assert.equal(top.travelMs, cp8.travelMs, '第 10 档路锥时间 = 小车巡逻第 8 档')
  assert.equal(top.gapMs, cp8.gapMs, '第 10 档波次间隔 = 小车巡逻第 8 档')
  assert.equal(top.waves, cp8.waves, '第 10 档波数 = 小车巡逻第 8 档')
  assert.equal(top.blocked, cp8.blocked, '第 10 档封路数 = 小车巡逻第 8 档')
  for (let level = 3; level <= 10; level++) {
    const mine = levels[level - 1]
    const same = api.getPatrolConfig(mine.patrolLevel)
    assert.equal(mine.travelMs, same.travelMs, '第 ' + level + ' 档路锥时间跟随映射档位')
    assert.equal(mine.lanes, same.lanes, '第 ' + level + ' 档车道数跟随映射档位')
  }
  const cp1 = api.getPatrolConfig(1)
  for (const level of [1, 2]) {
    const easy = levels[level - 1]
    assert.equal(easy.patrolLevel, 0, '第 ' + level + ' 档是「比小车巡逻最低档再降」')
    assert(easy.travelMs > cp1.travelMs, '第 ' + level + ' 档路锥比小车巡逻最低档更慢')
    assert(easy.gapMs > cp1.gapMs, '第 ' + level + ' 档波次间隔更长')
    assert(easy.waves < cp1.waves, '第 ' + level + ' 档波次更少')
    assert(easy.lanes <= cp1.lanes && easy.blocked <= cp1.blocked, '第 ' + level + ' 档车道/封路不高于最低档')
  }
  for (let level = 2; level <= 10; level++) {
    const previous = levels[level - 2], current = levels[level - 1]
    assert(current.travelMs <= previous.travelMs, '第 ' + level + ' 档路锥时间不增')
    assert(current.waves >= previous.waves, '第 ' + level + ' 档波数不减')
    assert(current.lanes >= previous.lanes, '第 ' + level + ' 档车道数不减')
    assert(current.stripSpeed == previous.stripSpeed, '滚动条速度全档一致（不靠提速加难）')
  }
  console.log('PASS: 难度映射（第 10 档 ≡ 小车巡逻第 8 档；第 1—2 档比最低档更慢更长更少；滚动条速度全档一致）')
}

// ---------- 素材与滚动条基本规则 ----------
{
  for (const child of ['yueyue', 'nuannuan']) {
    for (const kind of ['sit', 'lean']) {
      const file = api.stripImagePath(kind + '-' + child)
      assert(fs.existsSync(path.join(root, file)), '滚动条素材存在：' + file)
    }
    // 点对后翻成的是同一个小朋友的「端坐」图（提醒他坐好），不是结算页的拍手图
    const seated = api.stripSeatedPath('lean-' + child)
    assert(fs.existsSync(path.join(root, seated)), '点对后用的端坐图存在：' + seated)
    assert(seated == api.stripImagePath('sit-' + child), '点对后的正脸就是「端坐」图')
  }
  assert.equal(api.stripKindOf('lean-yueyue'), 'lean')
  assert.equal(api.stripKindOf('sit-nuannuan'), 'sit')
  assert.equal(api.stripChildOf('lean-nuannuan'), 'nuannuan')

  const config = api.littleDriverConfig(5)
  const rand = seeded(11)
  const field = api.littleDriverCreate(config, STRIP.width, STRIP.height, rand)
  assert.equal(field.images.length, 1, '开局先放第一张')
  assert.equal(field.images[0].x, STRIP.width + field.stripSize / 2, '第一张从右侧进入')
  // 匀速：位移 = 速度 × dt
  const before = field.images[0].x
  api.littleDriverStepStrip(field, 500, rand)
  assert(Math.abs((before - field.images[0].x) - config.stripSpeed * 0.5) < 1e-6, '横向匀速（速度 × 时间）')
  // 补位：上一张前进一个「图宽 + 间距」就补下一张，且不重叠
  let guard = 0
  while (field.images.length < 2 && guard < 400) { api.littleDriverStepStrip(field, 100, rand); guard += 1 }
  assert(field.images.length >= 2, '会持续补位成一条滚动带')
  const spacing = field.stripSize + field.stripGap
  assert(Math.abs((field.images[1].x - field.images[0].x) - spacing) < 1e-6, '相邻两张间距固定（新的在右侧、间隔 = 图宽 + 间距）')
  // 四种类别都会出现，且同一批里端坐/探头各两张
  const kinds = new Set()
  guard = 0
  while (kinds.size < 4 && guard < 4000) {
    for (const image of field.images) kinds.add(image.kind)
    api.littleDriverStepStrip(field, 50, rand)
    guard += 1
  }
  assert.equal(kinds.size, 4, '四种图（跃跃/暖暖 × 端坐/探头）都会出现：' + Array.from(kinds).join(','))
  const lean = field.images.filter((image) => api.stripKindOf(image.kind) == 'lean').length
  const sit = field.images.filter((image) => api.stripKindOf(image.kind) == 'sit').length
  assert(lean >= 1 && sit >= 1, '滚动带上端坐与探头混合出现（实际 ' + lean + '/' + sit + '）')
  console.log('PASS: 素材与滚动条（4 张滚动图存在、点对翻成同一位小朋友的端坐图、固定速度、固定间距、四类都会出现）')
}

// ---------- 点击判定与漏掉 ----------
{
  const config = api.littleDriverConfig(3)
  const rand = seeded(7)
  const field = api.littleDriverCreate(config, STRIP.width, STRIP.height, rand)
  // 造出两种图，方便分别验证
  let guard = 0
  while (guard < 4000) {
    const hasLean = field.images.some((image) => api.stripKindOf(image.kind) == 'lean' && !image.tapped)
    const hasSit = field.images.some((image) => api.stripKindOf(image.kind) == 'sit' && !image.tapped)
    if (hasLean && hasSit) break
    api.littleDriverStepStrip(field, 40, rand)
    guard += 1
  }
  const leanImage = field.images.filter((image) => api.stripKindOf(image.kind) == 'lean' && !image.tapped)[0]
  const sitImage = field.images.filter((image) => api.stripKindOf(image.kind) == 'sit' && !image.tapped)[0]
  assert.equal(api.littleDriverTapStrip(field, leanImage.id), 'correct', '点探头图算做对')
  assert(leanImage.seated, '点对后翻成端坐图（提醒他坐好）')
  assert.equal(field.leanHit, 1, '命中计数')
  assert.equal(api.littleDriverTapStrip(field, leanImage.id), 'ignored', '同一张图不能重复点击')
  assert.equal(field.leanHit, 1, '重复点击不重复计分')
  assert.equal(api.littleDriverTapStrip(field, sitImage.id), 'wrong', '点端坐图算误点')
  assert(!sitImage.seated, '端坐图被误点时不会翻面')
  assert.equal(field.wrongTaps, 1, '误点计数')
  assert.equal(api.littleDriverTapStrip(field, sitImage.id), 'ignored', '误点后也不能再点')
  assert.equal(api.littleDriverTapStrip(field, 'nope'), 'ignored', '不存在的图忽略')

  // 漏掉：探头图飘出屏幕没点 → 计入总数（拿不到分）；端坐图飘出不计数
  const rand2 = seeded(23)
  const field2 = api.littleDriverCreate(config, STRIP.width, STRIP.height, rand2)
  let leanExited = false, sitExited = false
  guard = 0
  while ((!leanExited || !sitExited) && guard < 20000) {
    const events = api.littleDriverStepStrip(field2, 60, rand2)
    for (const event of events) if (event.kind == 'missed') leanExited = true
    sitExited = field2.leanTotal >= 0
    guard += 1
    if (field2.leanTotal >= 2) break
  }
  assert(field2.leanTotal >= 1, '探头图飘出会记为「应点而没点」：' + field2.leanTotal)
  assert.equal(field2.leanHit, 0, '没点就没有命中')
  assert.equal(field2.wrongTaps, 0, '飘出不会算误点')

  // 飘出后的图不能再点
  const rand3 = seeded(5)
  const field3 = api.littleDriverCreate(config, STRIP.width, STRIP.height, rand3)
  let gone = null
  guard = 0
  while (gone == null && guard < 20000) {
    const before = field3.images.slice()
    api.littleDriverStepStrip(field3, 60, rand3)
    const after = field3.images.map((image) => image.id)
    for (const image of before) if (after.indexOf(image.id) < 0) gone = image
    guard += 1
  }
  assert(gone != null, '会有图飘出滚动条')
  assert.equal(api.littleDriverTapStrip(field3, gone.id), 'ignored', '飘出的图不能再点')
  console.log('PASS: 点击判定（探头→端坐图+命中、端坐→误点、单次点击、飘出后忽略、漏掉计入应点数）')
}

// ---------- 计分口径 ----------
{
  assert.equal(api.littleDriverScore(6, 6, 0, 0, 0, 10), 100, '全躲过得满分')
  assert.equal(api.littleDriverScore(6, 6, 4, 4, 0, 10), 100, '躲过 + 点全探头 = 满分')
  assert.equal(api.littleDriverScore(3, 6, 0, 0, 0, 10), 50, '只躲一半 = 50')
  assert.equal(api.littleDriverScore(6, 6, 2, 4, 0, 10), Math.round(100 * 8 / 10), '比例口径：done/required')
  assert.equal(api.littleDriverScore(6, 6, 4, 4, 3, 10), 70, '误点每个扣 10')
  assert.equal(api.littleDriverScore(0, 0, 0, 0, 0, 10), 0, '没有分母时给 0 而不是崩')
  assert.equal(api.littleDriverScore(6, 6, 4, 4, 20, 10), 0, '扣到 0 为止')
  assert.equal(api.littleDriverScore(20, 6, 20, 4, 0, 10), 100, '比例封顶 100')
  // 波次与滚动条共同决定整局分
  const config = api.littleDriverConfig(1)
  const field = api.littleDriverCreate(config, STRIP.width, STRIP.height, seeded(3))
  api.littleDriverRecordWave(field, false)
  api.littleDriverRecordWave(field, true)
  assert.equal(field.laneDone, 1, '躲过记一次通过，撞上不记')
  assert.equal(field.laneTotal, config.waves, '分母是总波次')
  assert(api.littleDriverSessionScore(field) >= 0 && api.littleDriverSessionScore(field) <= 100, '整局分在 0—100')
  assert.equal(api.littleDriverProgress(field) > 0, true, '进度按通过波次推进')
  api.littleDriverFinish(field)
  assert(api.littleDriverFinished(field), '结束时置为完成')
  console.log('PASS: 计分口径（完成比例 + 误点惩罚、封顶 100、漏掉拿不到分）')
}

// ---------- 训练开始的语音 ----------
{
  const voice = fs.readFileSync(path.join(root, 'utils/little-driver-voice.uts'), 'utf8')
    .replace(/^import[\s\S]*?from\s*'[^']*';?/gm, '').replace(/^export /gm, '')
  const voiceCtx = { Math, JSON, console }
  vm.createContext(voiceCtx)
  vm.runInContext(ts.transpile(voice + '\nglobalThis.v = { LITTLE_DRIVER_VOICE_IDS, LITTLE_DRIVER_VOICE_FILES, LITTLE_DRIVER_VOICE_TEXTS, LITTLE_DRIVER_VOICE_MS }', { target: ts.ScriptTarget.ES2020 }), voiceCtx)
  const v = voiceCtx.v
  assert.deepEqual(Array.from(v.LITTLE_DRIVER_VOICE_IDS), ['safety-intro'], '一条训练开始语音')
  assert.equal(v.LITTLE_DRIVER_VOICE_FILES.length, v.LITTLE_DRIVER_VOICE_MS.length, '语音清单一一对应')
  assert(fs.existsSync(path.join(root, v.LITTLE_DRIVER_VOICE_FILES[0])), '语音文件存在：' + v.LITTLE_DRIVER_VOICE_FILES[0])
  assert(v.LITTLE_DRIVER_VOICE_MS[0] > 1000 && v.LITTLE_DRIVER_VOICE_MS[0] < 12000, '语音时长合理：' + v.LITTLE_DRIVER_VOICE_MS[0])
  const text = v.LITTLE_DRIVER_VOICE_TEXTS[0]
  assert(text.indexOf('跃跃') >= 0 && text.indexOf('暖暖') >= 0, '语音点名两位小朋友：' + text)
  assert(text.indexOf('伸出车窗') >= 0 && text.indexOf('坐好') >= 0, '语音说明探头危险 + 让他坐好：' + text)
  console.log('PASS: 训练开始语音（1 句已生成、点名跃跃/暖暖、说明探头危险并让他坐好）')
}

// ---------- 页面接线（静态） ----------
{
  assert(page.indexOf('car-patrol-town-v1.webp') >= 0, '沿用小车巡逻的城镇背景')
  assert(page.indexOf('cone-v1.svg') >= 0 && page.indexOf('car-rear-v1.webp') >= 0, '路锥与小车素材沿用')
  assert(page.indexOf('ld-lane-buttons') >= 0, '有换道按钮')
  assert(page.indexOf('ld-strip') >= 0 && page.indexOf('ld-strip-track') >= 0, '底部有滚动条')
  assert(page.indexOf('点探头的小伙伴，让他坐好') >= 0, '滚动条简短安全提示')
  assert(page.indexOf('换车道 · 点探头的小朋友') >= 0, '简化试玩说明')
  assert(page.indexOf('LITTLE_DRIVER_VOICE_FILES') >= 0 && page.indexOf('playIntro') >= 0, '训练开始时播报玩法语音')
  assert(page.indexOf('stripImagePath') >= 0 && page.indexOf('stripSeatedPath') >= 0, '点对后换成端坐图')
  assert(page.indexOf('stripPraisePath') < 0, '不再用结算页的拍手图')
  assert(page.indexOf('ld-mark-good') >= 0 && page.indexOf('ld-mark-bad') >= 0, '打勾/打叉标记')
  assert(page.indexOf('setInterval(() => tick(), 33)') >= 0, '固定 33ms 步进')
  assert(page.indexOf('{{ scoredWaves }} / {{ laneTotal }}') >= 0, '顶部按已结算波次显示进度')
  assert(page.indexOf('通过 {{ laneDone }}') < 0, '不再用「通过」当进度计数')
  assert(page.indexOf('if (scoredWaves.value >= config.waves) finish()') >= 0, '收尾按已结算波次，与顶部计数一致')
  assert(page.indexOf('laneDone.value >= config.waves') < 0, '不得再按「躲过的波次」收尾')
  assert(page.indexOf('littleDriverDemoConfig') >= 0, '带试玩')
  const style = page.match(/<style>([\s\S]*?)<\/style>/)[1]
  const descendant = style.match(/\.\w[\w-]*\s+\.\w[\w-]*\s*\{/)
  assert(descendant == null, '页面样式不得用层级/后代选择器（Android）：' + (descendant == null ? '' : descendant[0]))
  const minHeights = style.match(/min-height:\s*[^;]+;/g) || []
  assert(minHeights.every((item) => item.indexOf('%') < 0), 'min-height 不得用百分比：' + minHeights.join(' '))
  const catalog = fs.readFileSync(path.join(root, 'utils/catalog.uts'), 'utf8')
  assert(catalog.includes("{ id: 'little-driver', dimensionId: 'divided', name: '一心二用小司机'"), 'catalog 条目保留')
  assert(catalog.includes("summary: '一边躲路锥，一边看住车窗外'"), 'catalog 摘要已更新为新玩法')
  assert(catalog.includes("if (gameId == 'light-tracking') {"), 'little-driver 不再走 motion-challenge 路由')
  // pages.json 解析失败要显式报错，而不是丢一个难懂的 SyntaxError。
  let pagesData = null
  try { pagesData = JSON.parse(fs.readFileSync(path.join(root, 'pages.json'), 'utf8')) }
  catch (error) { assert.fail('pages.json 解析失败：' + error.message) }
  const pages = pagesData.pages.map((entry) => entry.path)
  assert(pages.includes('pages/game/little-driver'), 'pages.json 已注册新页面')
  console.log('PASS: 页面接线（背景/路锥/换道/底部滚动条/安全提示/点对→端坐图/✓✕/33ms/试玩/训练开始语音/「经过」计数与收尾口径一致；catalog 与路由已切到独立页面）')
}

// ---------- 页面脚本整局（vm 驱动） ----------
// 场景一：每帧都换到安全车道（全躲过）→ 满分收尾。
// 场景二：一直不换道（必然撞锥）→ 也必须跑完所有波次并收尾 ——
//         回归的就是「后半段没有路障」：结束条件若按「躲过的波次」算，撞过锥的孩子永远等不到收尾，
//         而路障数量已经派完，后半段就空了。
function pageHarness() {
  const names = ['level', 'state', 'stripFeedback', 'stripViews', 'dashes', 'posts', 'cones', 'carLeft', 'carSize', 'targetLane', 'bumping', 'laneDone', 'leanHit', 'wrongTaps', 'laneCount', 'laneTotal', 'scoredWaves', 'begin', 'startDemo', 'tapStrip', 'moveTo', 'tick', 'waves']
  let now = 10000, id = 0, url = '', ready, load
  const played = []
  const timers = new Map()
  const pageCtx = {
    Math, Number, JSON, console, Set,
    ref: (value) => ({ value: value }),
    computed: (getter) => ({ get value() { return getter() } }),
    nextTick: (callback) => { callback() },
    onLoad: (callback) => { load = callback },
    onReady: (callback) => { ready = callback },
    onUnload: () => {},
    onResize: () => {},
    getGameDifficulty: () => 4,
    scoreQuery: (scores) => '&scoreVersion=goal-v2&roundScores=' + scores.join(','),
    Date: { now: () => now },
    setTimeout: (callback, ms) => { timers.set(++id, { callback: callback, at: now + ms }); return id },
    clearTimeout: (index) => { timers.delete(index) },
    uni: {
      getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, statusBarHeight: 47, pixelRatio: 3 }),
      getElementById: (elementId) => ({ getBoundingClientRect: () => elementId == 'ld-strip-track' ? { width: 360, height: 78 } : { width: 360, height: 420 } }),
      createInnerAudioContext: () => {
        const audio = { src: '', play: () => { played.push(audio.src) }, stop() {}, pause() {}, onPlay() {}, onEnded() {}, offPlay() {}, destroy() {} }
        return audio
      },
      redirectTo: (options) => { url = options.url },
      getStorageSync: () => '', setStorageSync() {}, removeStorageSync() {}, showToast() {}
    }
  }
  vm.createContext(pageCtx)
  require('./training-test-env.cjs').install(pageCtx)
  const liveNames = names.filter((name) => name != 'waves')
  vm.runInContext(ts.transpile(patrol + '\n' + driver + '\n' + voiceSource + '\n' + pageCode + '\nglobalThis.page = {' + liveNames.join(', ') + ', get waves() { return waves }}', { target: ts.ScriptTarget.ES2020 }), pageCtx)
  const pageApi = pageCtx.page
  function tick(ms) {
    const end = now + ms
    for (let guard = 0; guard < 5000; guard++) {
      const due = [...timers].filter(([, task]) => task.at <= end).sort((left, right) => left[1].at - right[1].at)[0]
      if (!due) break
      timers.delete(due[0])
      now = due[1].at
      due[1].callback()
    }
    now = end
    pageApi.tick()
  }
  load()
  ready()
  return { pageApi: pageApi, tick: tick, played: played, urlOf: () => url }
}

{
  const harness = pageHarness()
  const pageApi = harness.pageApi
  assert.equal(pageApi.level.value, 4, '读难度档位')
  assert.equal(pageApi.state.value, 'ready', '进入页面不自动试玩')
  assert.equal(pageApi.stripViews.value.length, 0, '进入页面滚动条不启动')
  assert.equal(harness.played.length, 0, '未开始不播放语音')
  const readyX = pageApi.carLeft.value
  harness.tick(100)
  assert.equal(pageApi.carLeft.value, readyX, '准备状态车辆不移动')
  pageApi.startDemo()
  assert.equal(pageApi.state.value, 'demo', '自主点击才试玩')
  assert.equal(pageApi.carLeft.value, api.patrolX(0,2,1), '试玩初始车在左车道而非中线')
  pageApi.moveTo(1)
  assert.equal(pageApi.targetLane.value,1,'换道选中状态响应式更新')
  harness.tick(200)
  assert.equal(pageApi.carLeft.value,api.patrolX(1,2,1),'试玩车辆随换道按钮移动')
  assert(pageApi.stripViews.value.length >= 1, '试玩时滚动条已有图')
  assert(pageApi.stripViews.value[0].style.indexOf('px') > 0, '滚动图用像素定位')
  assert(pageApi.stripViews.value.every((view) => view.mark == ''), '初始没有标记')

  // 点一张探头图：翻成同一位小朋友的端坐图 + 打勾；再点一张端坐图：打叉
  let guard = 0, tappedLean = false, tappedSit = false
  while ((!tappedLean || !tappedSit) && guard < 4000) {
    for (const view of pageApi.stripViews.value) {
      if (view.mark != '') continue
      const isLean = view.path.indexOf('-car-window-') >= 0
      if (isLean && !tappedLean) {
        pageApi.tapStrip(view.id)
        const after = pageApi.stripViews.value.filter((item) => item.id == view.id)[0]
        if (after != null) {
          assert(after.path.indexOf('-seatbelt-') >= 0, '点对后换成同一位小朋友的端坐图：' + after.path)
          assert.equal(after.mark, 'good', '点对后打勾')
        }
        tappedLean = true
      } else if (!isLean && !tappedSit) {
        pageApi.tapStrip(view.id)
        const after = pageApi.stripViews.value.filter((item) => item.id == view.id)[0]
        if (after != null) assert.equal(after.mark, 'bad', '点端坐图打叉')
        tappedSit = true
      }
    }
    harness.tick(60)
    guard += 1
  }
  assert(tappedLean && tappedSit, '试玩阶段能分别点到探头图与端坐图')
  assert(pageApi.leanHit.value >= 1 && pageApi.wrongTaps.value >= 1, '命中与误点都计入')
  assert(pageApi.stripFeedback.value != '', '点按后有文字反馈：' + pageApi.stripFeedback.value)
  assert(pageApi.state.value != 'finished' && harness.urlOf() == '', '试玩不跳结算')

  // 正式训练：一路躲对
  pageApi.begin()
  assert(pageApi.state.value == 'running', '开始正式训练')
  assert(harness.played.length >= 1 && harness.played[harness.played.length - 1] == '/static/audio/little-driver/safety-intro.mp3', '训练开始即播报玩法语音：' + harness.played.join(','))
  assert.equal(pageApi.laneTotal.value, api.littleDriverConfig(4).waves, '波数按档位')
  assert.equal(pageApi.laneCount.value, api.littleDriverConfig(4).lanes, '车道数按档位')
  guard = 0
  while (harness.urlOf() == '' && guard < 6000) {
    let earliest = null
    for (const wave of pageApi.waves) {
      if (wave.scored) continue
      if (earliest == null || wave.bornAt < earliest.bornAt) earliest = wave
    }
    if (earliest != null) pageApi.moveTo(earliest.safeLane)
    harness.tick(120)
    guard += 1
  }
  assert(harness.urlOf().indexOf('gameId=little-driver') >= 0 && harness.urlOf().indexOf('dimensionId=divided') >= 0, '结算跳转参数：' + harness.urlOf())
  const dodgeScore = Number(harness.urlOf().split('&score=')[1].split('&')[0])
  assert(dodgeScore >= 0 && dodgeScore <= 100, '整局分在 0—100（实际 ' + dodgeScore + '）')
  assert(harness.urlOf().indexOf('&scoreVersion=goal-v2') > 0, '带 goal-v2 单元素分数，避免结果页平均后失真')
  assert.equal(pageApi.laneDone.value, pageApi.laneTotal.value, '一路躲对应全通过')
  assert.equal(pageApi.scoredWaves.value, api.littleDriverConfig(4).waves, '全部波次都结算过')
  console.log('PASS: 页面脚本·一路躲对（试玩→点探头→端坐图+✓、开始播语音、全通过、整局结算 0—100）')
}

{
  // 场景二：一直不换道 → 必撞路锥。关键：后半段不能「没有路障」，也不能永远不结束。
  const harness = pageHarness()
  const pageApi = harness.pageApi
  const config = api.littleDriverConfig(4)
  pageApi.begin()
  let guard = 0
  let maxWaves = 0
  while (harness.urlOf() == '' && guard < 8000) {
    maxWaves = Math.max(maxWaves, pageApi.waves.length)
    harness.tick(120)
    guard += 1
  }
  assert(harness.urlOf() != '', '撞了路锥也必须能收尾（否则后半段就是空路面）')
  assert.equal(pageApi.scoredWaves.value, config.waves, '每一波都走到了结算（含撞到的）')
  assert(pageApi.laneDone.value < config.waves, '一直不换道不可能全通过（实际 ' + pageApi.laneDone.value + '/' + config.waves + '）')
  assert(maxWaves >= 2, '路障会持续出现（同时在场的波数峰值 ' + maxWaves + '）')
  const score = Number(harness.urlOf().split('&score=')[1].split('&')[0])
  assert(score < 100, '撞过路锥拿不到满分（实际 ' + score + '）')
  assert(score >= 0, '分数不为负')
  console.log('PASS: 页面脚本·一直不换道（撞锥也照常派满 ' + config.waves + ' 波并收尾、分数 <100，回归「后半段没有路障」）')
}

console.log('一心二用小司机回归通过：难度映射/滚动条规则/点击判定/计分/页面接线/页面脚本')
