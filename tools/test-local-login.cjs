const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '..');
for (const enabled of [true, false]) {
  const values = new Map([
    ['focus_planet_access_token', 'real-token'],
    ['focus_planet_auth_session', { userId: 'real-user', provider: 'phone', displayName: 'real' }],
    ['focus_planet_records_real-user', [{ id: 'original' }]],
    ['focus_planet_profile', { nickname: 'real', birthYear: 2018, birthMonth: 1 }]
  ]);
  const modules = new Map(); let requests = 0;
  const uni = { getStorageSync: k => values.get(k), setStorageSync: (k,v) => values.set(k,v), removeStorageSync: k => values.delete(k), $emit() {}, request() { requests++; }, getAppBaseInfo: () => ({ appVersionCode: '1' }) };
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const m = { exports: {} }; modules.set(file, m);
    let source = fs.readFileSync(file, 'utf8');
    if (file.endsWith('/local-test.uts')) source = source.replace(/LOCAL_TEST_MODE = (true|false)/, 'LOCAL_TEST_MODE = ' + enabled);
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    vm.runInNewContext(js, { exports: m.exports, module: m, require: p => load(path.resolve(path.dirname(file), p)), uni, console, Date, setTimeout, clearTimeout, setInterval, clearInterval }, { filename: file });
    return m.exports;
  }
  const api = load(path.join(root, 'utils/api-client.uts'));
  const auth = load(path.join(root, 'utils/auth.uts'));
  const storage = load(path.join(root, 'utils/storage.uts'));
  assert.equal(auth.getAuthSession().userId, enabled ? 'local-test' : 'real-user');
  assert.equal(api.getAccessToken(), enabled ? '' : 'real-token');
  if (enabled) {
    let error = '';
    api.apiRequest('/test', 'POST', {}, true, () => assert.fail('network success'), (_m,c) => error = c);
    assert.equal(error, 'LOCAL_TEST_MODE'); assert.equal(requests, 0);
    assert.equal(storage.getRecords().length, 0);
    storage.addRecord({ id: 'test' });
    assert.equal(storage.getRecords()[0].id, 'test');
    assert.equal(values.get('focus_planet_records_real-user')[0].id, 'original');
    storage.saveProfile({ nickname: 'test', birthYear: 2018, birthMonth: 1 });
    assert.equal(values.get('focus_planet_profile').nickname, 'real');
    const remote = load(path.join(root, 'utils/server-api.uts'));
    assert.equal(remote.getServerPlan(), null);
    const sync = load(path.join(root, 'utils/offline-sync.uts'));
    assert.equal(sync.syncOwner(), ''); assert.equal(sync.cachedReport('overview'), null);
    auth.clearAuthSession(); assert.equal(values.get('focus_planet_access_token'), 'real-token');
  } else assert.equal(storage.getRecords()[0].id, 'original');
}
console.log('PASS: simulated login, network isolation, separate local records/profile, real-account restoration');
