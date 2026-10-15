const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..')
const read = p => fs.readFileSync(path.join(root, p), 'utf8')
const frame = read('components/TrainingFrame.uvue')
assert.ok(frame.includes('v-if="preparing" class="training-difficulty"'))
assert.ok(frame.includes('v-else class="training-pause"'))
let count = 0
for (const file of fs.readdirSync(path.join(root, 'pages/game'))) {
  if (!file.endsWith('.uvue')) continue
  const source = read('pages/game/' + file)
  if (!source.includes('<TrainingFrame ')) continue
  count++
  assert.match(source, /<TrainingFrame :difficulty="[^"]+" :preparing="[^"]+"/, file)
  const template = source.slice(0, source.lastIndexOf('</template>'))
  for (const button of template.matchAll(/<button\b[^>]*@click(?:\.stop)?="begin"[^>]*>/g)) {
    assert.ok(button[0].includes('training-preview-primary'), file + ' begin button')
  }
  assert.ok(source.includes('background-color: #8d9bdb'), file + ' shared palette')
  assert.ok(!/max-width:\s*\d+%/.test(source), file + ' native max-width requires pixels')
  assert.ok(!/<button[^>]*>\s*<(text|view|image)\b/.test(template), file + ' native button children')
  // 试玩/重试入口必须是原生 button：用 <text> 撑出来的“按钮”在原生端命中区域不可靠。
  assert.ok(!/<text[^>]*training-preview-secondary/.test(template), file + ' trial control must be a native button')
  // 准备页的两个按钮必须有固定的上下间距，否则主/次按钮会贴在一起。
  const secondary = source.match(/\.training-preview-secondary \{([^}]*)\}/)
  if (secondary) assert.ok(/margin-top:\s*12px/.test(secondary[1]), file + ' secondary button needs a 12px top gap')
  // 只用 training-preview-card 当卡片、又不补内边距时，按钮会直接贴到卡片边缘。
  for (const card of ['mr-intro', 'nt-intro', 'pf-intro']) {
    const match = source.match(new RegExp('\\.' + card + ' \\{([^}]*)\\}'))
    if (match) assert.ok(/padding:/.test(match[1]), file + ' ' + card + ' needs card padding')
  }
}
assert.equal(count, 29)

// 试玩不得进页面就自动跑（音频/动画会和孩子听到的说明语音叠在一起）。
function callBody(source, name) {
  const start = source.indexOf(name + '(')
  if (start < 0) return ''
  const open = source.indexOf('(', start)
  let depth = 0, close = -1
  for (let i = open; i < source.length; i++) {
    const c = source[i]
    if (c == '(') depth++
    else if (c == ')') { depth--; if (depth == 0) { close = i; break } }
  }
  if (close < 0) return ''
  // function 声明：继续取后面的花括号函数体；回调（如 onLoad）直接返回参数里的箭头函数。
  let brace = close + 1
  while (brace < source.length && /\s/.test(source[brace])) brace++
  if (source[brace] != '{') return source.slice(open + 1, close)
  let braces = 0
  for (let i = brace; i < source.length; i++) {
    if (source[i] == '{') braces++
    else if (source[i] == '}') { braces--; if (braces == 0) return source.slice(brace + 1, i) }
  }
  return ''
}
for (const file of ['listen-find', 'sound-filter', 'memory-search', 'motion-challenge']) {
  const source = read('pages/game/' + file + '.uvue')
  for (const hook of ['onLoad', 'onShow', 'onReady']) {
    const body = callBody(source, hook)
    assert.ok(!/\bstartDemo\(|\bsetupTrial\(/.test(body), file + ' must not auto-start a trial in ' + hook)
  }
}
// 会开口/跑动的试玩一开始就必须压掉准备页说明语音，避免两句叠着。
for (const [file, fn] of [['listen-find', 'startDemo'], ['sound-filter', 'startDemo'], ['memory-search', 'setupTrial'], ['audio-sequence', 'beginTrial'], ['breathing-planet', 'beginTrial'], ['memory-link', 'beginTrial'], ['order-guess', 'beginTrial'], ['bird-cloud', 'startDemo'], ['car-patrol', 'startDemo'], ['little-driver', 'startDemo'], ['dual-track', 'startDemo'], ['spot-difference', 'setupTrial']]) {
  const body = callBody(read('pages/game/' + file + '.uvue'), 'function ' + fn)
  assert.ok(body.includes('stopIntro'), file + '.' + fn + ' must stop the intro voice')
}
assert.ok(read('pages/game/forest-search.uvue').includes(':src="FOREST_SEARCH_BACKGROUND"'))
assert.ok(read('pages/game/number-track.uvue').includes(':src="NUMBER_TRACK_BACKGROUND"'))
console.log('PASS: 29 training pages, preparation difficulty / gameplay pause, unified start controls, native button constraints and background wiring')
