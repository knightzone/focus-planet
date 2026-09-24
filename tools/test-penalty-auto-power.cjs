const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require('/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const page=fs.readFileSync(path.resolve(__dirname,'../pages/game/penalty-kick.uvue'),'utf8');
const source=page.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'');
function harness(level=1){
 let now=10000,id=0;const tasks=new Map(),life={};
 const ctx={Math,Date:{now:()=>now},ref:value=>({value}),computed:f=>({get value(){return f()}}),watch(){},nextTick:f=>f(),onLoad:f=>life.load=f,onHide:f=>life.hide=f,onUnload:f=>life.unload=f,getGameDifficulty:()=>level,setTimeout:(f,ms)=>{tasks.set(++id,{f,at:now+ms});return id},clearTimeout:id=>tasks.delete(id),uni:{redirectTo(){},navigateBack(){}}};
 vm.createContext(ctx);require('./training-test-env.cjs').install(ctx);
 vm.runInContext(ts.transpile(source+'\nglobalThis.api={power,powerMin,powerMax,keeperLane,chooseLane,goals,saves,misses,accepting,aimLane,training,trainingClock}',{target:ts.ScriptTarget.ES2020}),ctx);life.load();
 return {t:ctx.api,life,tasks,advance(ms){const end=now+ms;while(true){const due=[...tasks].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;tasks.delete(due[0]);now=due[1].at;due[1].f()}now=end}};
}
for(let level=1;level<=10;level++){
 const h=harness(level),t=h.t;h.advance(240);assert(t.power.value>0,'auto starts without touch');
 for(let i=0;i<200;i++){h.advance(24);assert(t.power.value>=0&&t.power.value<=100)}
 t.power.value=50;t.keeperLane.value='center';t.chooseLane('left');assert.equal(t.goals.value,1);assert.equal(t.aimLane.value,'left');assert.equal(t.power.value,50);
 t.chooseLane('right');assert.equal(t.goals.value,1,'double input ignored');h.advance(1000);assert.equal(t.power.value,50,'shot freezes power');h.advance(874);assert(t.accepting.value);assert(t.power.value>0&&t.power.value<10,'next round starts automatic power');
 h.life.hide();const frozen=t.power.value;h.advance(5000);assert.equal(t.power.value,frozen);t.chooseLane('right');assert(t.accepting.value,'paused input ignored');t.training.resume();h.advance(24);assert.notEqual(t.power.value,frozen);h.life.unload();assert.equal(h.tasks.size,0);
}
for(const [power,lane,keeper,field] of [[0,'left','right','saves'],[100,'right','left','misses'],[50,'center','center','saves'],[50,'right','left','goals']]){
 const h=harness();h.t.power.value=power;h.t.keeperLane.value=keeper;h.t.chooseLane(lane);assert.equal(h.t[field].value,1);assert.equal(h.t.power.value,power);h.life.unload();
}
assert(page.includes('@click="chooseLane(lane)"'));assert(!page.includes('@touch'));assert(!page.includes('按住射门'));assert(!page.includes('松手射门'));
assert(page.includes("laneArrow(lane) + '  ' + laneLabel(lane)"));
assert(page.includes("lane == 'left' ? '↖' : lane == 'center' ? '↑' : '↗'"));
console.log('PASS: 10 levels, auto oscillation, click-time direction/power, 4 outcomes, duplicate input, pause/resume/next round/unload, 3 directional arrows');
