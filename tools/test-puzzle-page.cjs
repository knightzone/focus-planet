// 拼图工坊页面回归：把真实 pages/game/puzzle.uvue 的脚本装进 vm 沙箱跑，
// 用最小 ref/computed shim、内存存储、可控时钟驱动点击与拖动，检查几何、交互与轮次结算。
// 这里不校验真机渲染（裁切靠 overflow:hidden，属真机验收），只校验页面逻辑与坐标换算。
// NODE + TYPESCRIPT_PATH 可在其他电脑运行；不启动 App、不连接服务端。
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const strip = text => text.replace(/^import .*$/gm, '').replace(/^export /gm, '')

// ---------- 最小 shim ----------
function makeRef(value) { return { value: value } }
function makeComputed(fn) { return { get value() { return fn() } } }

let nowMs = 1000000
const timers = []
let timerSeed = 0
const clock = {
  now: () => nowMs,
  setTimeout(callback, delay) { timerSeed += 1; const task = { id: timerSeed, at: nowMs + delay, every: 0, callback }; timers.push(task); return task.id },
  setInterval(callback, delay) { timerSeed += 1; const task = { id: timerSeed, at: nowMs + delay, every: Math.max(1, delay), callback }; timers.push(task); return task.id },
  clearTimeout(id) { const at = timers.findIndex(task => task.id === id); if (at >= 0) timers.splice(at, 1) },
  clearInterval(id) { const at = timers.findIndex(task => task.id === id); if (at >= 0) timers.splice(at, 1) },
  dispose() { timers.length = 0 }
}
// 手动推进时钟，让「700ms 换轮」「1s 计时」这些定时器可确定地触发。
function advance(ms) {
  const target = nowMs + ms
  for (;;) {
    let next = null
    for (const task of timers) if (task.at <= target && (next === null || task.at < next.at)) next = task
    if (next === null) break
    nowMs = next.at
    if (next.every > 0) next.at = nowMs + next.every
    else { const at = timers.indexOf(next); if (at >= 0) timers.splice(at, 1) }
    next.callback()
  }
  nowMs = target
}

const storage = new Map()
const redirects = []
const feedbacks = []
let windowWidth = 390, windowHeight = 844, statusBarHeight = 47
let difficultyLevel = 4
const uniMock = {
  getWindowInfo: () => ({ windowWidth, windowHeight, statusBarHeight, pixelRatio: 3 }),
  getStorageSync: key => storage.has(key) ? storage.get(key) : '',
  setStorageSync: (key, value) => { storage.set(key, value) },
  removeStorageSync: key => { storage.delete(key) },
  redirectTo: options => { redirects.push(options.url) }
}
let loadCallback = null
const sessionMock = () => ({
  clock,
  paused: makeRef(false),
  navigating: makeRef(false),
  setStartedCheck() {},
  playFeedback(kind) { feedbacks.push(kind) },
  pause() {}, resume() {}, restart() {}, exit() {}, back() {}
})

// ---------- 装载真实页面脚本 ----------
const page = read('pages/game/puzzle.uvue')
const pageScript = page.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
const COMMON = ['training-clock', 'local-test', 'spot-difference-types', 'spot-difference-story', 'spot-difference-scenes', 'puzzle', 'puzzle-cycle', 'game-scoring']
const common = COMMON.map(name => strip(read('utils/' + name + '.uts'))).join('\n')
const js = ts.transpile(common + '\n' + pageScript, { target: ts.ScriptTarget.ES2020 })
const ast = ts.createSourceFile('p.ts', pageScript, ts.ScriptTarget.Latest, true)
const names = []
for (const node of ast.statements) {
  if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) names.push(declaration.name.getText(ast))
  if (ts.isFunctionDeclaration(node)) names.push(node.name.text)
}
const exposed = names.concat(['puzzleConfig', 'puzzleSolved', 'puzzlePlacedCount', 'puzzleEmptySlots', 'DIFFERENCE_SCENES'])
const sandbox = {
  ref: makeRef,
  computed: makeComputed,
  uni: uniMock,
  onLoad: callback => { loadCallback = callback },
  onUnload: () => {},
  onResize: () => {},
  getGameDifficulty: () => difficultyLevel,
  useTrainingSession: sessionMock,
  console: console
}
vm.createContext(sandbox)
vm.runInContext(js + '\nglobalThis.api = {' + exposed.map(name => JSON.stringify(name) + ':' + name).join(',') + '}', sandbox)
const api = sandbox.api

const CONTENT_PAD = 18, CELL_GAP = 6, TRAY_H = 66, DROP_NONE = -2
const FRAME_TOP = () => statusBarHeight + 44 // TrainingFrame：状态栏 + 44px 工具条

// 解析 "left:-200px;top:-50px;width:300px;height:200px;" 这类样式串（目前仅预览脚本用得到）
// -0 与 0 在严格相等下不等，样式串里实际写的是 0px，这里统一成正零。
const norm = value => value === 0 ? 0 : value
// 手势只靠位移推进，所以合成事件用任意 client 坐标都行，这里从 0 起算。
const move = (clientX, clientY) => ({ touches: [{ clientX: clientX, clientY: clientY }], changedTouches: [] })
// 正式训练模式下按指定档位建立棋盘
function setupLevel(level) {
  difficultyLevel = level
  redirects.length = 0
  api.begin()
  api.onBoardLoaded()
  assert.equal(api.boardReady.value, true, 'L' + level + ' 图片加载后应可操作')
}
// 还原试玩态：真实页面里试玩只出现在点「开始」之前，这里显式把状态拨回去。
function enterDemo() {
  api.started.value = false
  storage.clear()
  api.resetDemo()
}
const slotCenterX = slot => CONTENT_PAD + ((slot % api.cols.value) + 0.5) * (api.boardW.value / api.cols.value)
const slotCenterY = slot => api.boardTopLocal() + (Math.floor(slot / api.cols.value) + 0.5) * (api.boardH.value / api.rows.value)

loadCallback({})

// ---------- 模板标识符静态检查 ----------
// 页面回归只调脚本函数、不渲染模板，模板里引用未定义变量（例如把 CELL_H 写成 cellH）会到真机才报
// ReferenceError 并整屏空白。这里把模板里的每个标识符都对一遍脚本声明，补上这个盲区。
{
  const template = page.slice(page.indexOf('<template>') + 10, page.lastIndexOf('</template>'))
  const declared = new Set(names)
  const globals = new Set(['true', 'false', 'null', 'undefined', 'Math', 'Number', 'String', 'JSON', 'Date', 'uni', 'console', 'NaN', 'Infinity'])
  const aliases = new Set()
  const expressions = []
  // v-for 的循环别名不是脚本声明，要先收集
  for (const match of template.matchAll(/v-for="\s*\(([^)]*)\)\s+in\s+([^"]+)"|v-for="\s*([A-Za-z_$][\w$]*)\s+in\s+([^"]+)"/g)) {
    if (match[1] !== undefined) for (const alias of match[1].split(',')) aliases.add(alias.trim())
    if (match[3] !== undefined) aliases.add(match[3].trim())
    expressions.push(match[2] !== undefined ? match[2] : match[4])
  }
  // 插值与大括号/方括号属性（:style、:class、@click、v-if 等）
  for (const match of template.matchAll(/\{\{([\s\S]*?)\}\}/g)) expressions.push(match[1])
  for (const match of template.matchAll(/[:@][\w.-]+="([^"]*)"/g)) expressions.push(match[1])
  for (const match of template.matchAll(/v-(?:if|else-if|show)="([^"]*)"/g)) expressions.push(match[1])
  const missing = new Map()
  for (const expression of expressions) {
    const source = ts.createSourceFile('expr.ts', 'const __probe = (' + expression + ')', ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    // 只看包装声明的初始化表达式，别把 __probe 自己算进去
    const statement = source.statements[0]
    if (statement === undefined || !ts.isVariableStatement(statement)) continue
    const initializer = statement.declarationList.declarations[0].initializer
    if (initializer === undefined) continue
    const visit = node => {
      if (ts.isIdentifier(node)) {
        const parent = node.parent
        const isPropertyName = parent !== undefined && ts.isPropertyAccessExpression(parent) && parent.name === node
        const isObjectKey = parent !== undefined && ts.isPropertyAssignment(parent) && parent.name === node
        if (!isPropertyName && !isObjectKey) {
          const name = node.text
          if (!declared.has(name) && !aliases.has(name) && !globals.has(name)) {
            const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
            if (!missing.has(name)) missing.set(name, expression.trim() + ' (片段第 ' + line + ' 行)')
          }
        }
        return
      }
      ts.forEachChild(node, visit)
    }
    visit(initializer)
  }
  if (missing.size > 0) {
    const lines = []
    missing.forEach((where, name) => lines.push(name + '  ← ' + where))
    assert.fail('模板引用了脚本里没有的标识符（真机会 ReferenceError 整屏空白）：\n  ' + lines.join('\n  '))
  }
  assert(expressions.length > 20, '应解析出足够多的模板表达式，实际 ' + expressions.length)
  console.log('PASS: 模板标识符静态检查（' + expressions.length + ' 个表达式里的标识符都能对上脚本声明）')
}

// ---------- 试玩初始化与布局 ----------
{
  api.resetDemo()
  assert.equal(api.started.value, false, '初始是试玩')
  assert.equal(api.cols.value, 2)
  assert.equal(api.rows.value, 2)
  assert.equal(api.count.value, 4, '试玩 2×2')
  assert(api.slots.value.every(v => v === -1), '开局格子全空')
  assert.equal(api.tray.value.length, 4, '4 块都在托盘')
  assert.equal(api.boardReady.value, false, '图片没加载完不能操作')
  api.tapSlot(0)
  assert.equal(api.selected.value, -1, '未加载完点击应被忽略')
  assert.equal(api.boardW.value, Math.floor(390 - CONTENT_PAD * 2), '棋盘宽度 = 屏宽 - 左右内边距')
  assert.equal(api.boardH.value, Math.round(api.boardW.value * 432 / 768), '棋盘高度按 16:9')
  assert.equal(api.boardTopLocal(), CONTENT_PAD + 46 + 24 + 96 + 12, '棋盘在页面内的纵向位置')
  assert.equal(api.trayTopLocal(), api.boardTopLocal() + api.boardH.value + 10, '托盘紧跟棋盘')
  const bottom = api.trayTopLocal() + TRAY_H + 32 + 60
  assert(bottom <= windowHeight - FRAME_TOP(), '内容应在屏幕内，实际底部 ' + bottom + ' 可用 ' + (windowHeight - FRAME_TOP()))
  console.log('PASS: 试玩初始化（2×2、格子全空、图片未就绪时拒绝操作）与棋盘布局 ' + api.boardW.value + '×' + api.boardH.value)
}

// ---------- 裁切数学 ----------
{
  setupLevel(5) // 3×4
  assert.equal(api.cols.value, 3)
  assert.equal(api.rows.value, 4)
  assert.equal(api.cropLeft(5, 100), -200, '第 5 块在第 2 列，向左偏 2 格')
  assert.equal(api.cropTop(5, 50), -50, '第 5 块在第 1 行，向上偏 1 格')
  assert.equal(api.cropWidth(100), 300, '放大到 3 格宽')
  assert.equal(api.cropHeight(50), 200, '放大到 4 格高')
  for (const level of [1, 4, 7, 10]) {
    setupLevel(level)
    const config = api.puzzleConfig(level)
    const w = 100, h = 60
    const tiles = []
    for (let piece = 0; piece < config.count; piece++) {
      const left = api.cropLeft(piece, w), top = api.cropTop(piece, h)
      const width = api.cropWidth(w), height = api.cropHeight(h)
      const col = piece % config.cols, row = Math.floor(piece / config.cols)
      // cropLeft/cropTop 对首行首列会返回 -0（渲染成 "0px" 没问题），比较前统一成正零
      assert.equal(norm(left), norm(-col * w), 'L' + level + ' 第 ' + piece + ' 块列偏移')
      assert.equal(norm(top), norm(-row * h), 'L' + level + ' 第 ' + piece + ' 块行偏移')
      assert.equal(width, w * config.cols, 'L' + level + ' 拼图整体宽度')
      assert.equal(height, h * config.rows, 'L' + level + ' 拼图整体高度')
      assert(-left >= 0 && -left + w <= width, 'L' + level + ' 裁切窗口在原图横向范围内')
      assert(-top >= 0 && -top + h <= height, 'L' + level + ' 裁切窗口在原图纵向范围内')
      tiles.push([norm(-left), norm(-top), w, h].join(','))
    }
    assert.equal(new Set(tiles).size, config.count, 'L' + level + ' 每块裁切区域互不重叠')
  }
  console.log('PASS: 裁切数学（行列偏移、整体放大、10 档每块区域落在原图内且互不重叠）')
}

// ---------- 格子平铺 ----------
{
  for (const level of [1, 5, 10]) {
    setupLevel(level)
    const config = api.puzzleConfig(level)
    const boardW = api.boardW.value, boardH = api.boardH.value
    for (let slot = 0; slot < config.count; slot++) {
      const left = api.slotLeft(slot), top = api.slotTop(slot)
      const width = api.slotWidth(slot), height = api.slotHeight(slot)
      const col = slot % config.cols, row = Math.floor(slot / config.cols)
      assert(width > 0 && height > 0, 'L' + level + ' 格子尺寸为正')
      assert(left >= 0 && top >= 0, 'L' + level + ' 格子不越出棋盘左上')
      assert.equal(left + width, Math.round((col + 1) * boardW / config.cols), 'L' + level + ' 格子右边界')
      assert.equal(top + height, Math.round((row + 1) * boardH / config.rows), 'L' + level + ' 格子下边界')
      // 同一行相邻格子必须严丝合缝
      if (col + 1 < config.cols) {
        assert.equal(left + width, api.slotLeft(slot + 1), 'L' + level + ' 第 ' + slot + ' 格与右邻不留缝不重叠')
      }
    }
    const lastSlot = config.count - 1
    assert(api.slotLeft(lastSlot) + api.slotWidth(lastSlot) <= boardW, 'L' + level + ' 最后一格在棋盘内')
    assert(api.slotTop(lastSlot) + api.slotHeight(lastSlot) <= boardH, 'L' + level + ' 最后一格在棋盘内')
    // 托盘格子宽度 = 拼块宽 + 间隔，命中判定用的就是这个跨度
    assert.equal(api.trayCellW.value, api.cellW.value + CELL_GAP, 'L' + level + ' 托盘格子跨度')
  }
  console.log('PASS: 格子平铺（2×2 / 3×4 / 5×6 严丝合缝、铺满棋盘）')
}

// ---------- 落点判定 ----------
{
  setupLevel(1)
  for (let slot = 0; slot < api.count.value; slot++) {
    assert.equal(api.hitSlot(slotCenterX(slot), slotCenterY(slot)), slot, '格子中心应命中第 ' + slot + ' 格')
  }
  assert.equal(api.hitSlot(CONTENT_PAD + 5, api.boardTopLocal() + 5), 0, '左上角属于第 0 格')
  assert.equal(api.hitSlot(slotCenterX(0), api.trayTopLocal() + 10), -1, '托盘区域返回 -1')
  assert.equal(api.hitSlot(slotCenterX(0), api.trayTopLocal() + TRAY_H + 10), DROP_NONE, '托盘下方不算落点')
  assert.equal(api.hitSlot(CONTENT_PAD - 10, api.boardTopLocal() + 5), DROP_NONE, '棋盘左侧外不落子')
  assert.equal(api.hitSlot(CONTENT_PAD + 5, api.boardTopLocal() - 10), DROP_NONE, '目标卡区域不落子')
  console.log('PASS: 落点判定（格子中心、托盘区域、棋盘以内以外）')
}

// ---------- 托盘几何与横向滑动 ----------
// 拖动只靠手指位移推进，落点用拼块中心（页面坐标）；这里验证托盘的几何与滑动行为。
{
  setupLevel(5)
  const cellW = api.cellW.value
  // 拼块中心位置：第一格中心、第二格中心，以及第二格就该落在首个间隔之后
  assert.equal(api.trayCenterX(0), CONTENT_PAD + cellW / 2, '第一块中心')
  assert.equal(api.trayCenterX(1), CONTENT_PAD + cellW + CELL_GAP + cellW / 2, '第二块中心')
  assert.equal(api.trayCenterY(), api.trayTopLocal() + TRAY_H / 2, '托盘拼块中心在托盘中部')
  // 托盘空白处横向拖动＝翻托盘
  api.trayBackgroundStart()
  api.gestureMove(move(200, 500)) // 第一次移动只定锚点
  api.gestureMove(move(140, 505))
  api.gestureEnd()
  assert(api.trayScroll.value > 0, '横向拖动应滚动托盘，实际 ' + api.trayScroll.value)
  assert.equal(api.selected.value, -1, '翻空白不应选中拼块')
  assert.equal(api.dragPiece.value, -1, '翻空白不应产生浮动拼块')
  const scrolled = api.trayScroll.value
  // 滚动后拼块中心跟着偏移，落点用的就是这个值
  assert.equal(api.trayCenterX(0), CONTENT_PAD + cellW / 2 - scrolled, '滚动后拼块中心随之左移')
  api.trayBackgroundStart()
  api.gestureMove(move(140, 505))
  api.gestureMove(move(200, 500))
  api.gestureEnd()
  assert.equal(api.trayScroll.value, 0, '反向滑动应回到起点')
  // 托盘拼块上横向滑也是翻托盘，不会拿起拼块
  api.trayStart(api.tray.value[0], 0)
  api.gestureMove(move(200, 500))
  api.gestureMove(move(120, 508))
  assert.equal(api.dragPiece.value, -1, '横向滑动托盘拼块不应拿起它')
  api.gestureEnd()
  assert(api.trayScroll.value > 0, '横向滑动托盘拼块应翻托盘')
  assert.equal(api.slots.value.indexOf(api.tray.value[0]) < 0, true, '拼块仍在托盘')
  api.trayBackgroundStart()
  api.gestureMove(move(-100, 0))
  api.gestureMove(move(0, 0))
  api.gestureEnd()
  console.log('PASS: 托盘几何与横向滑动（滑动不误选、不误拿起拼块）')
}

// ---------- 试玩：点选放置 ----------
{
  advance(400) // 越过上节滑动结束后的点击抑制窗口
  enterDemo()
  api.onBoardLoaded()
  assert.equal(storage.size, 0, '试玩不写「已看过」')
  const piece = api.tray.value[0]
  api.tapTrayPiece(piece)
  assert.equal(api.selected.value, piece, '点托盘可选中拼块')
  api.tapSlot(piece)
  assert.equal(api.slots.value[piece], piece, '再点对应格子应放进去')
  assert.equal(api.tray.value.indexOf(piece), -1, '放下的拼块离开托盘')
  assert.equal(api.steps.value, 1, '计一步')
  assert.equal(api.mistakes.value, 0, '试玩不计失误')
  assert.equal(api.feedbackGood.value, true)
  const other = api.tray.value[0]
  const wrong = (other + 1) % api.count.value
  api.tapTrayPiece(other)
  api.tapSlot(wrong)
  assert.equal(api.slots.value[wrong], other, '试玩也允许先放错，之后再交换')
  assert.equal(api.mistakes.value, 0, '试玩不记失误')
  console.log('PASS: 试玩点选放置（选中→放格、试玩不记失误、不写已看列表）')
}

// ---------- 正式训练：失误、交换、移动、退回托盘 ----------
{
  storage.clear()
  difficultyLevel = 2
  api.begin()
  assert.equal(api.started.value, true, '点开始进入正式训练')
  assert.equal(api.count.value, 6, 'L2 是 2×3')
  assert.equal(api.totalRounds.value, 3, 'L2 共 3 轮')
  assert.equal(api.roundIndex.value, 0)
  assert.equal(api.boardReady.value, false, '换新图要等加载')
  assert.equal(storage.size, 0, '图片没显示出来之前不算看过')
  api.onBoardLoaded()
  assert.equal(api.boardReady.value, true)
  const seen = storage.get('focus_puzzle_seen_v1' + '_local_test')
  assert(Array.isArray(seen) && seen.length === 1, '图片一显示就记进「已看」，实际 ' + JSON.stringify(seen))
  // 放错记失误，拼块留在格子里
  const piece = api.tray.value[0]
  const wrongSlot = (piece + 1) % api.count.value
  api.tapTrayPiece(piece)
  api.tapSlot(wrongSlot)
  assert.equal(api.slots.value[wrongSlot], piece, '放错也留在格子里，靠交换纠正')
  assert.equal(api.mistakes.value, 1, '正式训练放错记 1 次失误')
  assert.equal(api.feedbackGood.value, false)
  // 放进已占格子：原拼块退回托盘
  const incoming = api.tray.value[0]
  const trayBefore = api.tray.value.length
  api.tapTrayPiece(incoming)
  api.tapSlot(wrongSlot)
  assert.equal(api.slots.value[wrongSlot], incoming, '新拼块占据该格')
  assert.equal(api.tray.value.length, trayBefore, '被换下的拼块回到托盘，托盘数量不变')
  assert(api.tray.value.indexOf(piece) >= 0, '被换下的是原先那块')
  // 选中格子里的拼块 → 点空格 → 移动
  const from = wrongSlot
  const empty = api.slots.value.indexOf(-1)
  assert(empty >= 0, '应有空格')
  const moving = api.slots.value[from]
  api.tapSlot(from)
  assert.equal(api.selected.value, moving, '点格子可选中里面的拼块')
  api.tapSlot(empty)
  assert.equal(api.slots.value[empty], moving, '移动到空格')
  assert.equal(api.slots.value[from], -1, '原格清空')
  assert.equal(api.selected.value, -1, '操作完取消选中')
  // 再放一块，凑出两个已占格子，才谈得上交换
  const second = api.tray.value[0]
  const secondSlot = api.slots.value.indexOf(-1)
  assert(secondSlot >= 0 && secondSlot != empty, '应有第二个空格可放')
  api.tapTrayPiece(second)
  api.tapSlot(secondSlot)
  assert.equal(api.slots.value[secondSlot], second, '第二块应放进格子')
  // 格子间交换
  const occupied = api.slots.value.findIndex((value, index) => value >= 0 && index != empty)
  assert(occupied >= 0, '应有第二个已占格子')
  const before = api.slots.value.slice()
  api.tapSlot(empty)
  api.tapSlot(occupied)
  assert.equal(api.slots.value[occupied], before[empty], '交换后目标格拿到原拼块')
  assert.equal(api.slots.value[empty], before[occupied], '原格拿到对方的拼块')
  // 退回托盘
  const holder = api.slots.value.findIndex(value => value >= 0)
  const returning = api.slots.value[holder]
  const trayLen = api.tray.value.length
  api.tapSlot(holder)
  api.tapTrayBackground()
  assert.equal(api.slots.value[holder], -1, '格子清空')
  assert(api.tray.value.indexOf(returning) >= 0, '拼块回到托盘')
  assert.equal(api.tray.value.length, trayLen + 1)
  console.log('PASS: 正式训练（放错记失误、占位交换退回托盘、格子间移动与交换、退回托盘）')
}

// ---------- 拖动与残留点击抑制 ----------
// 拖动把「拼块中心」当成手指的延伸：中心 = 抓取时的中心 + 手指位移，
// 松动后直接用这个中心判定落点 —— 与用户看到的位置一致，也不依赖 client 零点。
{
  advance(400)
  enterDemo()
  api.onBoardLoaded()
  const piece = api.tray.value[0]
  api.trayStart(piece, 0)
  assert.equal(api.dragPiece.value, -1, '刚按下还不算拖动')
  assert.equal(api.selected.value, -1, '刚按下还没选中')
  api.gestureMove(move(0, 0)) // 第一次移动只定锚点
  assert.equal(api.dragPiece.value, -1, '只定锚点时还不算拖动')
  api.gestureMove(move(0, -20)) // 纵向起手
  assert.equal(api.dragPiece.value, piece, '纵向拖动应拿起拼块')
  // 拖到该拼块自己的格子：位移 = 目标格中心 - 抓取时的中心
  const dx = slotCenterX(piece) - api.trayCenterX(0)
  const dy = slotCenterY(piece) - api.trayCenterY()
  api.gestureMove(move(dx, dy))
  assert(Math.abs(api.dragX.value - slotCenterX(piece)) < 1e-6, '浮动拼块中心应落在目标格中心')
  assert(Math.abs(api.dragY.value - slotCenterY(piece)) < 1e-6, '浮动拼块中心应落在目标格中心')
  api.gestureEnd()
  assert.equal(api.slots.value[piece], piece, '拖到对应格子应放下')
  assert.equal(api.dragPiece.value, -1, '松手后浮动拼块消失')
  const other = api.tray.value[0]
  api.tapTrayPiece(other)
  assert.equal(api.selected.value, -1, '拖动后紧跟的点击应被抑制，避免重复落子')
  // 从格子里拖出来：落到棋盘外偏下的托盘区域，应收回托盘
  api.slotStart(piece)
  api.gestureMove(move(0, 0))
  api.gestureMove(move(0, 20))
  assert.equal(api.dragPiece.value, piece, '格子里的拼块也能拖起')
  const dropX = slotCenterX(piece) + 10
  const dropY = api.trayTopLocal() + 20
  api.gestureMove(move(dropX - slotCenterX(piece), dropY - slotCenterY(piece)))
  api.gestureEnd()
  assert.equal(api.slots.value[piece], -1, '拖到托盘应把拼块收回')
  assert(api.tray.value.indexOf(piece) >= 0, '拼块回到托盘')
  // 空格子按下不应产生拖动
  const emptySlot = api.slots.value.indexOf(-1)
  api.slotStart(emptySlot)
  api.gestureMove(move(0, 0))
  api.gestureMove(move(0, -40))
  assert.equal(api.dragPiece.value, -1, '空格子拖动不应拿起任何拼块')
  api.gestureEnd()
  // 拖动与点选可以混用：拿不到拼块时不会误判成拖动
  assert.equal(api.selected.value, -1, '空格子不应选中任何拼块')
  console.log('PASS: 拖动（中心跟手、落点等于看到的位置、拖回托盘、空格子不响应、抑制残留点击）')
}

// ---------- 完成一轮、换轮、整局结算 ----------
{
  setupLevel(1) // 2×2，3 轮
  assert.equal(api.totalRounds.value, 3, 'L1 共 3 轮')
  const playRound = () => {
    for (let piece = 0; piece < api.count.value; piece++) {
      if (api.tray.value.indexOf(piece) >= 0) api.placeFromTray(piece, piece)
      else {
        const at = api.slots.value.indexOf(piece)
        if (at >= 0 && at != piece) api.moveBetweenSlots(at, piece)
      }
    }
    assert.equal(api.puzzleSolved(api.slots.value), true, '应能拼完本轮')
    assert.equal(api.roundComplete.value, true, '本轮结束')
    assert.equal(api.placedCount.value, api.count.value, '已拼好数量正确')
  }
  playRound()
  assert.equal(api.passedRounds.value, 1, '第 1 轮应达标')
  advance(1000)
  assert.equal(api.roundIndex.value, 1, '计时结束后进入第 2 轮')
  assert.equal(api.boardReady.value, false, '新轮要等图片加载')
  assert.equal(api.mistakes.value, 0, '新轮失误清零')
  assert(api.slots.value.every(v => v === -1), '新轮格子空')
  api.onBoardLoaded()
  playRound()
  advance(1000)
  assert.equal(api.roundIndex.value, 2)
  api.onBoardLoaded()
  playRound()
  advance(1000)
  assert.equal(redirects.length, 1, '3 轮打完应跳结算页，实际 ' + redirects.length + ' 次')
  const url = redirects[0]
  assert(url.indexOf('gameId=puzzle') >= 0, '结算带 gameId=puzzle')
  assert(url.indexOf('dimensionId=selective') >= 0, '主维度是选择注意')
  assert(url.indexOf('roundScores=') >= 0, '结算带每轮分数')
  assert(url.indexOf('total=3') >= 0, '结算带总轮数')
  assert(url.indexOf('completed=3') >= 0, '三轮达标')
  assert(url.indexOf('score=100') >= 0 && url.indexOf('accuracy=100') >= 0, '三轮无失误应报满分口径，实际 ' + url.slice(0, 120))
  assert(feedbacks.indexOf('correct') >= 0 && feedbacks.indexOf('wrong') >= 0, '正确/错误反馈都触发过')
  console.log('PASS: 完成一轮→换轮→3 轮后跳结算 ' + url.slice(0, 88) + '…')
}

// ---------- 目标时间与计分口径 ----------
{
  const config = api.puzzleConfig(1)
  setupLevel(1)
  assert.equal(api.targetMs.value, config.targetMs, '本轮目标时间取自难度配置')
  for (let round = 0; round < config.rounds; round++) {
    advance(config.targetMs) // 本轮正好用满目标时间
    for (let piece = 0; piece < api.count.value; piece++) api.placeFromTray(piece, piece)
    assert.equal(api.roundComplete.value, true, '第 ' + (round + 1) + ' 轮应结束')
    if (round + 1 < config.rounds) {
      advance(800)
      assert.equal(api.roundIndex.value, round + 1, '应进入下一轮')
      api.onBoardLoaded()
    }
  }
  advance(800)
  assert.equal(redirects.length, 1, '应跳结算')
  const url = redirects[0]
  const matched = url.match(/roundScores=([^&]*)/)
  assert(matched != null, '结算应带每轮分数')
  const scores = matched[1].split(',').map(Number)
  assert.equal(scores.length, config.rounds, '每轮一条分数')
  for (const score of scores) assert.equal(score, 100, '正好用满目标时间且无失误应得 100 分，实际 ' + score)
  assert(url.indexOf('completed=' + config.rounds.toString()) >= 0, '各轮均达标')
  console.log('PASS: 目标时间口径（L1 每轮 ' + (config.targetMs / 1000) + 's 时限下无失误正好 100 分，共 ' + config.rounds + ' 轮）')
}

// ---------- 小屏复核 ----------
{
  windowWidth = 375
  windowHeight = 667
  statusBarHeight = 20
  enterDemo()
  const bottom = api.trayTopLocal() + TRAY_H + 32 + 60
  assert(bottom <= windowHeight - FRAME_TOP(), '小屏内容不应溢出，实际底部 ' + bottom + ' 可用 ' + (windowHeight - FRAME_TOP()))
  assert(api.boardW.value <= windowWidth - CONTENT_PAD * 2, '小屏棋盘不超宽')
  assert(api.boardH.value > 100, '小屏棋盘不应过小，实际 ' + api.boardH.value)
  const demoBoardH = api.boardH.value, demoBoardW = api.boardW.value
  // 正式训练没有「开始」按钮那段留白，棋盘应该更大
  setupLevel(1)
  assert(api.boardH.value > demoBoardH, '正式训练棋盘应更大，试玩 ' + demoBoardH + ' 正式 ' + api.boardH.value)
  const startedBottom = api.trayTopLocal() + TRAY_H + 32 + 60
  assert(startedBottom <= windowHeight - FRAME_TOP(), '正式训练内容也不应溢出')
  console.log('PASS: 小屏 375×667 复核（试玩棋盘 ' + demoBoardW + '×' + demoBoardH + '、正式 ' + api.boardW.value + '×' + api.boardH.value + '，都不溢出）')
}

console.log('拼图工坊页面回归通过')
