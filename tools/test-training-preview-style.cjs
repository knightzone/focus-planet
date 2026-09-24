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
}
assert.equal(count, 29)
assert.ok(read('pages/game/forest-search.uvue').includes(':src="FOREST_SEARCH_BACKGROUND"'))
assert.ok(read('pages/game/number-track.uvue').includes(':src="NUMBER_TRACK_BACKGROUND"'))
console.log('PASS: 29 training pages, preparation difficulty / gameplay pause, unified start controls, native button constraints and background wiring')
