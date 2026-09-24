// 红绿指令（循环车道）回归：难度参数、车道几何、灯态机、停车/闯灯判定、公平性（不卡点）、计分口径。
// 用法：node tools/test-red-green.cjs
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'utils/red-green.uts'), 'utf8').replace(/^export /gm, '')
const ctx = { Math, JSON, console }
vm.createContext(ctx)
vm.runInContext(ts.transpile(source + '\nglobalThis.api = { redGreenConfig, redGreenDeduction, redGreenScore, redGreenLayout, redGreenPointAt, redGreenSpots, redGreenCreate, redGreenSeededRand, redGreenSpeed, redGreenSafeZone, redGreenStep, redGreenPause, redGreenGo, redGreenFront, redGreenAheadLight, redGreenCrossed, redGreenBlocks, redGreenFinished }', { target: ts.ScriptTarget.ES2020 }), ctx)
const api = ctx.api
// 为测试方便：把「能不能进路口」的判定也暴露出来

let failures = 0
function check(ok, message) { if (!ok) { failures += 1; console.error('  ✗ ' + message) } }

const layout = api.redGreenLayout(390, 700, 26, 46)
const DT = 1 / 30

// ---------- 难度参数 ----------
{
  let prev = null
  for (let level = 1; level <= 10; level++) {
    const cfg = api.redGreenConfig(level)
    check(cfg.level == level, 'L' + level + ' level 字段')
    check(cfg.lights >= 2 && cfg.lights <= 5, 'L' + level + ' 灯数应在 2–5，实际 ' + cfg.lights)
    check(cfg.laps == 3, 'L' + level + ' 圈数固定 3')
    check(cfg.speedFactor == api.redGreenConfig(1).speedFactor, '车速应全档一致（不随难度提速）')
    check(cfg.countdown == 3, 'L' + level + ' 切换前倒数应为 3 秒')
    if (prev != null) {
      check(cfg.lights >= prev.lights, 'L' + level + ' 灯数不应减少')
      check(cfg.stopTolerance < prev.stopTolerance, 'L' + level + ' 停车容差应逐档收紧')
      check(cfg.startWindow < prev.startWindow, 'L' + level + ' 绿灯起步窗口应逐档缩短')
    }
    prev = cfg
  }
  check(api.redGreenConfig(1).lights == 2 && api.redGreenConfig(10).lights == 5, '灯数应从 2 增到 5')
  console.log('PASS: 难度参数（灯数 2→5、停车容差逐档收紧 0.55→0.15s、起步窗口 3.5→1.2s、车速全档一致、倒数固定 3s）')
}

// ---------- 车道几何 ----------
{
  const a = layout.straightA, b = layout.straightB, arc = layout.arc, r = layout.radius, inset = layout.inset
  const expected = 2 * a + 2 * b + 4 * arc
  check(Math.abs(layout.pathLength - expected) < 1e-6, '周长公式应为 2a+2b+4×弧长')
  const p0 = api.redGreenPointAt(layout, 0)
  check(Math.abs(p0.x - (inset + r)) < 1e-6 && Math.abs(p0.y - inset) < 1e-6, 's=0 应在上直道左端')
  // 采样整圈：点必须连续（相邻采样距离 ≈ 步长）
  const step = 3
  let prev = api.redGreenPointAt(layout, 0)
  let maxJump = 0
  for (let s = step; s <= layout.pathLength; s += step) {
    const point = api.redGreenPointAt(layout, s)
    const jump = Math.sqrt(Math.pow(point.x - prev.x, 2) + Math.pow(point.y - prev.y, 2))
    if (jump > maxJump) maxJump = jump
    prev = point
  }
  check(maxJump < step * 1.5, '整圈采样应连续，实际最大跳变 ' + maxJump.toFixed(1))
  const wrapA = api.redGreenPointAt(layout, 1)
  const wrapB = api.redGreenPointAt(layout, layout.pathLength + 1)
  check(Math.abs(wrapA.x - wrapB.x) < 1e-6 && Math.abs(wrapA.y - wrapB.y) < 1e-6, '周长应环绕闭合')
  // 灯位必须落在直道上（不在圆角里）：与四条直道的弧长区间对齐
  // 直道区间：上 [0, a]；右 [a+arc, a+arc+b]；下 [a+b+2arc, 2a+b+2arc]；左 [2a+b+3arc, 2a+2b+3arc]
  const straightRanges = [
    [0, a],
    [a + arc, a + arc + b],
    [a + b + 2 * arc, 2 * a + b + 2 * arc],
    [2 * a + b + 3 * arc, 2 * a + 2 * b + 3 * arc]
  ]
  for (const count of [2, 3, 4, 5]) {
    const spots = api.redGreenSpots(layout, count)
    check(spots.length == count, count + ' 盏灯应生成 ' + count + ' 个点位')
    for (const spot of spots) {
      const onStraight = straightRanges.some(range => spot.s > range[0] + 0.01 && spot.s < range[1] - 0.01)
      check(onStraight, '灯位 ' + spot.s.toFixed(1) + ' 应落在直道上（' + spot.edge + '）')
    }
  }
  // 灯间距：任何灯数下最近间距都不小于「周长 / 灯数」的一半；2 盏必须落在对开的两条边
  for (const count of [2, 3, 4, 5]) {
    const spots = api.redGreenSpots(layout, count)
    const p = layout.pathLength
    let minGap = p
    for (let i = 0; i < spots.length; i++) for (let k = i + 1; k < spots.length; k++) {
      let gap = Math.abs(spots[i].s - spots[k].s)
      if (gap > p / 2) gap = p - gap
      if (gap < minGap) minGap = gap
    }
    check(minGap >= p / count * 0.5, count + ' 盏灯的最近间距 ' + minGap.toFixed(0) + ' 应不小于周长/' + count + ' 的一半')
  }
  {
    const two = api.redGreenSpots(layout, 2)
    const opposite = (two[0].edge == 'top' && two[1].edge == 'bottom') || (two[0].edge == 'bottom' && two[1].edge == 'top') || (two[0].edge == 'left' && two[1].edge == 'right') || (two[0].edge == 'right' && two[1].edge == 'left')
    check(opposite, '2 盏灯应对开（左右或上下），实际 ' + two[0].edge + '/' + two[1].edge)
  }
  console.log('PASS: 车道几何（圆角矩形周长、整圈连续闭合、' + layout.pathLength.toFixed(0) + 'px、2–5 盏灯都落在直道上且间距不小于周长均分的一半、2 盏对开）')
}

// ---------- 灯态机 ----------
{
  const cfg = api.redGreenConfig(3)
  const state = api.redGreenCreate(cfg, layout, api.redGreenSeededRand(5))
  const seen = {}
  const phaseDurations = {}
  let last = state.lights[0].phase
  let elapsed = 0
  for (let i = 0; i < 30 / DT; i++) {
    for (const light of state.lights) seen[light.phase] = true
    api.redGreenStep(state, DT, cfg, layout)
    if (state.lights[0].phase != last) { phaseDurations[last] = elapsed; elapsed = 0; last = state.lights[0].phase }
    elapsed += DT
  }
  check(seen['green'] && seen['warnRed'] && seen['red'] && seen['warnGreen'], '一个周期内应出现四种灯态')
  check(Math.abs((phaseDurations['warnRed'] || 0) - cfg.countdown) < 0.2, '倒数转红时长应为 3 秒，实际 ' + (phaseDurations['warnRed'] || 0).toFixed(2))
  check(Math.abs((phaseDurations['warnGreen'] || 0) - cfg.countdown) < 0.2, '倒数转绿时长应为 3 秒，实际 ' + (phaseDurations['warnGreen'] || 0).toFixed(2))
  // 各灯相位应错开（不能同时变灯）
  const sameTimer = state.lights.every((light, i) => i == 0 || Math.abs(light.timer - state.lights[0].timer) < 0.05)
  check(!sameTimer, '各灯相位应错开，避免同时变灯')
  console.log('PASS: 灯态机（绿→倒数转红→红→倒数转绿，倒数 3 秒，多灯相位错开）')
}

// ---------- 公平性：转红时不会出现「来不及停又没过线」 ----------
{
  const safeBot = (level, seed) => {
    const cfg = api.redGreenConfig(level)
    const state = api.redGreenCreate(cfg, layout, api.redGreenSeededRand(seed * 97 + level * 13))
    const safe = api.redGreenSafeZone(cfg, layout)
    const p = layout.pathLength
    let razor = 0
    let steps = 0
    while (!api.redGreenFinished(state, cfg) && steps < 40000) {
      const front = api.redGreenFront(state, cfg, layout)
      const ahead = api.redGreenAheadLight(state, cfg, layout)
      if (ahead >= 0) {
        const light = state.lights[ahead]
        let gap = light.s - front
        if (gap < 0) gap += p
        const stopping = api.redGreenBlocks(light.phase)
        if (state.moving && stopping && gap <= safe) api.redGreenPause(state, cfg, layout)
        if (!state.moving && light.phase == 'green' && state.stoppedAt == ahead) api.redGreenGo(state, cfg)
      }
      const phases = state.lights.map(light => light.phase)
      const movingBefore = state.moving
      api.redGreenStep(state, DT, cfg, layout)
      state.lights.forEach((light, i) => {
        if (phases[i] == 'warnRed' && light.phase == 'red' && movingBefore) {
          let gap = light.s - front
          if (gap < 0) gap += p
          // 卡点 = 转红那一刻车还在冲突区内：离线不足一个安全区，或车身还没完全过线
          let after = (state.carS - light.s) % p
          if (after < 0) after += p
          if ((gap > 0 && gap < safe) || after < cfg.carLength / 2) razor += 1
        }
      })
      steps += 1
    }
    return { state, razor, steps, safe }
  }
  let razorTotal = 0
  for (let level = 1; level <= 10; level++) {
    for (let seed = 0; seed < 8; seed++) {
      const run = safeBot(level, seed)
      razorTotal += run.razor
      check(api.redGreenFinished(run.state, api.redGreenConfig(level)), 'L' + level + ' 应能在限定步数内跑完 3 圈')
      // 完美玩家（倒数亮起就停进安全区、绿灯立刻起步）零扣分
      check(run.state.deductions == 0, 'L' + level + ' 完美玩家不应被扣分，实际扣 ' + run.state.deductions + '（事件 ' + JSON.stringify(run.state.events) + '）')
      check(run.state.passed > 0, 'L' + level + ' 应有正常通过红灯的记录')
      // 车速恒定：用固定 dt 推进，圈速应稳定
      const laps = run.state.lap
      const expectedLapSeconds = layout.pathLength / api.redGreenSpeed(api.redGreenConfig(level), layout)
      check(expectedLapSeconds > 5 && expectedLapSeconds < 15, 'L' + level + ' 单圈时长应在 5–15 秒，实际 ' + expectedLapSeconds.toFixed(1))
      void laps
    }
  }
  check(razorTotal == 0, '转红瞬间不应出现「来不及停又没过线」的卡点，实际 ' + razorTotal + ' 次')
  console.log('PASS: 公平性（80 局完美玩家零扣分通关；转红瞬间卡点 0 次 —— 决策窗口内的转红会被顺延）')
}

// ---------- 判定规则 ----------
{
  const cfg = api.redGreenConfig(1)
  const safe = api.redGreenSafeZone(cfg, layout)
  const p = layout.pathLength

  // ① 路中间停车 = 非红灯停车（扣 6）
  {
    const state = api.redGreenCreate(cfg, layout, () => 0.5)
    // 找一段两边都没有红灯的位置
    for (const light of state.lights) { light.phase = 'green'; light.timer = cfg.green }
    state.carS = 0
    const events = api.redGreenPause(state, cfg, layout)
    check(events.length == 1 && events[0].kind == 'stopWrong', '绿灯时停车应判非红灯停车，实际 ' + JSON.stringify(events))
    check(state.deductions == api.redGreenDeduction('stopWrong'), '非红灯停车扣分')
  }
  // ② 红灯前停进安全区 = 正确停车（不扣分）
  {
    const state = api.redGreenCreate(cfg, layout, () => 0.5)
    const ahead = api.redGreenAheadLight(state, cfg, layout)
    state.lights[ahead].phase = 'red'
    state.lights[ahead].timer = cfg.red
    const target = state.lights[ahead].s - safe / 2
    state.carS = (target - cfg.carLength / 2 + p) % p
    const events = api.redGreenPause(state, cfg, layout)
    check(events.length == 1 && events[0].kind == 'stopGood', '红灯前停进安全区应判正确，实际 ' + JSON.stringify(events))
    check(state.deductions == 0, '正确停车不扣分')
    check(state.stoppedAt == ahead, '应记录停在哪盏灯前')
  }
  // ③ 停在红灯的线后 = 红灯停车过线（扣 8）
  {
    const state = api.redGreenCreate(cfg, layout, () => 0.5)
    const behind = 0
    state.lights[behind].phase = 'red'
    state.lights[behind].timer = cfg.red
    const target = state.lights[behind].s + safe * 0.6
    state.carS = (target - cfg.carLength / 2 + p) % p
    const events = api.redGreenPause(state, cfg, layout)
    check(events.length == 1 && events[0].kind == 'overLine', '红灯停在过线处应判过线，实际 ' + JSON.stringify(events))
    check(state.deductions == api.redGreenDeduction('overLine'), '过线停车扣分')
  }
  // ④ 闯红灯：以「整辆车完全过线」为准；过线停车只算过线，之后再开走才额外算闯红灯
  {
    const state = api.redGreenCreate(cfg, layout, () => 0.5)
    const light = state.lights[0]
    light.phase = 'red'
    light.timer = cfg.red * 5
    const runRed = api.redGreenDeduction('runRed')
    const wrong = api.redGreenDeduction('stopWrong')
    const overLine = api.redGreenDeduction('overLine')
    check(runRed == wrong * 2, '闯红灯应为非红灯停车的双倍扣分（' + runRed + ' vs ' + wrong + '）')
    // (a) 车头已过线、车尾还在线后：停下只判「红灯停车过线」，不判闯红灯
    state.carS = (light.s + 6) % p
    const stopEvents = api.redGreenPause(state, cfg, layout)
    check(stopEvents.length == 1 && stopEvents[0].kind == 'overLine', '车头过线后停车应判过线，实际 ' + JSON.stringify(stopEvents))
    check(state.deductions == overLine, '车头过线停车只扣过线分，实际 ' + state.deductions)
    let parkedHits = 0
    for (let i = 0; i < 60; i++) {
      for (const event of api.redGreenStep(state, DT, cfg, layout)) if (event.kind == 'runRed') parkedHits += 1
    }
    check(parkedHits == 0, '停着不动不应判闯红灯，实际 ' + parkedHits)
    // (b) 重新开出去 → 整辆车过线，追加一次闯红灯（两次扣分是允许的）
    api.redGreenGo(state, cfg)
    let runs = 0
    for (let i = 0; i < 60; i++) {
      for (const event of api.redGreenStep(state, DT, cfg, layout)) if (event.kind == 'runRed') runs += 1
    }
    check(runs == 1, '重新开出去应追加一次闯红灯，实际 ' + runs)
    check(state.deductions == overLine + runRed, '过线 + 闯红灯 共两次扣分，实际 ' + state.deductions)
    // (c) 闯红灯后这盏灯退出判定：之后停在路中应判非红灯停车，而不是重复判过线
    const ahead = api.redGreenAheadLight(state, cfg, layout)
    state.lights[ahead].phase = 'green'
    state.lights[ahead].timer = cfg.green
    const before = state.deductions
    api.redGreenPause(state, cfg, layout)
    check(state.deductions - before == wrong, '闯红灯后停在路中应判非红灯停车，实际 +' + (state.deductions - before))
    // (d) 同一圈同一盏灯只记一次闯红灯
    api.redGreenGo(state, cfg)
    let repeat = 0
    for (let i = 0; i < 30; i++) {
      for (const event of api.redGreenStep(state, DT, cfg, layout)) if (event.kind == 'runRed') repeat += 1
    }
    check(repeat == 0, '同一圈同一盏灯不应重复判闯红灯，实际 ' + repeat)
  }
  // ⑤ 绿灯超时未起步 = 非红灯停车（扣 6），每盏灯每个绿灯周期只记一次
  {
    // 先合法停在红灯前（倒数转红时停进安全区），再等它变绿
    const state = api.redGreenCreate(cfg, layout, () => 0.5)
    const ahead = api.redGreenAheadLight(state, cfg, layout)
    state.lights[ahead].phase = 'red'
    state.lights[ahead].timer = cfg.red
    const target = state.lights[ahead].s - safe / 2
    state.carS = (target - cfg.carLength / 2 + p) % p
    api.redGreenPause(state, cfg, layout)
    check(state.moving == false && state.stoppedAt == ahead, '应合法停在灯前等待')
    let timeouts = 0
    let sawGreen = false
    for (let i = 0; i < Math.ceil((cfg.countdown + cfg.red + cfg.countdown + cfg.startWindow + 1) / DT); i++) {
      if (state.lights[ahead].phase == 'green') sawGreen = true
      for (const event of api.redGreenStep(state, DT, cfg, layout)) if (event.kind == 'greenTimeout') timeouts += 1
    }
    check(sawGreen, '该灯应经过绿→倒数转红→红→倒数转绿→绿')
    check(timeouts == 1, '绿灯超时应只记一次，实际 ' + timeouts)
    check(state.deductions == api.redGreenDeduction('greenTimeout'), '绿灯超时按非红灯停车扣分')
    // 停在原地不动、且不在灯前：仍按前方最近那盏灯的绿灯超时扣分（不能靠停路中间躲过去）
    const state3 = api.redGreenCreate(cfg, layout, () => 0.5)
    // 先把所有灯设为绿灯（避免车后方恰好是红灯而被判“过线”），再单独把前方那盏设为倒数转红
    for (const light of state3.lights) { light.phase = 'green'; light.timer = cfg.green }
    const ahead3 = api.redGreenAheadLight(state3, cfg, layout)
    state3.lights[ahead3].phase = 'warnRed'
    state3.lights[ahead3].timer = cfg.countdown
    // 故意停在两盏灯之间的路中间（离前方灯还有 4 个安全区）
    state3.carS = (state3.lights[ahead3].s - safe * 4 - cfg.carLength / 2 + p) % p
    api.redGreenPause(state3, cfg, layout)
    check(state3.deductions == api.redGreenDeduction('stopWrong'), '停在路中间应先拿一次非红灯停车，实际 ' + state3.deductions)
    let roadTimeouts = 0
    for (let i = 0; i < Math.ceil((cfg.countdown + cfg.red + cfg.countdown + cfg.startWindow + 1) / DT); i++) {
      for (const event of api.redGreenStep(state3, DT, cfg, layout)) {
        if (event.kind == 'greenTimeout') { roadTimeouts += 1; check(event.light == ahead3, '超时应按前方最近那盏灯计，实际记在 ' + event.light) }
      }
    }
    check(roadTimeouts == 1, '停路中间也应触发绿灯超时一次，实际 ' + roadTimeouts)
    check(state3.deductions == api.redGreenDeduction('stopWrong') + api.redGreenDeduction('greenTimeout'), '停路中间的总扣分 = 非红灯停车 + 绿灯超时')
    // 持续不动时，下一个绿灯周期应再记一次
    let moreTimeouts = 0
    for (let i = 0; i < Math.ceil((cfg.green + cfg.red + cfg.countdown * 2 + cfg.startWindow + 1) / DT); i++) {
      for (const event of api.redGreenStep(state3, DT, cfg, layout)) if (event.kind == 'greenTimeout') moreTimeouts += 1
    }
    check(moreTimeouts == 1, '持续不动时，下一个绿灯周期应再记一次超时，实际 ' + moreTimeouts)
    // 窗口内起步则不扣分
    const state2 = api.redGreenCreate(cfg, layout, () => 0.5)
    const ahead2 = api.redGreenAheadLight(state2, cfg, layout)
    state2.lights[ahead2].phase = 'red'
    state2.lights[ahead2].timer = cfg.red
    state2.carS = (state2.lights[ahead2].s - safe / 2 - cfg.carLength / 2 + p) % p
    api.redGreenPause(state2, cfg, layout)
    let greenAt = -1
    // 该灯初始是红灯，绿灯要等 red + countdown 之后才亮。循环必须停在「绿灯亮起约 0.5 秒」处，
    // 才是本条断言想验证的「在起步窗口内出发」；原来多等了一个 countdown（绿灯后 4.0 秒），
    // 已经超出 3.5 秒窗口才起步，绿灯超时扣分是正确行为。
    for (let i = 0; i < Math.ceil((cfg.red + cfg.countdown + 0.5) / DT); i++) {
      api.redGreenStep(state2, DT, cfg, layout)
      if (greenAt < 0 && state2.lights[ahead2].phase == 'green') greenAt = i
      if (api.redGreenBlocks(state2.lights[ahead2].phase)) api.redGreenPause(state2, cfg, layout)
    }
    api.redGreenGo(state2, cfg)
    check(greenAt >= 0, '循环内该灯应已转绿，否则这条断言没有真正验证「窗口内起步」')
    check(state2.deductions == 0, '绿灯刚亮就起步不应扣分，实际 ' + state2.deductions)
  }
  // ⑥ 闪烁语义：绿灯闪烁（warnRed）仍算绿灯，可以过；红灯闪烁（warnGreen）仍算红灯，冲出去就是闯红灯
  {
    const s1 = api.redGreenCreate(cfg, layout, () => 0.5)
    const l1 = s1.lights[0]
    l1.phase = 'warnRed'
    l1.timer = cfg.countdown
    s1.carS = (l1.s - cfg.carLength - 10 + p) % p
    let runs1 = 0
    for (let i = 0; i < 60; i++) for (const event of api.redGreenStep(s1, DT, cfg, layout)) if (event.kind == 'runRed') runs1 += 1
    check(runs1 == 0, '绿灯闪烁期间通过不应算闯红灯，实际 ' + runs1)
    const s2 = api.redGreenCreate(cfg, layout, () => 0.5)
    const l2 = s2.lights[0]
    l2.phase = 'warnGreen'
    l2.timer = cfg.countdown
    s2.carS = (l2.s - cfg.carLength - 10 + p) % p
    let runs2 = 0
    for (let i = 0; i < 60; i++) for (const event of api.redGreenStep(s2, DT, cfg, layout)) if (event.kind == 'runRed') runs2 += 1
    check(runs2 == 1, '红灯闪烁期间冲出去应算闯红灯，实际 ' + runs2)
  }
  // ⑦ 绿灯闪烁（warnRed）时停下 = 有效停车，不扣分；但没停进安全区仍要扣
  {
    // 只留前方一盏灯处于「绿灯闪烁」，其余全绿，避免车后方恰好是红灯而被判过线
    const state = api.redGreenCreate(cfg, layout, () => 0.5)
    for (const light of state.lights) { light.phase = 'green'; light.timer = cfg.green }
    const ahead = api.redGreenAheadLight(state, cfg, layout)
    state.lights[ahead].phase = 'warnRed'
    state.lights[ahead].timer = cfg.countdown
    state.carS = (state.lights[ahead].s - safe / 2 - cfg.carLength / 2 + p) % p
    const events = api.redGreenPause(state, cfg, layout)
    check(events.length == 1 && events[0].kind == 'stopGood', '绿灯闪烁时停进安全区应算有效停车，实际 ' + JSON.stringify(events))
    check(state.deductions == 0, '绿灯闪烁时停进安全区不扣分，实际 ' + state.deductions)
    // 绿灯闪烁但停在安全区之外：仍然算非红灯停车（安全区外不算有效停车）
    const far = api.redGreenCreate(cfg, layout, () => 0.5)
    for (const light of far.lights) { light.phase = 'green'; light.timer = cfg.green }
    const aheadFar = api.redGreenAheadLight(far, cfg, layout)
    far.lights[aheadFar].phase = 'warnRed'
    far.lights[aheadFar].timer = cfg.countdown
    far.carS = (far.lights[aheadFar].s - safe * 3 - cfg.carLength / 2 + p) % p
    const farEvents = api.redGreenPause(far, cfg, layout)
    check(farEvents.length == 1 && farEvents[0].kind == 'stopWrong', '绿灯闪烁但没停进安全区仍应判非红灯停车，实际 ' + JSON.stringify(farEvents))
  }
  // ⑧ 车身跨在停车线上时转红要顺延：此时既停不进安全区、又还没完全过线，不能判闯红灯
  {
    const cfg3 = api.redGreenConfig(3)
    const state = api.redGreenCreate(cfg3, layout, () => 0.5)
    for (const light of state.lights) { light.phase = 'green'; light.timer = cfg3.green }
    const light = state.lights[0]
    // 车头刚过线 8px、车中心还在线后 9px：这是最容易漏判的冲突位 ——
    // (carS - lineS) mod p 此时会环绕到接近周长，旧实现会把「车身跨线」误判成「已完全过线」而不顺延，
    // 结果就是车尾在红灯下过线、白扣 12 分。
    state.carS = (light.s - 9 + p) % p
    light.phase = 'warnRed'
    light.timer = 0.01
    let runs = 0, passes = 0
    for (let i = 0; i < 30; i++) {
      for (const event of api.redGreenStep(state, DT, cfg3, layout)) {
        if (event.kind == 'runRed') runs += 1
        if (event.kind == 'pass') passes += 1
      }
    }
    check(runs == 0, '车身跨线时转红应顺延，不应判闯红灯，实际 ' + runs)
    check(passes >= 1, '顺延后应正常通过并记一次通过，实际 ' + passes)
    // 同一局里线前一个安全区内的转红同样要顺延（车头还没过线但已经进安全区）
    const s2 = api.redGreenCreate(cfg3, layout, () => 0.5)
    for (const light of s2.lights) { light.phase = 'green'; light.timer = cfg3.green }
    const l2 = s2.lights[0]
    const safe3 = api.redGreenSafeZone(cfg3, layout)
    s2.carS = (l2.s - safe3 / 2 - cfg3.carLength / 2 + p) % p
    l2.phase = 'warnRed'
    l2.timer = 0.01
    let runs2 = 0
    for (let i = 0; i < 30; i++) for (const event of api.redGreenStep(s2, DT, cfg3, layout)) if (event.kind == 'runRed') runs2 += 1
    check(runs2 == 0, '车头进入安全区时转红应顺延（玩家能停住），实际闯红灯 ' + runs2)
  }
  console.log('PASS: 判定规则（路中/非红灯停车 6、红灯过线停车 8、闯红灯 12 = 双倍且同圈不重复、绿灯超时按非红灯停车且窗口内起步不罚、闪烁语义、绿灯闪烁有效停车、跨线转红顺延）')
}

// ---------- 计分口径 ----------
{
  check(api.redGreenScore(0) == 100, '零扣分满分')
  check(api.redGreenScore(18) == 100, '扣 ≤20 仍记达标 100（对齐仓库「达标给满分」口径）')
  check(api.redGreenScore(24) == 76, '扣 24 记 76')
  check(api.redGreenScore(100) == 0, '扣满 0 分')
  check(api.redGreenScore(200) == 0, '不为负')
  console.log('PASS: 计分口径（扣 ≤20 记 100 达标，再多按实际扣分）')
}

if (failures > 0) { console.error(`红绿指令回归失败 ${failures} 项`); process.exit(1) }
console.log('红绿指令回归通过：难度参数/车道几何/灯态机/公平性/判定规则/计分口径')
