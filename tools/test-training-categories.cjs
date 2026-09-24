const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const assert = require('node:assert/strict')
const ts = require('/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root = path.resolve(__dirname, '..')
const read = f => fs.readFileSync(path.join(root, f), 'utf8')
const clean = f => read(f).replace(/^import[\s\S]*?from\s*'[^']*';?/gm, '').replace(/^export /gm, '')
const values = new Map()
const ctx = { console, Math, Date, JSON, LOCAL_TEST_MODE:true, localTestKey:k=>k, getGameDifficulty:()=>1, uni:{getStorageSync:k=>values.get(k)||'',setStorageSync:(k,v)=>values.set(k,v)} }
vm.createContext(ctx)
vm.runInContext(ts.transpile(clean('utils/catalog.uts')+'\n'+clean('utils/storage.uts')+'\n'+clean('utils/training-plan.uts')+'\nglobalThis.api={DIMENSIONS,GAMES,getGameDimensionId,buildDailyPlan,buildServerPlan,getRecords,addRecord}', {target:ts.ScriptTarget.ES2020}),ctx)
const a=ctx.api
const expected={
 selective:['forest-search','color-command','symbol-detective','spot-difference','number-tap','listen-find'],
 focused:['light-tracking','spot-change','memory-search','memory-link','audio-sequence','sound-location'],
 sustained:['star-catcher','car-patrol','bird-cloud','red-green','breathing-planet','sky-watcher'],
 alternating:['water-sort','order-guess','pattern-find','puzzle','shape-match','sorting-station'],
 divided:['magic-rule','number-track','little-driver','dual-track','penalty-kick','sound-filter']
}
assert.equal(a.GAMES.length,30)
assert.equal(Array.from(a.DIMENSIONS,d=>d.name).join('/'),'观察发现/记忆辨识/反应控制/逻辑空间/切换兼顾')
for(const [id,games] of Object.entries(expected)){
 assert.equal(a.GAMES.filter(g=>g.dimensionId===id).length,games.length)
 for(const game of games) assert.equal(a.getGameDimensionId(game),id,game)
}
for(let day=1;day<=31;day++){
 const plan=a.buildDailyPlan(8,[],new Date(2026,8,day).getTime())
 assert.equal(new Set(plan.map(p=>p.dimensionId)).size,5)
 for(const p of plan) assert.equal(p.dimensionId,a.getGameDimensionId(p.gameId))
}
const remote=a.buildServerPlan({planId:'test',revision:1,items:[{gameId:'sound-filter',dimensionId:'selective',role:'core',difficultyLevel:1,status:'PENDING',itemId:'i',playToken:'p'}]})
assert.equal(remote[0].dimensionId,'divided')
values.set('focus_planet_records_local_test',[{gameId:'sound-filter',dimensionId:'selective',score:83}])
assert.equal(a.getRecords()[0].dimensionId,'selective')
assert.equal(a.getRecords()[0].score,83)
a.addRecord({gameId:'penalty-kick',dimensionId:'focused',score:100})
assert.equal(a.getRecords()[0].dimensionId,'divided')
assert.equal(a.getRecords().length,2)
for(const file of fs.readdirSync(path.join(root,'pages/game')).filter(f=>f.endsWith('.uvue'))){
 const source=read('pages/game/'+file)
 for(const m of source.matchAll(/gameId=([a-z-]+)&dimensionId=([a-z-]+)/g)) assert.equal(m[2],a.getGameDimensionId(m[1]),file)
 assert.ok(!/集中注意|持续注意|选择注意|转换注意|分配注意/.test(source),file+' 旧分类')
}
assert.ok(!read('pages/report/report-v2.uvue').includes('categoryVersion'))
assert.ok(read('pages/result/result.uvue').includes('dimensionId.value = getGameDimensionId(gameId.value)'))
const home = read('pages/index/index.uvue')
const dimensionsPage = read('pages/dimensions/dimensions.uvue')
const showcasePage = read('pages/dimensions/game-showcase.uvue')
assert.equal((home.match(/@click="openDimension\(item\.id\)"/g) || []).length, 2, 'five dimension cards open their list')
assert.ok(dimensionsPage.includes("visibleDimensions.value = [exists]"), 'dimension list is scoped to the tapped dimension')
assert.ok(dimensionsPage.includes("/pages/dimensions/game-showcase?gameId="), 'list opens the showcase')
assert.ok(!dimensionsPage.includes('getGameRoute('), 'browse list must not start a game')
assert.ok(!showcasePage.includes('getGameRoute(') && !showcasePage.includes('beginLessonItem('), 'showcase is display-only')
assert.ok(read('pages.json').includes('pages/dimensions/game-showcase'), 'showcase route is registered')
console.log('PASS: 30 游戏归属 6/6/6/6/6、31天计划、统一归属写入、全部结算链接；不迁移旧记录、不要求报告版本字段')
