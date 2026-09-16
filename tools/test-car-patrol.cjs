const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '..');
const logic = fs.readFileSync(path.join(root, 'utils/car-patrol.uts'), 'utf8').replace(/^export /gm, '');
const page = fs.readFileSync(path.join(root, 'pages/game/car-patrol.uvue'), 'utf8');
const script = page.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '');
const names = 'trainingPaused,getPatrolConfig,makePatrolWave,patrolDepth,patrolX,patrolY,patrolOverlaps,patrolConeSize,patrolConeOpacity,renderRoad,dashes,posts,state,level,config,backgroundReady,carReady,passed,hits,elapsed,carLane,targetLane,startDemo,begin,moveTo,pauseGame,resumeGame,updateGame,tick';
const code = ts.transpile(logic + '\n' + script + '\nglobalThis.api={' + names + ',getWaves:()=>waves,getTimers:()=>timer};', { target: ts.ScriptTarget.ES2020 });
function harness(level) {
  let now = 10000, id = 0, url = '', seed = 37;
  const timers = new Map(), lifecycle = {};
  const ctx = { ref: value => ({value}), computed: f => ({get value() {return f();}}), nextTick: f => f(), onReady: () => {}, onResize: () => {},
    onLoad: f => lifecycle.load = f, onHide: f => lifecycle.hide = f, onUnload: f => lifecycle.unload = f,
    getGameDifficulty: () => level, Date: {now: () => now},
    Math: Object.assign(Object.create(Math), {random: () => ((seed = seed * 16807 % 2147483647) / 2147483647)}),
    setInterval: f => {timers.set(++id, f); return id;}, clearInterval: id => timers.delete(id),
    uni: {redirectTo: o => url = o.url, navigateBack() {}, getElementById: () => ({ getBoundingClientRect: () => ({width:390,height:550}) })} };
  vm.createContext(ctx); require('./training-test-env.cjs').install(ctx); vm.runInContext(code, ctx); lifecycle.load();
  const t = ctx.api;
  t.backgroundReady.value = true; t.carReady.value = true;
  return {t, timers, lifecycle, step(ms = 33) { now += ms; if (timers.size) [...timers.values()][0](); }, url: () => url};
}
for (let level = 1; level <= 10; level++) {
  const h = harness(level), t = h.t, c = t.getPatrolConfig(level);
  if (level > 1) {
    const previous = t.getPatrolConfig(level - 1);
    assert(c.travelMs < previous.travelMs); assert(c.gapMs < previous.gapMs); assert(c.lanes >= previous.lanes);
  }
  let safe = 0;
  for (let i = 0; i < 1000; i++) {
    const w = t.makePatrolWave(i, 0, c, safe);
    assert(w.lanes.length < c.lanes); assert(!w.lanes.includes(w.safeLane)); assert(w.lanes.includes(safe));
    assert.equal(Math.abs(w.safeLane - safe), 1); assert.equal(new Set(w.lanes).size, w.lanes.length);
    safe = w.safeLane;
  }
  // 试玩停在障碍前，必须主动换道；不污染分数。
  t.startDemo(); for (let i = 0; i < 230; i++) h.step();
  assert.equal(t.state.value, 'demo'); assert(t.elapsed.value < 6000); assert.equal(t.hits.value, 0);
  t.moveTo(1); for (let i = 0; i < 160 && t.state.value === 'demo'; i++) h.step();
  assert.equal(t.state.value, 'demo-done'); assert.equal(t.passed.value, 0); assert.equal(h.timers.size, 0);
  t.begin(); assert.equal(t.config.value.lanes, c.lanes); t.begin(); assert.equal(h.timers.size, 1);
  // 自动驾驶仅在上一波通过后选择最近障碍的安全车道；十级都应有可通行路径。
  let guard = 0;
  while (t.state.value === 'running' && guard++ < 10000) {
    const next = t.getWaves().find(w => !w.scored);
    if (next) t.moveTo(next.safeLane);
    h.step();
  }
  assert.equal(t.state.value, 'finished'); assert.equal(t.hits.value, 0, 'unfair level ' + level);
  assert.equal(t.passed.value, c.waves); assert(h.url().includes('&score=100&')); assert.equal(h.timers.size, 0);
}
{
  const h = harness(10), t = h.t; t.state.value = 'demo-done'; t.begin();
  for (let i = 0; i < 200; i++) h.step();
  assert(t.hits.value > 0); assert(t.hits.value <= t.getWaves().length + t.passed.value);
  const before = t.elapsed.value; h.lifecycle.hide(); h.step(10000);
  assert.equal(t.trainingPaused.value, true); assert.equal(t.elapsed.value, before); assert.equal(h.timers.size, 0);
  t.resumeGame(); assert.equal(h.timers.size, 1); h.step(1000); assert.equal(t.trainingPaused.value, true);
  t.resumeGame(); h.lifecycle.unload(); assert.equal(h.timers.size, 0);
}
const routes = JSON.parse(fs.readFileSync(path.join(root, 'pages.json'), 'utf8'));
// 正式训练无需先通过试玩；跳过途中试玩必须重置计时/成绩并只留一个计时器。
for (const demoFirst of [false, true]) {
  const h = harness(8), t = h.t;
  if (demoFirst) { t.startDemo(); h.step(100); }
  t.begin();
  assert.equal(t.state.value, 'running'); assert.equal(t.config.value.lanes, 4);
  assert.equal(t.elapsed.value, 0); assert.equal(t.passed.value, 0); assert.equal(t.hits.value, 0);
  assert.equal(t.getWaves().length, 0); assert.equal(h.timers.size, 1);
  t.begin(); assert.equal(h.timers.size, 1);
  h.lifecycle.unload(); assert.equal(h.timers.size, 0);
}
{
  const {t} = harness(1); t.carReady.value = false; t.begin();
  assert.equal(t.state.value, 'ready');
}
{
  const {t} = harness(10);
  const times = [6000,5500,5000,4800,4400,4000,3800,3500,3200,2900];
  const gaps = [3900,3500,3200,3000,2700,2450,2300,2100,1850,1650];
  for (let i = 1; i <= 10; i++) {
    assert.equal(t.getPatrolConfig(i).travelMs, times[i-1]);
    assert.equal(t.getPatrolConfig(i).gapMs, gaps[i-1]);
  }
  t.config.value = t.getPatrolConfig(10); t.renderRoad();
  const posts = JSON.stringify(t.posts.value);
  t.elapsed.value = 1800; t.renderRoad();
  assert.equal(JSON.stringify(t.posts.value), posts, 'roadside must remain stationary');
  assert.equal(t.dashes.value.length, 6);
  assert(t.dashes.value.every(d => d.opacity >= 0 && d.opacity <= 0.4));
  assert(t.dashes.value.some(d => d.height > 70), 'nearby markings should be long');
  assert(t.dashes.value.filter(d => d.id % 10 === 1).every(d => d.angle > 0));
  assert(t.dashes.value.filter(d => d.id % 10 === 2).every(d => d.angle === 0));
  assert(t.dashes.value.filter(d => d.id % 10 === 3).every(d => d.angle < 0));
  for (const d of t.dashes.value) {
    const expectedSlope = (d.id % 10 / 4 - 0.5) * 1.5 * 390 / 550;
    assert(Math.abs(-Math.tan(d.angle * Math.PI / 180) - expectedSlope) < 1e-10);
  }
  assert(t.patrolConeSize(0.08) > 20); assert.equal(t.patrolConeSize(1.16), 60);
  assert.equal(t.patrolConeOpacity(1.06), 1);
  assert(t.patrolConeOpacity(1.11) < 0.51); assert.equal(t.patrolConeOpacity(1.16), 0);
}
assert(routes.pages.some(p => p.path === 'pages/game/car-patrol'));
assert(page.includes('car-rear-v1.webp')); assert(page.includes('car-patrol-town-v1.webp'));
console.log('PASS: 10-level timing/density/lanes, 10,000 fair waves, demo isolation, full-score runs, collision, pause/resume/lag/unload, route');
