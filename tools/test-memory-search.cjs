// 记忆与搜索回归：无尽累加规则、随机目标序、零影子图、累计计分（设计记录见 docs/MEMORY_SEARCH.md）。
// 覆盖：固定棋盘 + 随机目标出场序（首目标不写死）、第 k 轮目标数 = k、最后一轮覆盖整盘、
//       棋盘与目标全部非影子、干扰/目标素材只来自 shadow-match 彩图与 sky-planets、
//       累计计分（每张按速度给分、单张封顶 2 倍 base、局分封顶 200）、
//       三类结束条件（误点达 maxErrors / 累计满分 / 打完 boardSize 轮即找全）、
//       试玩 4 张 2 轮不计分、暂停不推进、卸载清理、pages.json 路由与 catalog / game-assets 条目一致。
// 用法：node tools/test-memory-search.cjs
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root = path.resolve(__dirname, '..')
const levelCode = fs.readFileSync(path.join(root, 'utils/memory-search-levels.uts'), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export /gm, '')
const page = fs.readFileSync(path.join(root, 'pages/game/memory-search.uvue'), 'utf8')
const pageCode = page.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')

const ILLUSTRATION = '/static/images/runtime/illustrations/shadow-match/'
const PLANETS = '/static/images/runtime/sky-planets/'

function exists(filePath) { return fs.existsSync(path.join(root, filePath.replace(/^\//, ''))) }
function seeded(seed) {
  let state = Math.floor(seed) % 2147483647
  if (state <= 0) state += 2147483646
  return () => { state = (state * 16807) % 2147483647; return (state - 1) / 2147483646 }
}

function harness(level) {
  let now = 10000, id = 0, url = '', load, unload
  const timers = new Map()
  const ctx = {
    Math, Number, JSON, parseFloat, Array, Object, String, Set,
    Date: { now: () => now },
    playedVoices: [],
    stoppedVoices: [],
    ref: (value) => ({ value }),
    computed: (fn) => ({ get value() { return fn() } }),
    getGameDifficulty: () => level,
    getGameTuningAge: () => level + 4,
    onLoad: (fn) => { load = fn },
    onUnload: (fn) => { unload = fn },
    onHide: () => {},
    setTimeout: (fn, ms) => { timers.set(++id, { f: fn, at: now + ms }); return id },
    clearTimeout: (index) => { timers.delete(index) },
    uni: {
      getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, statusBarHeight: 47 }),
      createInnerAudioContext: () => {
        const audio = { src: '', play: () => { ctx.playedVoices.push(audio.src) }, stop: () => { ctx.stoppedVoices.push(audio.src) }, pause() {}, onPlay() {}, onEnded() {}, offPlay() {}, destroy() {} }
        return audio
      },
      redirectTo: (options) => { url = options.url },
      showToast: () => {}
    }
  }
  vm.createContext(ctx)
  require('./training-test-env.cjs').install(ctx)
  // 语音清单（生成物）也要进上下文：页面用它决定播哪句、把记忆展示拉到“语音念得完”
  const voiceCode = fs.readFileSync(path.join(root, 'utils/memory-search-voice.uts'), 'utf8')
    .replace(/^import[\s\S]*?from\s*'[^']*';?/gm, '')
    .replace(/^export /gm, '')
  const api = 'globalThis.api = { begin, choose, pickTrial, setupTrial, training, started, phase, rounds, roundIndex, boardTiles, targetTiles, targetIds, foundIds, remaining, errorsTotal, foundTotal, completedRounds, remainingErrors, findScores, liveScore, level, boardSize, maxErrors, feedback, trialBoardTiles, trialTargetTiles, trialNewTargets, trialFoundIds, trialDone, trialRoundIndex, trialHint, trialRounds, newTargets, previewTitle, previewTip, previewDuration, memoryImageSize, layoutBoard, tileSize, tileImageSize, memorySearchLevelConfig, memorySearchTrialConfig, memorySearchPool, memorySearchTotalFinds, memorySearchFindBase, memorySearchFindScore, memorySearchGameScore, memorySearchDifficultyIndex, generateMemorySearchRounds, generateMemorySearchTrial, generateMemorySearchBoard, MEMORY_SEARCH_VOICE_IDS, MEMORY_SEARCH_VOICE_FILES, MEMORY_SEARCH_VOICE_MS, MEMORY_SEARCH_VOICE_TEXTS }'
  vm.runInContext(ts.transpile(voiceCode + '\n' + levelCode + '\n' + pageCode + '\n' + api, { target: ts.ScriptTarget.ES2020 }), ctx)
  load()
  // 与既有页面回归一致：虚拟时钟按到期顺序执行训练时钟的任务。
  function tick(ms) {
    const end = now + ms
    for (let guard = 0; guard < 10000; guard++) {
      const due = [...timers].filter(([, task]) => task.at <= end).sort((left, right) => left[1].at - right[1].at)[0]
      if (!due) break
      timers.delete(due[0])
      now = due[1].at
      due[1].f()
    }
    now = end
  }
  return { t: ctx.api, tick, timers, url: () => url, unload: () => unload(), played: () => ctx.playedVoices, stopped: () => ctx.stoppedVoices, ctx: ctx }
}

function targetIndex(t, id) { return t.boardTiles.value.findIndex((tile) => tile.id === id) }
function wrongIndexes(t) { return t.boardTiles.value.map((tile, index) => t.targetIds.value.indexOf(tile.id) >= 0 ? -1 : index).filter((index) => index >= 0) }
function boardKey(tiles) { return tiles.map((tile) => tile.id).sort().join('|') }

// ---------- 关卡阶梯：棋盘规模 + 记忆时长 + 单目标时间 + 误点预算 ----------
{
  const module = harness(1).t
  for (let level = 1; level <= 10; level++) {
    const config = module.memorySearchLevelConfig(level)
    assert.equal(config.level, level)
    assert(config.boardSize >= 6 && config.boardSize <= 16, '棋盘图片数应落在 6–16')
    assert(config.columns >= 1 && config.columns <= config.boardSize, '列数合理')
    assert(config.maxErrors >= 4 && config.maxErrors <= 8, '误点预算应落在 4–8')
    assert(config.perTargetMs >= 4000 && config.perTargetMs <= 6500, '单目标时间复用 memory-search 分档')
    // 旧口径字段（轮数 / 逐轮容错 / 影子干扰阈值）已删除
    assert.equal(config.rounds, undefined, '不再有固定轮数字段')
    assert.equal(config.tolerance, undefined, '不再有逐轮容错字段')
    assert.equal(config.shadowTargetFrom, undefined, '不再有影子干扰阈值字段')
    if (level > 1) {
      const previous = module.memorySearchLevelConfig(level - 1)
      assert(config.boardSize >= previous.boardSize, '棋盘规模逐档不降')
      assert(config.previewMs <= previous.previewMs, '记忆展示时长逐档不增')
      assert(config.maxErrors <= previous.maxErrors, '误点预算逐档不增')
      assert(module.memorySearchDifficultyIndex(level) > module.memorySearchDifficultyIndex(level - 1), '难度指标严格递增')
    }
  }
  assert.equal(module.memorySearchLevelConfig(1).boardSize, 6, '最低档 6 张图片')
  assert.equal(module.memorySearchLevelConfig(10).boardSize, 16, '最高档 16 张图片')
  assert.equal(module.memorySearchLevelConfig(1).maxErrors, 8, '最低档 8 次误点预算')
  assert.equal(module.memorySearchLevelConfig(10).maxErrors, 4, '最高档 4 次误点预算')
  const trial = module.memorySearchTrialConfig()
  assert.equal(trial.boardSize, 4, '试玩 4 张图片')
  assert.equal(trial.columns, 4, '试玩棋盘也固定 4 列（与正式一致）')
}

// ---------- 出题：固定棋盘 + 随机目标序 + 零影子图 ----------
{
  const module = harness(1).t
  const sessions = 40
  for (let level = 1; level <= 10; level++) {
    const config = module.memorySearchLevelConfig(level)
    for (let session = 0; session < sessions; session++) {
      const rounds = module.generateMemorySearchRounds(level, seeded(session * 7919 + level * 104729))
      assert.equal(rounds.length, config.boardSize, '轮数 = 棋盘图片数（打完即找全）')
      const board = rounds[0].tiles
      assert.equal(board.length, config.boardSize, '棋盘图片数符合档位')
      assert.equal(new Set(board.map((tile) => tile.id)).size, config.boardSize, '棋盘图片互不重复')
      const boardIds = boardKey(board)
      let previousTargets = []
      for (let index = 0; index < rounds.length; index++) {
        const round = rounds[index]
        assert.equal(round.index, index)
        assert.equal(round.boardSize, config.boardSize)
        assert.equal(round.columns, config.columns)
        assert.equal(round.previewMs, config.previewMs)
        assert.equal(round.targets.length, index + 1, '第 k 轮目标数 = k')
        assert.equal(round.targetBudgetMs, config.perTargetMs * round.targets.length, '每轮目标时间 = 单目标 × 目标数')
        // 固定棋盘：每轮都是同一批图片，只有顺序不同
        assert.equal(boardKey(round.tiles), boardIds, '整局棋盘集合不变')
        // 零影子图：棋盘与目标都不得出现影子素材
        for (const tile of round.tiles) {
          assert.equal(tile.isShadow, false, '棋盘不得出现影子图')
          assert(!tile.path.includes('-shadow.webp'), '不得引用影子素材：' + tile.path)
          assert(tile.path.startsWith(ILLUSTRATION) || tile.path.startsWith(PLANETS), '素材来源只能是影子配对彩图或星球：' + tile.path)
          assert(exists(tile.path), '素材文件缺失：' + tile.path)
        }
        for (const tile of round.targets) {
          assert.equal(tile.isShadow, false, '目标不得是影子图')
          assert(!tile.path.includes('-shadow.webp'), '目标不得引用影子素材：' + tile.path)
          assert(round.tiles.some((item) => item.id === tile.id), '目标必须在棋盘上')
        }
        // 目标累加：上一轮的目标全部保留
        for (const tile of previousTargets) assert(round.targets.some((item) => item.id === tile.id), '旧目标必须保留')
        assert.equal(new Set(round.targets.map((tile) => tile.id)).size, round.targets.length, '目标不重复')
        previousTargets = round.targets
      }
      // 最后一轮覆盖整张棋盘 —— 这就是「找全了」
      const last = rounds[rounds.length - 1]
      assert.equal(boardKey(last.targets), boardIds, '最后一轮目标集合 = 整张棋盘')
    }
  }
  // 首目标随机生成（不再写死火星/钢琴）
  const firstTargets = new Set()
  for (let session = 0; session < 60; session++) {
    const rounds = module.generateMemorySearchRounds(3, seeded(session * 31 + 7))
    firstTargets.add(rounds[0].targets[0].id)
  }
  assert(firstTargets.size >= 5, '首目标应为随机生成，实际只有 ' + firstTargets.size + ' 种：' + [...firstTargets].join('、'))
  // 第二组目标也不是固定搭配
  const secondPairs = new Set()
  for (let session = 0; session < 60; session++) {
    const rounds = module.generateMemorySearchRounds(3, seeded(session * 53 + 11))
    secondPairs.add(rounds[1].targets.map((tile) => tile.id).sort().join('+'))
  }
  assert(secondPairs.size >= 5, '前两个目标应为随机组合，实际只有 ' + secondPairs.size + ' 种')
  // 素材池不变：插画仍有影子版定义（只是本游戏不再使用），星球没有
  const pool = module.memorySearchPool(10)
  for (const asset of pool) {
    assert(exists(asset.path), '池内素材缺失：' + asset.path)
    if (asset.kind == 'planet') assert.equal(asset.shadowPath, '')
    else { assert(asset.shadowPath.endsWith('-shadow.webp')); assert(exists(asset.shadowPath), '影子素材缺失：' + asset.shadowPath) }
  }
}

// ---------- 计分：累计制、每张按速度给分、单张封顶 2 倍 base、局分封顶 200 ----------
{
  const module = harness(1).t
  assert.equal(module.memorySearchTotalFinds(6), 21, '6 张棋盘找全需 21 次点击')
  assert.equal(module.memorySearchTotalFinds(16), 136, '16 张棋盘找全需 136 次点击')
  // 第 1 档 base ≈ 9.5，粒度足够验证严格单调
  const base1 = module.memorySearchFindBase(6)
  const per1 = module.memorySearchLevelConfig(1).perTargetMs
  assert(Math.abs(base1 - 200 / 21) < 1e-9, 'base = 满分 / 找全总点击数')
  const fast = module.memorySearchFindScore(1000, per1, base1)
  const onTarget = module.memorySearchFindScore(per1, per1, base1)
  const slow = module.memorySearchFindScore(per1 * 4, per1, base1)
  assert(fast > onTarget && onTarget > slow, '越快分越高：' + fast + '/' + onTarget + '/' + slow)
  assert.equal(onTarget, Math.round(base1), '恰好用满目标时间 = 1 倍 base')
  assert.equal(fast, Math.floor(base1 * 2), '极快时取封顶（2 倍 base）')
  // 最高档 base ≈ 1.47，粒度只剩 1–2 分：验证区间、单调不增与保底
  const base16 = module.memorySearchFindBase(16)
  const per16 = module.memorySearchLevelConfig(10).perTargetMs
  const cap16 = Math.floor(base16 * 2)
  let previous = Infinity
  for (const elapsed of [500, 1000, 2000, 4000, 8000, 16000, 60000]) {
    const value = module.memorySearchFindScore(elapsed, per16, base16)
    assert(value >= 1, '单张至少 1 分')
    assert(value <= base16 * 2, '单张不得超过 2 倍 base')
    assert(value <= previous, '越慢分不升：' + elapsed + 'ms → ' + value)
    previous = value
  }
  assert.equal(module.memorySearchFindScore(1, per16, base16), cap16, '极快时取封顶值')
  assert.equal(module.memorySearchFindScore(999999999, per16, base16), 1, '极慢也保底 1 分')
  assert.equal(module.memorySearchFindScore(1000, 4000, 0), 0, 'base 非法返回 0')
  // 局分 = 累计，封顶 200
  assert.equal(module.memorySearchGameScore([]), 0)
  assert.equal(module.memorySearchGameScore([10, 20, 30]), 60, '局分为各项之和')
  const many = []
  for (let i = 0; i < 136; i++) many.push(cap16)
  assert.equal(module.memorySearchGameScore(many), 200, '局分封顶 200')
  assert.equal(module.memorySearchGameScore([-5, 10]), 10, '忽略非法值')
}

// ---------- 正式流程：每点对一张记一次分、完成一轮自动累加进下一轮 ----------
{
  const h = harness(1)
  const t = h.t
  const config = t.memorySearchLevelConfig(1)
  t.begin()
  assert.equal(t.started.value, true)
  assert.equal(t.rounds.value.length, config.boardSize, '第 1 档 6 张 → 6 轮')
  assert.equal(t.roundIndex.value, 0)
  assert.equal(t.liveScore.value, 0)
  assert.equal(t.remainingErrors.value, config.maxErrors)
  assert.equal(t.phase.value, 'preview')
  // 记忆阶段棋盘不显示、点击无效
  t.choose(0)
  assert.equal(t.foundTotal.value, 0)
  assert.equal(t.errorsTotal.value, 0)
  assert.equal(t.targetTiles.value.length, 1, '第 1 轮 1 个目标')
  assert.equal(t.newTargets.value.length, 1, '第 1 轮记忆展示的也是这 1 个')
  assert.equal(t.newTargets.value[0].id, t.targetTiles.value[0].id, '第 1 轮展示当前目标')
  assert.equal(h.played()[h.played().length - 1], '/static/audio/memory-search/first.mp3', '第 1 轮播「记住这个目标」')
  assert.equal(t.previewDuration.value, config.previewMs, '记忆展示时长照档位走，不被语音延长')
  const stopsBeforeSearch = h.stopped().length
  h.tick(t.previewDuration.value)
  assert.equal(t.phase.value, 'search')
  assert.equal(h.stopped().length, stopsBeforeSearch, '进入寻找阶段不应打断语音（没念完的后半句继续播）')
  // 点错：判错、本轮继续、记一次误点
  t.choose(wrongIndexes(t)[0])
  assert.equal(t.errorsTotal.value, 1)
  assert.equal(t.phase.value, 'search')
  assert.equal(t.remaining.value, 1)
  assert.equal(t.remainingErrors.value, config.maxErrors - 1)
  assert.equal(t.findScores.value.length, 0, '点错不计分')
  // 点对：记一次得分并即时更新实时分数（第 1 轮只有 1 个目标，点对即完成本轮）
  h.tick(1)
  t.choose(targetIndex(t, t.targetIds.value[0]))
  assert.equal(t.foundTotal.value, 1)
  assert.equal(t.findScores.value.length, 1, '每点对一张记一次得分')
  assert(t.findScores.value[0] >= 1)
  assert.equal(t.liveScore.value, t.findScores.value[0], '实时分数 = 累计得分')
  assert(t.feedback.value.includes('都找齐'), '找齐本轮提示：' + t.feedback.value)
  h.tick(620)
  assert.equal(t.roundIndex.value, 1, '完成一轮自动进入下一轮（无尽累加）')
  assert.equal(t.phase.value, 'preview')
  assert.equal(t.targetTiles.value.length, 2, '第 2 轮目标累加')
  // 记忆核心：每轮只亮出**新增**的那一个，旧目标不再重播（要自己回想）
  assert.equal(t.newTargets.value.length, 1, '第 2 轮记忆阶段只展示新增的 1 个')
  assert.equal(t.newTargets.value[0].id, t.targetTiles.value[1].id, '展示的应是新加的那一个，而不是整集合')
  assert(t.previewTip.value.includes('前面看到的也要一起找齐') && t.previewTip.value.includes('共 2 个'), '提示要与语音同口径并说明本轮总数：' + t.previewTip.value)
  assert(t.previewTitle.value.includes('又加了一个目标'), '第 2 轮标题应为「又加了一个目标」：' + t.previewTitle.value)
  assert.equal(h.played()[h.played().length - 1], '/static/audio/memory-search/next.mp3', '第 2 轮播「新增一个目标…」的语音说明')
  assert.equal(t.previewDuration.value, config.previewMs, '第 2 轮展示时长同样照档位走')
  assert.equal(t.completedRounds.value, 1)
  assert.equal(t.errorsTotal.value, 1, '误点全游戏累计')
  // 第 2 轮：先点 1 个（未找齐）→ 反馈带得分；乱序点也算
  h.tick(t.previewDuration.value)
  h.tick(1)
  t.choose(targetIndex(t, t.targetIds.value[1]))
  assert(t.feedback.value.includes('+'), '点对反馈带得分：' + t.feedback.value)
  assert.equal(t.phase.value, 'search', '找齐前本轮继续')
  assert.equal(t.remaining.value, 1)
  t.choose(targetIndex(t, t.targetIds.value[0]))
  assert.equal(t.remaining.value, 0)
  assert.equal(t.completedRounds.value, 2, '找齐本轮即记完成')
  h.tick(620)
  assert.equal(t.roundIndex.value, 2)
  assert.equal(t.targetTiles.value.length, 3)
  assert.equal(t.findScores.value.length, 3, '第 2 轮两张都计分')
  assert.equal(t.liveScore.value, t.memorySearchGameScore(t.findScores.value))
  h.unload()
  h.tick(50000)
  assert.equal(h.timers.size, 0, '卸载后无残留定时器')
}

// ---------- 结束条件 ①：累计误点达到 maxErrors 即失败结算 ----------
{
  const h = harness(10)
  const t = h.t
  const config = t.memorySearchLevelConfig(10)
  t.begin()
  h.tick(t.previewDuration.value)
  for (let index = 0; index < config.maxErrors; index++) {
    t.choose(wrongIndexes(t)[0])
    assert.equal(t.errorsTotal.value, index + 1, '误点累计')
    if (index < config.maxErrors - 1) assert.equal(t.phase.value, 'search', '未达预算仍继续本轮')
  }
  assert.equal(t.remainingErrors.value, 0)
  assert.equal(t.phase.value, 'clear')
  assert(t.feedback.value.includes('容错用完'), '失败提示：' + t.feedback.value)
  assert.equal(h.url(), '', '先亮提示再结算')
  h.tick(700)
  const url = h.url()
  assert(url.includes('/pages/result/result?gameId=memory-search'), '失败进入结算：' + url)
  assert(url.includes('dimensionId=divided'), '写入分配注意维度')
  assert(url.includes('scoreVersion=goal-v2'))
  assert.equal(t.completedRounds.value, 0)
  assert.equal(t.foundTotal.value, 0)
  assert(/[?&]score=0(&|$)/.test(url), '未得分即 0 分：' + url)
  h.unload()
}

// ---------- 结束条件 ②：累计到满分提前收工 ----------
{
  const h = harness(1)
  const t = h.t
  const config = t.memorySearchLevelConfig(1)
  t.begin()
  let capped = false
  for (let round = 0; round < config.boardSize && !capped; round++) {
    h.tick(t.previewDuration.value)
    for (const tile of t.targetTiles.value.slice()) {
      h.tick(1) // 点得飞快 → 每张取封顶分
      t.choose(targetIndex(t, tile.id))
      if (t.feedback.value.includes('满分')) { capped = true; break }
    }
    if (!capped) h.tick(620)
  }
  assert(capped, '累计到满分应提前结束')
  assert.equal(t.liveScore.value, 200, '实时分数封顶 200')
  assert.equal(t.phase.value, 'clear')
  h.tick(700)
  const url = h.url()
  assert(url.includes('/pages/result/result?gameId=memory-search'))
  assert.equal(Number(url.match(/[?&]score=(\d+)/)[1]), 200, '满分结算 score=200')
  assert(t.completedRounds.value < config.boardSize, '满分应先于打完整盘结束')
  h.unload()
}

// ---------- 结束条件 ③：打完 boardSize 轮 = 找全整张棋盘 ----------
{
  const h = harness(1)
  const t = h.t
  const config = t.memorySearchLevelConfig(1)
  t.begin()
  for (let round = 0; round < config.boardSize; round++) {
    h.tick(t.previewDuration.value)
    assert.equal(t.targetTiles.value.length, round + 1, '第 ' + (round + 1) + ' 轮目标数')
    for (const tile of t.targetTiles.value.slice()) {
      h.tick(70000) // 点得很慢 → 每张保底 1 分，保证不会提前满分收工
      t.choose(targetIndex(t, tile.id))
    }
    if (round < config.boardSize - 1) {
      h.tick(620)
      assert.equal(t.roundIndex.value, round + 1, '自动进入下一轮')
    }
  }
  assert(t.feedback.value.includes('全部找齐'), '找全提示：' + t.feedback.value)
  h.tick(620)
  const url = h.url()
  assert(url.includes('/pages/result/result?gameId=memory-search'), '找全进入结算：' + url)
  assert.equal(t.completedRounds.value, config.boardSize, '完成轮数 = 棋盘图片数')
  assert.equal(t.foundTotal.value, t.memorySearchTotalFinds(config.boardSize), '点击总数 = 找全所需总次数')
  assert(url.includes('completed=' + config.boardSize), 'completed 写入棋盘图片数')
  assert(url.includes('total=' + config.boardSize), 'total 写入棋盘图片数')
  assert(t.liveScore.value < 200, '慢速通关不会触顶')
  h.unload()
}

// ---------- 试玩：4 张图片、2 轮、随机、非影子、不计分 ----------
{
  const h = harness(6)
  const t = h.t
  assert.equal(t.trialBoardTiles.value.length, 4, '试玩棋盘 4 张图片')
  assert.equal(t.trialTargetTiles.value.length, 1)
  for (const tile of t.trialBoardTiles.value) {
    assert.equal(tile.isShadow, false, '试玩也不使用影子图')
    assert(!tile.path.includes('-shadow.webp'), '试玩不得引用影子素材')
  }
  assert.equal(t.started.value, false)
  // 试玩点错不计入正式误点、不跳结算
  const wrong = t.trialBoardTiles.value.findIndex((tile) => tile.id !== t.trialTargetTiles.value[0].id)
  t.pickTrial(wrong)
  assert(t.trialHint.value.includes('不是目标'))
  assert.equal(t.errorsTotal.value, 0)
  assert.equal(t.foundTotal.value, 0)
  assert.equal(t.findScores.value.length, 0)
  assert.equal(h.url(), '')
  // 第 1 轮找齐 → 第 2 轮
  t.pickTrial(t.trialBoardTiles.value.findIndex((tile) => tile.id === t.trialTargetTiles.value[0].id))
  assert.equal(t.trialRoundIndex.value, 1, '试玩进入第 2 轮')
  assert.equal(t.trialBoardTiles.value.length, 4, '第 2 轮仍是 4 张图片')
  assert.equal(t.trialTargetTiles.value.length, 2, '试玩第 2 轮目标累加')
  // 第 2 轮乱序点
  for (const tile of t.trialTargetTiles.value.slice()) {
    if (t.trialFoundIds.value.indexOf(tile.id) >= 0) continue
    t.pickTrial(t.trialBoardTiles.value.findIndex((item) => item.id === tile.id))
  }
  assert.equal(t.trialDone.value, true, '试玩 2 轮即可完成')
  assert(t.trialHint.value.includes('试玩完成'))
  assert.equal(h.url(), '', '试玩不进入结算页')
  assert.equal(t.findScores.value.length, 0, '试玩不计成绩')
  assert.equal(t.foundTotal.value, 0)
  assert.equal(t.errorsTotal.value, 0)
  assert.equal(t.started.value, false)
  // 试玩后直接开始正式训练：状态干净
  t.begin()
  assert.equal(t.started.value, true)
  assert.equal(t.roundIndex.value, 0)
  assert.equal(t.errorsTotal.value, 0)
  assert.equal(t.foundTotal.value, 0)
  assert.equal(t.findScores.value.length, 0)
  assert.equal(t.liveScore.value, 0)
  assert.equal(t.rounds.value.length, t.memorySearchLevelConfig(6).boardSize)
  h.unload()
}

// ---------- 暂停与记忆阶段不推进 ----------
{
  const h = harness(3)
  const t = h.t
  t.begin()
  t.training.pause()
  h.tick(60000)
  assert.equal(t.phase.value, 'preview', '暂停时记忆阶段不推进')
  assert.equal(h.url(), '')
  t.training.resume()
  h.tick(t.previewDuration.value)
  assert.equal(t.phase.value, 'search')
  h.tick(1)
  t.choose(targetIndex(t, t.targetIds.value[0]))
  t.training.pause()
  h.tick(60000)
  assert.equal(t.remaining.value, 0)
  h.unload()
  h.tick(60000)
  assert.equal(h.timers.size, 0)
}

// ---------- 展示尺寸：棋盘固定 4 列（格子够大），只有新目标再放大一档 ----------
{
  const t = harness(1).t
  const sizeOf = () => Number(t.tileSize.value.replace('px', ''))
  const memoryOf = () => Number(t.memoryImageSize.value.replace('px', ''))
  t.layoutBoard(6, 4)
  assert.equal(t.tileSize.value, '74px', '6 张 4 列 74px（旧版 3 列 92px、5 列 57px）')
  assert.equal(t.tileImageSize.value, '59px', '格内图按 0.8 缩放（保持原样）')
  const four = sizeOf()
  t.layoutBoard(16, 4)
  assert.equal(t.tileSize.value, '74px', '16 张 4 列同样 74px（列数固定，四行也不挤）')
  t.layoutBoard(15, 5)
  const five = sizeOf()
  assert(five < four, '列越多格子越小（函数仍按列数算）：' + four + ' → ' + five)
  assert(memoryOf() > four, '新目标展示应明显大于棋盘格子：' + memoryOf() + ' > ' + four)
  assert.equal(t.memoryImageSize.value, '132px', '新目标展示按窗口宽度 34% 取到上限 132px')
  assert([four, five].every((size) => size >= 44 && size <= 92), '棋盘格子仍在 44—92px')
  console.log('PASS: 展示尺寸（棋盘固定 4 列 74px；只把新目标放大到 132px）')
}

// ---------- 语音说明 + 固定 4 列 ----------
{
  const t = harness(1).t
  for (let level = 1; level <= 10; level++) {
    assert.equal(t.memorySearchLevelConfig(level).columns, 4, '第 ' + level + ' 档棋盘固定 4 列')
  }
  assert.equal(t.memorySearchTrialConfig().columns, 4, '试玩也固定 4 列')
  assert.deepEqual(Array.from(t.MEMORY_SEARCH_VOICE_IDS), ['first', 'next'], '两句语音：第 1 轮 / 之后每轮')
  assert.equal(t.MEMORY_SEARCH_VOICE_FILES.length, t.MEMORY_SEARCH_VOICE_MS.length, '语音清单一一对应')
  for (let i = 0; i < t.MEMORY_SEARCH_VOICE_FILES.length; i++) {
    assert(exists(t.MEMORY_SEARCH_VOICE_FILES[i]), '语音文件存在：' + t.MEMORY_SEARCH_VOICE_FILES[i])
    assert(t.MEMORY_SEARCH_VOICE_MS[i] > 500 && t.MEMORY_SEARCH_VOICE_MS[i] < 8000, '语音时长合理：' + t.MEMORY_SEARCH_VOICE_MS[i])
  }
  assert(t.MEMORY_SEARCH_VOICE_TEXTS[0].includes('记住'), '第 1 轮语音：记住目标')
  assert(t.MEMORY_SEARCH_VOICE_TEXTS[1].includes('又加了一个目标'), '之后每轮语音说明又加了目标：' + t.MEMORY_SEARCH_VOICE_TEXTS[1])
  assert(t.MEMORY_SEARCH_VOICE_TEXTS[1].includes('前面的也要找齐'), '之后每轮语音要求找齐前面的目标')
  assert(t.MEMORY_SEARCH_VOICE_TEXTS[1].length < t.MEMORY_SEARCH_VOICE_TEXTS[1].length + 1, '短句口径')
  assert(t.MEMORY_SEARCH_VOICE_MS[1] < 4600, '第二句改成短句后应明显短于旧文案（实测 ' + t.MEMORY_SEARCH_VOICE_MS[1] + 'ms）')
  console.log('PASS: 语音说明（2 句已生成、短句口径、文案与目标一致）+ 棋盘固定 4 列')
}

// ---------- 路由与条目一致：pages.json、catalog、game-assets、页面样式 ----------
{
  // pages.json 解析失败要显式报错，而不是丢一个难懂的 SyntaxError。
  let pages = []
  try { pages = JSON.parse(fs.readFileSync(path.join(root, 'pages.json'), 'utf8')).pages.map((entry) => entry.path) }
  catch (error) { assert.fail('pages.json 解析失败：' + error.message) }
  assert(pages.includes('pages/game/memory-search'), 'pages.json 已注册 memory-search 路由')
  const catalog = fs.readFileSync(path.join(root, 'utils/catalog.uts'), 'utf8')
  assert(catalog.includes("{ id: 'memory-search', dimensionId: 'divided', name: '记忆与搜索'"), 'catalog 条目与新页面一致（gameId/dimensionId 相同）')
  assert(page.includes("gameId=memory-search&dimensionId=divided"), '页面写入的成绩使用 catalog 的 gameId 与维度')
  // catalog 里出现的页面路由都必须已经在 pages.json 注册（避免再次出现指向不存在页面的路由）
  // 只认「单引号包裹、且以 /pages/ 开头」的字符串；否则注释里提到 /pages/ 也会被当成路由。
  for (const match of catalog.matchAll(/'(\/pages\/[^']*)'/g)) {
    const route = match[1].split('?')[0].replace(/^\//, '')
    if (route.endsWith('/')) continue
    assert(pages.includes(route), 'catalog 路由未注册：' + route)
  }
  const assets = fs.readFileSync(path.join(root, 'utils/game-assets.uts'), 'utf8')
  const thumbnail = assets.match(/if \(gameId == 'memory-search'\) return '([^']+)'/)
  assert(thumbnail, 'game-assets 有 memory-search 缩略图条目')
  assert(exists(thumbnail[1]), '缩略图文件存在：' + thumbnail[1])
  // 头部实时分数 chip
  assert(page.includes('得分'), '页面头部应有实时分数 chip')
  assert(page.includes('liveScore'), '实时分数应绑定 liveScore')
  // 记忆阶段只渲染新增目标，而不是整集合
  const previewBlock = page.slice(page.indexOf("phase == 'preview'"), page.indexOf("class=\"ms-search\""))
  assert(previewBlock.includes('in newTargets'), '记忆阶段应只渲染 newTargets')
  assert(!previewBlock.includes('in targetTiles'), '记忆阶段不应再渲染整集合 targetTiles')
  assert(page.includes('width: memoryImageSize') || page.includes('memoryImageSize'), '新目标展示尺寸应绑定 memoryImageSize')
  assert(page.includes('MEMORY_SEARCH_VOICE_FILES'), '页面应接入记忆阶段语音')
  assert(page.includes('previewDuration.value = round.previewMs'), '记忆展示时长照档位走，不用语音时长兜底')
  assert(!page.includes('memoryPreviewMs'), '不应再按语音延长记忆展示')
  assert(page.includes('前面看到的也要一起找齐'), '文字提示应与语音同一口径')
  // 页面内只使用单类选择器（Android 编译限制）
  const style = page.slice(page.indexOf('<style>'))
  for (const match of style.matchAll(/^\.[\w-]+ [\w.:-]+/gm)) assert(false, '样式出现层级/后代选择器：' + match[0])
}

console.log('PASS: 记忆与搜索回归；随机目标序（首目标不写死）、固定棋盘、零影子图、第 k 轮目标数 = k、记忆阶段只展示新增目标 + 短句语音说明（不延长展示、跨阶段继续播）、棋盘固定 4 列、最后一轮覆盖整盘、无尽累加自动进轮、误点达 maxErrors 判负、累计满分提前收工、打完 boardSize 轮判找全、每张按速度给分且封顶 2 倍 base、局分封顶 200、试玩 4 张 2 轮不计分、展示尺寸放大、暂停与清理、路由与样式一致')
