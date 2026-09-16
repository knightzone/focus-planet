const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const ts = require('/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
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
const api=exportsObject, now=Date.now();
const policy={platform:'ios',channel:'appstore',latestVersionCode:120,minSupportedVersionCode:110,latestVersionName:'0.2.0',updateUrl:'https://apps.apple.com/cn/app/id123456789',expiresAt:new Date(now+3600000).toISOString()};
assert.equal(api.updateMode(policy,100,now),'force');
assert.equal(api.updateMode(policy,110,now),'optional');
assert.equal(api.updateMode(policy,120,now),'none');
assert.equal(api.updateMode(policy,121,now),'none');
assert.equal(api.updateMode({...policy,minSupportedVersionCode:121},100,now),'none');
assert.equal(api.updateMode({...policy,expiresAt:'invalid'},100,now),'none');
assert.equal(api.updateMode(policy,100,now+7200000),'none');
assert.equal(api.validUpdateLink('https://apps.apple.com.evil.test/a','ios'),false);
assert.equal(api.validUpdateLink('javascript:alert(1)','ios'),false);
api.initializeAppUpdate(); api.resumeAppUpdate(); scheduled.shift()();
assert.equal(request.timeout,5000);
assert.equal(request.data.versionCode,100);
assert.equal(request.header.Authorization,undefined);
route='pages/game/number-tap';
request.success({statusCode:200,data:{data:policy}});request.complete();
assert.equal(launches,0,'active round is not interrupted');
assert.equal(api.updateRequired(),true);
assert.equal(guards.redirectTo.invoke({url:'/pages/result/result?score=100'}),true,'allow result persistence');
assert.equal(guards.navigateTo.invoke({url:'/pages/settings/settings'}),false,'block new business page');
route='pages/result/result';timer();
assert.equal(route,'pages/update/update');
api.checkAppUpdate(true);request.fail();request.complete();
assert.equal(api.updateRequired(),true,'network failure retains valid forced policy');
api.checkAppUpdate(true);request.success({statusCode:200,data:{data:{...policy,updateUrl:'https://evil.test'}}});request.complete();
assert.equal(api.updateRequired(),true,'malformed response cannot revoke policy');
api.checkAppUpdate(true);request.success({statusCode:200,data:{data:null}});request.complete();
assert.equal(api.updateRequired(),false,'explicit revocation releases gate');
route='pages/mine/mine';
api.checkAppUpdate(true);request.success({statusCode:200,data:{data:{...policy,minSupportedVersionCode:100}}});request.complete();
assert.equal(modals,1);timer();assert.equal(modals,1,'skip suppresses repeated optional prompt');
console.log('PASS: version boundaries, URL restrictions, anonymous check, round deferral, navigation gate, offline retention, invalid response, revocation and skip throttling');
