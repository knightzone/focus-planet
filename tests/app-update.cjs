const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const ts = require('/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const store = new Map(), guards = {}, scheduled = [], events = [];
let request, route = 'pages/index/index', launches = 0, modals = 0, timer;
const uni = {
  getAppBaseInfo: () => ({appVersionCode:'100',appVersion:'0.1.0'}), getDeviceInfo: () => ({osVersion:'18.6'}),
  getStorageSync: key => store.get(key), setStorageSync: (key,val) => store.set(key,val), removeStorageSync:key=>store.delete(key),
  $on: () => {}, $emit: (name) => events.push(name), addInterceptor: (name, val) => {guards[name]=val;},
  reLaunch: options => {launches++; route=options.url.slice(1); options.complete?.();},
  navigateTo: options => {route=options.url.slice(1);}, showModal: options => {modals++; options.success({confirm:false}); options.complete();},
  showToast: () => {}, request: options => {request=options;}
};
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('utils/app-update.uts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
  {exports:exportsObject,require:()=>({API_BASE_URL:'https://api.example.test/api/v1',getPlatformName:()=> 'ios'}),uni,JSON,Date,Number,Object,
   getCurrentPages:()=>[{route}],setTimeout:fn=>{scheduled.push(fn);return 1;},setInterval:fn=>{timer=fn;return 1;},clearInterval:()=>{}});
const api=exportsObject;
const update = {forceUpdate:true,optionalUpdate:false,currentVersion:'0.1.0',latestVersion:'1.0.0',minimumVersion:'1.0.0',updateUrl:'https://apps.apple.com/cn/app/id123456789',releaseNotes:'修复小问题\n新增两个游戏'};
const policy = {configVersion:1,updatedAt:'2026-10-09T00:00:00Z',versionPolicy:{},update};
const optional = {...policy,update:{...update,forceUpdate:false,optionalUpdate:true}};
const clear = {...policy,update:{...update,forceUpdate:false,optionalUpdate:false,updateUrl:'',releaseNotes:''}};
// 服务端直接给出结论：update 块缺失或双 flag 关闭即无更新；客户端不再自行比较版本号。
assert.equal(api.updateMode(null),'none');
assert.equal(api.updateMode({}),'none');
assert.equal(api.updateMode(policy),'force');
assert.equal(api.updateMode(optional),'optional');
assert.equal(api.updateMode(clear),'none');
assert.equal(api.validUpdateLink('https://apps.apple.com.evil.test/a','ios'),false);
assert.equal(api.validUpdateLink('javascript:alert(1)','ios'),false);
assert.equal(api.validUpdateLink('https://apps.apple.com/cn/app/id1','ios'),true);
// 升级 App 后旧缓存（回显版本不一致）不得恢复成强制门。
store.set('focus_update_policy_v2',{...policy,update:{...update,currentVersion:'0.9.0'}});
api.initializeAppUpdate();
assert.equal(api.updateRequired(),false,'stale cached policy from an older app version is ignored');
api.resumeAppUpdate(); scheduled.shift()();
assert.equal(request.url,'https://api.example.test/api/v1/config');
assert.equal(request.timeout,5000);
assert.equal(request.data.platform,'ios');
assert.equal(request.data.appVersion,'0.1.0');
assert.equal(request.header.Authorization,undefined,'anonymous startup-config check');
route='pages/game/number-tap';
request.success({statusCode:200,data:{data:policy}});request.complete();
assert.equal(launches,0,'active round is not interrupted');
assert.equal(api.updateRequired(),true);
assert.equal(api.currentUpdate()['update']['updateUrl'],update.updateUrl,'服务端链接合法时必须原样使用，不走降级');
assert.equal(guards.redirectTo.invoke({url:'/pages/result/result?score=100'}),true,'allow result persistence');
assert.equal(guards.navigateTo.invoke({url:'/pages/settings/settings'}),false,'block new business page');
route='pages/result/result';timer();
assert.equal(route,'pages/update/update');
api.checkAppUpdate(true);request.fail();request.complete();
assert.equal(api.updateRequired(),true,'network failure retains valid forced policy');
api.checkAppUpdate(true);request.success({statusCode:200,data:{data:{...policy,update:{...update,updateUrl:''}}}});request.complete();
assert.equal(api.updateRequired(),true,'空链接不撤回策略，降级为暂存链接');
assert.equal(api.currentUpdate()['update']['updateUrl'],'https://apps.apple.com/cn/app/id6808091213','空链接应替换为 iOS 暂存链接');
api.checkAppUpdate(true);request.success({statusCode:200,data:{data:{...policy,update:{...update,updateUrl:'https://evil.test'}}}});request.complete();
assert.equal(api.updateRequired(),true,'非法链接降级为暂存链接，不撤回已有强更策略');
assert.equal(api.currentUpdate()['update']['updateUrl'],'https://apps.apple.com/cn/app/id6808091213','非法链接应替换为 iOS 暂存链接');
api.checkAppUpdate(true);request.success({statusCode:200,data:{data:clear}});request.complete();
assert.equal(api.updateRequired(),false,'explicit revocation releases gate');
route='pages/mine/mine';
api.checkAppUpdate(true);request.success({statusCode:200,data:{data:optional}});request.complete();
assert.equal(modals,1,'optional update prompts on manual check');
timer();assert.equal(modals,1,'skip suppresses repeated optional prompt');
console.log('PASS: /config contract, mode mapping, fallback updateUrl, URL restrictions, anonymous check, round deferral, navigation gate, offline retention, revocation and skip throttling');
