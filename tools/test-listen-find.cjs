// 听声捉图形（原「听声找图」重做）回归：难度参数、素材、语音、出题（多答案/居中排布）、点击判定、计分、整局、页面接线与页面脚本。
// 用法：node tools/test-listen-find.cjs
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

const lib = readModule('utils/listen-find-shapes.uts')
const voice = readModule('utils/listen-find-voice.uts')
const page = fs.readFileSync(path.join(root, 'pages/game/listen-find.uvue'), 'utf8')
const pageCode = page.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1]
  .replace(/^import[\s\S]*?from\s*'[^']*';?/gm, '')
  .replace(/^export /gm, '')

const EXPOSED = [
  'LISTEN_FIND_SHAPES', 'LISTEN_FIND_COLORS', 'LISTEN_FIND_HALVES', 'LISTEN_FIND_ASSET_BASE',
  'listenFindConfig', 'listenFindDemoConfig', 'listenFindShapeLabel', 'listenFindColorLabel', 'listenFindHalfLabel',
  'listenFindAssetPath', 'listenFindCommand', 'listenFindInHalf', 'listenFindMatches', 'listenFindMatchCount',
  'listenFindQuadrantOrigin', 'listenFindSlotOffset',
  'listenFindRoundScore', 'listenFindSessionScore', 'listenFindProgress', 'listenFindFinished', 'listenFindShapeSize',
  'listenFindGenerateRound', 'listenFindCreate', 'listenFindTap', 'listenFindStep'
]
const VOICE_EXPOSED = ['LISTEN_FIND_VOICE_IDS', 'LISTEN_FIND_VOICE_FILES', 'LISTEN_FIND_VOICE_TEXTS', 'LISTEN_FIND_VOICE_MS']

function seeded(seed) {
  let state = Math.floor(seed) % 2147483647
  if (state <= 0) state += 2147483646
  return () => { state = (state * 16807) % 2147483647; return (state - 1) / 2147483646 }
}

const FIELD = { width: 358, height: 320 }
const DT = 100
const ctx = { Math, Number, JSON, parseFloat, Array, Object, String, Set, console }
vm.createContext(ctx)
const apiCode = `globalThis.api = {${EXPOSED.join(', ')}, ${VOICE_EXPOSED.join(', ')}}`
vm.runInContext(ts.transpile(`${lib}\n${voice}\n${apiCode}`, { target: ts.ScriptTarget.ES2020 }), ctx)
const api = ctx.api

// ---------- 难度参数 ----------
{
  for (let level = 1; level <= 10; level++) {
    const config = api.listenFindConfig(level)
    assert.equal(config.level, level)
    assert.equal(config.rounds, 6, `L${level} 一局固定 6 轮`)
    assert(config.perQuadrant >= 1 && config.perQuadrant <= 4, `L${level} 每区 1—4 个图形`)
    assert(config.maxTargets >= 1 && config.maxTargets <= 4, `L${level} 每轮答案上限 1—4 个`)
    assert(config.maxTargets <= config.perQuadrant * 2, `L${level} 答案上限不超过该半屏的图形数`)
    assert(config.roundMs >= 4000 && config.roundMs <= 12000, `L${level} 每轮时间在 4—12 秒`)
    assert.equal(config.wrongPenalty, 10, `L${level} 点错扣分固定 10`)
    assert.equal(config.demo, false)
    if (level > 1) {
      const previous = api.listenFindConfig(level - 1)
      assert(config.perQuadrant >= previous.perQuadrant, `L${level} 图形数不应减少`)
      assert(config.maxTargets >= previous.maxTargets, `L${level} 答案上限逐档不降`)
      assert(config.roundMs >= previous.roundMs, `L${level} 图形变多时时间应放宽`)
    }
  }
  assert.equal(api.listenFindConfig(1).perQuadrant, 1, '最低档每区 1 个')
  assert.equal(api.listenFindConfig(10).perQuadrant, 4, '最高档每区 4 个')
  assert.equal(api.listenFindConfig(1).maxTargets, 1, '难度 1 答案最多 1 个')
  assert.equal(api.listenFindConfig(10).maxTargets, 4, '难度 10 答案最多 4 个')
  const demo = api.listenFindDemoConfig()
  assert(demo.demo && demo.rounds === 1 && demo.perQuadrant === 1 && demo.maxTargets === 1, '试玩：1 轮、每区 1 个、答案 1 个')
  assert(demo.roundMs === 0 && demo.wrongPenalty === 0, '试玩不计时不计分')
  console.log('PASS: 难度参数（6 轮固定、每区 1→4 个、答案上限 1→4、时间 5→11 秒放宽、点错扣 10、不再判负）')
}

// ---------- 图形素材 ----------
{
  for (const shape of api.LISTEN_FIND_SHAPES) {
    for (const color of api.LISTEN_FIND_COLORS) {
      const file = api.listenFindAssetPath(shape, color)
      assert(file.indexOf(api.LISTEN_FIND_ASSET_BASE) === 0, `素材路径前缀：${file}`)
      assert(fs.existsSync(path.join(root, file)), `图形素材存在：${file}`)
      assert(file.endsWith('.svg'), `图形用 SVG（矢量、体积小）：${file}`)
      const svg = fs.readFileSync(path.join(root, file), 'utf8')
      assert(svg.indexOf('stroke') < 0, `图形不带描边（更柔和）：${file}`)
      assert(svg.indexOf('fill="#') > 0, `图形是平涂色块：${file}`)
    }
  }
  assert.equal(api.LISTEN_FIND_SHAPES.length * api.LISTEN_FIND_COLORS.length, 12, '3 形状 × 4 颜色 = 12 个素材')
  // 色系对齐魔法规则的柔和粉彩
  const palette = fs.readFileSync(path.join(root, api.listenFindAssetPath('circle', 'blue')), 'utf8')
  assert(palette.indexOf('#5b8def') > 0, '蓝色用魔法规则的柔和蓝 #5b8def')
  const yellow = fs.readFileSync(path.join(root, api.listenFindAssetPath('square', 'yellow')), 'utf8')
  assert(yellow.indexOf('#ffc857') > 0, '黄色用魔法规则的柔和黄 #ffc857')
  assert.deepEqual(Array.from(api.LISTEN_FIND_HALVES), ['left', 'right', 'top', 'bottom'])
  assert.equal(api.listenFindShapeLabel('triangle'), '三角形')
  assert.equal(api.listenFindColorLabel('blue'), '蓝色图形')
  assert.equal(api.listenFindHalfLabel('bottom'), '下方')
  console.log('PASS: 图形素材（3 形状 × 4 颜色 = 12 个 SVG、无描边、柔和色系与魔法规则一致）')
}

// ---------- 语音指令 ----------
{
  const ids = Array.from(api.LISTEN_FIND_VOICE_IDS)
  assert.equal(ids.length, 4 * 7, '指令 4 半屏 × 7 描述符 = 28 句')
  for (let i = 0; i < ids.length; i++) {
    const half = ids[i].split('-')[0]
    const key = ids[i].split('-')[1]
    const kind = ['circle', 'square', 'triangle'].indexOf(key) >= 0 ? 'shape' : 'color'
    const command = api.listenFindCommand(half, kind, key)
    assert.equal(command.text, api.LISTEN_FIND_VOICE_TEXTS[i], `文案一致：${command.text}`)
    assert(fs.existsSync(path.join(root, api.LISTEN_FIND_VOICE_FILES[i])), `语音文件存在：${api.LISTEN_FIND_VOICE_FILES[i]}`)
  }
  assert.equal(api.listenFindCommand('left', 'shape', 'square').text, '点击左侧方形')
  assert.equal(api.listenFindCommand('bottom', 'color', 'red').text, '点击下方红色图形')
  console.log('PASS: 语音指令（28 句按部件拼接、文案与 id 一一对应、文件有效）')
}

// ---------- 位置：居中、规整、不挨太近 ----------
{
  for (const count of [1, 2, 3, 4]) {
    const offsets = []
    for (let slot = 0; slot < count; slot++) offsets.push(api.listenFindSlotOffset(count, slot))
    const cx = offsets.reduce((sum, item) => sum + item.x, 0) / count
    const cy = offsets.reduce((sum, item) => sum + item.y, 0) / count
    assert(Math.abs(cx - 0.5) < 0.06, `每区 ${count} 个时横向居中（重心 ${cx.toFixed(2)}）`)
    assert(Math.abs(cy - 0.5) < 0.08, `每区 ${count} 个时纵向居中（重心 ${cy.toFixed(2)}）`)
    for (let a = 0; a < count; a++) {
      for (let b = a + 1; b < count; b++) {
        const dx = offsets[a].x - offsets[b].x
        const dy = offsets[a].y - offsets[b].y
        assert(Math.sqrt(dx * dx + dy * dy) > 0.2, `每区 ${count} 个时两两不挨太近（相对间距 ${Math.sqrt(dx * dx + dy * dy).toFixed(2)}）`)
      }
    }
  }
  const origin = api.listenFindQuadrantOrigin(FIELD.width, FIELD.height, 3)
  assert.equal(origin.x, FIELD.width / 2, '右下区的原点 x 在右半')
  assert.equal(origin.y, FIELD.height / 2, '右下区的原点 y 在下半')
  console.log('PASS: 位置（1 个居中、2 个并排、3 个上二下一、4 个 2×2；都居中且不挨太近）')
}

// ---------- 出题：多答案 + 同半屏不撞描述符 ----------
{
  const descriptors = {}
  for (let level = 1; level <= 10; level++) {
    for (let seed = 1; seed <= 12; seed++) {
      const config = api.listenFindConfig(level)
      const rand = seeded(seed * 31 + level)
      const round = api.listenFindGenerateRound(config, FIELD.width, FIELD.height, 0, rand)
      const shapes = round.shapes
      assert.equal(shapes.length, config.perQuadrant * 4, `L${level}/${seed} 图形总数 = 每区数 × 4`)
      assert(round.targets >= 1 && round.targets <= config.maxTargets, `L${level}/${seed} 答案数在 1..${config.maxTargets}（上限不是必须）`)
      assert.equal(api.listenFindMatchCount(shapes, round.command), round.targets, `L${level}/${seed} 匹配数 = 本轮答案数（${round.command.text}）`)
      for (const shape of shapes) {
        if (!api.listenFindInHalf(shape, round.command.half)) continue
        if (api.listenFindMatches(shape, round.command)) continue
        const clash = round.command.kind === 'shape' ? shape.shape === round.command.key : shape.color === round.command.key
        assert(!clash, `L${level}/${seed} 同半屏出现了额外匹配`)
      }
      const size = api.listenFindShapeSize(FIELD.width, FIELD.height)
      for (let quadrant = 0; quadrant < 4; quadrant++) {
        const inQuadrant = shapes.filter((shape) => shape.quadrant === quadrant)
        assert.equal(inQuadrant.length, config.perQuadrant, `L${level}/${seed} 第 ${quadrant} 区图形数`)
        assert.equal(new Set(inQuadrant.map((shape) => shape.slot)).size, inQuadrant.length, `L${level}/${seed} 同区格子不重复`)
        const quadrantOrigin = api.listenFindQuadrantOrigin(FIELD.width, FIELD.height, quadrant)
        const cx = inQuadrant.reduce((sum, shape) => sum + shape.x, 0) / inQuadrant.length
        const cy = inQuadrant.reduce((sum, shape) => sum + shape.y, 0) / inQuadrant.length
        assert(Math.abs(cx - (quadrantOrigin.x + quadrantOrigin.w / 2)) < quadrantOrigin.w * 0.06, `L${level}/${seed} 图形横向居中于本区`)
        assert(Math.abs(cy - (quadrantOrigin.y + quadrantOrigin.h / 2)) < quadrantOrigin.h * 0.08, `L${level}/${seed} 图形纵向居中于本区`)
        for (let a = 0; a < inQuadrant.length; a++) {
          for (let b = a + 1; b < inQuadrant.length; b++) {
            const dx = inQuadrant[a].x - inQuadrant[b].x
            const dy = inQuadrant[a].y - inQuadrant[b].y
            assert(Math.sqrt(dx * dx + dy * dy) > size * 0.5, `L${level}/${seed} 同区图形不挨太近`)
          }
        }
        for (const shape of inQuadrant) {
          assert(shape.x - size / 2 >= quadrantOrigin.x - 0.001 && shape.x + size / 2 <= quadrantOrigin.x + quadrantOrigin.w + 0.001, `L${level}/${seed} 横向落在本区`)
          assert(shape.y - size / 2 >= quadrantOrigin.y - 0.001 && shape.y + size / 2 <= quadrantOrigin.y + quadrantOrigin.h + 0.001, `L${level}/${seed} 纵向落在本区`)
          assert(shape.size === size && size >= 30 && size <= 68, `L${level}/${seed} 图形尺寸自适应`)
        }
      }
      const key = `${round.command.kind === 'shape' ? 'shape-' : 'color-'}${round.command.key}`
      descriptors[key] = (descriptors[key] || 0) + 1
    }
  }
  assert(Object.keys(descriptors).length >= 7, `7 个描述符都出现过：${Object.keys(descriptors).join(',')}`)
  // 上限是「最多」不是「必须」：高难度也要出现比上限少的轮次
  let sawFewer = false
  const hard = api.listenFindConfig(10)
  for (let seed = 1; seed <= 60; seed++) {
    const round = api.listenFindGenerateRound(hard, FIELD.width, FIELD.height, 0, seeded(seed))
    if (round.targets < hard.maxTargets) sawFewer = true
    assert(round.targets >= 1 && round.targets <= 4, `第 10 档答案数在 1..4（实际 ${round.targets}）`)
  }
  assert(sawFewer, '第 10 档也会出现「少于 4 个答案」的轮次（上限不是必须）')
  console.log('PASS: 出题（答案数 = 1..上限、匹配数精确、同半屏不撞描述符、居中且不挨太近、落在本区、上限不是必须）')
}

// ---------- 点击判定与计分 ----------
{
  const config = api.listenFindConfig(9)
  const rand = seeded(99)
  const field = api.listenFindCreate(config, FIELD.width, FIELD.height, rand)
  const answers = field.shapes.filter((shape) => api.listenFindMatches(shape, field.command))
  const wrongs = field.shapes.filter((shape) => !api.listenFindMatches(shape, field.command))
  assert.equal(field.roundTargets, answers.length, '本轮答案数 = 匹配数')
  assert.equal(api.listenFindTap(field, wrongs[0].id), 'wrong', '点错返回 wrong')
  assert.equal(field.roundWrong, 1, '本轮点错计数')
  assert.equal(api.listenFindTap(field, wrongs[0].id), 'ignored', '点过的图形不能再点')
  assert.equal(api.listenFindRoundScore(1, 2, 1, config.wrongPenalty), 40, '找一半 + 点错一次 = 50−10')
  assert.equal(api.listenFindRoundScore(2, 2, 0, config.wrongPenalty), 100, '全找到满分')
  assert.equal(api.listenFindRoundScore(0, 2, 0, config.wrongPenalty), 0, '一个没找到 0 分')
  assert.equal(api.listenFindRoundScore(2, 2, 12, config.wrongPenalty), 0, '扣到 0 为止')

  // 多答案：点第一个不会收尾，点齐全部才收尾
  assert(answers.length >= 2, `第 9 档这一轮应有 2 个以上答案（实际 ${answers.length}）`)
  assert.equal(api.listenFindTap(field, answers[0].id), 'correct', '点到答案返回 correct')
  assert.equal(field.phase, 'play', '还有答案没点完时本轮继续')
  assert.equal(field.roundFound, 1, '记一次已找到')
  for (let i = 1; i < answers.length; i++) api.listenFindTap(field, answers[i].id)
  assert.equal(field.phase, 'gap', '点齐全部答案才收尾')
  assert.equal(field.roundFound, field.roundTargets, '已找到 = 本轮答案数')
  assert.equal(field.roundScores.length, 1, '本轮分入账')
  assert.equal(field.roundScores[0], 100 - field.roundWrong * config.wrongPenalty, '本轮分 = 100 − 点错×10')
  assert.equal(api.listenFindTap(field, wrongs[1].id), 'ignored', '收尾后不再接受点击')

  // 点漏：超时后本轮 0 分，并亮出全部答案
  const timeoutField = api.listenFindCreate(api.listenFindConfig(4), FIELD.width, FIELD.height, seeded(5))
  let guard = 0
  const events = []
  while (timeoutField.phase === 'play' && guard < 1000) {
    const stepEvents = api.listenFindStep(timeoutField, DT, () => 0.5)
    for (const event of stepEvents) events.push(event)
    guard += 1
  }
  assert.equal(timeoutField.phase, 'gap', '超时进入停顿')
  assert.equal(timeoutField.missedRounds, 1, '记一次点漏')
  assert.equal(timeoutField.roundScores[0], 0, '点漏本轮 0 分')
  assert.equal(timeoutField.revealedIds.length, timeoutField.roundTargets, '超时把本轮全部答案都亮出来')
  assert(events.some((event) => event.kind === 'timeout'), '发出 timeout 事件')

  // 点错不再判负：连错多次本轮照常继续，整局也不会因为错误提前结束
  {
    const hardField = api.listenFindCreate(api.listenFindConfig(10), FIELD.width, FIELD.height, seeded(41))
    const wrongs = hardField.shapes.filter((shape) => !api.listenFindMatches(shape, hardField.command))
    for (let i = 0; i < 6; i++) {
      api.listenFindTap(hardField, wrongs[i % wrongs.length].id)
    }
    assert.equal(hardField.errors, 6, '误点照常累计')
    assert.equal(hardField.phase, 'play', '连错多次本轮仍在进行')
    assert.equal(api.listenFindFinished(hardField), false, '点错不会让整局提前结束')
    // 只用分数体现：本轮找不到就 0 分，找到才按点错扣
    assert.equal(api.listenFindRoundScore(0, 1, 6, hardField.config.wrongPenalty), 0, '一个没找齐就是 0 分')
    assert.equal(api.listenFindRoundScore(1, 1, 6, hardField.config.wrongPenalty), 40, '找齐但错 6 次 = 100 − 60')
  }

  assert.equal(api.listenFindCreate(api.listenFindDemoConfig(), FIELD.width, FIELD.height, seeded(3)).phase, 'play', '试玩开局正常进行')
  console.log('PASS: 点击判定与计分（多答案点齐才收尾、点错只扣分不判负、点漏 0 分并亮全部答案）')
}

// ---------- 整局：固定 6 轮、换轮重新生成图形 ----------
{
  for (const level of [1, 5, 10]) {
    const config = api.listenFindConfig(level)
    const rand = seeded(level * 17)
    const field = api.listenFindCreate(config, FIELD.width, FIELD.height, rand)
    let guard = 0
    let regenerated = 0
    let lastSignature = field.shapes.map((shape) => shape.shape + shape.color).join(',')
    let commands = 0
    let expectedFinds = 0
    while (!api.listenFindFinished(field) && guard < 40000) {
      for (const shape of field.shapes) {
        if (!shape.tapped && api.listenFindMatches(shape, field.command)) {
          if (api.listenFindTap(field, shape.id) === 'correct') expectedFinds += 1
        }
      }
      const stepEvents = api.listenFindStep(field, DT, rand)
      for (const event of stepEvents) {
        if (event.kind === 'roundStart') {
          commands += 1
          const signature = field.shapes.map((shape) => shape.shape + shape.color).join(',')
          if (signature !== lastSignature) regenerated += 1
          lastSignature = signature
          assert.equal(field.shapes.length, config.perQuadrant * 4, `L${level} 换轮时图形已生成`)
          assert.equal(api.listenFindMatchCount(field.shapes, field.command), field.roundTargets, `L${level} 新轮匹配数 = 本轮答案数`)
          assert.equal(field.shapes.filter((shape) => shape.tapped).length, 0, `L${level} 新轮图形全部重置`)
        }
      }
      guard += 1
    }
    assert(api.listenFindFinished(field), `L${level} 整局应结束`)
    assert.equal(field.roundScores.length, 6, `L${level} 固定 6 轮`)
    assert(field.roundScores.every((score) => score === 100), `L${level} 全点对应满分`)
    assert.equal(api.listenFindSessionScore(field), 100, `L${level} 整局 100`)
    assert.equal(api.listenFindProgress(field), 1, `L${level} 进度 100%`)
    assert.equal(commands, 5, `L${level} 换轮播报 5 次（共 6 轮）`)
    assert(regenerated >= 5, `L${level} 每轮图形都应重新生成（实际更换 ${regenerated} 次）`)
    assert.equal(field.found, expectedFinds, `L${level} 点对计数 = 实际点中次数（${expectedFinds}）`)
    assert(expectedFinds >= 6, `L${level} 至少每轮 1 个答案（实际 ${expectedFinds}）`)
  }
  console.log('PASS: 整局（固定 6 轮、每轮先重新生成图形再播报、多答案点齐、全点对 100 分）')
}

// ---------- 页面接线（静态） ----------
{
  assert(page.indexOf('shadow-match-sky-v1.webp') >= 0, '带背景图')
  assert(page.indexOf('lf-axis-h') >= 0 && page.indexOf('lf-axis-v') >= 0, '中间有十字坐标轴')
  for (const label of ['左上', '右上', '左下', '右下']) assert(page.indexOf(label) >= 0, `四个区域标注：${label}`)
  assert(page.indexOf('lf-mark-good') >= 0 && page.indexOf('lf-mark-bad') >= 0 && page.indexOf('lf-mark-missed') >= 0, '点对打勾、点错打叉、漏掉亮答案三种标记')
  assert(page.indexOf('LISTEN_FIND_VOICE_IDS') >= 0 && page.indexOf('LISTEN_FIND_VOICE_FILES[index]') >= 0, '语音按指令 id 查表播放')
  assert(page.indexOf('再听一次') < 0 && page.indexOf('lf-replay') < 0 && page.indexOf('replayVoice') < 0, '去掉「再听一次」按钮')
  assert(page.indexOf('roundTargets') >= 0 && page.indexOf('还有 ') >= 0, '多答案：提示要找几个、还剩几个')
  assert(page.indexOf('listenFindDemoConfig') >= 0, '带试玩')
  assert(page.indexOf('setInterval(() => tick(), 33)') >= 0, '固定 33ms 步进')
  const style = page.match(/<style>([\s\S]*?)<\/style>/)[1]
  const descendant = style.match(/\.\w[\w-]*\s+\.\w[\w-]*\s*\{/)
  assert(descendant === null, `页面样式不得用层级/后代选择器（Android）：${descendant === null ? '' : descendant[0]}`)
  const minHeights = style.match(/min-height:\s*[^;]+;/g) || []
  assert(minHeights.every((item) => item.indexOf('%') < 0), `min-height 不得用百分比：${minHeights.join(' ')}`)
  const borderWidths = [...style.matchAll(/border-width:\s*([^;]+);/g)].map(item => item[1].trim())
  assert(borderWidths.every(value => value === '0' || value === '0px'), '图形/棋盘不带外边框；统一按钮允许显式清除边框')
  assert(style.indexOf('#9b7ede') >= 0 && style.indexOf('#4aa3c7') < 0, '配色换成魔法规则那套柔和紫系')
  const catalog = fs.readFileSync(path.join(root, 'utils/catalog.uts'), 'utf8')
  assert(catalog.includes("{ id: 'listen-find', dimensionId: 'selective', name: '听声捉图形'"), 'catalog 里 listen-find 按新分类属于观察发现')
  const soundLocation = fs.readFileSync(path.join(root, 'pages/game/sound-location.uvue'), 'utf8')
  assert(soundLocation.includes("from '../../utils/sound-sources.uts'"), '声音从哪来仍用原来的音效素材（玩法未被替换）')
  console.log('PASS: 页面接线（背景、坐标轴、四区标注、✓/✕/漏标、无「再听一次」、多答案提示、柔和配色、无边框、33ms、Android 限制）')
}

// ---------- 页面脚本整局（vm 驱动） ----------
{
  const names = ['started', 'level', 'demoDone', 'totalRounds', 'commandText', 'hint', 'hitCount', 'wrongCount', 'missedCount', 'shapeViews', 'voiceReady', 'roundIndex', 'roundDone', 'timerWidth', 'timed', 'begin', 'startDemo', 'tapShape', 'tick', 'field']
  let now = 10000, id = 0, url = '', load
  const played = []
  const timers = new Map()
  const pageCtx = {
    Math, Number, JSON, console, Set,
    ref: (value) => ({ value: value }),
    computed: (getter) => ({ get value() { return getter() } }),
    nextTick: (callback) => { callback() },
    onLoad: (callback) => { load = callback },
    onReady: () => {},
    onUnload: () => {},
    onResize: () => {},
    getGameDifficulty: () => 9,
    averageRoundScore: (scores, maximum) => scores.length === 0 ? 0 : Math.floor(scores.reduce((total, value) => total + Math.min(maximum, value), 0) / scores.length + 0.000001),
    scoreQuery: (scores) => `&scoreVersion=goal-v2&roundScores=${scores.join(',')}`,
    Date: { now: () => now },
    setTimeout: (callback, ms) => { timers.set(++id, { callback: callback, at: now + ms }); return id },
    clearTimeout: (index) => { timers.delete(index) },
    uni: {
      getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, statusBarHeight: 47, pixelRatio: 3 }),
      getElementById: () => null,
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
  const liveNames = names.filter((name) => name !== 'field')
  const pageApiCode = `globalThis.page = {${liveNames.join(', ')}, get field() { return field }}`
  vm.runInContext(ts.transpile(`${lib}\n${voice}\n${pageCode}\n${pageApiCode}`, { target: ts.ScriptTarget.ES2020 }), pageCtx)
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
  function announcedPaths() {
    const label = pageApi.commandText.value.replace('找一找，', '')
    const paths = new Set()
    for (const type of api.LISTEN_FIND_TYPES === undefined ? [] : api.LISTEN_FIND_TYPES) paths.add(type)
    for (const shape of api.LISTEN_FIND_SHAPES) {
      for (const color of api.LISTEN_FIND_COLORS) {
        const file = api.listenFindAssetPath(shape, color)
        if (label.indexOf(api.listenFindShapeLabel(shape)) >= 0) paths.add(file)
        if (label.indexOf(api.listenFindColorLabel(color).replace('图形', '')) >= 0) paths.add(file)
      }
    }
    return { label: label, paths: paths }
  }

  // 听声捉图形的试玩在 onLoad 里就起来了（页面不用 onReady）
  load()
  assert.equal(pageApi.level.value, 9, '页面读取难度档位')
  assert.equal(pageApi.totalRounds.value, 6, '一局 6 轮')
  assert(pageApi.started.value === false, '进来先试玩')
  assert.equal(pageApi.shapeViews.value.length, 4, '试玩渲染 4 个图形（每区 1 个）')
  assert.equal(played.length, 1, `试玩就播指令语音：${played[0]}`)
  assert(pageApi.voiceReady.value, '有录音时语音就绪')
  assert(!pageApi.timed.value, '试玩不计时')
  assert(pageApi.commandText.value.indexOf('点击') === 0, `指令文案：${pageApi.commandText.value}`)

  // 试玩：点错打叉、点对打勾，点齐（试玩只有 1 个答案）后停下等开始
  const field = pageApi.field
  const answer = field.shapes.filter((shape) => api.listenFindMatches(shape, field.command))[0]
  const wrong = field.shapes.filter((shape) => !api.listenFindMatches(shape, field.command))[0]
  pageApi.tapShape(wrong.id)
  assert(pageApi.shapeViews.value.some((view) => view.id === wrong.id && view.mark === 'bad'), '试玩点错打叉')
  pageApi.tapShape(answer.id)
  assert(pageApi.shapeViews.value.some((view) => view.id === answer.id && view.mark === 'good'), '试玩点对打勾')
  assert(pageApi.hint.value.indexOf('都找齐啦') >= 0 || pageApi.hint.value.indexOf('还有 ') >= 0, `点对后有文字反馈：${pageApi.hint.value}`)
  let guard = 0
  while (!pageApi.demoDone.value && guard < 500) { tick(50); guard += 1 }
  assert(pageApi.demoDone.value, '试玩一轮跑完停下')
  assert(url === '', '试玩不跳结算')

  // 正式训练：第 9 档每轮 1—4 个答案，全部点齐
  pageApi.begin()
  assert(pageApi.started.value === true, '开始正式训练')
  assert.equal(pageApi.shapeViews.value.length, api.listenFindConfig(9).perQuadrant * 4, '正式训练图形数按档位')
  assert(pageApi.timed.value, '正式训练计时')
  assert.equal(played.length, 2, '开始后重新播报指令')
  let expectedFinds = 0
  guard = 0
  while (url === '' && guard < 40000) {
    const current = pageApi.field
    for (const shape of current.shapes) {
      if (!shape.tapped && api.listenFindMatches(shape, current.command)) {
        pageApi.tapShape(shape.id)
        expectedFinds += 1
      }
    }
    tick(50)
    guard += 1
  }
  assert(url.indexOf('gameId=listen-find') >= 0 && url.indexOf('dimensionId=selective') >= 0, `结算跳转参数：${url}`)
  assert.equal(Number(url.split('&score=')[1].split('&')[0]), 100, '全点对应 100 分')
  assert.equal(pageApi.wrongCount.value, 0, '正式训练全程只点对时不应计点错')
  assert.equal(pageApi.hitCount.value, expectedFinds, `命中数 = 实际点中数（${expectedFinds}）`)
  assert(expectedFinds >= 6, `六轮至少各一个答案（实际 ${expectedFinds}）`)
  assert(announcedPaths().paths.size > 0, '指令能对应到素材路径')
  console.log('PASS: 页面脚本（先试玩并停下、点错打叉点对打勾、多答案点齐、开始按档位生成、6 轮后 100 分结算）')
}

console.log('听声捉图形回归通过：难度参数/素材/语音/位置/出题/多答案判定/计分/整局/页面接线/页面脚本')
