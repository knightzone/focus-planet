const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..')
const read = p => fs.readFileSync(path.join(root, p), 'utf8')
const { stripTypeScriptTypes } = require('node:module')
const storage = new Map()
let account = 'user-a'
let respond
let failWith
let requests = 0
let clock = Date.parse('2026-09-22T12:00:00Z')
// 可控时钟：刷新节流与到期判断都基于 Date.now()。
class FakeDate extends Date {
  static now() { return clock }
  static parse(value) { return Date.parse(value) }
}
const failures = []
const exportsObject = {}
const source = `${stripTypeScriptTypes(read('utils/membership.uts').replace(/^import .*$/gm, '').replace(/export /g, ''))}\nObject.assign(exports, { parseMembership, cachedMembership, saveMembership, refreshMembership, membershipStale, membershipSyncedAt, resumeMembership });`
const store = success => { requests += 1; respond = success }
vm.runInNewContext(source, {
  exports: exportsObject,
  getMembershipStatus: (success, failure) => { requests += 1; respond = success; failWith = failure },
  getAuthSession: () => account ? { userId: account } : null,
  require: name => name.includes('server-api') ? { getMembershipStatus: store } : { getAuthSession: () => account ? { userId: account } : null },
  uni: { getStorageSync: k => storage.get(k), setStorageSync: (k,v) => storage.set(k,v), $emit: () => {}, navigateTo: () => {} },
  Date: FakeDate, Number, JSON
})
const m = exportsObject
const payload = { isVip: true, expiresAt: null, appAccountToken: 'vip-token', products: [{ productId: 'lifetime', name: '永久会员', type: 'non_consumable' }] }
assert.equal(m.parseMembership(payload).active, true)
assert.equal(m.parseMembership(payload).products[0].productId, 'lifetime')
assert.equal(m.parseMembership({ active: true }).active, false, 'Legacy active must not grant VIP')
storage.set('focus_membership_user-a', { active: true })
assert.equal(m.cachedMembership().active, false, 'Legacy cache must not grant VIP')
m.saveMembership(m.parseMembership(payload))
assert.equal(m.cachedMembership().active, true, 'Permanent VIP has no expiry')
m.saveMembership(m.parseMembership({ ...payload, expiresAt: '2000-01-01T00:00:00Z' }))
assert.equal(m.cachedMembership().active, false)
account = 'user-b'
assert.equal(m.cachedMembership().active, false, 'Accounts are isolated')
m.refreshMembership(() => assert.fail('stale callback'), (_msg, code) => failures.push(code))
account = 'user-c'
respond(payload)
assert.equal(failures[0], 'ACCOUNT_CHANGED')
assert.equal(m.cachedMembership().active, false)

// 服务端用微秒精度（2027-09-22T08:41:42.489230Z）：未过期就不能被本地判成未开通。
account = 'user-vip'
m.saveMembership({ active: true, expiresAt: '2027-09-22T08:41:42.489230Z', appAccountToken: 'vip-token', products: [] })
assert.equal(m.cachedMembership().active, true, '微秒 ISO 时间不得被误判为已过期')
clock = Date.parse('2028-01-01T00:00:00Z')
assert.equal(m.cachedMembership().active, false, '确实过期要降级')
clock = Date.parse('2026-09-22T12:00:00Z')
m.saveMembership({ active: true, expiresAt: 'not-a-timestamp', appAccountToken: 'vip-token', products: [] })
assert.equal(m.cachedMembership().active, true, '时间解析失败时保留服务端结论，交给刷新纠正')

// 主动刷新：从未同步过 → stale；节流、并发去重、失败重试都要成立。
assert.equal(m.membershipStale(), true, '从未成功同步过视为过期')
assert.equal(m.membershipSyncedAt(), 0)
const vip = { isVip: true, expiresAt: '2027-09-22T08:41:42.489230Z', appAccountToken: 'vip-token', products: [] }
requests = 0
m.resumeMembership()
assert.equal(requests, 1, '回前台/进入受限入口时主动刷新一次')
m.resumeMembership()
assert.equal(requests, 1, '刷新未返回时不重复请求')
respond(vip)
assert.equal(m.cachedMembership().active, true)
assert.equal(m.membershipStale(), false, '成功刷新后 5 分钟内不视为过期')
m.resumeMembership()
assert.equal(requests, 1, '节流窗口内不重复请求')
clock += 5 * 60 * 1000 + 1000
m.resumeMembership()
assert.equal(requests, 2, '超过节流窗口重新拉取')
failWith('网络不可用', 'NETWORK')
clock += 1000
m.resumeMembership()
assert.equal(requests, 2, '失败后 30 秒内不重试')
clock += 31 * 1000
m.resumeMembership()
assert.equal(requests, 3, '超过重试间隔后允许重试')
respond({ isVip: false, expiresAt: null, appAccountToken: 'vip-token', products: [] })
assert.equal(m.cachedMembership().active, false, '服务端说未开通就按未开通缓存')
assert.equal(m.membershipStale(), false)

const api = read('utils/server-api.uts')
assert.match(api, /\/vip\/status/)
assert.match(api, /\/vip\/apple\/verify/)
assert.match(api, /signedTransaction: signedTransaction/)
assert.doesNotMatch(api, /\/membership\//)
const page = read('pages/membership/membership.uvue')
assert.match(page, /state\.products/)
assert.match(page, /introOfferEligible/)
// 服务端列出的每个商品都要出卡片；StoreKit 没返回或类型不符时说明原因，不得静默消失。
assert.match(page, /result\.products\.find\(/)
assert.match(page, /\{ productId: p\.productId, name: p\.name,[^}]*available: false \}/)
assert.match(page, /App Store 未返回 ' \+ p\.productId/)
assert.match(page, /App Store 中此商品不是自动续期订阅/)
assert.match(page, /App Store 未配置引入优惠/)
assert.match(page, /当前 Apple ID 不符合优惠资格/)
assert.match(page, /新用户首期 ' \+ apple\.introOfferDisplayPrice/)
assert.match(page, /新用户前' \+ \(apple\.introOfferPeriodValue \* apple\.introOfferPeriodCount\)/)
assert.match(page, /plan\.hint/)
assert.match(page, /planClass\(plan\)/)
assert.match(page, /fetchAppleSignedTransaction/)
assert.match(page, /transaction\.appAccountToken/)
assert.match(page, /restoreNext/)
assert.doesNotMatch(page, /parseMembership\(_?data\)|membership\.monthly|membership\.yearly/)
// /vip/status 的调用时机：启动/回前台、训练列表、首页与会员页。
assert.match(read('App.uvue'), /onShow\(\(\) => \{ resumeAppUpdate\(\); resumeOfflineSync\(\); resumeMembership\(\) \}\)/)
assert.match(read('pages/dimensions/dimensions.uvue'), /onShow\(\(\) => resumeMembership\(\)\)/)
assert.match(read('pages/index/index.uvue'), /onShow\(\(\) => refresh\(\)\)/)
assert.match(read('pages/membership/membership.uvue'), /onShow\(\(\) => \{ if \(!paying\.value\) reload\(\) \}\)/)
assert.match(read('uni_modules/focus-face-detector/utssdk/app-ios/FocusFaceDetectorNative.swift'), /result\.jwsRepresentation/)
assert.ok(page.indexOf('verifyAppleTransaction(jws') < page.indexOf('.finishTransaction('))
console.log('PASS: VIP parsing, cache isolation, expiry tolerance, foreground refresh throttle, account switch, endpoints and signed verification flow')
