const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict')
const ts=require('/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root=path.resolve(__dirname,'..')
const lib=fs.readFileSync(path.join(root,'utils/sound-sources.uts'),'utf8').replace(/^export /gm,'')
const page=fs.readFileSync(path.join(root,'pages/game/sound-location.uvue'),'utf8').match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'')
const names='soundObjects,soundPool,soundChoices,soundChoiceCount,begin,replay,answer,pause,resume,started,paused,playing,heard,failed,demoDone,target,choices,correct,errors,roundIndex,totalRounds,reactions,finished'
const code=ts.transpile(lib+'\n'+page+'\nglobalThis.api={'+names+'}',{target:ts.ScriptTarget.ES2020})
function harness(level){
 let now=10000,n=0,url='',load,hide,unload; const timers=new Map(),players=[]
 const ctx={ref:v=>({value:v}),computed:fn=>({get value(){return fn()}}),getGameDifficulty:()=>level,
  onLoad:fn=>load=fn,onHide:fn=>hide=fn,onUnload:fn=>unload=fn,Date:{now:()=>now},Math,
  setTimeout:(fn,ms)=>{const id=++n;timers.set(id,{fn,at:now+ms});return id},clearTimeout:id=>timers.delete(id),
  uni:{navigateTo:()=>{},redirectTo:o=>url=o.url,createInnerAudioContext:()=>{const p={paused:true,playListeners:[],stop(){this.paused=true},pause(){this.paused=true},destroy(){this.destroyed=true},play(){this.paused=false;this.playListeners.forEach(fn=>fn())},onPlay(fn){this.playListeners.push(fn)},onEnded(fn){this.ended=()=>{this.paused=true;fn()}},onError(fn){this.error=fn}};players.push(p);return p}}}
 vm.createContext(ctx);require('./training-test-env.cjs').install(ctx);vm.runInContext(code,ctx);load()
 const tick=ms=>{const until=now+ms;while(true){const t=[...timers].filter(([,v])=>v.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!t)break;timers.delete(t[0]);now=t[1].at;t[1].fn()}now=until}
 return {t:ctx.api,tick,players,last:()=>players.at(-1),url:()=>url,hide:()=>hide(),unload:()=>unload()}
}
for(let level=1;level<=10;level++){
 const h=harness(level),t=h.t
 assert.equal(t.soundObjects.length,18)
 for(const obj of t.soundObjects){assert(fs.existsSync(path.join(root,obj.image)));for(const audio of obj.sounds)assert(fs.existsSync(path.join(root,audio)))}
 for(const target of t.soundPool(level))for(let i=0;i<40;i++){
  const options=t.soundChoices(target,level);assert.equal(options.length,t.soundChoiceCount(level));assert.equal(new Set(options.map(o=>o.id)).size,options.length);assert.equal(options.filter(o=>o.id===target.id).length,1)
 }
 // 试玩可以不玩，直接开始（旧实现要求先答对试玩题，已改为可选）
 {const fresh=harness(level),f=fresh.t;f.begin();assert(f.started.value);assert.equal(f.correct.value,0)}
 t.replay();t.answer('cat');assert.equal(t.demoDone.value,false)
 h.last().ended();t.answer('cat');assert.equal(t.demoDone.value,true);assert.equal(t.correct.value,0)
 t.begin();assert(t.started.value)
 const stale=h.last();h.tick(500);stale.ended();h.tick(300);t.pause();h.tick(60000);t.resume();assert(t.heard.value);assert(!t.failed.value)
 h.tick(200);t.answer(t.target.value.id);t.answer(t.target.value.id);assert.equal(t.correct.value,1);assert.equal(t.reactions[0],500)
 t.pause();h.tick(2000);assert.equal(t.roundIndex.value,0);t.resume();assert.equal(t.roundIndex.value,0);h.tick(1100);assert.equal(t.roundIndex.value,1)
 stale.error({});assert(!t.failed.value)
 h.last().error({});assert(t.failed.value);t.answer(t.target.value.id);assert.equal(t.correct.value,1)
 t.replay();h.last().ended();h.tick(250);t.answer(t.choices.value.find(o=>o.id!==t.target.value.id).id);assert.equal(t.errors.value,1);h.tick(1100)
 while(!t.finished.value){h.last().ended();h.tick(250);t.answer(t.target.value.id);h.tick(1100)}
 const url=new URL(h.url(),'http://test');assert.equal(url.searchParams.get('gameId'),'sound-location');assert.equal(+url.searchParams.get('completed'),t.totalRounds.value);assert(+url.searchParams.get('duration')<60);assert.equal(t.correct.value+t.errors.value,t.totalRounds.value)
 h.unload();assert(h.players.every(p=>p.destroyed))
 const f=harness(level);f.t.replay();f.tick(8000);assert(f.t.failed.value);assert(!f.t.playing.value)
}
// pages.json 必须能解析；解析失败要显式报错，而不是丢一个难懂的 SyntaxError。
try { JSON.parse(fs.readFileSync(path.join(root,'pages.json'),'utf8')) }
catch(error){ throw new Error('pages.json 解析失败：'+error.message) }
console.log('PASS: 10 levels, unique image options, asset paths, demo, playback gating, pause/resume, stale callbacks, errors, double taps, completion, active duration')
