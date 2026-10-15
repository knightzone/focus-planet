// 家长验证门回归：大写数字加减题 + 数字键盘输入 + 连错锁定。
// 关键哨兵：isParentAreaUnlocked() 不能又被改成常量 true（之前就是这么被下线的）。
// 不启动 App、不联网。
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

// ---------- 运行 utils/parent-lock.uts ----------
const storage = new Map()
const uni = {
  getStorageSync: key => (storage.has(key) ? storage.get(key) : ''),
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key)
}
const lockPath = path.join(root, 'utils/parent-lock.uts')
const lockSource = ts.transpileModule(read('utils/parent-lock.uts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText
const lockModule = { exports: {} }
vm.runInNewContext(lockSource, { exports: lockModule.exports, module: lockModule, require, uni, console }, { filename: lockPath })
const lock = lockModule.exports

// 门必须是真门：初始未解锁，不能是常量 true。
assert.equal(lock.isParentAreaUnlocked(), false, '家长门必须默认关闭')
assert.equal(typeof lock.lockParentArea, 'function', 'lockParentArea 必须存在')

// ---------- 出题：大写加减，答案正确 ----------
const UPPER = { 零: 0, 壹: 1, 贰: 2, 叁: 3, 肆: 4, 伍: 5, 陆: 6, 柒: 7, 捌: 8, 玖: 9 }
const pattern = /^([零壹贰叁肆伍陆柒捌玖]) ([+−]) ([零壹贰叁肆伍陆柒捌玖]) = ？$/
let sawAdd = false
let sawSub = false
for (let index = 0; index < 400; index++) {
  const challenge = lock.createParentChallenge()
  const match = pattern.exec(challenge.text)
  assert.ok(match, `题目必须是大写数字加减：${challenge.text}`)
  const a = UPPER[match[1]]
  const b = UPPER[match[3]]
  const expected = match[2] === '+' ? a + b : a - b
  assert.equal(challenge.answer, expected, `答案必须与题目一致：${challenge.text}`)
  assert.ok(challenge.answer >= 0, '答案不能为负')
  assert.ok(challenge.answer <= 18, '答案应在 0~18 内')
  if (match[2] === '+') { sawAdd = true } else { assert.ok(a > b, '减法必须被减数大于减数'); sawSub = true }
}
assert.ok(sawAdd && sawSub, '加减都要出现，不能只出加法')

// ---------- 解锁与锁定 ----------
lock.unlockParentArea()
assert.equal(lock.isParentAreaUnlocked(), true, '验证通过后应解锁')
lock.lockParentArea()
assert.equal(lock.isParentAreaUnlocked(), false, 'lockParentArea 应立刻上锁')

assert.equal(lock.parentLockRemainingSeconds(), 0, '初始不应处于锁定中')
assert.equal(lock.recordParentFailure(), 0, '第 1 次答错不锁定')
assert.equal(lock.recordParentFailure(), 0, '第 2 次答错不锁定')
const lockedFor = lock.recordParentFailure()
assert.ok(lockedFor > 0, '第 3 次答错应锁定')
assert.ok(lock.parentLockRemainingSeconds() > 0, '锁定时应能读到剩余秒数')
assert.equal(lock.isParentAreaUnlocked(), false, '锁定时不能解锁')
lock.unlockParentArea()
assert.equal(lock.parentLockRemainingSeconds(), 0, '验证通过要清掉锁定')

// ---------- 页面接线 ----------
const page = read('pages/parent-lock/parent-lock.uvue')
assert.ok(/type="number"/.test(page), '家长要用数字键盘输入答案')
assert.ok(/createParentChallenge\(\)/.test(page), '页面要出大写加减题')
assert.ok(/recordParentFailure\(\)/.test(page), '页面要记录答错并锁定')
assert.ok(/parseInt\(answer\.value, 10\) == challengeAnswer/.test(page), '页面要按数字比对答案')
assert.ok(/lockAction\.value == 'delete'/.test(page), '家长验证页需要处理 delete 动作')
assert.ok(/requestAccountDeletion/.test(page), '家长验证通过后要真正提交注销')

// 现有卡片不再用滑动/长按这类纯动作当门。
assert.ok(!/gestureStage|gesture-thumb|按住跃跃/.test(page), '滑动/长按门不能回退')

// 扣费前要过门；恢复购买不再扣费，不挂门。
const membership = read('pages/membership/membership.uvue')
const purchaseBlock = membership.slice(membership.indexOf('function purchase()'), membership.indexOf('function restore()'))
assert.ok(/isParentAreaUnlocked\(\)/.test(purchaseBlock), '开通会员前必须过家长门')
assert.ok(purchaseBlock.indexOf('isParentAreaUnlocked()') < purchaseBlock.indexOf('requestVirtualPayment'), '家长门要在扣费之前')
assert.ok(!/isParentAreaUnlocked/.test(membership.slice(membership.indexOf('function restore()'))), '恢复购买不挂门')

// 家长区各入口都走同一个门。
assert.ok(/isParentAreaUnlocked\(\)/.test(read('pages/settings/settings.uvue')), '设置页要过门')
assert.ok(/isParentAreaUnlocked\(\)/.test(read('pages/mine/mine.uvue')), '退出登录要过门')
assert.ok(/isParentAreaUnlocked\(\)/.test(read('pages/account/account.uvue')), '账号页要过门')

console.log('PASS: 家长门为大写数字加减，数字键盘作答，连错 3 次锁定；设置/退出/注销/扣费均已过门，滑动门未回退')
