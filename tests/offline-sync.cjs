const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const ts = require('/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const storage = new Map();
const storedQueue = owner => JSON.parse(storage.get('focus_pending_results_' + owner));
let connected = false;
let probeFails = false;
let attempts = [];
let pending = [];
const forceFailureIds = new Set();
let syncedLessonRecords = [];
let overviewRequests = 0;
let networkListener;
let intervalCount = 0;
let clearedIntervals = 0;
let timeoutId = 0;
const timeouts = new Map();
let now = Date.now();
let localRecords = [{id:'server-confirmed',lessonNo:1,gameId:'star-catcher',lessonSyncPending:false}];
const NativeDate = Date;
class TestDate extends NativeDate {
  static now() { return now; }
  static parse(value) { return NativeDate.parse(value); }
}
const events = {};
const uni = {
  getStorageSync: k => storage.get(k),
  setStorageSync: (k, v) => storage.set(k, JSON.parse(JSON.stringify(v))),
  removeStorageSync: k => storage.delete(k),
  $emit: k => events[k]?.(),
  $on: (k, fn) => { events[k] = fn; },
  onNetworkStatusChange: fn => { networkListener = fn; },
  getNetworkType: options => {
    if (probeFails) { options.fail({errMsg: 'getNetworkType:fail'}); return; }
    options.success({networkType: connected ? 'wifi' : 'none'});
  }
};
function login(id) { storage.set('focus_planet_auth_session', {userId: id}); }
const api = {
  submitTrainingResult: (plan, item, payload, ok, fail) => {
    attempts.push(payload.submissionId);
    if (!connected) fail('offline', 'NETWORK_ERROR');
    else pending.push(() => ok({}));
  },
  submitLessonTrainingResult: (payload, ok, fail) => {
    attempts.push(payload.localSyncId ?? payload.submissionId);
    if (forceFailureIds.has(payload.localSyncId)) fail('bad result', 'INVALID_RESULT');
    else if (!connected) fail('offline', 'NETWORK_ERROR');
    else pending.push(() => ok({}));
  },
  getOverviewReport: (ok) => { overviewRequests += 1; if (connected) ok({scopes: [], allTime: {completedGames: 3}}); },
  getDailyReport: (lessonNo, ok) => { if (connected) ok({lesson: {lessonNo}}); }
};
function load() {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('utils/offline-sync.uts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code, {
    exports, uni, console, JSON,
    Date: TestDate,
    setInterval: () => { intervalCount += 1; return intervalCount; },
    clearInterval: () => { clearedIntervals += 1; },
    setTimeout: callback => { timeoutId += 1; timeouts.set(timeoutId, callback); return timeoutId; },
    clearTimeout: id => { timeouts.delete(id); },
    require: name => name.includes('api-client') ? {getAccessToken: () => 'test-token'} : name.includes('server-api') ? api : name.includes('course-plan') ? {repairActiveLessonRecords: () => 0} : {getLocalDayKey: n => new NativeDate(n).toISOString().slice(0, 10), getRecords: () => localRecords, saveRecords: records => { localRecords=JSON.parse(JSON.stringify(records)); }, markLessonRecordSynced: id => syncedLessonRecords.push(id)}
  });
  return exports;
}
login('a');
let sync = load();
sync.enqueueResult('plan', 'item', {submissionId: 'result-0001', playToken: 'original'});
assert.equal(sync.pendingResultCount(), 1, 'offline result persists');
sync = load();
assert.equal(sync.pendingResultCount(), 1, 'queue survives restart');

// 另一个账号不能上传上一个账号的队列
login('b');
sync.flushResults();
assert.equal(attempts.length, 1, 'another account cannot upload old results');

// App 启动：注册监听、拉起 30 秒轮询，并立即补一次
login('a'); connected = true;
sync.initializeOfflineSync();
assert.equal(intervalCount, 1, 'app start installs 30s polling');
assert.equal(pending.length, 1, 'app start flushes pending results');
sync.initializeOfflineSync();
assert.equal(intervalCount, 1, 'initialize guard does not re-register polling');

// 网络恢复事件 + 并发去重
networkListener({isConnected: true});
sync.flushResults();
assert.equal(pending.length, 1, 'concurrent flush does not duplicate request');
pending.shift()();
assert.equal(sync.pendingResultCount(), 0, 'successful upload acknowledged');
assert.deepEqual(attempts, ['result-0001', 'result-0001'], 'retry preserves idempotency ID');
assert.equal(overviewRequests, 0, 'successful upload does not prefetch overview');
sync.refreshReports();
assert.ok(sync.cachedReport('overview'), 'report saved');
const requestsAfterUpload = overviewRequests;
sync.syncNow();
assert.equal(overviewRequests, requestsAfterUpload, 'empty queue does not prefetch overview after login or resume');

// 报告缓存按账号隔离 + 48 小时过期
login('b'); assert.equal(sync.cachedReport('overview'), null, 'report cache isolated');
login('a');
const key = 'focus_report_a_overview';
storage.get(key).savedAt = now - 49 * 3600000;
assert.equal(sync.cachedReport('overview'), null, '48-hour cache expires');

// 断网失败保留原始队列
connected = false;
sync.enqueueResult('plan', 'item', {submissionId: 'result-0002'});
storage.set('focus_report_a_daily', {savedAt: 0, data: {days: []}});
sync.cachedReport('daily');
assert.equal(sync.pendingResultCount(), 1, 'cache expiry never deletes pending results');
assert.equal(typeof storage.get('focus_pending_results_a'), 'string', 'queue avoids native object-array bridging');
assert.equal(storedQueue('a')[0].payload.submissionId, 'result-0002', 'failed result keeps original payload');
assert.equal(storedQueue('a')[0].error, 'NETWORK_ERROR', 'failed result keeps error code');

// 网络恢复：iOS 回前台过渡回调可能给出 isConnected=false，用 getNetworkType 复核后仍要补传
connected = true;
networkListener({isConnected: false, networkType: 'unknown'});
assert.equal(attempts[attempts.length - 1], 'result-0002', 'network recovery reuses original submissionId');
assert.equal(pending.length, 1, 'network recovery issues one request');
pending.shift()();
assert.equal(sync.pendingResultCount(), 0, 'network recovery acknowledged');

// 回前台（onShow）：重建轮询；断网时不发请求也不丢队列
connected = false;
sync.enqueueResult('plan', 'item', {submissionId: 'result-0003'});
storage.delete('focus_report_a_overview');
storage.delete('focus_report_a_daily');
const attemptsWhileOffline = attempts.length;
sync.resumeOfflineSync();
assert.equal(attempts.length, attemptsWhileOffline, 'offline foreground resume does not retry');
assert.equal(sync.pendingResultCount(), 1, 'offline foreground resume keeps queue');
assert.equal(intervalCount, 2, 'foreground resume rebuilds polling');
assert.equal(clearedIntervals, 1, 'foreground resume replaces the old timer');

// 回前台（onShow）：有网时只补传，报告仍需用户打开页面才查询。
connected = true;
sync.resumeOfflineSync();
assert.equal(pending.length, 1, 'foreground resume flushes pending results');
assert.equal(sync.cachedReport('overview'), null, 'foreground resume does not prefetch overview');
pending.shift()();
assert.equal(sync.pendingResultCount(), 0, 'foreground resume acknowledged');
assert.equal(sync.cachedReport('overview'), null, 'upload does not prefetch overview');
sync.refreshReports();
assert.ok(sync.cachedReport('overview'), 'explicit report refresh works');

// 登录就绪事件只触发补传，不自动查询报告。
connected = false;
sync.enqueueResult('plan', 'item', {submissionId: 'result-0006'});
storage.delete('focus_report_a_daily');
assert.equal(sync.cachedReport('daily'), null, 'daily cache cleared for event check');
connected = true;
events['focus-auth-ready']();
assert.equal(pending.length, 1, 'auth ready flushes pending results');
assert.equal(attempts[attempts.length - 1], 'result-0006', 'auth ready reuses the original submissionId');
pending.shift()();
assert.equal(sync.pendingResultCount(), 0, 'auth ready acknowledged');
assert.equal(sync.cachedReport('daily'), null, 'auth ready does not request a report');
sync.refreshReports();
assert.ok(sync.cachedReport('daily'), 'explicit report refresh works after auth ready');

// iOS 挂起恢复：网络探针失败时按“可能有网”继续尝试补传（不能因为探针失败就漏传）
connected = false;
sync.enqueueResult('plan', 'item', {submissionId: 'result-0005'});
const attemptsBeforeProbe = attempts.length;
connected = true;
probeFails = true;
sync.resumeOfflineSync();
assert.equal(attempts.length, attemptsBeforeProbe + 1, 'failed network probe still attempts the sync');
assert.equal(attempts[attempts.length - 1], 'result-0005', 'probe failure keeps the original submissionId');
probeFails = false;
pending.shift()();
assert.equal(sync.pendingResultCount(), 0, 'probe failure recovery acknowledged');

// iOS 挂起恢复：在途上传锁超过阈值后释放并沿用原 submissionId
sync.enqueueResult('plan', 'item', {submissionId: 'result-0004'});
assert.equal(pending.length, 1, 'new result uploads immediately when online');
const attemptsBeforeSuspend = attempts.length;
sync.resumeOfflineSync();
assert.equal(attempts.length, attemptsBeforeSuspend, 'in-flight upload is not duplicated');
now += 91 * 1000;
sync.resumeOfflineSync();
assert.equal(attempts.length, attemptsBeforeSuspend + 1, 'stale upload lock is released after suspension');
assert.equal(attempts[attempts.length - 1], 'result-0004', 'stale recovery keeps the original submissionId');
assert.equal(sync.pendingResultCount(), 1, 'queue retained until the server acknowledges');
pending.shift()();
pending.shift()();
assert.equal(sync.pendingResultCount(), 0, 'late and retried acknowledgements both drain the queue');

// 新版客户端课次成绩共用持久化队列；旧日未同步成绩会阻止开启新课。
sync.enqueueLessonResult({localSyncId: 'lesson-result-0001', lessonNo:1, gameId:'star-catcher', difficultyLevel:2, score:88, accuracy:90, averageReactionMs:500, durationSeconds:30, omissions:0, falseAlarms:0, completionCount:8, scoreAlgorithmVersion:'goal-v2', clientCompletedAt: new Date(now - 86400000).toISOString()});
assert.equal(sync.pendingResultCount(), 1, 'client lesson result persists before acknowledgement');
assert.equal(sync.hasPendingOlderThan(new Date(now).toISOString().slice(0, 10)), true, 'older unsynced lesson result is detectable');
pending.shift()();
assert.equal(sync.pendingResultCount(), 0, 'client lesson result drains after acknowledgement');
assert.equal(syncedLessonRecords.includes('lesson-result-0001'), true, 'acknowledged lesson record is marked locally');

// 老版本遗留的本地课程记录没有同步标记：恢复时每个课程/游戏只补传最高分。
connected = false;
localRecords = [
  {id:'legacy-equal',localSyncId:'legacy-equal-local',lessonNo:2,gameId:'star-catcher',difficultyLevel:2,score:120,accuracy:95,averageReaction:250,durationSeconds:28,completedCount:10,completedAt:now+1000,lessonSyncPending:false},
  {id:'legacy-low',submissionId:'legacy-low',lessonNo:2,gameId:'star-catcher',difficultyLevel:2,score:80,accuracy:80,averageReaction:300,durationSeconds:30,completedCount:8,completedAt:now-1000},
  {id:'legacy-best',submissionId:'legacy-best',lessonNo:2,gameId:'star-catcher',difficultyLevel:2,score:120,accuracy:95,averageReaction:250,durationSeconds:28,completedCount:10,completedAt:now}
];
sync.recoverUnsyncedLessonResults();
assert.equal(sync.pendingResultCount(), 1, 'legacy local best is restored to the queue once');
assert.equal(storedQueue('a')[0].payload.score, 120, 'legacy lower score is not restored');
connected = true;
sync.flushResults();
pending.shift()();
assert.equal(sync.pendingResultCount(), 0, 'restored local best uploads normally');
assert.equal(syncedLessonRecords.includes('recovered-legacy-best-star-catcher'), true, 'restored result is marked after acknowledgement');

// 无效、失败、回调超时都只能影响本条，后面的有效课程成绩仍须继续上传。
const lessonEntry = (id, score) => ({id, planId:'', itemId:'', error:'', mode:'client-lesson', payload:{localSyncId:id, lessonNo:3, gameId:'forest-search', difficultyLevel:2, score, accuracy:90, averageReactionMs:500, durationSeconds:30, omissions:0, falseAlarms:0, completionCount:8, scoreAlgorithmVersion:'goal-v2', clientCompletedAt:new Date(now).toISOString()}});
assert.equal(sync.enqueueLessonResult({localSyncId:'new-invalid', lessonNo:3, gameId:'forest-search', score:90}), false, 'normal result with missing required fields fails before queue write');
assert.equal(sync.pendingResultCount(), 0, 'invalid new result is never mistaken for a queued upload');
storage.set('focus_pending_results_a', JSON.stringify([{id:'bad',planId:'',itemId:'',error:'',mode:'client-lesson',payload:{}},lessonEntry('after-invalid',80)]));
sync.flushResults();
assert.equal(attempts.at(-1), 'after-invalid', 'invalid item does not block a valid follower');
pending.shift()();
assert.equal(storedQueue('a').length, 0, 'invalid legacy item is discarded after valid follower succeeds');
assert.equal(sync.pendingResultCount(), 0, 'invalid item cannot block next lesson');
storage.set('focus_pending_results_a', JSON.stringify([lessonEntry('reject-first',70),lessonEntry('after-reject',85)]));
forceFailureIds.add('reject-first');
sync.flushResults();
assert.equal(attempts.at(-1), 'after-reject', 'server-rejected item does not block a valid follower');
pending.shift()();
assert.equal(storedQueue('a')[0].error, 'INVALID_RESULT');
forceFailureIds.clear();
storage.set('focus_pending_results_a', JSON.stringify([lessonEntry('hang-first',70),lessonEntry('after-timeout',90)]));
sync.flushResults();
assert.equal(attempts.at(-1), 'hang-first');
const timerCallback = [...timeouts.values()].at(-1);
timerCallback();
assert.equal(attempts.at(-1), 'after-timeout', 'lost callback times out per item and advances');
pending.pop()();
assert.equal(storedQueue('a')[0].error, 'REQUEST_TIMEOUT');
pending.shift()();
assert.equal(sync.pendingResultCount(), 1, 'late callback cannot acknowledge a timed-out item');

console.log('PASS: offline persistence, account isolation, recovery, idempotency, and per-item invalid/rejected/timeout isolation');
