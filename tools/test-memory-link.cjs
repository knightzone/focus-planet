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
assert.equal(a.memoryLinkScore(3,3,20000),100);assert.equal(a.memoryLinkScore(3,3,0),200);assert(a.memoryLinkScore(2,3,1)<100)
function harness(level){
 let now=1000,id=0,url='',backs=0;const tasks=new Map(),life={}
 const c={Math,Number,Date:{now:()=>now},ref:value=>({value}),computed:f=>({get value(){return f()}}),watch:()=>{},getGameDifficulty:()=>level,
 onLoad:f=>life.load=f,onUnload:f=>life.unload=f,onResize:f=>life.resize=f,
 setTimeout:(fn,ms)=>{tasks.set(++id,{fn,at:now+ms});return id},clearTimeout:id=>tasks.delete(id),
 uni:{getWindowInfo:()=>({windowWidth:375}),getElementById:()=>({getBoundingClientRect:()=>({left:0,top:0})}),redirectTo:o=>url=o.url,switchTab:()=>backs++,navigateBack:()=>backs++,showToast(){}}}
 vm.createContext(c);require('./training-test-env.cjs').install(c)
 vm.runInContext(ts.transpile(logic+'\n'+clean(page.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1])+'\nglobalThis.api={training,started,phase,selected,items,order,answers,config,completed,failures,remaining,countdown,lines,begin,beginTrial,selectShape,connect,submit,dragStart,dragEnd,boardWidth,roundScores,displayNumbers,shapeTop,shuffleMotion}',{target:ts.ScriptTarget.ES2020}),c);life.load()
 const tick=ms=>{const end=now+ms;let guard=0;while(true){const due=[...tasks].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;assert(++guard<100000);tasks.delete(due[0]);now=due[1].at;due[1].fn()}now=end}
 return {t:c.api,tick,life,tasks,url:()=>url,backs:()=>backs}
}
function solve(h,good=true){const t=h.t;for(let row=0;row<t.items.value.length;row++){t.selectShape(row);const correct=t.items.value[t.order.value[row]].number;t.connect(good?correct:correct%t.items.value.length+1)}t.submit()}
{
 const exited=harness(10);exited.t.training.back();assert.equal(exited.backs(),1);exited.life.unload()
 const h=harness(10),t=h.t;assert.equal(t.phase.value,'ready');assert.equal(h.tasks.size,0)
 t.beginTrial();t.selectShape(0);t.connect(1);assert.equal(t.answers.value[0],0);h.tick(a.memoryLinkConfig(1).memoryMs+800);assert.equal(t.phase.value,'answer')
 t.selectShape(0);t.training.pause();const before=t.countdown.value;h.tick(6000);t.connect(1);assert.equal(t.answers.value[0],0);assert.equal(t.countdown.value,before);t.training.resume()
 solve(h);h.tick(1800);assert.equal(t.phase.value,'trial-done');assert.equal(h.url(),'');assert.equal(t.roundScores.length,0);assert.equal(h.tasks.size,0)
 t.beginTrial();h.tick(a.memoryLinkConfig(1).memoryMs+800);t.begin();assert.equal(t.items.value.length,6);assert.equal(t.completed.value,0);assert.equal(t.phase.value,'memory');assert(t.answers.value.every(n=>n===0))
 h.life.unload();h.tick(100000);assert.equal(h.tasks.size,0);assert.equal(h.url(),'')
}
{
 const h=harness(10),t=h.t;t.begin();h.tick(t.config.value.memoryMs+800);solve(h,false);h.tick(1800);assert.equal(t.failures.value,1)
 h.tick(t.config.value.memoryMs+800);solve(h,true);assert.equal(t.failures.value,0);h.tick(1800)
 for(let n=0;n<2;n++){h.tick(t.config.value.memoryMs+800);solve(h,false);h.tick(1800)}
 assert(h.url().includes('gameId=memory-link&dimensionId=focused'));assert(Number(new URLSearchParams(h.url().split('?')[1]).get('score'))<100);h.life.unload()
}
{
 const h=harness(1),t=h.t;t.beginTrial();h.tick(a.memoryLinkConfig(1).memoryMs+800);t.dragStart(0);t.dragEnd({changedTouches:[{clientX:t.boardWidth.value-10,clientY:24}]});assert.equal(t.answers.value[0],t.displayNumbers.value[0])
 h.tick(22000);assert.equal(t.phase.value,'review');h.tick(1800);assert.equal(t.phase.value,'trial-done');assert.equal(h.url(),'');t.begin();h.tick(a.memoryLinkConfig(1).durationMs);assert(h.url().includes('duration=85'));assert.equal(h.tasks.size,0)
}
{
 const h=harness(1),t=h.t;t.beginTrial();const items=t.items.value, numbers=t.displayNumbers.value.join();h.tick(a.memoryLinkConfig(1).memoryMs)
 assert.equal(t.phase.value,'shuffle');assert.equal(t.lines.value.length,0);assert.equal(t.items.value,items);assert.equal(t.displayNumbers.value.join(),numbers)
 h.tick(320);const top=t.shapeTop(0);assert.notEqual(top,0);t.training.pause();h.tick(5000);assert.equal(t.shapeTop(0),top);t.selectShape(0);assert.equal(t.selected.value,-1);t.training.resume();h.tick(480)
 assert.equal(t.phase.value,'answer');assert.equal(t.items.value,items);assert.equal(t.displayNumbers.value.join(),numbers);assert.equal(t.lines.value.length,0)
 for(let i=0;i<items.length;i++)assert.equal(t.shapeTop(i),t.order.value.indexOf(i)*56)
 solve(h);assert.equal(t.lines.value.length,3);h.life.unload();h.tick(10000);assert.equal(h.tasks.size,0)
}
console.log('PASS: 600 same-group color rounds, stable images/digits, visible paused shuffle, derangements, one-to-one edits, drag/tap, trial isolation, scoring, timeout and unload')
