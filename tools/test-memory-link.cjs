const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'..'),ts=require('/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),clean=s=>s.replace(/^import .*$/gm,'').replace(/^export /gm,'')
const groups=clean(read('utils/spot-change-assets.uts').split('export const CHANGE_MID_GROUPS')[0])
const logic=groups+'\n'+clean(read('utils/memory-link.uts'))
const page=read('pages/game/memory-link.uvue')
const ctx={Math};vm.createContext(ctx);vm.runInContext(ts.transpile(logic+'\nglobalThis.api={memoryLinkConfig,memoryLinkRound,memoryLinkOrder,memoryLinkAssign,memoryLinkMatches,memoryLinkScore}',{target:ts.ScriptTarget.ES2020}),ctx)
const a=ctx.api
let seed=42;function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646}
for(let level=1;level<=10;level++){
 const c=a.memoryLinkConfig(level);assert(c.count>=3&&c.count<=6)
 assert.equal(c.memoryMs,(c.count*2+2)*2000)
 if(level>1){const p=a.memoryLinkConfig(level-1);assert(c.count>=p.count);assert(c.durationMs>p.durationMs);assert(c.failureLimit<=p.failureLimit)}
 for(let n=0;n<60;n++){
  const items=a.memoryLinkRound(c.count,rand),order=a.memoryLinkOrder(c.count,rand)
  assert.equal(items.length,c.count);assert.equal(new Set(items.map(i=>i.path)).size,c.count);assert.equal(new Set(items.map(i=>i.number)).size,c.count)
  assert.equal(new Set(items.map(i=>path.dirname(i.path))).size,1)
  for(const item of items){assert(!item.path.includes('-shadow'));assert(fs.existsSync(path.join(root,item.path)))}
  assert(order.every((v,i)=>v!==i));assert.equal(new Set(order).size,c.count)
  assert.equal(a.memoryLinkMatches(items,order,order.map(i=>items[i].number)),c.count)
 }
}
assert.deepEqual(Array.from(a.memoryLinkOrder(3,()=>0.99999)),[1,2,0])
assert.deepEqual(Array.from(a.memoryLinkAssign([1,2,3],0,2)),[2,0,3])
assert.deepEqual(Array.from(a.memoryLinkAssign([1,2,3],-1,2)),[1,2,3])
// 计分 = 起始 120 − 每错 10，下限 0（与上天入海同口径）：错 0/1/2 次仍 ≥100，允许小错
assert.equal(a.memoryLinkScore(0),120);assert.equal(a.memoryLinkScore(1),110);assert.equal(a.memoryLinkScore(2),100)
assert.equal(a.memoryLinkScore(3),90);assert.equal(a.memoryLinkScore(12),0);assert.equal(a.memoryLinkScore(99),0)
assert.equal(a.memoryLinkScore(-1),120);assert.equal(a.memoryLinkScore(NaN),120)
function harness(level){
 let now=1000,id=0,url='',backs=0;const tasks=new Map(),life={}
 const c={Math,Number,Date:{now:()=>now},ref:value=>({value}),computed:f=>({get value(){return f()}}),watch:()=>{},getGameDifficulty:()=>level,
 onLoad:f=>life.load=f,onUnload:f=>life.unload=f,onResize:f=>life.resize=f,
 setTimeout:(fn,ms)=>{tasks.set(++id,{fn,at:now+ms});return id},clearTimeout:id=>tasks.delete(id),
 uni:{getWindowInfo:()=>({windowWidth:375}),getElementById:()=>({getBoundingClientRect:()=>({left:0,top:0})}),redirectTo:o=>url=o.url,switchTab:()=>backs++,navigateBack:()=>backs++,showToast(){}}}
 vm.createContext(c);require('./training-test-env.cjs').install(c)
 vm.runInContext(ts.transpile(logic+'\n'+clean(page.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1])+'\nglobalThis.api={training,started,phase,selected,items,order,answers,config,completed,failures,remaining,countdown,memoryLeftPercent,lines,begin,beginTrial,tapRow,tapNumber,connect,completeRound,rowVerdict,solved,roundErrors,totalErrors,shapeClass,numberClass,dragStart,dragEnd,boardWidth,roundScores,displayNumbers,shapeTop,shuffleMotion}',{target:ts.ScriptTarget.ES2020}),c);life.load()
 const tick=ms=>{const end=now+ms;let guard=0;while(true){const due=[...tasks].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;assert(++guard<100000);tasks.delete(due[0]);now=due[1].at;due[1].fn()}now=end}
 return {t:c.api,tick,life,tasks,url:()=>url,backs:()=>backs}
}
// 新流程：每行点一下选中（红行点一下是取消），再点数字连线；全部连对后自动完成，不需要手动提交。
function linkRow(h,row){const t=h.t;if(t.rowVerdict(row)===1)t.tapRow(row);t.tapRow(row);t.connect(t.items.value[t.order.value[row]].number)}
function wrongLink(h,row){const t=h.t;t.tapRow(row);t.connect(t.items.value[t.order.value[row]].number%t.items.value.length+1)}
function linkAll(h){const t=h.t;for(let row=0;row<t.items.value.length;row++)if(t.rowVerdict(row)!==2)linkRow(h,row)}
{
 const exited=harness(10);exited.t.training.back();assert.equal(exited.backs(),1);exited.life.unload()
 const h=harness(10),t=h.t;assert.equal(t.phase.value,'ready');assert.equal(h.tasks.size,0)
 t.beginTrial();t.tapRow(0);t.connect(1);assert.equal(t.answers.value[0],0);h.tick(a.memoryLinkConfig(1).memoryMs+800);assert.equal(t.phase.value,'answer')
 t.tapRow(0);t.training.pause();const before=t.countdown.value;h.tick(6000);t.connect(1);assert.equal(t.answers.value[0],0);assert.equal(t.countdown.value,before);t.training.resume()
 linkAll(h);h.tick(1800);assert.equal(t.phase.value,'trial-done');assert.equal(h.url(),'');assert.equal(t.roundScores.length,0);assert.equal(h.tasks.size,0)
 t.beginTrial();h.tick(a.memoryLinkConfig(1).memoryMs+800);t.begin();assert.equal(t.items.value.length,6);assert.equal(t.completed.value,0);assert.equal(t.phase.value,'memory');assert(t.answers.value.every(n=>n===0))
 h.life.unload();h.tick(100000);assert.equal(h.tasks.size,0);assert.equal(h.url(),'')
}
{
 // 新流程下“一轮没通过”只可能是作答超时（连对后会自动完成，错误只扣分不算失败）。
 const h=harness(10),t=h.t;t.begin();h.tick(t.config.value.memoryMs+800);assert.equal(t.phase.value,'answer')
 h.tick(t.config.value.answerMs+200);assert.equal(t.phase.value,'review');assert.equal(t.failures.value,1,'超时算一次未通过');assert.equal(t.roundScores.at(-1),0,'超时记 0 分')
 h.tick(1800);h.tick(t.config.value.memoryMs+800);linkAll(h);assert.equal(t.failures.value,0,'连对后连续未通过清零');h.tick(1800)
 for(let n=0;n<2;n++){h.tick(t.config.value.memoryMs+800);h.tick(t.config.value.answerMs+200);h.tick(1800)}
 assert(h.url().includes('gameId=memory-link&dimensionId=focused'));assert(Number(new URLSearchParams(h.url().split('?')[1]).get('score'))<100);h.life.unload()
}
{
 const h=harness(1),t=h.t;t.beginTrial();h.tick(a.memoryLinkConfig(1).memoryMs+800);t.dragStart(0);t.dragEnd({changedTouches:[{clientX:t.boardWidth.value-10,clientY:24}]});assert.equal(t.answers.value[0],t.displayNumbers.value[0]);assert.equal(t.roundErrors.value,t.rowVerdict(0)===1?1:0,'拖动连线同样实时判定')
 h.tick(22000);assert.equal(t.phase.value,'review');h.tick(1800);assert.equal(t.phase.value,'trial-done');assert.equal(h.url(),'');t.begin();h.tick(a.memoryLinkConfig(1).durationMs);assert(h.url().includes('duration=85'));assert.equal(h.tasks.size,0)
}
{
 const h=harness(1),t=h.t;t.beginTrial();const items=t.items.value, numbers=t.displayNumbers.value.join();h.tick(a.memoryLinkConfig(1).memoryMs)
 assert.equal(t.phase.value,'shuffle');assert.equal(t.lines.value.length,0);assert.equal(t.items.value,items);assert.equal(t.displayNumbers.value.join(),numbers)
 h.tick(320);const top=t.shapeTop(0);assert.notEqual(top,0);t.training.pause();h.tick(5000);assert.equal(t.shapeTop(0),top);t.tapRow(0);assert.equal(t.selected.value,-1);t.training.resume();h.tick(480)
 assert.equal(t.phase.value,'answer');assert.equal(t.items.value,items);assert.equal(t.displayNumbers.value.join(),numbers);assert.equal(t.lines.value.length,0)
 for(let i=0;i<items.length;i++)assert.equal(t.shapeTop(i),t.order.value.indexOf(i)*56)
 linkAll(h);assert.equal(t.lines.value.length,3);assert.equal(t.phase.value,'review','全部连对后自动完成');h.life.unload();h.tick(10000);assert.equal(h.tasks.size,0)
}
// 实时定位对错：连错立即变红、可取消重连；连对变绿、锁定不可取消，数字也不能被抢；得分按错误次数
{
 const h=harness(1),t=h.t;t.begin();h.tick(t.config.value.memoryMs+800);assert.equal(t.phase.value,'answer')
 const len=t.items.value.length,row=0,correct=t.items.value[t.order.value[row]].number
 wrongLink(h,row)
 assert.equal(t.rowVerdict(row),1,'连错要立即标红');assert.equal(t.shapeClass(row),'shape-wrong');assert.equal(t.roundErrors.value,1,'连错计一次错误');assert.equal(t.solved.value,0)
 t.tapRow(row);assert.equal(t.rowVerdict(row),0,'红色可以点一下取消');assert.equal(t.answers.value[row],0,'取消后这一行回到未连');assert.equal(t.selected.value,-1)
 t.tapRow(row);t.connect(correct);assert.equal(t.rowVerdict(row),2,'连对立即标绿');assert.equal(t.shapeClass(row),'shape-right');assert.equal(t.numberClass(correct),'number-right');assert.equal(t.solved.value,1)
 t.tapRow(row);assert.equal(t.rowVerdict(row),2,'绿色不能被取消');assert.equal(t.answers.value[row],correct,'绿色不会被清掉')
 const other=(row+1)%len;t.tapRow(other);t.connect(correct);assert.equal(t.answers.value[row],correct,'已连对的数字不能被别的行抢走');assert.notEqual(t.answers.value[other],correct);assert.equal(t.roundErrors.value,1,'抢数字不算新错误')
 for(let r=0;r<len;r++)if(t.rowVerdict(r)!==2)linkRow(h,r)
 assert.equal(t.phase.value,'review','全部连对后自动完成，无需手动提交');assert.equal(t.roundScores.length,1);assert.equal(t.roundScores[0],110,'错 1 次 = 110 分（起始 120 − 10）')
 // 错误次数直接决定得分：同一轮错 3 次只能拿 90
 const x=harness(1),u=x.t;u.begin();x.tick(u.config.value.memoryMs+800)
 const xlen=u.items.value.length;for(let n=0;n<3;n++)wrongLink(x,n%xlen)
 assert.equal(u.roundErrors.value,3);for(let r=0;r<xlen;r++)if(u.rowVerdict(r)!==2)linkRow(x,r)
 assert.equal(u.roundScores[0],90,'错 3 次 = 90 分')
 h.life.unload();x.life.unload()
}
// 记忆阶段的倒数用进度条：100% 递减到 0%，画面里不再出现数字倒数
{
 assert(/memory-track/.test(page)&&/memoryLeftPercent/.test(page),'记忆阶段要渲染进度条')
 assert(!/countdown \+ ' 秒后藏起连线'/.test(page),'记忆阶段不再用数字倒数')
 const h=harness(1),t=h.t;assert.equal(t.memoryLeftPercent.value,100,'准备页进度条满格')
 t.beginTrial();assert.equal(t.phase.value,'memory');assert.equal(t.memoryLeftPercent.value,100,'刚进记忆阶段满格')
 const ms=a.memoryLinkConfig(1).memoryMs
 h.tick(Math.floor(ms/2));const half=t.memoryLeftPercent.value
 assert(half>35&&half<65,'跑掉一半后进度条约 50%，实际 '+half)
 h.tick(ms - Math.floor(ms/2) + 50);assert.equal(t.phase.value,'shuffle');assert(t.memoryLeftPercent.value<=2,'记忆结束时进度条基本排空，实际 '+t.memoryLeftPercent.value)
 h.tick(800);assert.equal(t.phase.value,'answer')
 linkAll(h);assert.equal(t.roundScores.length,0,'试玩不计分')
 h.life.unload()
}
console.log('PASS: 600 same-group color rounds, stable images/digits, memory progress bar instead of digits, visible paused shuffle, derangements, one-to-one edits, drag/tap, trial isolation, realtime green/red verdict, locked-correct and cancel-wrong, error-based scoring, timeout and unload')