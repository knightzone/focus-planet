const fs = require('fs')
const vm = require('vm')
const assert = require('assert/strict')
const ts = require('/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')

const values = new Map()
const uni = {
  getStorageSync: key => values.get(key) ?? '',
  setStorageSync: (key, value) => {
    // 模拟 iOS 原生对象数组桥接丢弃可选字段；字符串不经对象桥接。
    values.set(key, Array.isArray(value) ? value.map(({ lessonNo, slotNo, localSyncId, lessonSyncPending, ...rest }) => rest) : value)
  },
  removeStorageSync: key => values.delete(key)
}
const storageApi = {}
const code = ts.transpileModule(fs.readFileSync('utils/storage.uts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
vm.runInNewContext(code, {
  exports: storageApi, uni, console, JSON, Date, Math,
  require: name => name.includes('local-test') ? { LOCAL_TEST_MODE: false, localTestKey: key => key } : name.includes('catalog') ? { getGameDimensionId: () => 'selective' } : { calculateAge: () => 8 }
})
values.set('focus_planet_auth_session', { userId: 'test' })
values.set('focus_planet_schema_version', 2)
const record = (id, score) => ({ id, gameId: 'forest-search', dimensionId: 'selective', score, accuracy: 90, averageReaction: 500, completedAt: Date.now(), lessonNo: 1, slotNo: 1, localSyncId: id, lessonSyncPending: true })
storageApi.addRecord(record('first', 80))
assert.equal(typeof values.get('focus_planet_records_test'), 'string', '成绩必须以 JSON 字符串持久化')
assert.equal(storageApi.getRecords()[0].lessonNo, 1)
assert.equal(storageApi.getRecords()[0].localSyncId, 'first')
storageApi.addRecord(record('lower', 60))
assert.equal(storageApi.getRecords().length, 1, '同课同游戏低分不新增记录')
assert.equal(storageApi.getRecords()[0].score, 80)
storageApi.addRecord(record('better', 100))
assert.equal(storageApi.getRecords().length, 1, '同课同游戏高分覆盖旧成绩')
assert.equal(storageApi.getRecords()[0].score, 100)
assert.equal(storageApi.getRecords()[0].localSyncId, 'better')
console.log('PASS: 课程成绩跨原生存储桥接后保留课号、题位和同步状态，并只留最高分')
