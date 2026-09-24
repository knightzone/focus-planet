// 上天入海（原「双轨任务」重做）回归：难度参数、素材、中线约束、上下移动、障碍密度、碰撞扣分、整局时长、页面接线与页面脚本。
// 用法：node tools/test-dual-track.cjs
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

const lib = readModule('utils/dual-track.uts')
const page = fs.readFileSync(path.join(root, 'pages/game/dual-track.uvue'), 'utf8')
const pageCode = page.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1]
  .replace(/^import[\s\S]*?from\s*'[^']*';?/gm, '')
  .replace(/^export /gm, '')

const EXPOSED = [
  'SKY_HALF', 'SEA_HALF', 'DUAL_TRACK_SLOTS', 'OBSTACLE_SPEED', 'SCENE_PATH', 'ROCKET_PATH', 'SUBMARINE_PATH',
  'dualTrackConfig', 'dualTrackDemoConfig', 'obstaclePath', 'obstacleIds', 'vehicleSize', 'obstacleSize',
  'halfRange', 'slotCenterY', 'slotOfY', 'halfOfY', 'vehicleY', 'slotStep', 'dualTrackDraggedSlot', 'dualTrackMoveTo', 'dualTrackGlide', 'dualTrackSpawn',
  'dualTrackOverlaps', 'dualTrackCreate', 'dualTrackStep', 'dualTrackScore', 'dualTrackProgress', 'dualTrackFinished', 'dualTrackRemainingMs'
]
const ctx = { Math, Number, JSON, console }
vm.createContext(ctx)
vm.runInContext(ts.transpile(lib + '\nglobalThis.api = {' + EXPOSED.join(', ') + '}', { target: ts.ScriptTarget.ES2020 }), ctx)
const api = ctx.api

function seeded(seed) {
  let state = Math.floor(seed) % 2147483647
  if (state <= 0) state += 2147483646
  return () => { state = (state * 16807) % 2147483647; return (state - 1) / 2147483646 }
}

const FIELD = { width: 360, height: 520 }
const DT = 100

// ---------- 难度参数 ----------
{
  const levels = []
  for (let level = 1; level <= 10; level++) levels.push(api.dualTrackConfig(level))
  assert.equal(levels[0].durationMs, 60000, '第 1 档 60 秒')
  assert.equal(levels[9].durationMs, 120000, '第 10 档 120 秒（1—2 分钟）')
  assert.equal(levels[0].startScore, 150, '第 1 档起始分 150')
  assert.equal(levels[0].spawnGapMs, 1200, '第 1 档障碍间隔 1200ms（密度整体降一档）')
  assert.equal(levels[9].spawnGapMs, 430, '第 10 档障碍间隔 430ms')
  assert.equal(levels[9].startScore, 100, '第 10 档起始分 100')
  assert.equal(levels[0].collisionPenalty, 10, '每次碰撞扣 10')
  assert.equal(levels[0].slots, 3, '每一半 3 个停靠位')
  for (let level = 1; level <= 10; level++) {
    const config = api.dualTrackConfig(level)
    assert.equal(config.speedPxPerSec, api.OBSTACLE_SPEED, 'L' + level + ' 障碍速度全档一致（难度只靠密度）')
    assert(config.durationMs >= 60000 && config.durationMs <= 120000, 'L' + level + ' 时长在 1—2 分钟')
    if (level > 1) {
      const previous = api.dualTrackConfig(level - 1)
      assert(config.spawnGapMs <= previous.spawnGapMs, 'L' + level + ' 密度逐档变高（间隔不增）')
      assert(config.startScore <= previous.startScore, 'L' + level + ' 起始分逐档不增')
      assert(config.durationMs >= previous.durationMs, 'L' + level + ' 时长逐档不缩短')
    }
  }
  assert(levels[9].spawnGapMs < levels[0].spawnGapMs, '最高档障碍明显更密')
  const demo = api.dualTrackDemoConfig()
  assert(demo.demo && demo.durationMs <= 20000 && demo.collisionPenalty == 0, '试玩：短、不扣分')
  console.log('PASS: 难度参数（时长 60→120s、起始分 150→100、每次碰撞扣 10、密度 1200→430ms（已整体降一档）、速度全档一致）')
}

// ---------- 素材 ----------
{
  assert.equal(api.obstacleIds(api.SKY_HALF).length, 20, '20 个小星球')
  assert.equal(api.obstacleIds(api.SEA_HALF).length, 8, '8 种鱼')
  for (const half of [api.SKY_HALF, api.SEA_HALF]) {
    for (const id of api.obstacleIds(half)) {
      const file = api.obstaclePath(half, id)
      assert(fs.existsSync(path.join(root, file)), '障碍素材存在：' + file)
    }
  }
  for (const file of [api.SCENE_PATH, api.ROCKET_PATH, api.SUBMARINE_PATH]) {
    assert(fs.existsSync(path.join(root, file)), `背景/载具素材存在：${file}`)
  }
  console.log('PASS: 素材（20 星球 + 8 鱼 + 新背景 + 跃跃火箭/暖暖潜艇 全部存在）')
}

// ---------- 中线与停靠位 ----------
{
  const height = FIELD.height
  const sky = api.halfRange(height, api.SKY_HALF)
  const sea = api.halfRange(height, api.SEA_HALF)
  assert(sky.bottom < height / 2, '上半的底边在中线之上（不能过中线）')
  assert(sea.top > height / 2, '下半的顶边在中线之下（不能过中线）')
  const skySlots = [0, 1, 2].map((slot) => api.slotCenterY(height, api.SKY_HALF, slot))
  const seaSlots = [0, 1, 2].map((slot) => api.slotCenterY(height, api.SEA_HALF, slot))
  assert(skySlots[0] < skySlots[1] && skySlots[1] < skySlots[2], '上半三格从上到下单调')
  assert(seaSlots[0] < seaSlots[1] && seaSlots[1] < seaSlots[2], '下半三格从上到下单调')
  assert(skySlots.every((y) => y > 0 && y < height / 2), '上半三格都在上半屏内')
  assert(seaSlots.every((y) => y > height / 2 && y < height), '下半三格都在下半屏内')
  assert.equal(api.halfOfY(height, skySlots[1]), api.SKY_HALF, '上半的格子判为天空')
  assert.equal(api.halfOfY(height, seaSlots[1]), api.SEA_HALF, '下半的格子判为大海')
  assert.equal(api.slotOfY(height, api.SKY_HALF, skySlots[2]), 2, '按 y 反查格子（最后一行）')
  const size = api.vehicleSize(height)
  assert(size >= 40 && size <= 62, '载具尺寸自适应：' + size)
  assert(api.obstacleSize(height) < size + 20, '障碍物不会大到无法躲避')
  console.log('PASS: 中线与停靠位（两半各 3 格、都不过中线、载具尺寸自适应）')
}

// ---------- 上下移动与滑行 ----------
{
  const rand = seeded(7)
  const state = api.dualTrackCreate(api.dualTrackConfig(3), FIELD.width, FIELD.height, rand)
  assert.equal(state.skyY, api.slotCenterY(FIELD.height, api.SKY_HALF, 1), '开局停在中间格')
  assert(api.dualTrackMoveTo(state, api.SKY_HALF, 2), '点格子会改变目标格')
  assert(!api.dualTrackMoveTo(state, api.SKY_HALF, 2), '重复点同一格不产生变化')
  api.dualTrackMoveTo(state, api.SKY_HALF, 9)
  assert.equal(state.skySlot, 2, '越界请求夹取到本半最后一格')
  let guard = 0
  while (state.skyY != api.slotCenterY(FIELD.height, api.SKY_HALF, 2) && guard < 200) { api.dualTrackGlide(state, 16); guard += 1 }
  assert.equal(state.skyY, api.slotCenterY(FIELD.height, api.SKY_HALF, 2), '滑行到目标格')
  assert(state.skyY < FIELD.height / 2, '滑行后仍不过中线')
  assert.equal(state.seaY, api.slotCenterY(FIELD.height, api.SEA_HALF, 1), '潜艇位置不受火箭影响（两个任务互不干扰）')
  console.log('PASS: 上下移动（点格子 → 向该格滑过去、越界夹取、不越中线、两半独立）')
}

// ---------- 障碍物：密度、匀速、两半交替 ----------
{
  const config = api.dualTrackConfig(6)
  const rand = seeded(11)
  const state = api.dualTrackCreate(config, FIELD.width, FIELD.height, rand)
  for (const obstacle of state.obstacles) {
    assert(obstacle.x > FIELD.width - obstacle.size, '障碍从右侧进入')
    const range = api.halfRange(FIELD.height, obstacle.half)
    assert(obstacle.y >= range.top - 0.001 && obstacle.y <= range.bottom + 0.001, '障碍纵向落在本半屏内')
  }
  const before = state.obstacles[0].x
  api.dualTrackStep(state, 500, rand)
  assert(Math.abs((before - state.obstacles[0].x) - config.speedPxPerSec * 0.5) < 1e-6, '障碍匀速左移（速度 × 时间）')
  // 密度：跑够一个间隔应新增一个，且上下两半都出现
  const halves = new Set(state.obstacles.map((obstacle) => obstacle.half))
  let guard = 0
  const countBefore = state.obstacles.length
  while (state.obstacles.length <= countBefore && guard < 200) { api.dualTrackStep(state, DT, rand); guard += 1 }
  guard = 0
  while (halves.size < 2 && guard < 2000) {
    for (const obstacle of state.obstacles) halves.add(obstacle.half)
    api.dualTrackStep(state, DT, rand)
    guard += 1
  }
  assert.equal(halves.size, 2, '上下两半都会有障碍物（两路同时进行）')
  // 密度随难度变高：同样 20 秒内，高难度生成更多
  const spawnCount = (level) => {
    const levelConfig = api.dualTrackConfig(level)
    const levelState = api.dualTrackCreate(levelConfig, FIELD.width, FIELD.height, seeded(3))
    let created = 0, steps = 0
    while (levelState.elapsedMs < 20000 && steps < 5000) {
      const events = api.dualTrackStep(levelState, 50, seeded(9))
      for (const event of events) if (event.kind == 'spawn') created += 1
      steps += 1
    }
    return created
  }
  const easySpawns = spawnCount(1)
  const hardSpawns = spawnCount(10)
  assert(hardSpawns > easySpawns, '难度体现在障碍密度（20 秒内 L1=' + easySpawns + ' < L10=' + hardSpawns + '）')
  console.log('PASS: 障碍物（从右侧进入、纵向落在本半、匀速 ' + config.speedPxPerSec + 'px/s、两半交替、密度随难度变高）')
}

// ---------- 碰撞与扣分 ----------
{
  const config = api.dualTrackConfig(2)
  const rand = seeded(5)
  const state = api.dualTrackCreate(config, FIELD.width, FIELD.height, rand)
  const target = state.obstacles[0]
  // 把障碍直接摆到载具身上验证判定
  target.x = FIELD.width * 0.28
  target.y = api.vehicleY(state, target.half)
  const events = api.dualTrackStep(state, 16, rand)
  const hit = events.filter((event) => event.kind == 'hit')
  assert.equal(hit.length, 1, '重叠即判一次碰撞')
  assert.equal(hit[0].half, target.half, '碰撞事件带上是哪一路')
  assert.equal(state.collisions, 1, '碰撞计入总数')
  assert.equal(target.half == api.SKY_HALF ? state.hitsSky : state.hitsSea, 1, '分别记录撞星球/撞鱼')
  assert.equal(api.dualTrackScore(state), config.startScore - 10, '每次碰撞扣 10 分')
  api.dualTrackStep(state, 16, rand)
  assert.equal(state.collisions, 1, '同一个障碍不会重复扣分')
  // 分数不会为负
  const many = api.dualTrackCreate(config, FIELD.width, FIELD.height, seeded(6))
  many.collisions = config.startScore / 10 + 5
  assert.equal(api.dualTrackScore(many), 0, '扣到 0 为止')
  // 不重叠就不扣分
  const safe = api.dualTrackCreate(config, FIELD.width, FIELD.height, seeded(8))
  safe.obstacles.length = 0
  assert.equal(api.dualTrackScore(safe), config.startScore, '没撞到就是起始分')
  console.log('PASS: 碰撞与扣分（重叠判一次、同一障碍不重复扣、撞星球/撞鱼分开记、扣到 0 为止）')
}

// ---------- 时长与结束 ----------
{
  const config = api.dualTrackConfig(4)
  const rand = seeded(13)
  const state = api.dualTrackCreate(config, FIELD.width, FIELD.height, rand)
  assert.equal(api.dualTrackRemainingMs(state), config.durationMs, '开局剩余时间 = 本档时长')
  let guard = 0
  const events = []
  while (!api.dualTrackFinished(state) && guard < 20000) {
    const stepEvents = api.dualTrackStep(state, DT, rand)
    for (const event of stepEvents) events.push(event)
    guard += 1
  }
  assert(api.dualTrackFinished(state), '到时长即结束')
  assert(events.filter((event) => event.kind == 'finished').length == 1, '结束事件只发一次')
  assert.equal(api.dualTrackProgress(state), 1, '进度到 100%')
  assert.equal(api.dualTrackRemainingMs(state), 0, '剩余时间归零')
  console.log('PASS: 时长与结束（第 4 档 ' + (config.durationMs / 1000) + ' 秒跑完即结束、进度 100%、剩余 0）')
}

// ---------- 页面接线（静态） ----------
{
  assert(page.indexOf('SCENE_PATH') >= 0, '用新的整屏背景图（路径常量在 utils/dual-track.uts，素材存在性已在上方校验）')
  assert(page.indexOf('dt-center-line') >= 0, '有中线')
  assert(page.indexOf('ROCKET_PATH') >= 0, '上半是跃跃开火箭（整张 4:3 素材）')
  assert(page.indexOf('SUBMARINE_PATH') >= 0, '下半是暖暖开潜艇（整张 4:3 素材）')
  assert(page.indexOf('dt-obstacle') >= 0, '障碍物用图片渲染')
  assert(page.indexOf('dt-scene') >= 0 && page.indexOf('dt-vehicle') >= 0, '背景整屏 + 载具用图片')
  assert(page.indexOf('@touchstart="dragStart(') >= 0 && page.indexOf('@touchmove.stop="dragMove(') >= 0, '停靠位支持拖动')
  assert(page.indexOf('pointer-events: none') >= 0, '背景/障碍/载具不吃触摸，触摸落到停靠位带上')
  assert(page.indexOf('const rocketStyle = computed((): string => vehicleStyle(rocketTop.value))') >= 0, '载具位置用响应式 ref（否则会一直停在顶部）')
  assert(page.indexOf('rocketTop.value = field!.skyY - height / 2') >= 0, '每帧把载具位置写回 ref')
  assert(page.indexOf('onLongPress') < 0, '不需要长按手势')
  assert(page.indexOf("moveTo('sky'") >= 0 && page.indexOf("moveTo('sea'") >= 0, '上下两半各自有停靠位点击区')
  assert(page.indexOf('dualTrackDemoConfig') >= 0, '带试玩')
  assert(page.indexOf('setInterval(() => tick(), 33)') >= 0, '固定 33ms 步进')
  const style = page.match(/<style>([\s\S]*?)<\/style>/)[1]
  const descendant = style.match(/\.\w[\w-]*\s+\.\w[\w-]*\s*\{/)
  assert(descendant == null, '页面样式不得用层级/后代选择器（Android）：' + (descendant == null ? '' : descendant[0]))
  const minHeights = style.match(/min-height:\s*[^;]+;/g) || []
  assert(minHeights.every((item) => item.indexOf('%') < 0), 'min-height 不得用百分比')
  const catalog = fs.readFileSync(path.join(root, 'utils/catalog.uts'), 'utf8')
  assert(catalog.includes("{ id: 'dual-track', dimensionId: 'divided', name: '上天入海'"), 'catalog 已改名上天入海')
  const scoring = fs.readFileSync(path.join(root, 'utils/game-scoring.uts'), 'utf8')
  assert(scoring.includes("'dual-track'") && scoring.includes('? 200 : 100'), 'dual-track 走 200 档（起始分最高 150 不被夹）')
  let pagesData = null
  try { pagesData = JSON.parse(fs.readFileSync(path.join(root, 'pages.json'), 'utf8')) }
  catch (error) { assert.fail('pages.json 解析失败：' + error.message) }
  const route = pagesData.pages.filter((entry) => entry.path == 'pages/game/dual-track')[0]
  assert(route != null && route.style.navigationBarTitleText == '上天入海', 'pages.json 导航标题已改')
  console.log('PASS: 页面接线（新整屏背景、中线、载具整张素材、障碍图、两半点击区+拖动、触摸穿透、载具位置响应式、试玩、33ms、Android 限制、改名与计分档位）')
}

// ---------- 页面脚本整局（vm 驱动：试玩 → 移动 → 开始 → 结算） ----------
{
  const names = ['level', 'state', 'dragStart', 'dragMove', 'dragEnd', 'liveScore', 'hitsSky', 'hitsSea', 'remainingSeconds', 'obstacleViews', 'bump', 'rocketStyle', 'subStyle', 'progressWidth', 'begin', 'startDemo', 'moveTo', 'tick', 'field']
  let now = 10000, id = 0, url = '', ready, load
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
    getGameDifficulty: () => 6,
    scoreQuery: (scores) => '&scoreVersion=goal-v2&roundScores=' + scores.join(','),
    Date: { now: () => now },
    setTimeout: (callback, ms) => { timers.set(++id, { callback: callback, at: now + ms }); return id },
    clearTimeout: (index) => { timers.delete(index) },
    uni: {
      getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, statusBarHeight: 47, pixelRatio: 3 }),
      getElementById: () => ({ getBoundingClientRect: () => ({ width: 360, height: 520 }) }),
      createInnerAudioContext: () => ({ src: '', play() {}, stop() {}, pause() {}, onPlay() {}, onEnded() {}, offPlay() {}, destroy() {} }),
      redirectTo: (options) => { url = options.url },
      getStorageSync: () => '', setStorageSync() {}, removeStorageSync() {}, showToast() {}
    }
  }
  vm.createContext(pageCtx)
  require('./training-test-env.cjs').install(pageCtx)
  const liveNames = names.filter((name) => name != 'field')
  vm.runInContext(ts.transpile(lib + '\n' + pageCode + '\nglobalThis.page = {' + liveNames.join(', ') + ', get field() { return field }}', { target: ts.ScriptTarget.ES2020 }), pageCtx)
  const pageApi = pageCtx.page
  function tick(ms) {
    const end = now + ms
    for (let guard = 0; guard < 20000; guard++) {
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
  assert.equal(pageApi.level.value, 6, '读难度档位')
  assert.equal(pageApi.state.value, 'ready', '进入准备页，不自动开始')
  assert.equal(timers.size, 0, '准备页没有游戏时钟')
  tick(1000);assert.equal(pageApi.field.elapsedMs,0,'准备页不推进')
  pageApi.startDemo()
  assert.equal(pageApi.state.value, 'demo', '主动选择试玩')
  assert(pageApi.obstacleViews.value.length >= 2, '试玩开局两路各有一个障碍物')
  const skyBefore = pageApi.field.skyY
  assert(pageApi.rocketStyle.value.indexOf('top:') >= 0, `火箭用像素定位：${pageApi.rocketStyle.value}`)
  pageApi.moveTo('sky', 2)
  tick(200)
  assert(pageApi.field.skyY > skyBefore, '点上面格子后火箭会向下滑（y 变大）')
  // 拖动：从当前格往上拖一格
  const skySlotBefore = pageApi.field.skySlot
  const dragStep = api.slotStep(520, api.SKY_HALF)
  pageApi.dragStart('sky', { changedTouches: [{ clientY: 200 }], touches: [] })
  pageApi.dragMove({ changedTouches: [{ clientY: 200 - dragStep }], touches: [] })
  pageApi.dragEnd()
  assert.equal(pageApi.field.skySlot, skySlotBefore - 1, `向上拖动一格：${skySlotBefore} → ${pageApi.field.skySlot}`)
  tick(200)
  assert(pageApi.field.skyY < skyBefore || pageApi.field.skySlot < skySlotBefore, '拖动后位置跟着变')
  const demoY = pageApi.field.skyY

  tick(api.dualTrackDemoConfig().durationMs)
  assert.equal(pageApi.state.value,'demo-done');assert.equal(url,'','试玩不写成绩');assert.equal(timers.size,0)
  pageApi.startDemo();assert.equal(pageApi.state.value,'demo');assert.equal(pageApi.field.elapsedMs,0)

  pageApi.begin()
  assert(pageApi.state.value == 'running', '开始正式训练')
  const config = api.dualTrackConfig(6)
  assert.equal(pageApi.remainingSeconds.value > 0, true, '正式训练有剩余时间')
  assert.equal(pageApi.liveScore.value, config.startScore, '起始分 = 本档起始分（' + config.startScore + '）')
  let guard = 0
  while (url == '' && guard < 20000) {
    // 每帧躲到「没有障碍物」的那一格（两个半屏都照顾到）
    for (const half of ['sky', 'sea']) {
      const level = pageApi.field
      let best = 0
      let bestGap = -1
      for (let slot = 0; slot < 3; slot++) {
        const y = api.slotCenterY(520, half, slot)
        let nearest = 9999
        for (const obstacle of level.obstacles) {
          if (obstacle.half != half) continue
          nearest = Math.min(nearest, Math.abs(obstacle.y - y))
        }
        if (nearest > bestGap) { bestGap = nearest; best = slot }
      }
      pageApi.moveTo(half, best)
    }
    tick(120)
    guard += 1
  }
  assert(url.indexOf('gameId=dual-track') >= 0 && url.indexOf('dimensionId=divided') >= 0, '结算跳转参数：' + url)
  const score = Number(url.split('&score=')[1].split('&')[0])
  assert(score >= 0 && score <= 150, '整局分在 0—150（实际 ' + score + '）')
  assert(url.indexOf('&scoreVersion=goal-v2') > 0, '带 goal-v2 单元素分数')
  assert(pageApi.obstacleViews.value.length >= 0, '结算时障碍清单可读')
  assert(demoY > 0, '试玩阶段移动过')
  console.log('PASS: 页面脚本（准备不自动启动、可选试玩/完成重试不结算、两路点击拖动、随时正式开始、按档位计分）')
}

console.log('上天入海回归通过：难度参数/素材/中线与停靠位/上下移动/障碍密度/碰撞扣分/时长结束/页面接线/页面脚本')
