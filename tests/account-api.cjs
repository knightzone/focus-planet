const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const ts = require('/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
function load(file, requireMock, uni = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code, {exports, require: requireMock, uni, JSON, Date, Number});
  return exports;
}
const calls = [];
const api = load('utils/server-api.uts', () => ({
  apiRequest: (...args) => calls.push(args), getDeviceId: () => 'device-test', getPlatformName: () => 'ios'
}));
const ok = () => {};
const fail = message => { throw new Error(message); };
api.getAccountSummary(ok, fail);
api.createRemoteProfile('暖暖', 2018, 9, 'female', 'yellow-kitten', ok, fail);
api.updateRemoteProfile('跃跃', 2019, 6, 'male', 'blue-bunny', ok, fail);
assert.deepEqual(calls.map(c => c[0]), ['/me', '/me/update', '/me/update']);
assert.equal(calls[1][2].guardianConsented, true);
assert.equal(calls[1][2].guardianConsentVersion, 'privacy-v1');
assert.equal('cameraEnabled' in calls[1][2], false, 'completing info must preserve camera preferences');
assert.equal('guardianConsented' in calls[2][2], false, 'editing does not rewrite consent');
assert.equal('profileId' in calls[2][2], false);
assert.equal('userId' in calls[2][2], false, 'server determines current account');
let stored;
let remote = {userId:'user-b', infoCompleted:true, nickname:'服务端昵称', birthYear:2018, birthMonth:null, gender:'female', avatarId:'yellow-kitten'};
const auth = load('utils/auth.uts', name => {
  if (name.includes('server-api')) return {
    loginByPhone: (phone, code, success) => success({userId:'user-b', accessToken:'access', refreshToken:'refresh'}),
    getAccountSummary: success => success(remote), saveServerProfile: () => {}
  };
  if (name.includes('api-client')) return {saveTokens: () => {}};
  if (name.includes('storage')) return {saveProfile: value => {stored = value;}};
  return {calculateAge: () => 8};
}, {setStorageSync: () => {}, $emit: () => {}});
let needs;
auth.loginWithPhone('13800000000', '123456', (result, value) => {assert.equal(result.success,true); needs=value;});
assert.equal(needs,false);
assert.equal(stored.nickname,'服务端昵称');
assert.equal(stored.serverId,'user-b');
assert.equal(stored.birthMonth,1,'nullable month has safe display fallback');
remote = {userId:'user-c', infoCompleted:false};
auth.loginWithPhone('13800000000', '123456', (result, value) => {needs=value;});
assert.equal(needs,true,'incomplete user is routed to information completion');
console.log('PASS: current-account routes, request fields, consent, remote restoration, nullable birth month and incomplete-account routing');
