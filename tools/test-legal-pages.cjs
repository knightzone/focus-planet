// 法律文档与账号合规入口回归：正文不进包，统一用 <web-view> 打开线上 zhuanzhuapp.com/legal/*；
// 同时锁住协议里点名的两条路径：「账号 — 设置 — 订阅管理」与「账号 — 设置 — 注销」。
// 不启动 App、不联网、不校验真机渲染（iOS 的 web-view 元素需按需 ExtAPI，见 ios/README.md）。
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
function readJson(file) {
  try {
    return JSON.parse(read(file))
  } catch (error) {
    throw new Error(`${file} 不是合法 JSON：${error.message}`)
  }
}

// ---------- 运行 utils/legal.uts ----------
const navigations = []
const uni = { navigateTo: options => navigations.push(options.url), showToast() {} }
const legalPath = path.join(root, 'utils/legal.uts')
const legalSource = ts.transpileModule(read('utils/legal.uts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText
const legalModule = { exports: {} }
vm.runInNewContext(legalSource, { exports: legalModule.exports, module: legalModule, require, uni, console }, { filename: legalPath })
const legal = legalModule.exports

const expected = [
  { id: 'terms', title: '用户协议', url: 'https://zhuanzhuapp.com/legal/terms' },
  { id: 'privacy', title: '隐私政策', url: 'https://zhuanzhuapp.com/legal/privacy' },
  { id: 'children', title: '儿童个人信息保护规则', url: 'https://zhuanzhuapp.com/legal/children' },
  { id: 'sdk', title: '第三方信息共享清单', url: 'https://zhuanzhuapp.com/legal/privacy#sdk' }
]
assert.equal(legal.LEGAL_SITE_BASE, 'https://zhuanzhuapp.com/legal', '法律文档站点必须与线上公示域名一致')
// legal.uts 在 vm 沙箱里运行，数组原型不同域，这里逐项比较字段
assert.equal(legal.LEGAL_DOCS.length, expected.length, '法律文档入口应为 4 个')
for (let index = 0; index < expected.length; index++) {
  assert.equal(legal.LEGAL_DOCS[index].id, expected[index].id)
  assert.equal(legal.LEGAL_DOCS[index].title, expected[index].title)
  assert.equal(legal.LEGAL_DOCS[index].url, expected[index].url, `${expected[index].id} 的路径必须与线上文档一致`)
}
for (const doc of expected) {
  assert.equal(legal.getLegalDoc(doc.id).url, doc.url)
  assert.equal(legal.legalDocTitle(doc.id), doc.title)
  assert.equal(legal.legalDocUrl(doc.id), doc.url)
}
// 未知 id 回退到隐私政策，不允许出现空链接或异常地址
assert.equal(legal.getLegalDoc('missing'), null)
assert.equal(legal.legalDocTitle('missing'), '法律与合规')
assert.equal(legal.legalDocUrl('missing'), 'https://zhuanzhuapp.com/legal/privacy')

legal.openLegalDoc('children')
assert.equal(navigations.length, 1, '打开法律入口应只跳转一次')
assert.equal(navigations[0], '/pages/legal/legal?doc=children', '入口必须跳到包内 legal 页而不是外部浏览器')
// 需要整屏展示时传 hideBar=true，导航串带上 bar=0
legal.openLegalDoc('terms', true)
assert.equal(navigations[1], '/pages/legal/legal?doc=terms&bar=0', 'hideBar=true 必须带 bar=0 才能隐藏 App 顶部')

// ---------- 路由 ----------
const pagesJson = readJson('pages.json')
const routeOf = target => pagesJson.pages.find(page => page.path === target)
const legalRoute = routeOf('pages/legal/legal')
assert.ok(legalRoute, 'pages.json 必须注册 pages/legal/legal 路由')
// 顶部由页面自绘，才能用参数控制显隐（uni-app x 没有 hideNavigationBar）。
assert.equal(legalRoute.style.navigationStyle, 'custom', 'legal 页必须用自定义导航，顶部才能在运行时隐藏')
assert.ok(routeOf('pages/membership/membership'), '订阅管理需要 membership 路由')

// ---------- legal 页 ----------
const legalPage = read('pages/legal/legal.uvue')
assert.ok(/<web-view[^>]*:src="docUrl"/.test(legalPage), 'legal 页必须用 web-view 加载线上地址')
assert.ok(!/https:\/\/zhuanzhuapp\.com/.test(legalPage), 'legal 页不允许硬编码线上地址，统一从 utils/legal.uts 取')
assert.ok(/onLoad\(/.test(legalPage) && /legalDocUrl\(/.test(legalPage), 'legal 页必须按 doc 参数解析目标地址')
assert.ok(/options\['bar'\]/.test(legalPage) && /showBar/.test(legalPage), 'legal 页必须支持 bar 参数控制顶部显隐')
assert.ok(/v-if="showBar"/.test(legalPage) && /class="topbar"/.test(legalPage), '顶部必须是页面自绘且可整体隐藏')
assert.ok(/statusBarHeight/.test(legalPage), '自绘顶部要避开状态栏')
assert.ok(!/setNavigationBarTitle/.test(legalPage), '改用自绘顶部后不应再依赖原生导航栏标题')
assert.ok(/@error="onWebViewError"/.test(legalPage) && /webViewReady/.test(legalPage), 'legal 页必须对加载失败降级')

// ---------- 设置页：法律与合规 + 订阅管理 ----------
const settingsPage = read('pages/settings/settings.uvue')
for (const doc of expected) {
  assert.ok(settingsPage.includes(`openDoc('${doc.id}')`), `设置页缺少 ${doc.title} 入口`)
  assert.ok(settingsPage.includes(doc.title), `设置页缺少「${doc.title}」文案（隐私政策要求清单与 App 内一致）`)
}
assert.ok(/法律与合规/.test(settingsPage), '设置页需要法律与合规分组标题')
assert.ok(/订阅管理/.test(settingsPage), '协议点名的「订阅管理」入口必须存在')
assert.ok(/function openMembership\(\) \{ uni\.navigateTo\(\{ url: '\/pages\/membership\/membership' \}\) \}/.test(settingsPage), '「订阅管理」必须跳到会员页')

// ---------- 登录页：主动勾选，未勾选不得登录 ----------
const loginPage = read('pages/login/login.uvue')
for (const id of ['terms', 'privacy', 'children']) {
  assert.ok(loginPage.includes(`openDoc('${id}')`), `登录页缺少 ${id} 条款链接`)
}
assert.ok(/const consented = ref\(false\)/.test(loginPage), '同意条款必须默认不勾选')
assert.ok(/function toggleConsent/.test(loginPage) && /consented \? '✓' : ''/.test(loginPage), '登录页需要可主动勾选的同意框')
assert.ok(/canSubmit && consented && !loggingIn/.test(loginPage), '未勾选同意时手机号登录必须保持禁用')
assert.ok(/appleLogging \|\| !consented/.test(loginPage), '未勾选同意时 Apple 登录必须保持禁用')
assert.ok(/function requireConsent/.test(loginPage), '登录动作需要二次校验同意状态')
for (const fn of ['phoneLogin', 'appleLogin']) {
  const body = loginPage.slice(loginPage.indexOf(`function ${fn}()`))
  assert.ok(body.slice(0, 240).includes('requireConsent()'), `${fn} 必须先校验同意状态`)
}
assert.ok(!/登录即同意用户协议与隐私政策/.test(loginPage), '不可点击的「登录即同意…」纯文本必须移除')

// ---------- 注销：账号页入口 + 家长验证 + 后端契约 ----------
const accountPage = read('pages/account/account.uvue')
assert.ok(/注销账号/.test(accountPage), '账号页需要注销入口（协议写的是「账号 — 设置 — 注销」）')
assert.ok(/requestAccountDeletion/.test(accountPage), '账号页必须调用注销接口')
assert.ok(/isParentAreaUnlocked\(\).*action=delete/.test(accountPage), '注销必须先过家长验证')
assert.ok(/uni\.showModal/.test(accountPage), '注销必须二次确认')
assert.ok(/clearAuthSession\(\)/.test(accountPage), '注销成功后必须清掉本地会话')

const parentLockPage = read('pages/parent-lock/parent-lock.uvue')
assert.ok(/lockAction\.value == 'delete'/.test(parentLockPage), '家长验证页需要处理 delete 动作')
assert.ok(/requestAccountDeletion/.test(parentLockPage), '家长验证通过后要真正提交注销')

const serverApi = read('utils/server-api.uts')
assert.ok(/export function requestAccountDeletion/.test(serverApi), 'server-api 需要导出 requestAccountDeletion')
assert.ok(/apiRequest\('\/me\/delete', 'POST', \{\}, true, success, failure\)/.test(serverApi), '注销必须走 POST /me/delete 且发空对象')

console.log('PASS: 四个法律入口与线上路径一致、legal 页用 web-view 承载、登录必须主动勾选、订阅管理与注销路径可达')
