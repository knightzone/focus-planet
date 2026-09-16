const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const ts = require('/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const storage = new Map();
let connected = false;
let pending = [];
let attempts = [];
let networkListener;
const events = {};
const uni = {
  getStorageSync: k => storage.get(k),
  setStorageSync: (k, v) => storage.set(k, JSON.parse(JSON.stringify(v))),
  removeStorageSync: k => storage.delete(k),
  $emit: k => events[k]?.(),
  $on: (k, fn) => { events[k] = fn; },
  onNetworkStatusChange: fn => { networkListener = fn; }
};
function login(id) { storage.set('focus_planet_auth_session', {userId: id}); }
const api = {
  submitTrainingResult: (plan, item, payload, ok, fail) => {
    attempts.push(payload.submissionId);
    if (!connected) fail('offline', 'NETWORK_ERROR');
    else pending.push(() => ok({}));
  },
  getOverviewReport: (date, ok) => { if (connected) ok({dimensions: [], allTime: {completedItems: 3}}); },
  getDailyReport: (from, to, ok) => { if (connected) ok({days: []}); }
};
function load() {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('utils/offline-sync.uts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code, {exports, uni, console, Date, JSON, setInterval: () => 1, require: name => name.includes('api-client') ? {getAccessToken: () => 'test-token'} : name.includes('server-api') ? api : {getLocalDayKey: n => new Date(n).toISOString().slice(0, 10)}});
  return exports;
}
login('a');
let sync = load();
sync.enqueueResult('plan', 'item', {submissionId: 'result-0001', playToken: 'original'});
assert.equal(sync.pendingResultCount(), 1, 'offline result persists');
sync = load();
assert.equal(sync.pendingResultCount(), 1, 'queue survives restart');
login('b');
sync.flushResults();
assert.equal(attempts.length, 1, 'another account cannot upload old results');
login('a'); connected = true;
sync.initializeOfflineSync(); networkListener({isConnected: true});
sync.flushResults();
assert.equal(pending.length, 1, 'concurrent flush does not duplicate request');
pending.shift()();
assert.equal(sync.pendingResultCount(), 0, 'successful upload acknowledged');
assert.deepEqual(attempts, ['result-0001', 'result-0001'], 'retry preserves idempotency ID');
assert.ok(sync.cachedReport('overview'), 'report saved');
login('b'); assert.equal(sync.cachedReport('overview'), null, 'report cache isolated');
login('a');
const key = 'focus_report_a_overview';
storage.get(key).savedAt = Date.now() - 49 * 3600000;
assert.equal(sync.cachedReport('overview'), null, '48-hour cache expires');
connected = false;
sync.enqueueResult('plan', 'item', {submissionId: 'result-0002'});
storage.set('focus_report_a_daily', {savedAt: 0, data: {days: []}});
sync.cachedReport('daily');
assert.equal(sync.pendingResultCount(), 1, 'cache expiry never deletes pending results');
console.log('PASS: offline persistence, restart, account isolation, reconnect, concurrency, idempotency, report cache and TTL');
