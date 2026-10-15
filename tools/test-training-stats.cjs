// 训练统计口径回归：星训练 / 星小屋 的四个数字必须优先用服务端数据，本地只做首帧与离线兜底。
// 这里把 utils/training-stats.uts 装进 vm 用内存存储与桩接口跑，校验口径、去重、缓存与「不降到本地之下」。
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const strip = text => text.replace(/^import .*$/gm, '').replace(/^export /gm, '')

const DAY = 24 * 60 * 60 * 1000
const now = new Date(2026, 8, 29, 15, 0, 0).getTime()
const iso = timestamp => new Date(timestamp).toISOString()

// 被测代码里 storage.uts 的 getWeeklyRecords / calculateStreak 会读真实时钟，
// 若不同步成用例的 now，这些「等口径」断言会随运行日期漂移（今天跑就跨出 7 天窗口）。
// 这里把沙箱时钟固定到 now：new Date() 与 Date.now() 都返回 now，new Date(ts) 保持原语义。
function fixedClock(fixedNow) {
  return class FixedDate extends Date {
    constructor(...args) { super(...(args.length === 0 ? [fixedNow] : args)) }
    static now() { return fixedNow }
  }
}

function loadStats(options) {
  const storage = new Map(options.storage || [])
  const requests = []
  const deps = [
    // 本地测试开关钉在发布值：开关打开时存储键会变成 _local_test 后缀，用例会跟着漂移。
    strip(read('utils/local-test.uts')).replace(/LOCAL_TEST_MODE = (true|false)/, 'LOCAL_TEST_MODE = false'),
    strip(read('utils/star-rating.uts')),
    strip(read('utils/storage.uts')),
    strip(read('utils/training-stats.uts'))
  ].join('\n')
  const sandbox = {
    console,
    Math, Number, Date: fixedClock(now), JSON,
    uni: {
      getStorageSync: key => (storage.has(key) ? storage.get(key) : ''),
      setStorageSync: (key, value) => storage.set(key, value),
      removeStorageSync: key => storage.delete(key)
    },
    // 真实接口一定会回 success 或 failure，桩同样如此
    getOverviewReport: (success, failure) => { requests.push('overview'); if (options.overview) success(options.overview); else failure('网络不可用', 'NETWORK_ERROR') },
    getRecentTrainingResults: (_limit, success, failure) => { requests.push('records'); if (options.records) success(options.records); else failure('网络不可用', 'NETWORK_ERROR') }
  }
  vm.createContext(sandbox)
  const exposed = [
    'localTrainingStats', 'cachedTrainingStats', 'saveTrainingStats', 'applyTrainingRecords',
    'applyTrainingOverview', 'refreshTrainingStats', 'parseTrainingRecords', 'trainingStatsStale',
    // storage.uts 的原始口径，用来做等价断言
    'getRecords', 'getWeeklyRecords', 'calculateStreak', 'reportStarCount'
  ]
  vm.runInContext(ts.transpileModule(deps + '\nglobalThis.api = {' + exposed.join(',') + '}', {
    compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2020 }
  }).outputText, sandbox)
  sandbox.api.__storage = storage
  sandbox.api.__requests = requests
  return sandbox.api
}

function sessionStorage(records) {
  // saveAuthSession/saveRecords 的真实写法：会话是对象，记录是 JSON 字符串。
  return [
    ['focus_planet_auth_session', { userId: 'u1' }],
    ['focus_planet_records_u1', JSON.stringify(records)]
  ]
}

// ---------- 本地口径与 storage.uts 原有语义完全一致 ----------
{
  const records = [
    { gameId: 'puzzle', score: 100, durationSeconds: 60, completedAt: now - 3600 * 1000 },
    { gameId: 'puzzle', score: 40, durationSeconds: 30, completedAt: now - 2 * 3600 * 1000 },
    { gameId: 'puzzle', score: 90, durationSeconds: 120, completedAt: now - 3 * DAY }
  ]
  const api = loadStats({ storage: sessionStorage(records) })
  const local = api.getRecords()
  const stats = api.localTrainingStats(now)
  assert.equal(stats.todaySeconds, 90, '今日时长只累计今天的两局')
  assert.equal(stats.weeklySessions, api.getWeeklyRecords(local).length, '本周次数与 getWeeklyRecords 同口径')
  assert.equal(stats.streakDays, api.calculateStreak(local), '连续天数与 calculateStreak 同口径')
  assert.equal(stats.stars, local.reduce((total, item) => total + api.reportStarCount(item.score), 0), '能量按 reportStarCount 逐局累加')
  assert.equal(stats.totalSessions, 3)
  assert.equal(stats.totalDurationSeconds, 210)
  assert.equal(stats.activeDays, 2)
  assert.equal(stats.source, 'local')
}

// ---------- 服务端窗口数据覆盖本地，且与本地成绩去重 ----------
{
  const localRecord = { gameId: 'puzzle', score: 100, durationSeconds: 60, completedAt: now - 3600 * 1000 }
  const payload = { records: [
    // 与本地同一条：去重后不能算两次
    { score: 100, durationSeconds: 60, clientCompletedAt: iso(now - 3600 * 1000) },
    // 只存在于服务端（另一台设备 / 重装前）：昨天，用来验证连续天数被补齐
    { score: 100, durationSeconds: 200, clientCompletedAt: iso(now - DAY) }
  ] }
  const api = loadStats({ storage: sessionStorage([localRecord]), records: payload })
  const stats = api.applyTrainingRecords(payload, now)
  assert.equal(stats.todaySeconds, 60, '服务端 + 本地同一条只算一次')
  assert.equal(stats.weeklySessions, 2, '服务端补上的昨天成绩计入本周')
  assert.equal(stats.streakDays, 2, '服务端成绩把连续天数补成 2 天')
  assert.equal(stats.totalSessions, 1, '累计项等 /reports/overview，不被窗口数据改写')
  assert.equal(stats.source, 'server')
}

// ---------- /reports/overview 的 allTime 决定累计项，跨设备正确 ----------
{
  const api = loadStats({
    storage: sessionStorage([{ gameId: 'puzzle', score: 80, durationSeconds: 60, completedAt: now }]),
    overview: { allTime: { completedLessons: 4, completedGames: 42, trainingDurationSeconds: 3600, activeDays: 12 } }
  })
  const overview = { allTime: { completedLessons: 4, completedGames: 42, trainingDurationSeconds: 3600, activeDays: 12 } }
  const stats = api.applyTrainingOverview(overview, now)
  assert.equal(stats.totalSessions, 42, '累计次数用服务端全量')
  assert.equal(stats.totalDurationSeconds, 3600)
  assert.equal(stats.activeDays, 12)
  // refreshTrainingStats 会把合并结果落盘；在它之后即使服务端回更小的值，也不允许把数字降下去
  api.saveTrainingStats(stats)
  const lowered = api.applyTrainingOverview({ allTime: { completedLessons: 0, completedGames: 0, trainingDurationSeconds: 0, activeDays: 0 } }, now)
  assert.equal(lowered.totalSessions, 42, '缓存里的服务端累计不被更小的响应降下去')
  assert.equal(lowered.totalDurationSeconds, 3600)
}

// ---------- 缓存：按账号隔离、有 TTL、refresh 去重并落盘 ----------
{
  const key = 'focus_training_stats_v1_u1'
  const cached = { todaySeconds: 30, weeklySessions: 1, stars: 3, streakDays: 1, totalSessions: 9, totalDurationSeconds: 900, activeDays: 3, source: 'server', syncedAt: now }
  const storage = new Map([...sessionStorage([]), [key, { savedAt: now, stats: cached }]])
  const api = loadStats({ storage, records: { records: [] }, overview: { allTime: { completedGames: 9, trainingDurationSeconds: 900, activeDays: 3 } } })
  assert.equal(api.cachedTrainingStats().totalSessions, 9, '缓存命中时先渲染服务端数字')
  assert.equal(api.trainingStatsStale(), false)
  let resolved = null
  api.refreshTrainingStats(stats => { resolved = stats }, (_m, _c) => assert.fail('刷新不应失败'))
  assert.deepEqual(api.__requests.slice().sort(), ['overview', 'records'], '刷新要同时拿成绩与全量报告')
  assert.equal(resolved.totalSessions, 9)
  assert.ok(api.__storage.get(key) != null, '刷新成功要落盘给下次首帧用')

  const expiredStorage = new Map([...sessionStorage([]), [key, { savedAt: now - 60 * 60 * 1000, stats: cached }]])
  const expired = loadStats({ storage: expiredStorage, records: { records: [] }, overview: { allTime: {} } })
  assert.equal(expired.cachedTrainingStats(), null, '超过 TTL 的缓存必须失效')
  assert.equal(expired.trainingStatsStale(), true)
}

// ---------- 两个接口都失败时明确报错，页面继续用本地值 ----------
{
  const api = loadStats({ storage: sessionStorage([]) })
  let failure = ''
  api.refreshTrainingStats(_stats => assert.fail('不应成功'), (message, _code) => { failure = message })
  assert.ok(failure.length > 0, '两个接口都失败要回调失败，让页面保留本地口径')
}

// ---------- 页面接线：星训练与星小屋都必须用这套口径 ----------
{
  const indexPage = read('pages/index/index.uvue')
  const minePage = read('pages/mine/mine.uvue')
  for (const [name, page] of [['首页', indexPage], ['星小屋', minePage]]) {
    assert.ok(/from '\.\.\/\.\.\/utils\/training-stats\.uts'/.test(page), `${name}必须引用 training-stats`)
    assert.ok(/applyStats\(/.test(page), `${name}必须通过统一的 applyStats 写数字`)
  }
  assert.ok(/applyTrainingRecords\(data, Date\.now\(\)\)/.test(indexPage), '首页要复用成绩接口响应算统计，不再单独请求')
  assert.ok(!/getRecords\(\)/.test(indexPage), '首页的数字不应再看本地记录')
  assert.ok(/refreshTrainingStats\(/.test(minePage), '星小屋进页时要主动刷服务端统计')
  assert.ok(!/getRecords\(\)/.test(minePage), '星小屋的四个数字不应再看本地记录')
  assert.ok(!/calculateStreak\(/.test(indexPage + minePage), '连续天数由 training-stats 统一计算')
}

console.log('PASS: 统计口径服务端优先、服务端/本地去重、累计项取服务端全量、缓存按账号隔离并有 TTL、两个页面接线正确')
