// NODE + TYPESCRIPT_PATH 可在其他电脑运行；无需启动 App 或连接服务端。
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root = path.resolve(__dirname, '..')
const planets = fs.readFileSync(path.join(root, 'utils/sky-planets.uts'), 'utf8').replace(/^export /gm, '')
const page = fs.readFileSync(path.join(root, 'pages/game/sky-watcher.uvue'), 'utf8')
const script = page.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
const names = 'skyPlanetSources,getSkyTiming,pickSkyDistractor,configureDifficulty,begin,showNext,onStimulusLoaded,onStimulusError,retryImage,pauseGame,resumeGame,tapStimulus,tapDemo,resetDemo,targetIndex,demoPlanets,demoDone,hits,omissions,falseAlarms,reactions,visible,stimulusReady,loadFailed,paused,finished,currentTarget,stimulusIndex,roundIndex,totalRounds,showDuration,gapDuration'
const code = ts.transpile(planets + '\n' + script + '\nglobalThis.api = {' + names + '}', { target: ts.ScriptTarget.ES2020 })
function harness(level) {
  let now = 10000, next = 0, url = '', seed = 71, randomOverride = null
  const timers = new Map()
  const random = () => randomOverride == null ? ((seed = (seed * 16807) % 2147483647) / 2147483647) : randomOverride
  const context = { ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }),
    onLoad: () => {}, onHide: () => {}, onUnload: () => {}, getGameDifficulty: () => level,
    Date: { now: () => now }, Math: Object.assign(Object.create(Math), { random }),
    uni: { redirectTo: options => { url = options.url } },
    setTimeout: (fn, delay) => { const id = ++next; timers.set(id, { fn, at: now + delay }); return id },
    clearTimeout: id => timers.delete(id) }
  vm.createContext(context); require('./training-test-env.cjs').install(context); vm.runInContext(code, context)
  function tick(ms) {
    const until = now + ms
    while (true) {
      const due = [...timers].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      timers.delete(due[0]); now = due[1].at; due[1].fn()
    }
    now = until
  }
  return { t: context.api, tick, timers, random: value => { randomOverride = value }, url: () => url }
}

for (let level = 1; level <= 10; level++) {
  const h = harness(level), t = h.t
  t.configureDifficulty()
  assert.equal(t.skyPlanetSources.length, 20)
  t.skyPlanetSources.forEach(src => assert(fs.existsSync(path.join(root, src.slice(1))), src))
  if (level > 1) {
    assert(t.getSkyTiming(level).showMs < t.getSkyTiming(level - 1).showMs)
    assert(t.getSkyTiming(level).gapMs < t.getSkyTiming(level - 1).gapMs)
  }
  for (let target = 0; target < 4; target++) {
    for (let i = 0; i < 300; i++) {
      const id = t.pickSkyDistractor(level, target)
      assert(id >= 0 && id < 20 && id != target)
      if (level <= 3) assert(id >= 8)
    }
    if (level >= 7) { h.random(0); assert(t.pickSkyDistractor(level, target) < 4); h.random(null) }
  }
  const target = t.targetIndex.value
  assert.equal(t.demoPlanets.value.length, 2)
  assert(t.demoPlanets.value.includes(target))
  t.tapDemo(t.demoPlanets.value.find(id => id != target)); assert.equal(t.demoDone.value, false)
  t.tapDemo(target); assert.equal(t.demoDone.value, true)
  assert.equal(t.hits.value, 0); assert.equal(t.falseAlarms.value, 0); assert.equal(h.timers.size, 0)
  t.resetDemo(); assert.equal(t.demoDone.value, false)
  t.begin(); t.begin(); assert.equal(h.timers.size, 1)
  // 满分训练：每个真实目标点一次，干扰不点；图片加载完成前点击无效。
  while (!t.finished.value) {
    h.tick(t.gapDuration.value)
    if (t.finished.value) break
    assert.equal(t.stimulusReady.value, false)
    const hits = t.hits.value; t.tapStimulus(); assert.equal(t.hits.value, hits)
    h.tick(80); t.onStimulusLoaded(); t.onStimulusLoaded()
    assert.equal(h.timers.size, 1)
    if (t.currentTarget.value) { h.tick(100); t.tapStimulus(); t.tapStimulus() }
    h.tick(t.showDuration.value)
    assert.equal(t.targetIndex.value, target)
  }
  assert(h.url().includes('&score=100&'))
  assert.equal(t.hits.value, Math.max(4, Math.round(t.totalRounds.value * 0.35)))
  assert.equal(t.omissions.value, 0); assert.equal(t.falseAlarms.value, 0)
  assert.equal(h.timers.size, 0)
}
{
  const h = harness(1), t = h.t
  t.configureDifficulty(); t.begin(); h.tick(t.gapDuration.value)
  h.tick(5000); assert.equal(t.loadFailed.value, true); assert.equal(t.omissions.value, 0)
  t.retryImage(); t.onStimulusLoaded()
  t.currentTarget.value = true; t.tapStimulus(); assert.equal(t.hits.value, 1)
  // 保留当前刺激及剩余时间，不重抽/跳过当前题。
  t.pauseGame(); assert.equal(t.roundIndex.value, 0); assert.equal(h.timers.size, 0)
  h.tick(20000); t.resumeGame(); assert.equal(t.roundIndex.value, 0)
  h.tick(t.showDuration.value); assert.equal(t.roundIndex.value, 1)
  h.tick(t.gapDuration.value)
  t.onStimulusLoaded(); t.currentTarget.value = true
  h.tick(t.showDuration.value); assert.equal(t.omissions.value, 1)
  h.tick(t.gapDuration.value); t.onStimulusLoaded(); t.currentTarget.value = false
  t.tapStimulus(); t.tapStimulus(); assert.equal(t.falseAlarms.value, 1)
  t.pauseGame(); assert.equal(h.timers.size, 0)
}
console.log('PASS: 20 assets; 10 timing levels; distractor exclusion; fixed target; two-option demo; load-gated timing; perfect runs; misses; pause/retry; no duplicate scoring.')
