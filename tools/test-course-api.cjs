const fs=require('fs'),vm=require('vm'),assert=require('assert/strict')
const ts=require('/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const source=fs.readFileSync('utils/server-api.uts','utf8')
const block=source.slice(source.indexOf('export function getRecentTrainingResults'),source.indexOf('export function getDailyReport')).replace(/^export /gm,'')
const calls=[]
const ctx={Math,JSON,Date,apiRequest:(path,method,body,auth,success,failure,key)=>calls.push({path,method,body,auth,success,failure,key})}
vm.createContext(ctx)
vm.runInContext(ts.transpile(block+'\nglobalThis.api={getRecentTrainingResults,getMaxLessonTrainingResults,submitLessonTrainingResult}',{target:ts.ScriptTarget.ES2020}),ctx)
ctx.api.getRecentTrainingResults(120,()=>{},()=>{})
assert.equal(calls[0].path,'/training/records/latest');assert.equal(Object.keys(calls[0].body).length,0)
ctx.api.getMaxLessonTrainingResults(()=>{},()=>{})
assert.equal(calls[1].path,'/training/records/max-lesson');assert.equal(calls[1].method,'POST');assert.equal(Object.keys(calls[1].body).length,0)
let accepted=null,failed=null
ctx.api.submitLessonTrainingResult({
 submissionId:'result-00001',lessonNo:8,gameId:'bird-cloud',slotNo:3,difficultyLevel:4,score:120,accuracy:90,
 averageReactionMs:500,durationSeconds:60,omissions:0,falseAlarms:0,switchErrors:0,interferenceErrors:0,
 completionCount:12,scoreAlgorithmVersion:'goal-v2',clientCompletedAt:'2026-09-21T00:00:00.000Z',deviceId:'device',localSyncId:'local-only'
},data=>accepted=data,(message,code)=>failed={message,code})
const submit=calls[2];assert.equal(submit.path,'/training/records/sync');assert.equal(submit.body.lessonNo,8);assert.equal(submit.body.gameId,'bird-cloud');assert.equal(submit.body.difficultyLevel,4);assert.equal(submit.body.score,120);assert.equal(submit.body.completionCount,12);assert.equal(submit.body.submissionId,undefined);assert.equal(submit.body.localSyncId,undefined);assert.equal(submit.body.deviceId,undefined)
submit.success({acceptedAsBest:true});assert.equal(accepted.acceptedAsBest,true);assert.equal(failed,null)
assert.match(source,/getDailyReport\(lessonNo: number[\s\S]*?'\/reports\/daily', 'POST', \{ lessonNo: lessonNo \}/)
assert.match(source,/getOverviewReport\(success: ApiSuccess[\s\S]*?'\/reports\/overview', 'POST', \{\}/)
const pages=fs.readFileSync('pages.json','utf8')
assert(pages.includes('"path": "pages/report/report-v2"'))
assert(pages.includes('"path": "pages/history/history-v2"'))
for(const file of ['pages/report/report-v2.uvue','pages/history/history-v2.uvue'])assert(fs.existsSync(file))
const history=fs.readFileSync('pages/history/history-v2.uvue','utf8')
assert.match(history,/getMaxLessonTrainingResults\(/)
assert.match(history,/if \(lessonValue == null\) \{[\s\S]*?return[\s\S]*?\}[\s\S]*?loadLesson\(latestLessonNo\)/)
assert.match(history,/v-for="lessonNo in lessonNumbers"/)
console.log('PASS: 最新课程探测、空历史拦截、1 到最新课切换及训练报告接口')
