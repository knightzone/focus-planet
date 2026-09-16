const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require('/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js'),root=path.resolve(__dirname,'..');
const page=fs.readFileSync(path.join(root,'pages/game/breathing-planet.uvue'),'utf8');
const source=fs.readFileSync(path.join(root,'utils/breathing-planet.uts'),'utf8').replace(/^export /gm,'')+page.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'');
function harness(level){let now=10000,id=0,url='',unload;const timers=new Map(),watchers=new Map();
 const ctx={Math,Date:{now:()=>now},ref(v){let value=v;const r={get value(){return value},set value(x){const changed=x!==value;value=x;if(changed)watchers.get(r)?.(x)}};return r},computed:f=>({get value(){return f()}}),watch:(r,f)=>watchers.set(r,f),onLoad:f=>f(),onUnload:f=>unload=f,onHide:()=>{},getGameDifficulty:()=>level,
 setTimeout:(f,ms)=>{timers.set(++id,{f,at:now+ms});return id},clearTimeout:i=>timers.delete(i),uni:{redirectTo:o=>url=o.url}};
 vm.createContext(ctx);require('./training-test-env.cjs').install(ctx);vm.runInContext(ts.transpile(source+'\nglobalThis.api={trial,started,beginTrial,begin,press,release,cancelPress,training,phase,held,elapsed,cycleIndex,completed,rings,links,config,guided,getBreathingConfig,breathingCycleQuality}',{target:ts.ScriptTarget.ES2020}),ctx);
 function tick(ms){const end=now+ms;for(let guard=0;guard<100000;guard++){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;timers.delete(due[0]);now=due[1].at;due[1].f()}now=end}
 return {t:ctx.api,tick,timers,url:()=>url,unload:()=>unload()};
}
for(let level=1;level<=10;level++){
 const h=harness(level),t=h.t,c=t.config.value;assert(c.cycles*8>=60&&c.cycles*8<=180);assert(c.toleranceMs>=750);
 if(level>1){const prev=t.getBreathingConfig(level-1);assert(c.cycles>=prev.cycles);assert(c.toleranceMs<=prev.toleranceMs)}
 t.press();assert(!t.held.value);t.begin();t.begin();
 for(let r=0;r<c.cycles;r++){t.press();h.tick(3000);assert.equal(t.phase.value,'exhale');t.release();t.release();h.tick(4000);assert.equal(t.completed.value,r+1);assert.equal(t.rings.value,r+1);h.tick(1000)}
 assert.equal(t.phase.value,'finished');assert(h.url().includes('&score=100&accuracy=100'));assert.equal(h.timers.size,0);h.unload();
}
{
 const h=harness(10),t=h.t;t.begin();h.tick(160000);assert.equal(t.completed.value,0);assert(h.url().includes('&score=0&'));
 const x=harness(1),a=x.t;a.begin();a.press();x.tick(500);a.release();x.tick(7500);assert.equal(a.completed.value,1);assert.equal(a.rings.value,0);
 a.press();x.tick(1000);a.training.pause();x.tick(90000);a.release();assert.equal(a.elapsed.value,1000);a.training.resume();assert.equal(a.elapsed.value,0);assert(!a.held.value);a.press();x.tick(3000);a.release();x.tick(4000);assert.equal(a.rings.value,1);a.training.pause();x.tick(10000);a.training.resume();x.tick(1000);assert.equal(a.completed.value,2);a.press();a.cancelPress();a.release();x.tick(8000);assert.equal(a.completed.value,2);x.unload();x.tick(30000);assert.equal(x.timers.size,0);
 assert.equal(a.breathingCycleQuality(0,3750,750),2);assert.equal(a.breathingCycleQuality(0,3751,750),1);assert.equal(a.breathingCycleQuality(0,100,1500),0);
}
console.log('PASS: 10 levels, 136 perfect cycles, idle/early release/cancel/pause/resume/no duplicate reward/unload; fixed breathing timing');

{
 const h=harness(10),t=h.t;t.beginTrial();t.press();h.tick(3000);t.release();h.tick(5000);
 assert.equal(t.phase.value,'trial-done');assert.equal(h.url(),'');assert.equal(h.timers.size,0);
 t.beginTrial();h.tick(1000);t.begin();assert.equal(t.trial.value,false);assert.equal(t.completed.value,0);assert.equal(t.cycleIndex.value,0);assert.equal(t.config.value.cycles,20);h.unload();assert.equal(h.timers.size,0);
 const x=harness(1);x.t.beginTrial();x.tick(8000);assert.equal(x.t.phase.value,'trial-done');assert.equal(x.t.completed.value,0);assert.equal(x.url(),'');x.unload();
}
console.log('PASS: optional breathing trial, idle trial ends, replay/direct start, no result or score carry-over');
