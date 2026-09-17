// 规律小侦探生成回归：按 1–10 档难度阶梯设计（docs/PATTERN_FIND.md）验收。
// 覆盖：档位配置表、难度指标单调、素材相似度与近邻干扰项占比、唯一解、答案/问号位置分布、
// 同族配额与必出族、影子维度（9–10 档状态对必备）、相邻题答案不重复、素材路径存在、种子可复现、计分口径。
// 用法：node tools/test-pattern-find.cjs
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'utils/pattern-find-levels.uts'), 'utf8').replace(/^export /gm, '')
const ctx = { Math, JSON, console }
vm.createContext(ctx)
vm.runInContext(ts.transpile(source + '\nglobalThis.api = { generatePatternRounds, createSeededRand, patternRoundCount, patternLevelConfig, patternDifficultyIndex, patternFindScore }', { target: ts.ScriptTarget.ES2020 }), ctx)
const api = ctx.api

let failures = 0
function check(ok, message) {
  if (!ok) { failures += 1; console.error('  ✗ ' + message) }
}
function exists(filePath) { return fs.existsSync(path.join(root, filePath.replace(/^\//, ''))) }
function unique(list) { return new Set(list).size == list.length }
// 素材组：从路径反推（/illustrations/shadow-match/<group>/... 或 /sky-planets/...）
function groupOf(p) { const m = p.match(/shadow-match\/([^/]+)\//); return m ? m[1] : (p.includes('sky-planets') ? 'sky-planets' : '?') }
function baseId(id) { return id.endsWith("'") ? id.slice(0, -1) : id }

const SESSIONS = 400
const samples = {}
for (let level = 1; level <= 10; level++) {
  const list = []
  for (let s = 0; s < SESSIONS; s++) list.push(api.generatePatternRounds(level, api.createSeededRand(s * 7919 + level * 104729)))
  samples[level] = list
}

// ---------- 档位配置表 ----------
{
  const expected = {
    1: { tier: 1, families: 1, required: 0, near: 0, options: 3, task: 'FILL_END', phase: 'FIXED2', hint: 'BOX', shadow: 'NONE' },
    2: { tier: 1, families: 2, required: 0, near: 0, options: 3, task: 'FILL_END', phase: 'FIXED2', hint: 'BOX', shadow: 'NONE' },
    3: { tier: 1, families: 3, required: 0, near: 0, options: 3, task: 'FILL_END', phase: 'FIXED2', hint: 'TEXT', shadow: 'NONE' },
    4: { tier: 1, families: 4, required: 0, near: 0, options: 3, task: 'FILL_END', phase: 'FIXED2', hint: 'TEXT', shadow: 'NONE' },
    5: { tier: 2, families: 4, required: 0, near: 1, options: 3, task: 'FILL_END', phase: 'FIXED2', hint: 'TEXT', shadow: 'NONE' },
    6: { tier: 2, families: 4, required: 0, near: 1, options: 3, task: 'FILL_END', phase: 'RANDOM', hint: 'TEXT_ON_MISS', shadow: 'NONE' },
    7: { tier: 2, families: 5, required: 0, near: 1, options: 3, task: 'FILL_END', phase: 'RANDOM', hint: 'TEXT_ON_MISS', shadow: 'NONE' },
    8: { tier: 2, families: 5, required: 0, near: 1, options: 4, task: 'FILL_ANY', phase: 'RANDOM', hint: 'TEXT_ON_MISS', shadow: 'NONE' },
    9: { tier: 3, families: 6, required: 1, near: 2, options: 4, task: 'FILL_ANY', phase: 'RANDOM', hint: 'TEXT_ON_MISS', shadow: 'BIND' },
    10: { tier: 3, families: 8, required: 3, near: 3, options: 4, task: 'FILL_ANY', phase: 'RANDOM', hint: 'TEXT_ON_MISS', shadow: 'RULE' }
  }
  for (let level = 1; level <= 10; level++) {
    const cfg = api.patternLevelConfig(level)
    const want = expected[level]
    const tag = 'L' + level
    check(cfg.level == level, tag + ' level 字段')
    check(cfg.tier == want.tier, tag + ' 素材层级 ' + cfg.tier + ' != ' + want.tier)
    check(cfg.families.length == want.families, tag + ' 族池大小 ' + cfg.families.length + ' != ' + want.families)
    check(cfg.required.length == want.required, tag + ' 必出族数 ' + cfg.required.length + ' != ' + want.required)
    check(cfg.near == want.near, tag + ' 形近干扰项配额 ' + cfg.near + ' != ' + want.near)
    check(cfg.optionCount == want.options, tag + ' 选项数 ' + cfg.optionCount + ' != ' + want.options)
    check(cfg.task == want.task, tag + ' 任务类型 ' + cfg.task + ' != ' + want.task)
    check(cfg.phase == want.phase, tag + ' 问号相位 ' + cfg.phase + ' != ' + want.phase)
    check(cfg.hint == want.hint, tag + ' 提示强度 ' + cfg.hint + ' != ' + want.hint)
    check(cfg.shadow == want.shadow, tag + ' 影子维度 ' + cfg.shadow + ' != ' + want.shadow)
  }
  // 族池只增不减（低档族仍是高档族池的子集）
  for (let level = 2; level <= 10; level++) {
    const previous = api.patternLevelConfig(level - 1).families
    const current = api.patternLevelConfig(level).families
    for (const id of previous) check(current.indexOf(id) >= 0, 'L' + level + ' 族池应包含 L' + (level - 1) + ' 的 ' + id)
  }
  check(api.patternRoundCount(1) == 5 && api.patternRoundCount(10) == 5, '题量应全档固定 5 题')
  console.log('PASS: 档位配置表与设计一致（层级/族池/必出族/近邻配额/选项数/任务/相位/提示/影子），族池只增不减，题量固定 5')
}

// ---------- 难度指标单调 ----------
{
  const values = []
  for (let level = 1; level <= 10; level++) values.push(api.patternDifficultyIndex(level))
  for (let level = 1; level < 10; level++) {
    check(values[level] > values[level - 1], 'L' + (level + 1) + ' 难度指标 ' + values[level] + ' 应大于 L' + level + ' 的 ' + values[level - 1])
  }
  console.log('PASS: 难度指标严格递增 ' + values.map(v => v.toFixed(2)).join(' < '))
}

// ---------- 逐题结构 ----------
{
  const answerIndexCount = {}
  const shadowPairMissing = []
  const questionIndexSeen = {}
  for (let level = 1; level <= 10; level++) {
    const cfg = api.patternLevelConfig(level)
    const stats = { rounds: 0, nearHit: 0, newOnly: 0, nonFirstRounds: 0, nonFirstNewOnly: 0, maxCells: 0, answerShadow: 0, shadowCells: 0 }
    const familyCounts = {}
    for (let s = 0; s < SESSIONS; s++) {
      const rounds = samples[level][s]
      check(rounds.length == 5, 'L' + level + ' 一局应为 5 题，实际 ' + rounds.length)
      const perSession = {}
      let previousAnswer = ''
      for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i]
        const tag = 'L' + level + ' S' + s + ' R' + i
        stats.rounds += 1
        perSession[round.familyId] = (perSession[round.familyId] || 0) + 1
        familyCounts[round.familyId] = (familyCounts[round.familyId] || 0) + 1

        // 序列：恰好一个问号，格数在容量内，图片存在
        const blanks = round.cells.filter(c => c.path == '')
        check(blanks.length == 1, tag + ' 应恰好一个问号，实际 ' + blanks.length)
        check(round.answerIndex >= 0 && round.answerIndex < round.cells.length, tag + ' 问号下标越界')
        check(round.cells[round.answerIndex].path == '', tag + ' 问号下标未指向空位')
        check(round.cells.length <= 10 && round.cells.length >= 4, tag + ' 序列格数 ' + round.cells.length + ' 应在 4–10')
        stats.maxCells = Math.max(stats.maxCells, round.cells.length)
        for (const cell of round.cells) if (cell.path != '') check(exists(cell.path), tag + ' 图片缺失 ' + cell.path)
        if (round.cells.some(c => c.isShadow)) stats.shadowCells += 1
        if (round.answerIsShadow) stats.answerShadow += 1
        check(round.answerPath.endsWith('-shadow.webp') == round.answerIsShadow, tag + ' 答案路径与影子标记不一致：' + round.answerPath)
        check(round.answerId.endsWith("'") == round.answerIsShadow, tag + ' 答案 id 与影子标记不一致：' + round.answerId)

        // 选项：数量、唯一 id、恰好一个正确、图片存在
        check(round.options.length == cfg.optionCount, tag + ' 选项数 ' + round.options.length + ' != ' + cfg.optionCount)
        check(unique(round.options.map(o => o.id)), tag + ' 选项 id 重复')
        const correct = round.options.filter(o => o.id == round.answerId)
        check(correct.length == 1, tag + ' 正确选项数应为 1，实际 ' + correct.length)
        check(correct[0].path == round.answerPath, tag + ' 正确选项路径与答案不一致')
        for (const option of round.options) check(exists(option.path), tag + ' 选项图片缺失 ' + option.path)

        // 干扰项与答案不能是同一张图（A 与 A′ 视为不同图案，规则已明示）
        const distractors = round.options.filter(o => o.id != round.answerId)
        check(distractors.length == cfg.optionCount - 1, tag + ' 干扰项数量')
        for (const d of distractors) check(d.path != round.answerPath, tag + ' 干扰项与答案同图')

        // 形近项：同组近邻或答案的状态对
        const answerGroup = groupOf(round.answerPath)
        const hasNear = distractors.some(d => groupOf(d.path) == answerGroup && d.id != round.answerId)
        const hasStatePair = distractors.some(d => baseId(d.id) == baseId(round.answerId) && d.isShadow != round.answerIsShadow)
        if (level <= 4) {
          check(!hasNear, tag + ' 跨类别档不应出现同组近邻干扰项')
        } else if (level <= 8) {
          if (hasNear) stats.nearHit += 1
        } else {
          if (hasStatePair) stats.nearHit += 1
          if (!hasStatePair) shadowPairMissing.push(tag)
        }

        // 干扰项来源：非首题不应「全是没见过的图」
        const seenBefore = {}
        for (const cell of round.cells) if (cell.path != '') seenBefore[cell.path] = true
        for (const option of round.options) if (option.path != round.answerPath) { /* 本题选项不算已见，按设计只记前后题 */ }
        const allNew = distractors.every(d => !seenBefore[d.path] && (questionIndexSeen[d.path] === undefined))
        if (i > 0) {
          stats.nonFirstRounds += 1
          if (allNew) { stats.nonFirstNewOnly += 1; stats.newOnly += 1 }
        }
        // 记录已见（本题展示过的图案进入局内已见池，供后续题优先复用）
        for (const cell of round.cells) if (cell.path != '') questionIndexSeen[cell.path] = true
        void 0

        // 答案位置分布
        const at = round.options.findIndex(o => o.id == round.answerId)
        answerIndexCount[(level <= 7 ? 'three' : 'four') + ':' + at] = (answerIndexCount[(level <= 7 ? 'three' : 'four') + ':' + at] || 0) + 1

        // 相邻题答案不重复
        if (i > 0) check(round.answerId != previousAnswer, tag + ' 相邻两题答案重复')
        previousAnswer = round.answerId
      }
      // 同族配额
      const cap = Math.max(2, Math.ceil(5 / cfg.families.length))
      for (const id in perSession) check(perSession[id] <= cap, 'L' + level + ' S' + s + ' 族 ' + id + ' 出题 ' + perSession[id] + ' 超过配额 ' + cap)
      // 必出族
      for (const id of cfg.required) check(perSession[id] !== undefined, 'L' + level + ' S' + s + ' 缺少必出族 ' + id)
    }
    // 档位汇总
    if (level <= 4) {
      console.log('L' + level + ': 最大格数 ' + stats.maxCells + '，无同组近邻干扰项 ' + stats.rounds + ' 题')
    } else if (level <= 8) {
      const ratio = stats.nearHit / stats.rounds
      check(ratio >= 0.999, 'L' + level + ' 形近干扰项占比 ' + (ratio * 100).toFixed(1) + '% 应接近 100%')
      console.log('L' + level + ': 形近干扰项覆盖 ' + (ratio * 100).toFixed(1) + '%（' + stats.rounds + ' 题），最大格数 ' + stats.maxCells)
    } else {
      const ratio = stats.nearHit / stats.rounds
      check(ratio >= 0.999, 'L' + level + ' 状态对干扰项占比 ' + (ratio * 100).toFixed(1) + '% 应 100%')
      check(stats.shadowCells > 0, 'L' + level + ' 应出现含影子的题')
      console.log('L' + level + ': 状态对干扰项 ' + (ratio * 100).toFixed(1) + '%，含影子题 ' + stats.shadowCells + '/' + stats.rounds + '，答案是影子 ' + stats.answerShadow + ' 题，最大格数 ' + stats.maxCells)
    }
    // 非首题的干扰项应优先用序列内 / 局内已见图，而不是全新图。
    // 9–10 档的「答案状态对」本身必然是没展示过的新图（影子版），所以这里按设计的容差 ≤20% 判定。
    const newRatio = stats.nonFirstRounds == 0 ? 0 : stats.nonFirstNewOnly / stats.nonFirstRounds
    check(newRatio <= 0.2, 'L' + level + ' 有 ' + stats.nonFirstNewOnly + '/' + stats.nonFirstRounds + ' 道非首题干扰项全是新图（应 ≤20%）')
    if (newRatio > 0) console.log('     （L' + level + ' 非首题全用新图的比例 ' + (newRatio * 100).toFixed(2) + '%，在设计容差内）')
  }
  check(shadowPairMissing.length == 0, '9–10 档存在缺少状态对干扰项的题：' + shadowPairMissing.slice(0, 3).join(', '))
  // 答案位置分布
  for (const kind of ['three', 'four']) {
    const expected = kind == 'three' ? 1 / 3 : 1 / 4
    const tolerance = kind == 'three' ? 0.05 : 0.04
    for (let at = 0; at < (kind == 'three' ? 3 : 4); at++) {
      const got = (answerIndexCount[kind + ':' + at] || 0) / (SESSIONS * 5 * (kind == 'three' ? 7 : 3))
      check(Math.abs(got - expected) <= tolerance, kind + ' 答案位置 ' + at + ' 占比 ' + (got * 100).toFixed(1) + '% 偏离 ' + (expected * 100).toFixed(1) + '%')
    }
  }
  console.log('PASS: 逐题结构（唯一问号、格数 ≤10、选项唯一解、形近项配额、非首题不全用新图、答案位置均匀、相邻题答案不重复）')
}

// ---------- 素材相似度层级 ----------
{
  const tierGroups = { 1: {}, 2: {}, 3: {} }
  for (let level = 1; level <= 10; level++) {
    const tier = api.patternLevelConfig(level).tier
    for (let s = 0; s < 60; s++) {
      for (const round of samples[level][s]) {
        tierGroups[tier][groupOf(round.answerPath)] = true
      }
    }
  }
  // 跨类别档只能用 easy-* 组；同类别档用 medium 非 similar 组或星球；细节档用 similar 组
  for (const g in tierGroups[1]) check(g.startsWith('easy-'), 'S1 档出现非 easy 组素材：' + g)
  for (const g in tierGroups[2]) check(!g.startsWith('easy-') && !g.includes('similar') && g != 'hard-sea', 'S2 档出现不该用的组：' + g)
  for (const g in tierGroups[3]) check(g.includes('similar') || g == 'hard-sea', 'S3 档出现非相似组素材：' + g)
  console.log('PASS: 素材分层（S1 只用 easy 跨类别组；S2 用 medium 同类别组与星球；S3 用 similar/hard 细节组）')
}

// ---------- 计分口径 ----------
{
  check(api.patternFindScore(5, 5) == 100, '全对 100 分')
  check(api.patternFindScore(4, 5) == 100, '错 1 题仍达标 100 分（对应升档线 ≥80）')
  check(api.patternFindScore(3, 5) == 60, '错 2 题 60 分')
  check(api.patternFindScore(2, 5) == 40, '错 3 题 40 分（低于降档线 60）')
  check(api.patternFindScore(0, 5) == 0, '全错 0 分')
  console.log('PASS: 计分口径（5 题错 ≤1 达标 100；错 2 = 60；错 3 = 40 进入降档压力）')
}

// ---------- 种子可复现 ----------
{
  const a1 = JSON.stringify(api.generatePatternRounds(10, api.createSeededRand(2024)))
  const a2 = JSON.stringify(api.generatePatternRounds(10, api.createSeededRand(2024)))
  const b = JSON.stringify(api.generatePatternRounds(10, api.createSeededRand(2025)))
  check(a1 == a2, '同种子结果不一致')
  check(a1 != b, '异种子结果相同（概率极低，请换种子）')
  console.log('PASS: 同种子可复现、异种子有差异')
}

if (failures > 0) {
  console.error(`规律小侦探生成回归失败 ${failures} 项`)
  process.exit(1)
}
console.log('规律小侦探生成回归通过：档位配置/难度单调/逐题结构/素材分层/计分口径/种子可复现')
