// 离线生成倒水小实验的关卡库：对每档预生成固定最少步数的关卡，导出为 utils/water-sort-levels.uts。
// 运行时 waterSortGenerate 直接从表里随机抽一个并随机重映射颜色，不再实时求解。
// 用法：node tools/generate-water-sort-levels.cjs
// 输出：utils/water-sort-levels.uts（每档 PER_LEVEL 个关卡，颜色用编号 0..colors-1）
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'utils/water-sort.uts'), 'utf8').replace(/^export /gm, '')
const context = {}
vm.createContext(context)
vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2020 }), context)

const PER_LEVEL = 30
const MAX_ATTEMPTS = 30000

// 颜色规范化（按首次出现顺序重编号）+ 试管排序，让颜色对称的结构归一到同一 key，用于去重。
function canonical(tubes) {
  const map = {}, norm = tubes.map(tube => tube.map(c => { if (map[c] === undefined) map[c] = Object.keys(map).length; return map[c] }))
  return norm.map(tube => tube.join(',')).sort().join('|')
}

const levels = []
for (let level = 1; level <= 10; level++) {
  const cfg = context.waterSortConfig(level)
  const mixedFloor = Math.max(2, Math.ceil(cfg.colors * 0.7))
  const pool = []
  const seen = new Set()
  let attempts = 0
  while (pool.length < PER_LEVEL && attempts < MAX_ATTEMPTS) {
    attempts += 1
    const tubes = context.waterSortScatter(cfg)
    if (context.waterSortSolved(tubes)) continue
    if (context.waterSortMixedCount(tubes) < mixedFloor) continue
    // 命中「最少步数恰好等于目标值」才收下；budget 给足，保证离线质量。
    if (context.waterSortExactSteps(tubes, cfg.minimum, 60000) !== 1) continue
    const key = canonical(tubes)
    if (seen.has(key)) continue
    seen.add(key)
    // 双重验证：完整求解一次，确认最少步数确实等于目标值。
    const solved = context.waterSortSolve(tubes, cfg.scramble, 60000)
    if (!solved.exact || solved.steps !== cfg.minimum) continue
    pool.push(tubes)
  }
  levels.push(pool)
  console.log(`L${level}: ${pool.length} 关（最少 ${cfg.minimum} 步，尝试 ${attempts} 次）`)
}

let out = '// 由 tools/generate-water-sort-levels.cjs 生成，勿手改。\n'
out += '// 每档预生成的「最少步数固定」关卡；颜色用编号 0..colors-1，运行时随机重映射色相。\n'
out += 'export const WATER_SORT_LEVELS: number[][][][] = [\n'
for (const pool of levels) {
  out += '  [ // 档位\n'
  for (const tubes of pool) out += `    ${JSON.stringify(tubes)},\n`
  out += '  ],\n'
}
out += ']\n'
fs.writeFileSync(path.join(root, 'utils/water-sort-levels.uts'), out)
console.log(`已写入 utils/water-sort-levels.uts，${out.length} 字节`)
