const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require(process.env.TYPESCRIPT_PATH||'/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const root=path.resolve(__dirname,'..'),page=fs.readFileSync(path.join(root,'pages/game/bird-cloud.uvue'),'utf8');
const source=fs.readFileSync(path.join(root,'utils/bird-cloud.uts'),'utf8').replace(/^export /gm,'')+'\n'+page.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'');
const names='trainingPaused,getBirdConfig,nextBirdGap,state,config,bodyReady,wingReady,begin,startDemo,flap,pauseGame,resumeGame,birdY,birdVelocity,bodyAngle,wingAngle,wingScale,elapsed,gateX,gapCenter,gateResolved,passed,hits,roundIndex,resolveGate,resetGate';
const code=ts.transpile(source+'\nglobalThis.api={'+names+'}',{target:ts.ScriptTarget.ES2020});
function harness(level=1){
 let now=10000,id=0,url='';const timers=new Map(),life={};
 const ctx={ref:value=>({value}),computed:f=>({get value(){return f()}}),nextTick:f=>f(),onLoad:f=>life.load=f,onReady:()=>{},onResize:()=>{},onHide:f=>life.hide=f,onUnload:f=>life.unload=f,getGameDifficulty:()=>level,Date:{now:()=>now},Math,setInterval:f=>{timers.set(++id,f);return id},clearInterval:id=>timers.delete(id),uni:{getElementById:()=>({getBoundingClientRect:()=>({width:340})}),navigateBack(){},redirectTo:o=>url=o.url}};
 vm.createContext(ctx); require('./training-test-env.cjs').install(ctx);vm.runInContext(code,ctx);life.load();const t=ctx.api;t.bodyReady.value=true;t.wingReady.value=true;
 return {t,timers,life,step(ms=32){now+=ms;for(const f of [...timers.values()])f()},url:()=>url};
}
for(let l=1;l<=10;l++){
 const h=harness(l),t=h.t,c=t.getBirdConfig(l);
 if(l>1){const p=t.getBirdConfig(l-1);assert(c.speed>p.speed);assert(c.gap<p.gap);assert(c.shift>p.shift)}
 for(let i=0;i<1000;i++){const center=t.nextBirdGap(i%391,c,(i%101)/100);assert(center-c.gap/2>=26);assert(center+c.gap/2<=364)}
 t.begin();assert.equal(t.state.value,'running');assert.equal(h.timers.size,1);
 for(let i=0;i<c.rounds;i++){t.birdY.value=t.gapCenter.value-33;t.resolveGate();t.resolveGate();assert.equal(t.roundIndex.value,i+1);if(i+1<c.rounds)t.resetGate()}
 assert.equal(t.state.value,'finished');assert(h.url().includes('&score=100&'));assert.equal(t.config.value.speed,c.speed);assert.equal(h.timers.size,0);
}
{
 const h=harness(10),t=h.t;t.startDemo();assert.equal(t.config.value.gap,210);t.resolveGate();assert.equal(t.state.value,'demo-done');assert.equal(t.passed.value,0);assert.equal(t.roundIndex.value,0);
 t.begin();assert.equal(t.config.value.gap,120);assert.equal(t.elapsed.value,0);t.flap();const y=t.birdY.value;h.step();assert(t.birdY.value<y);assert(t.bodyAngle.value<0);const a=t.wingAngle.value;h.step(128);assert.notEqual(t.wingAngle.value,a);
 const frozen=[t.elapsed.value,t.bodyAngle.value,t.wingAngle.value];h.life.hide();h.step(10000);assert.deepEqual([t.elapsed.value,t.bodyAngle.value,t.wingAngle.value],frozen);t.flap();assert.equal(t.trainingPaused.value, true);t.resumeGame();assert.equal(h.timers.size,1);h.step(1000);assert.equal(t.trainingPaused.value, true);t.resumeGame();h.life.unload();assert.equal(h.timers.size,0);
}
for(const delta of [16,32,64]){
 const h=harness(),t=h.t;t.begin();t.flap();for(let i=0;i<640/delta;i++)h.step(delta);
 const snapshot=JSON.stringify([t.birdY.value,t.birdVelocity.value,t.wingAngle.value,t.bodyAngle.value]);if(delta===16)global.expected=snapshot;else assert.equal(snapshot,global.expected);
}
{
 const h=harness(),t=h.t;t.wingReady.value=false;t.begin();assert.equal(t.state.value,'ready');t.wingReady.value=true;t.startDemo();h.step();t.begin();assert.equal(t.elapsed.value,0);assert.equal(h.timers.size,1);
 t.gateX.value=4;t.birdY.value=162;h.step();assert.equal(t.roundIndex.value,0);t.birdY.value=162;h.step();assert.equal(t.roundIndex.value,1);h.step();assert.equal(t.roundIndex.value,1);
 t.resetGate();t.birdY.value=0;t.resolveGate();assert.equal(t.hits.value,1);
}
for(const m of page.matchAll(/src="(\/static\/[^\"]+)"/g))assert(fs.existsSync(path.join(root,m[1])));
console.log('PASS: 10 difficulty levels, bounded gaps, scoring, optional demo, frame-rate-independent flight/flapping, pause/lag/unload and assets');
