// 倒水小实验回归：难度梯度、试玩一步完成、倒水规则、生成题目必有解且目标步数可达。
// 参照求解器在测试内独立实现，用于交叉验证最少步数，并逐手重放 utils 的倒水实现。
// NODE + TYPESCRIPT_PATH 可在其他电脑运行；不启动 App、不连接服务端。
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'utils/water-sort.uts'), 'utf8').replace(/^import .*$/gm, '').replace(/^export /gm, '')
const levelsSource = fs.readFileSync(path.join(root, 'utils/water-sort-levels.uts'), 'utf8').replace(/^export /gm, '')
const names = 'WATER_SORT_CAPACITY,WATER_SORT_COLORS,waterSortConfig,waterSortDemoTubes,waterSortSolved,waterSortRoundScore,waterSortPour,waterSortSolve,waterSortGenerate,waterSortExactSteps,WATER_SORT_LEVELS'
const context = {}
vm.createContext(context)
vm.runInContext(ts.transpile(source + '\n' + levelsSource + '\nglobalThis.api = {' + names + '}', { target: ts.ScriptTarget.ES2020 }), context)
const api = context.api

const VERBOSE = process.argv.indexOf('--verbose') >= 0

// ---------- 参照实现 ----------
function solved(tubes) { return tubes.every(tube => tube.every(color => color === tube[0])) }
function clone(tubes) { return tubes.map(tube => tube.slice()) }
function topRun(tube) {
  if (tube.length === 0) return 0
  const color = tube[tube.length - 1]
  let run = 1
  while (run < tube.length && tube[tube.length - 1 - run] === color) run += 1
  return run
}
function apply(tubes, from, to, capacity) {
  const source = tubes[from], target = tubes[to]
  const color = source[source.length - 1]
  let moved = 0
  while (source.length > 0 && source[source.length - 1] === color && target.length < capacity) { target.push(source.pop()); moved += 1 }
  return moved
}
function legalMoves(tubes, capacity) {
  const result = []
  for (let from = 0; from < tubes.length; from++) {
    const source = tubes[from]
    if (source.length === 0) continue
    const color = source[source.length - 1]
    const run = topRun(source)
    for (let to = 0; to < tubes.length; to++) {
      if (to === from) continue
      const target = tubes[to]
      if (target.length >= capacity) continue
      if (run === source.length && target.length === 0) continue
      if (target.length > 0 && target[target.length - 1] !== color) continue
      result.push({ from, to })
    }
  }
  return result
}
// 迭代加深 + 规范化去重；返回最少步数与其中一条解法。
function referenceSolve(tubes, capacity, upperBound, budget) {
  const memo = new Map()
  let nodes = 0
  let solution = null
  const canonical = state => state.map(tube => tube.join(',')).sort().join('|')
  function dfs(state, depth, limit, path) {
    if (solved(state)) { solution = path.slice(); return true }
    if (depth >= limit || nodes >= budget) return false
    nodes += 1
    const key = canonical(state)
    const seen = memo.get(key)
    if (seen !== undefined && seen <= depth) return false
    memo.set(key, depth)
    for (const move of legalMoves(state, capacity)) {
      const moved = apply(state, move.from, move.to, capacity)
      if (moved <= 0) continue
      path.push(move)
      const found = dfs(state, depth + 1, limit, path)
      path.pop()
      for (let i = 0; i < moved; i++) state[move.from].push(state[move.to].pop())
      if (found) return true
      if (nodes >= budget) return false
    }
    return false
  }
  for (let limit = 1; limit <= upperBound; limit++) {
    memo.clear(); nodes = 0; solution = null
    if (dfs(clone(tubes), 0, limit, [])) return { steps: limit, moves: solution, complete: true, nodes }
    if (nodes >= budget) return { steps: 0, moves: null, complete: false, nodes }
  }
  return { steps: 0, moves: null, complete: false, nodes }
}
// 逐手重放 utils 的倒水实现，确认参照解法在正式规则下同样成立。
function replay(tubes, moves, capacity) {
  let state = clone(tubes)
  for (const move of moves) {
    const expected = Math.min(topRun(state[move.from]), capacity - state[move.to].length)
    const result = api.waterSortPour(state, move.from, move.to)
    assert.equal(result.ok, true, '参照解法中的倒水应被接受')
    assert.equal(result.moved, expected, '倒出的格数应为顶端整段同色水')
    state = result.tubes
  }
  assert.equal(api.waterSortSolved(state), true, '参照解法结束时所有颜色都应分开')
  return moves.length
}

// ---------- 难度梯度 ----------
let previous = null
for (let level = 1; level <= 10; level++) {
  const config = api.waterSortConfig(level)
  assert.equal(config.capacity, api.WATER_SORT_CAPACITY)
  assert.equal(config.level, level)
  assert.equal(config.tubes, config.colors + config.empties, '试管数 = 颜色数 + 空瓶数')
  assert(config.colors >= 2 && config.colors <= api.WATER_SORT_COLORS.length)
  assert(config.tubes <= config.colors + 2)
  assert(config.rounds >= 3 && config.rounds <= 5, '每次训练 3–5 轮')
  assert(config.allowance >= 0 && config.allowance <= 2)
  assert(config.minimum >= 1 && config.minimum <= config.scramble, '最少步数在打乱步数内（保证有解）')
  if (previous !== null) {
    assert(config.colors >= previous.colors, '颜色数随难度不降')
    assert(config.tubes >= previous.tubes, '试管数随难度不降')
    assert(config.rounds >= previous.rounds, '轮数随难度不降')
    assert(config.minimum >= previous.minimum, '最少步数随难度不降')
  }
  previous = config
}
assert.equal(api.waterSortConfig(1).colors, 2)
assert.equal(api.waterSortConfig(1).tubes, 3)
assert.equal(api.waterSortConfig(1).allowance, 1, '最低难度给 1 步宽限')
assert.equal(api.waterSortConfig(1).minimum, 4, '第 1 档固定最少步数')
assert.equal(api.waterSortConfig(10).colors, 5)
assert.equal(api.waterSortConfig(10).rounds, 5)
assert.equal(api.waterSortConfig(10).allowance, 0)
assert.equal(api.waterSortConfig(10).minimum, 10, '第 10 档固定最少步数')
assert.equal(api.waterSortConfig(0).level, 1)
assert.equal(api.waterSortConfig(99).level, 10)
console.log('PASS: 10 档难度，颜色 2→5、试管 3→7、最少步数 4→10 固定、轮数 3→5，1–6 档额外 1 步宽限')

// ---------- 试玩：两根试管，倒一次就完成 ----------
{
  const demo = api.waterSortDemoTubes()
  assert.equal(demo.length, 2, '试玩给两根试管')
  const pour = api.waterSortPour(demo, 0, 1)
  assert.equal(pour.ok, true)
  assert.equal(pour.moved, 2)
  assert.equal(api.waterSortSolved(pour.tubes), true, '试玩倒一下即可完成')
  assert.equal(api.waterSortSolved(demo), false, '倒水不能改动传入的局面')
  assert.equal(demo[0].length, 4)
  assert.equal(demo[1].length, 0)
}
console.log('PASS: 试玩两根试管，一次倒水完成，且不修改传入局面')

// ---------- 倒水规则 ----------
{
  const state = [[0, 0, 1], [1, 0, 0], []]
  assert.equal(api.waterSortPour(state, 0, 0).ok, false)
  assert.equal(api.waterSortPour(state, 2, 0).ok, false, '空瓶不能倒水')
  assert.equal(api.waterSortPour(state, 0, 1).ok, false, '颜色不同不能倒')
  assert.equal(api.waterSortPour(state, 0, 5).ok, false)
  // 顶端同色的整段一起倒，且受目标瓶容量限制。
  const run = api.waterSortPour([[0, 0, 1, 1], [1]], 0, 1)
  assert.equal(run.ok, true)
  assert.equal(run.moved, 2)
  assert.deepEqual(run.tubes[0], [0, 0])
  assert.deepEqual(run.tubes[1], [1, 1, 1])
  const capped = api.waterSortPour([[0, 0, 1, 1], [1, 1, 1]], 0, 1)
  assert.equal(capped.ok, true)
  assert.equal(capped.moved, 1, '目标瓶只剩一格时只倒一格')
  assert.deepEqual(capped.tubes[1], [1, 1, 1, 1])
  // 上层同色多份一次倒出：倒多少只受目标瓶剩余空间限制，与两根瓶子整体颜色是否一致无关。
  const three = api.waterSortPour([[0, 1, 1, 1], []], 0, 1)
  assert.equal(three.ok, true)
  assert.equal(three.moved, 3, '上层三份同色且目标空余足够时应三份一起倒')
  assert.deepEqual(three.tubes[0], [0])
  assert.deepEqual(three.tubes[1], [1, 1, 1])
  const threeCapped = api.waterSortPour([[0, 1, 1, 1], [1, 1]], 0, 1)
  assert.equal(threeCapped.ok, true)
  assert.equal(threeCapped.moved, 2, '目标瓶只剩两格时三份同色只倒两份')
  assert.deepEqual(threeCapped.tubes[0], [0, 1])
  assert.deepEqual(threeCapped.tubes[1], [1, 1, 1, 1])
  const full = api.waterSortPour([[0], [1, 1, 1, 1]], 0, 1)
  assert.equal(full.ok, false, '满瓶不能再接水')
}
console.log('PASS: 倒水规则（空瓶/同色/整段/容量/满瓶/越界）')

// ---------- 每档生成题目 ----------
{
  const rounds = 6
  let worstNodes = 0, exactCount = 0, total = 0
  for (let level = 1; level <= 10; level++) {
    const config = api.waterSortConfig(level)
    for (let round = 0; round < rounds; round++) {
      const puzzle = api.waterSortGenerate(level)
      total += 1
      assert.equal(puzzle.tubes.length, config.tubes, '试管数与难度一致')
      const counts = {}
      let units = 0
      for (const tube of puzzle.tubes) {
        assert(tube.length <= config.capacity)
        for (const color of tube) { counts[color] = (counts[color] || 0) + 1; units += 1 }
      }
      assert.equal(Object.keys(counts).length, config.colors, '颜色数应与难度一致')
      Object.keys(counts).forEach(color => assert.equal(counts[color], config.capacity, '每种颜色正好倒满一瓶'))
      assert.equal(units, config.colors * config.capacity)
      assert.equal(api.waterSortSolved(puzzle.tubes), false, '开局不应已经完成')
      assert.equal(puzzle.minimum, config.minimum, '每档最少步数固定为预设值')
      assert(puzzle.minimum <= config.scramble, '最少步数不应超过打乱步数（打乱序列一定有解）')
      assert.equal(puzzle.target, puzzle.minimum + config.allowance)
      assert.equal(puzzle.exact, true, '固定步数题目来自精确求解')
      if (puzzle.exact) exactCount += 1

      const reference = referenceSolve(puzzle.tubes, config.capacity, puzzle.target, 400000)
      assert(reference.moves !== null, '目标步数内必须存在解法')
      assert(reference.steps <= puzzle.target, '参照求解器应在目标步数内完成')
      assert(puzzle.minimum >= reference.steps, '本实现给出的最少步数不可能小于真正最少步数')
      if (reference.complete && puzzle.exact) {
        assert.equal(puzzle.minimum, reference.steps, '本实现标记为精确时必须等于真正最少步数')
      }
      const replayed = replay(puzzle.tubes, reference.moves, config.capacity)
      assert(replayed <= puzzle.target)
      worstNodes = Math.max(worstNodes, reference.nodes)
      if (VERBOSE) console.log(`L${level} colors=${config.colors} tubes=${config.tubes} scramble=${config.scramble} min=${puzzle.minimum} target=${puzzle.target} exact=${puzzle.exact} ref=${reference.steps}/${reference.complete} nodes=${reference.nodes}`)
    }
  }
  console.log(`PASS: 10 档 × ${rounds} 题，每色正好一瓶、开局未完成、目标步数内可解；精确解 ${exactCount}/${total}，参照搜索最多 ${worstNodes} 节点`)
}

// ---------- 关卡表 ----------
{
  assert.equal(api.WATER_SORT_LEVELS.length, 10, '关卡表覆盖 10 档')
  let total = 0
  for (let level = 1; level <= 10; level++) {
    const config = api.waterSortConfig(level)
    const pool = api.WATER_SORT_LEVELS[level - 1]
    assert(pool.length > 0, '每档至少有一关')
    for (const tubes of pool) {
      total += 1
      assert.equal(tubes.length, config.tubes, '关卡试管数与难度一致')
      const counts = {}
      let units = 0
      for (const tube of tubes) {
        assert(tube.length <= config.capacity)
        for (const color of tube) { counts[color] = (counts[color] || 0) + 1; units += 1 }
      }
      assert.equal(Object.keys(counts).length, config.colors, '颜色数与难度一致')
      Object.keys(counts).forEach(c => assert.equal(counts[c], config.capacity, '每种颜色正好倒满一瓶'))
      assert.equal(units, config.colors * config.capacity)
      assert.equal(api.waterSortSolved(tubes), false, '关卡开局未完成')
      assert.equal(api.waterSortExactSteps(tubes, config.minimum, 60000), 1, '关卡最少步数等于预设值')
    }
  }
  console.log(`PASS: 关卡表 10 档共 ${total} 关，每关结构正确且最少步数与预设一致`)
}

// ---------- 计分 ----------
{
  assert.equal(api.waterSortRoundScore(5, 5), 100, '刚好最少步数给满分')
  assert.equal(api.waterSortRoundScore(4, 5), 100, '少于目标步数同样满分')
  assert.equal(api.waterSortRoundScore(6, 5), 88, '超出一步保留部分分但不过关')
  assert.equal(api.waterSortRoundScore(9, 5), 52)
  assert.equal(api.waterSortRoundScore(30, 5), 0, '分数不为负')
}
console.log('PASS: 达标 100 分、超出按步数递减、下限 0')

// ---------- 求解器 ----------
{
  // 已知局面：一次倒水完成，最少步数必须是 1，且不能把打乱步数当成答案。
  const one = [[0, 0, 1, 1], []]
  const result = api.waterSortSolve(one, 6, 20000)
  assert.equal(result.steps, 1)
  assert.equal(result.exact, true)
  assert.equal(result.found, true)
  // 固定局面与参照求解器逐一比对，有解时必须给出同样的最少步数。
  const fixed = [
    [[0, 0, 1, 1], [1, 1, 0, 0], []],
    [[1, 0], [0, 1], []],
    [[0, 1, 2, 2], [1, 2, 0, 0], [2, 0, 1, 1], []],
    [[0, 0, 1, 1], [1, 1, 0, 0], [0, 1, 1, 0], []]
  ]
  for (const state of fixed) {
    const expected = referenceSolve(state, api.WATER_SORT_CAPACITY, 12, 400000)
    assert.equal(expected.complete, true, '参照求解器应能证明固定局面的最少步数')
    const actual = api.waterSortSolve(state, 12, 20000)
    assert.equal(actual.steps, expected.steps, '两个实现的最少步数应一致')
    assert.equal(actual.exact, true)
    assert.equal(actual.found, true)
    assert.equal(replay(state, expected.moves, api.WATER_SORT_CAPACITY), expected.steps)
  }
  // 两瓶都装满又混色时无解：必须如实报告，不能把上界当成解法。
  const dead = api.waterSortSolve([[0, 0, 0, 1], [1, 1, 1, 0]], 12, 20000)
  assert.equal(dead.found, false)
  assert.equal(referenceSolve([[0, 0, 0, 1], [1, 1, 1, 0]], api.WATER_SORT_CAPACITY, 12, 400000).moves, null)
  // 预算极小的时候也要给出一个可达上界，而不是 0 或未定义。
  const bounded = api.waterSortSolve([[1, 0, 2, 2], [0, 1, 1, 2], [2, 0, 0, 1], []], 6, 20)
  assert(bounded.steps >= 1 && bounded.steps <= 6)
}
console.log('PASS: 求解器给出最少步数，预算不足时回退到可达上界')

console.log('倒水小实验回归通过')
