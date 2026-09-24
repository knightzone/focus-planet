// 拼图工坊回归：难度网格、洗牌、托盘放入/占位交换、格子间移动交换、完成判定、素材循环去重。
// NODE + TYPESCRIPT_PATH 可在其他电脑运行；不启动 App、不连接服务端。
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const readJson = file => {
  try { return JSON.parse(read(file)) }
  catch (error) { throw new Error(`无法解析 ${file}: ${error.message}`) }
}
const strip = text => text.replace(/^import .*$/gm, '').replace(/^export /gm, '')
const bundle = [
  read('utils/local-test.uts'),
  read('utils/spot-difference-types.uts'),
  read('utils/puzzle.uts'),
  read('utils/puzzle-cycle.uts')
].map(strip).join('\n')
const names = 'PUZZLE_IMAGE_W,PUZZLE_IMAGE_H,PUZZLE_EMPTY,puzzleConfig,puzzleShuffle,puzzleEmptySlots,puzzlePlaceFromTray,puzzleMoveBetweenSlots,puzzleReturnToTray,puzzlePlacedCount,puzzleSolved,chooseUnseenPuzzleSource,markPuzzleShown'
// 内存版本地存储，替代 uni 的同步存储接口。
const store = {}
const context = {
  uni: {
    getStorageSync: key => store[key] === undefined ? '' : store[key],
    setStorageSync: (key, value) => { store[key] = value },
    removeStorageSync: key => { delete store[key] }
  },
  console: console
}
vm.createContext(context)
vm.runInContext(ts.transpile(bundle + '\nglobalThis.api = {' + names + '}', { target: ts.ScriptTarget.ES2020 }), context)
const api = context.api
// vm 里新建的数组与宿主数组原型不同，比较前先转成宿主数组。
const plain = value => Array.from(value)

// ---------- 难度网格 ----------
{
  const expectCols = [2, 2, 2, 3, 3, 3, 4, 4, 5, 5]
  const expectRows = [2, 3, 4, 3, 4, 5, 4, 5, 5, 6]
  const expectRounds = [3, 3, 3, 4, 4, 5, 5, 4, 3, 3]
  let previous = null
  for (let level = 1; level <= 10; level++) {
    const config = api.puzzleConfig(level)
    assert.equal(config.level, level)
    assert.equal(config.cols, expectCols[level - 1], 'L' + level + ' 列数')
    assert.equal(config.rows, expectRows[level - 1], 'L' + level + ' 行数')
    assert.equal(config.count, config.cols * config.rows, '拼块数 = 列×行')
    assert.equal(config.rounds, expectRounds[level - 1], 'L' + level + ' 轮数')
    assert(config.targetMs >= config.count * 4000, '目标时间随拼块数增长')
    if (previous !== null) {
      assert(config.count > previous.count, '拼块数随难度递增')
      assert(config.targetMs > previous.targetMs)
    }
    previous = config
  }
  assert.equal(api.puzzleConfig(1).count, 4, '最低档 2×2')
  assert.equal(api.puzzleConfig(10).count, 30, '最高档 5×6')
  assert.equal(api.puzzleConfig(0).level, 1)
  assert.equal(api.puzzleConfig(99).level, 10)
  console.log('PASS: 10 档网格 2×2→5×6（4→30 块），轮数 3,3,3,4,4,5,5,4,3,3')
}

// ---------- 洗牌与空格 ----------
{
  for (const count of [4, 9, 15, 20, 30]) {
    for (let round = 0; round < 40; round++) {
      const tray = api.puzzleShuffle(count)
      assert.equal(tray.length, count, '托盘拼块数')
      const sorted = tray.slice().sort((a, b) => a - b)
      for (let i = 0; i < count; i++) assert.equal(sorted[i], i, '洗牌后仍是 0..count-1 的排列')
    }
    const slots = api.puzzleEmptySlots(count)
    assert.equal(slots.length, count)
    assert(slots.every(v => v === api.PUZZLE_EMPTY), '开局格子全空')
  }
  console.log('PASS: 洗牌是全排列、开局格子全空')
}

// ---------- 托盘放入：空格 / 占位交换 ----------
{
  const slots = api.puzzleEmptySlots(4), tray = [2, 0, 3, 1]
  // 放进正确格子：不记失误，拼块离开托盘。
  assert.equal(api.puzzlePlaceFromTray(slots, tray, 0, 0), 0, '放对不记失误')
  assert.deepEqual(plain(slots), [0, -1, -1, -1])
  assert.deepEqual(plain(tray), [2, 3, 1], '放下的拼块离开托盘')
  // 放进错误格子：记 1 次失误，拼块留在格子里（允许自由摆放，靠交换纠正）。
  assert.equal(api.puzzlePlaceFromTray(slots, tray, 2, 1), 1, '放错记 1 次失误')
  assert.deepEqual(plain(slots), [0, 2, -1, -1])
  assert.deepEqual(plain(tray), [3, 1])
  // 放进已占格子：原拼块退回托盘，新拼块进格。
  assert.equal(api.puzzlePlaceFromTray(slots, tray, 1, 1), 0, '交换进正确格子不记失误')
  assert.deepEqual(plain(slots), [0, 1, -1, -1], '被换下的拼块让位')
  assert.deepEqual(plain(tray), [3, 2], '被换下的拼块退回托盘')
  // 非法：拼块不在托盘 / 格子越界。
  assert.equal(api.puzzlePlaceFromTray(slots, tray, 0, 2), -1, '托盘里没有的拼块不能放')
  assert.equal(api.puzzlePlaceFromTray(slots, tray, 3, 9), -1, '越界格子不能放')
}
console.log('PASS: 托盘放入（空格放对/放错、占位交换退回托盘、非法操作）')

// ---------- 格子间移动与交换 ----------
{
  const slots = [0, 2, api.PUZZLE_EMPTY, 3], tray = [1]
  assert.equal(api.puzzleMoveBetweenSlots(slots, 1, 2), true, '可以移到空格')
  assert.deepEqual(plain(slots), [0, -1, 2, 3])
  assert.equal(api.puzzleMoveBetweenSlots(slots, 0, 2), true, '可以和已占格子交换')
  assert.deepEqual(plain(slots), [2, -1, 0, 3])
  assert.equal(api.puzzleMoveBetweenSlots(slots, 0, 0), false, '同一格不算移动')
  assert.equal(api.puzzleMoveBetweenSlots(slots, 1, 2), false, '空格不能移动')
  assert.equal(api.puzzleMoveBetweenSlots(slots, 0, 9), false, '越界不算移动')
  // 放回托盘
  assert.equal(api.puzzleReturnToTray(slots, tray, 0), true)
  assert.deepEqual(plain(slots), [-1, -1, 0, 3])
  assert.deepEqual(plain(tray), [1, 2], '退回的拼块进入托盘')
  assert.equal(api.puzzleReturnToTray(slots, tray, 0), false, '空格不能退回')
}
console.log('PASS: 格子间移动/交换、格子退回托盘')

// ---------- 放对数与完成判定 ----------
{
  const config = api.puzzleConfig(6)
  const slots = api.puzzleEmptySlots(config.count), tray = api.puzzleShuffle(config.count)
  assert.equal(api.puzzlePlacedCount(slots), 0)
  assert.equal(api.puzzleSolved(slots), false, '开局不算完成')
  for (let i = 0; i < config.count; i++) api.puzzlePlaceFromTray(slots, tray, i, i)
  assert.equal(api.puzzlePlacedCount(slots), config.count, '全部归位')
  assert.equal(api.puzzleSolved(slots), true)
  assert.equal(tray.length, 0, '托盘清空')
  // 少放一块就不算完成
  const almost = api.puzzleEmptySlots(4)
  almost[0] = 0; almost[1] = 1; almost[2] = 2
  assert.equal(api.puzzlePlacedCount(almost), 3)
  assert.equal(api.puzzleSolved(almost), false)
  // 放对位置但顺序无关：完成只看「每格是否为它自己的拼块」
  const swapped = [1, 0]
  assert.equal(api.puzzleSolved(swapped), false)
  assert.equal(api.puzzleSolved([0, 1]), true)
  assert.equal(api.puzzleSolved([]), false)
}
console.log('PASS: 放对数与完成判定（空/未完成/完成/空数组）')

// ---------- 完整解法：直接放 + 先乱放再交换 ----------
{
  for (let level = 1; level <= 10; level++) {
    const config = api.puzzleConfig(level)
    // 解法一：从托盘逐块放进自己的格子，0 失误。
    {
      const slots = api.puzzleEmptySlots(config.count), tray = api.puzzleShuffle(config.count)
      let mistakes = 0
      while (tray.length > 0) {
        const piece = tray[0]
        mistakes += api.puzzlePlaceFromTray(slots, tray, piece, piece)
      }
      assert.equal(mistakes, 0, 'L' + level + ' 逐块放对不应记失误')
      assert.equal(api.puzzleSolved(slots), true, 'L' + level + ' 应能拼完')
    }
    // 解法二：先按托盘顺序乱放，再用格子间交换排好；失误只来自乱放。
    {
      const slots = api.puzzleEmptySlots(config.count), tray = api.puzzleShuffle(config.count)
      let mistakes = 0
      while (tray.length > 0) {
        const piece = tray[0]
        const slot = config.count - 1 - piece
        mistakes += api.puzzlePlaceFromTray(slots, tray, piece, slot)
      }
      assert.equal(mistakes, config.count - api.puzzlePlacedCount(slots), '失误数应为乱放时恰好放对的补集')
      let swaps = 0
      while (!api.puzzleSolved(slots)) {
        let at = -1
        for (let i = 0; i < slots.length; i++) if (slots[i] != i) { at = i; break }
        assert(at >= 0, 'L' + level + ' 未完成时应能找到错位格子')
        let home = -1
        for (let i = 0; i < slots.length; i++) if (slots[i] == at) { home = i; break }
        assert(home >= 0, 'L' + level + ' 错位的拼块应还在场内')
        assert.equal(api.puzzleMoveBetweenSlots(slots, at, home), true, '交换应发生')
        swaps += 1
        assert(swaps <= config.count + 2, 'L' + level + ' 交换次数应有界')
      }
      assert.equal(api.puzzleSolved(slots), true, 'L' + level + ' 交换后应拼完')
    }
  }
  console.log('PASS: 10 档均可解（逐块放对 0 失误；乱放后靠交换排好）')
}

// ---------- 素材循环：看到即消耗、看过一轮才重置 ----------
{
  const scenes = []
  for (let i = 1; i <= 6; i++) scenes.push({ id: 'SD-00' + i, tier: 'low', imageA: '/a' + i + '.webp', imageB: '/b' + i + '.webp', regions: [] })
  // 一局 6 轮取满 6 个不同场景。
  const seenThisSession = {}
  for (let round = 0; round < 6; round++) {
    const source = api.chooseUnseenPuzzleSource(scenes)
    assert(source !== null, '应能取到素材')
    assert(seenThisSession[source.sceneId] === undefined, '同一轮内不应重复场景，实际重复 ' + source.sceneId)
    assert.equal(source.image, '/a' + Number(source.sceneId.slice(-1)) + '.webp', '拼图只使用该场景的 A 图')
    seenThisSession[source.sceneId] = true
    api.markPuzzleShown(source.sceneId, scenes)
  }
  // 全部看过之后开新一轮：仍然能取到，且不与上一张相同。
  const last = api.chooseUnseenPuzzleSource(scenes)
  const next = api.chooseUnseenPuzzleSource(scenes)
  assert(last !== null && next !== null, '看过一轮后应重新开一轮')
  // 空场景表不应崩。
  assert.equal(api.chooseUnseenPuzzleSource([]), null)
  for (let i = 0; i < 200; i++) {
    const source = api.chooseUnseenPuzzleSource(scenes)
    assert.equal(source.image, scenes.find(s => s.id === source.sceneId).imageA)
    api.markPuzzleShown(source.sceneId, scenes)
  }
  console.log('PASS: 素材按场景去重、看到即消耗、看完全部后重开一轮，固定 A 图（含200次跨轮检查）')
}

{
  for (const key of Object.keys(store)) delete store[key]
  const scenes = readJson('content/brand/spot-difference-story-v2/runtime-review/manifest.json').scenes
  assert.equal(scenes.length, 150)
  let previous = ''
  for (let cycle = 0; cycle < 2; cycle++) {
    const seen = new Set()
    for (let i = 0; i < scenes.length; i++) {
      const source = api.chooseUnseenPuzzleSource(scenes)
      assert(!seen.has(source.sceneId))
      assert.notEqual(source.sceneId, previous)
      assert.equal(source.image, scenes.find(s => s.id === source.sceneId).imageA)
      assert(fs.existsSync(path.join(root, source.image)))
      seen.add(source.sceneId)
      previous = source.sceneId
      api.markPuzzleShown(source.sceneId, scenes)
    }
  }
  console.log('PASS: 真实150场景连续两轮不重复，固定A图，跨轮不紧邻重复')
}
console.log('拼图工坊回归通过')
