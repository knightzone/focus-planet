// 登录态持久性回归：并发 401 只能触发一次刷新，刷新被拒时会话要清干净。
// 背景：冷启动/回前台会同时发多个鉴权请求（/vip/status、/training/records/sync、首页课程…）。
// 若服务端的刷新令牌是用一次换一次，并发刷新会让后到的请求拿着作废的旧令牌去换，
// 换失败就清会话，用户刚打开就被踢回登录页——这是「登录状态总是消失」的客户端侧主因。
// 不启动 App、不联网：uni.request 用挂起队列手动回放响应。
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root = path.resolve(__dirname, '..')

function loadApi(values, pending, log) {
  const modules = new Map()
  const uni = {
    getStorageSync: key => (values.has(key) ? values.get(key) : ''),
    setStorageSync: (key, value) => values.set(key, value),
    removeStorageSync: key => values.delete(key),
    $emit() {},
    getAppBaseInfo: () => ({ appVersionCode: '1' }),
    request: options => { log.push(options.url); pending.push(options) }
  }
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports
    const m = { exports: {} }
    modules.set(file, m)
    // 本地测试开关钉在发布值：开关打开时 getAccessToken/getRefreshToken 直接返回空串，
    // 刷新链路根本不会触发，这个用例会随仓库开关状态漂移。
    const source = fs.readFileSync(file, 'utf8')
      .replace(/LOCAL_TEST_MODE = (true|false)/, 'LOCAL_TEST_MODE = false')
    const js = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText
    vm.runInNewContext(js, {
      exports: m.exports, module: m, require: p => load(path.resolve(path.dirname(file), p)),
      uni, console, Date, Math, Number, JSON, setTimeout, clearTimeout, setInterval, clearInterval
    }, { filename: file })
    return m.exports
  }
  return load(path.join(root, 'utils/api-client.uts'))
}

const respondOk = (options, data) => options.success({ statusCode: 200, data: { data } })
const respond401 = (options, code) => options.success({ statusCode: 401, data: { error: { code, message: 'expired' } } })
const isRefresh = options => options.url.endsWith('/auth/token/refresh')

function seed(values) {
  values.set('focus_planet_access_token', 'old')
  values.set('focus_planet_refresh_token', 'old-r')
  values.set('focus_planet_auth_session', { userId: 'u1', provider: 'phone', displayName: '13800000000', accessToken: 'old', refreshToken: 'old-r' })
}

// ---------- 1. 并发 401 只刷新一次，三个请求都带新令牌重试成功 ----------
{
  const values = new Map(), pending = [], log = [], done = []
  seed(values)
  const api = loadApi(values, pending, log)
  for (let i = 0; i < 3; i++) api.apiRequest('/job' + i, 'POST', {}, true, () => done.push('ok' + i), (_m, c) => done.push('fail' + i + ':' + c))
  assert.equal(pending.length, 3, '三个鉴权请求都应发出')

  pending.splice(0, 3).forEach(options => respond401(options, 'TOKEN_EXPIRED'))
  assert.equal(log.filter(url => url.endsWith('/auth/token/refresh')).length, 1, '并发 401 只能发一个刷新请求')
  assert.equal(pending.length, 1, '此刻只应挂着一个刷新请求')
  const refreshRequest = pending.shift()
  assert.ok(isRefresh(refreshRequest), '挂着的应该是刷新请求')

  respondOk(refreshRequest, { accessToken: 'new', refreshToken: 'new-r' })
  assert.equal(values.get('focus_planet_access_token'), 'new', '刷新后的访问令牌要落盘')
  assert.equal(values.get('focus_planet_refresh_token'), 'new-r', '轮换后的刷新令牌要落盘')
  assert.equal(pending.length, 3, '刷新成功后三个请求都要重试')

  pending.splice(0, 3).forEach(options => {
    assert.equal(options.header['Authorization'], 'Bearer new', '重试必须带新令牌')
    respondOk(options, {})
  })
  assert.deepEqual(done.sort(), ['ok0', 'ok1', 'ok2'], '三个请求最终都要成功')
  assert.equal(values.has('focus_planet_auth_session'), true, '成功刷新不能动会话')
}

// ---------- 2. 刷新被服务端拒（令牌作废）→ 令牌与会话对象一起清，不留半登录 ----------
{
  const values = new Map(), pending = [], log = [], done = []
  seed(values)
  const api = loadApi(values, pending, log)
  api.apiRequest('/job', 'POST', {}, true, () => done.push('ok'), (_m, c) => done.push('fail:' + c))
  respond401(pending.shift(), 'TOKEN_EXPIRED')
  const refreshRequest = pending.shift()
  assert.ok(isRefresh(refreshRequest), '应发起刷新')
  respond401(refreshRequest, 'INVALID_TOKEN')
  assert.equal(values.has('focus_planet_access_token'), false, '访问令牌要清掉')
  assert.equal(values.has('focus_planet_refresh_token'), false, '刷新令牌要清掉')
  assert.equal(values.has('focus_planet_auth_session'), false, '会话对象也要清掉，不能半登录')
  assert.deepEqual(done, ['fail:INVALID_TOKEN'], '要如实把失败原因回给调用方')
}

// ---------- 3. 刷新遇到网络错误 → 保留登录态，下次还能再试 ----------
{
  const values = new Map(), pending = [], log = [], done = []
  seed(values)
  const api = loadApi(values, pending, log)
  api.apiRequest('/job', 'POST', {}, true, () => done.push('ok'), (_m, c) => done.push('fail:' + c))
  respond401(pending.shift(), 'TOKEN_EXPIRED')
  const refreshRequest = pending.shift()
  refreshRequest.fail({ errMsg: 'timeout' })
  assert.equal(values.get('focus_planet_access_token'), 'old', '网络失败不能清访问令牌')
  assert.equal(values.has('focus_planet_auth_session'), true, '网络失败不能清会话')
  assert.deepEqual(done, ['fail:NETWORK_ERROR'])
}

// ---------- 4. 没有刷新令牌时不发刷新请求 ----------
{
  const values = new Map(), pending = [], log = [], done = []
  values.set('focus_planet_access_token', 'old')
  values.set('focus_planet_auth_session', { userId: 'u1', provider: 'phone', displayName: '13800000000', accessToken: 'old', refreshToken: '' })
  const api = loadApi(values, pending, log)
  api.apiRequest('/job', 'POST', {}, true, () => done.push('ok'), (_m, c) => done.push('fail:' + c))
  respond401(pending.shift(), 'TOKEN_EXPIRED')
  assert.equal(pending.filter(isRefresh).length, 0, '没有刷新令牌就不该发刷新请求')
  assert.equal(log.filter(url => url.endsWith('/auth/token/refresh')).length, 0)
  assert.deepEqual(done, ['fail:TOKEN_EXPIRED'])
}

console.log('PASS: 并发 401 单飞刷新、轮换令牌落盘、刷新被拒清会话、网络失败保留登录态')
