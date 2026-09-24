const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict')
const ts=require('/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8')
const clean=s=>s.replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'')
const storage=new Map(),uni={getStorageSync:k=>storage.get(k)||'',setStorageSync:(k,v)=>storage.set(k,structuredClone(v)),removeStorageSync:k=>storage.delete(k)}
let localRecords=[]
const ctx={console,Math,Date,JSON,Number,uni,defaultDifficultyForAge:age=>Math.max(1,Math.min(10,age-4)),getGameDifficulty:()=>2,setGameDifficulty:()=>{},getLocalDayKey:n=>new Date(n).toISOString().slice(0,10),getRecords:()=>structuredClone(localRecords),saveRecords:records=>{localRecords=structuredClone(records)}}
vm.createContext(ctx)
vm.runInContext(ts.transpile(clean(read('utils/catalog.uts'))+'\n'+clean(read('utils/course-plan.uts'))+'\nglobalThis.api={lessonGameIds,nextDifficulty,buildLesson,saveActiveLesson,lessonCompleted,resolveLessonAfterSync,startTodayLesson,markLessonResult,beginLessonItem,getActiveLesson,parseRecentTrainingResults,activeLessonItemForResult,clearLessonPlay,repairActiveLessonRecords}',{target:ts.ScriptTarget.ES2020}),ctx)
const a=ctx.api,dims=['selective','focused','sustained','alternating','divided']
assert.equal(a.lessonGameIds(1).join(','),'forest-search,memory-search,breathing-planet,water-sort,little-driver')
for(let lesson=1;lesson<=18;lesson++){
 const first=a.lessonGameIds(lesson),second=a.lessonGameIds(lesson)
 assert.equal(first.join(','),second.join(','),'同一课必须确定生成')
 assert.equal(new Set(first).size,5)
 assert.equal(first.map(id=>ctx.getGameDimensionId(id)).join(','),dims.join(','))
}
for(let offset=0;offset<5;offset++)assert.equal(new Set(Array.from({length:6},(_,i)=>a.lessonGameIds(i+1)[offset])).size,6,'每类6课轮完')
const h=(scores,levels)=>scores.map((score,i)=>({lessonNo:scores.length-i,lessonDate:'2026-09-20',slotNo:1,gameId:'star-catcher',difficultyLevel:levels[i],score,completedAt:scores.length-i}))
assert.equal(a.nextDifficulty('star-catcher',h([100],[4]),4),5)
assert.equal(a.nextDifficulty('star-catcher',h([120],[10]),10),10)
assert.equal(a.nextDifficulty('star-catcher',h([20,30,40],[4,4,4]),4),3)
assert.equal(a.nextDifficulty('star-catcher',h([20,30,40],[3,4,4]),3),3,'已降级后必须在新难度重新累计3次')
assert.equal(a.nextDifficulty('star-catcher',h([20,50,20],[4,4,4]),4),4,'50分会中断连续低分')
assert.equal(a.nextDifficulty('star-catcher',h([20,30,40],[1,1,1]),1),1)
const lesson=a.buildLesson(7,'2026-09-21',8,[])
assert.equal(lesson.items.length,5);assert.equal(a.lessonCompleted(lesson),false)
assert.equal(a.buildLesson(0,'2026-09-21',8,[]).lessonNo,1,'首课编号必须从1开始')
a.saveActiveLesson(lesson)
for(const item of lesson.items){a.beginLessonItem(item);a.markLessonResult(item.gameId,80)}
assert.equal(a.lessonCompleted(a.getActiveLesson()),true)
const parsed=a.parseRecentTrainingResults({records:Array.from({length:105},(_,i)=>({lessonNo:i+1,gameId:a.lessonGameIds(i+1)[0],difficultyLevel:4,score:60,clientCompletedAt:'2026-09-21T00:00:00.000Z'}))})
assert.equal(parsed.length,100);assert.equal(parsed[0].lessonNo,105)
assert.equal(parsed[0].difficultyLevel,4,'难度必须直接读取服务端成绩事实')
storage.clear()
const today=ctx.getLocalDayKey(Date.now()),yesterday=ctx.getLocalDayKey(Date.now()-86400000)
const lesson10=a.buildLesson(10,yesterday,8,[])
const history=(count,completedAt,lessonDate=yesterday)=>lesson10.items.slice(0,count).map(item=>({lessonNo:10,lessonDate,slotNo:item.slotNo,gameId:item.gameId,difficultyLevel:item.difficultyLevel,score:80,completedAt}))
assert.equal(a.resolveLessonAfterSync(8,history(2,Date.now()-86400000),today).lessonNo,10,'1–4项恢复未完成课')
storage.clear();assert.equal(a.resolveLessonAfterSync(8,history(5,Date.now(),today),today).lessonNo,10,'今天生成并完成不再开新课')
storage.clear();assert.equal(a.resolveLessonAfterSync(8,history(5,Date.now()),today).lessonNo,10,'旧课今天补完等待显式开启')
storage.clear();assert.equal(a.resolveLessonAfterSync(8,history(5,Date.now()-86400000),today).lessonNo,11,'无未完成且非今天完成自动开下一课')
// 旧包产生的 5 条空课号成绩：即使 active lesson 已被今天重建，也应恢复成昨天同一课并获得同步 ID。
storage.clear();localRecords=[]
const recoveredLesson=a.buildLesson(12,today,8,[]);a.saveActiveLesson(recoveredLesson)
localRecords=recoveredLesson.items.map((item,index)=>({id:'old-'+index,gameId:item.gameId,dimensionId:item.dimensionId,score:70+index,accuracy:80,averageReaction:500,completedAt:Date.now()-86400000}))
assert.equal(a.repairActiveLessonRecords(),5)
assert.equal(a.getActiveLesson().createdDay,yesterday)
assert.equal(a.lessonCompleted(a.getActiveLesson()),true)
assert.equal(localRecords.every(record=>record.lessonNo==12&&record.localSyncId&&record.lessonSyncPending),true)
// 非自由训练时即使 play 标记陈旧，也能按当前课内 gameId 找回课程号。
uni.setStorageSync('focus_planet_lesson_play_guest',{lessonNo:11,slotNo:1,gameId:'stale'})
assert.equal(a.activeLessonItemForResult(recoveredLesson.items[0].gameId).lessonNo,12)
// 分类卡仅展示，不是课程入口；显式自由训练不能污染课程成绩。
a.clearLessonPlay()
assert.equal(a.activeLessonItemForResult(recoveredLesson.items[0].gameId),null)
// 活动课程对象意外丢失时，独立课程凭证仍必须保住 lessonNo。
storage.clear();localRecords=[]
const ticketLesson=a.buildLesson(1,today,8,[])
a.beginLessonItem(ticketLesson.items[0])
uni.removeStorageSync('focus_planet_active_lesson_guest')
assert.equal(a.activeLessonItemForResult(ticketLesson.items[0].gameId).lessonNo,1)
// 完全缺少 active lesson 的早期记录，只在同日完整覆盖固定第1课时才可无歧义恢复。
storage.clear();localRecords=[]
const firstLesson=a.buildLesson(1,yesterday,8,[])
localRecords=firstLesson.items.map((item,index)=>({id:'first-'+index,gameId:item.gameId,dimensionId:item.dimensionId,score:80,accuracy:80,averageReaction:400,difficultyLevel:3,completedAt:Date.now()-86400000}))
assert.equal(a.repairActiveLessonRecords(),5)
assert.equal(a.getActiveLesson().lessonNo,1)
assert.equal(a.getActiveLesson().createdDay,yesterday)
assert.equal(localRecords.every(record=>record.lessonNo==1&&record.localSyncId),true)
console.log('PASS: 固定5题循环、难度、课次恢复、空课号修复与100条解析')
