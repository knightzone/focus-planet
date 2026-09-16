const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require(process.env.TYPESCRIPT_PATH||'/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const root=path.resolve(__dirname,'..'),page=fs.readFileSync(path.join(root,'pages/game/audio-sequence.uvue'),'utf8');
const source=fs.readFileSync(path.join(root,'utils/audio-match.uts'),'utf8').replace(/^export /gm,'')+'\n'+page.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'');
const code=ts.transpile(source+'\nglobalThis.api={trial,beginTrial,training,phase,started,target,targetPlayed,options,correct,errors,roundIndex,reactions,begin,preview,choose,matchSounds,matchSoundPath,audioMatchChoices,getAudioMatchConfig,soundDifference}',{target:ts.ScriptTarget.ES2020});
function harness(level){let now=10000,id=0,url='',load,unload;const timers=new Map(),players=[];
 const ctx={ref:value=>({value}),computed:f=>({get value(){return f()}}),getGameDifficulty:()=>level,Math,Date:{now:()=>now},onLoad:f=>load=f,onHide:()=>{},onUnload:f=>unload=f,
 setTimeout:(f,ms)=>{timers.set(++id,{f,at:now+ms});return id},clearTimeout:id=>timers.delete(id),uni:{redirectTo:o=>url=o.url,createInnerAudioContext(){
 const p={paused:true,plays:[],destroyed:false,onPlay(f){this.plays.push(f)},onEnded(f){this.ended=f},onError(f){this.error=f},play(){this.paused=false;this.plays.forEach(f=>f())},pause(){this.paused=true},stop(){this.paused=true},destroy(){this.destroyed=true}};players.push(p);return p;
 }}};
 vm.createContext(ctx);require('./training-test-env.cjs').install(ctx);vm.runInContext(code,ctx);load();
 function tick(ms){const end=now+ms;for(let guard=0;guard<1000;guard++){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;timers.delete(due[0]);now=due[1].at;due[1].f()}now=end}
 return {t:ctx.api,tick,last:()=>players.at(-1),players,timers,url:()=>url,unload:()=>unload()};
}
for(let level=1;level<=10;level++){
 const h=harness(level),t=h.t,c=t.getAudioMatchConfig(level);assert.equal(c.targetPlays,2);assert(c.options>=2&&c.options<=5);assert.equal(t.matchSounds().length,216);assert.equal(new Set(t.matchSounds().map(s=>s.instrument)).size,6);
 for(const target of t.matchSounds())for(let i=0;i<8;i++){const options=t.audioMatchChoices(target,level);assert.equal(options.length,c.options);assert.equal(new Set(options.map(s=>s.id)).size,c.options);assert.equal(options.filter(s=>s.id===target.id).length,1);for(const s of options){assert(fs.existsSync(path.join(root,t.matchSoundPath(s.id))));if(s.id!==target.id)assert(t.soundDifference(s,target)>=2)}}
 for(const target of t.matchSounds())for(const option of t.audioMatchChoices(target,level)){
  if(option.id===target.id)continue;
  assert(option.instrument!==target.instrument||option.pitch!==target.pitch||option.rhythm!==target.rhythm);
  if(level===10)assert.equal(option.instrument,target.instrument,'highest level uses matching timbre but audible pitch/rhythm difference');
  if(level===1)assert.notEqual(option.instrument,target.instrument,'entry level has an obvious timbre difference');
 }
 assert.equal(t.started.value,false);t.begin();t.begin();assert.equal(h.players.length,1);
 const seen=new Set();
 for(let r=0;r<8;r++){
  assert(!seen.has(t.target.value.id),'session targets must not repeat');seen.add(t.target.value.id);
  assert.equal(t.phase.value,'target');const first=h.last();t.preview(0);t.choose(0);assert.equal(h.last(),first);assert.equal(t.correct.value,r);
  first.ended();first.ended();assert.equal(t.targetPlayed.value,1);h.tick(450);h.last().ended();assert.equal(t.targetPlayed.value,2);assert.equal(t.phase.value,'choices');
  const count=h.players.length;t.training.pause();h.tick(20000);t.preview(0);t.choose(0);assert.equal(h.players.length,count);t.training.resume();
  const index=t.options.value.findIndex(s=>s.id===t.target.value.id);t.preview(index);const audition=h.last();h.tick(250);t.choose(index);t.choose(index);audition.ended();assert.equal(t.correct.value,r+1);assert.equal(t.reactions[r],250);h.tick(900);
 }
 assert.equal(t.phase.value,'finished');assert(h.url().includes('&score=100&'));assert.equal(h.timers.size,0);h.unload();assert(h.players.every(p=>p.destroyed));
}
{
 const h=harness(1),t=h.t;t.begin();h.last().error({});assert.equal(t.phase.value,'error');const count=h.players.length;t.begin();t.preview(0);h.tick(30000);assert.equal(h.players.length,count);assert.equal(t.correct.value,0);
 const x=harness(10),a=x.t;a.begin();x.last().ended();x.tick(450);x.last().ended();a.preview(0);x.last().error({});assert.equal(a.phase.value,'choices');a.preview(1);assert.equal(x.last().paused,false);a.training.pause();assert(x.last().paused);a.training.resume();assert.equal(x.last().paused,false);a.choose(a.options.value.findIndex(s=>s.id!==a.target.value.id));assert.equal(a.errors.value,1);x.unload();x.tick(10000);assert.equal(a.roundIndex.value,0);
}
assert(!page.includes('再听一次'));assert(!page.includes('function replay'));
assert(!page.includes('waiting-note'));assert(!page.includes('♪　♫　♪'),'target waiting area must not resemble option buttons');
const decoration=page.match(/<image class="melody-decoration[^>]*>/)[0];
assert(!decoration.includes('@'));assert(decoration.includes('tap-content'));
assert(fs.existsSync(path.join(root,'static/images/runtime/backgrounds/audio-melody-staff.svg')));
console.log('PASS: 216 assets/6 timbres; non-repeating session targets; 10 levels/2–5 options; audible differences; exactly 2 target plays; pause/errors/80-round scoring');

{
 const h=harness(10),t=h.t;t.beginTrial();assert.equal(t.options.value.length,2);
 h.last().ended();h.tick(450);h.last().ended();assert.equal(t.targetPlayed.value,2);
 t.preview(0);t.choose(t.options.value.findIndex(s=>s.id===t.target.value.id));h.tick(1400);
 assert.equal(t.phase.value,'trial-done');assert.equal(t.correct.value,0);assert.equal(t.reactions.length,0);assert.equal(h.url(),'');
 t.beginTrial();const stale=h.last();stale.ended();t.begin();assert.equal(t.trial.value,false);assert.equal(t.options.value.length,5);assert.equal(t.roundIndex.value,0);
 const active=h.last();stale.ended();h.tick(450);assert.equal(h.last(),active);assert.equal(t.targetPlayed.value,0);h.unload();assert.equal(h.timers.size,0);assert(h.players.every(p=>p.destroyed));
}
console.log('PASS: optional one-question audio trial, 2 choices/2 target plays, no saved score, replay/direct start clears stale callbacks');
