const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function harness(){
 let now=10000,id=0,route={route:'pages/game/grid-challenge',options:{gameId:'spot-change',planId:'今天 & 1'}},navigate='',fail=false;
 const timers=new Map(),life={},players=[];
 const ctx={ref:value=>({value}),Date:{now:()=>now},Math,encodeURIComponent,Object,
  onHide:f=>life.hide=f,onUnload:f=>life.unload=f,onBackPress:f=>life.back=f,
  getCurrentPages:()=>[route],setTimeout:(f,ms)=>{timers.set(++id,{f,at:now+ms});return id},clearTimeout:id=>timers.delete(id),
  uni:{redirectTo:o=>{navigate=o.url;if(fail)o.fail()},switchTab:o=>navigate=o.url,navigateBack:()=>navigate='back',showToast(){},createInnerAudioContext(){
   const p={paused:true,destroyed:false,playCount:0,onPlay(f){this.didPlay=f},play(){this.paused=false;this.playCount++;this.didPlay?.()},pause(){this.paused=true},stop(){this.paused=true},destroy(){this.destroyed=true}};players.push(p);return p;
  }}};
 vm.createContext(ctx);require('./training-test-env.cjs').install(ctx);vm.runInContext('globalThis.session=useTrainingSession();globalThis.tween=useTrainingTween(session.clock,0)',ctx);
 function tick(ms){const until=now+ms;let guard=0;while(true){const item=[...timers].filter(([,t])=>t.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!item)break;assert(++guard<10000);timers.delete(item[0]);now=item[1].at;item[1].f()}now=until}
 return {s:ctx.session,tween:ctx.tween,tick,timers,life,players,nav:()=>navigate,setFail:v=>fail=v};
}
{
 const h=harness(),c=h.s.clock;let count=0,intervals=0;
 c.setTimeout(()=>count++,1000);const repeating=c.setInterval(()=>intervals++,300);h.tick(250);const began=c.now();h.s.pause();h.s.pause();assert.equal(h.timers.size,0);h.tick(60000);assert.equal(c.now(),began);assert.equal(count,0);assert.equal(intervals,0);
 h.s.resume();h.s.resume();h.tick(49);assert.equal(intervals,0);h.tick(1);assert.equal(intervals,1);h.tick(699);assert.equal(count,0);h.tick(1);assert.equal(count,1);
 c.clearInterval(repeating);let canceled=0;c.setTimeout(()=>canceled++,200);h.s.pause();const late=c.setTimeout(()=>canceled++,100);c.clearTimeout(late);h.life.unload();h.s.resume();h.tick(60000);assert.equal(canceled,0);assert.equal(h.timers.size,0);
}
{
 const h=harness();h.tween.move(100,1000);h.tick(320);const value=h.tween.value.value;assert(value>0&&value<100);h.life.hide();h.tick(20000);assert.equal(h.tween.value.value,value);h.s.resume();h.tick(700);assert.equal(h.tween.value.value,100);
}
{
 const h=harness(),c=h.s.clock,a=c.createAudio(),silent=c.createAudio();a.play();h.s.pause();assert(a.paused);h.tick(50000);h.s.resume();assert.equal(a.playCount,2);assert.equal(silent.playCount,0);
 h.s.pause();const pending=c.createAudio();pending.play();assert(pending.paused);c.destroyAudio(a);h.s.resume();assert.equal(a.playCount,2);assert.equal(pending.playCount,2);h.life.unload();assert(pending.paused);
}
{
 const h=harness();assert.equal(h.life.back({from:'backbutton'}),true);assert(h.s.paused.value);h.setFail(true);h.s.restart();assert.equal(h.s.navigating.value,false);assert(h.s.paused.value);
 h.setFail(false);h.s.restart();assert(h.nav().includes('gameId=spot-change'));assert(h.nav().includes('planId='+encodeURIComponent('今天 & 1')));assert.equal(h.life.back({from:'navigateBack'}),false);assert(!h.nav().includes('result'));
 const x=harness();x.s.exit();assert.equal(x.nav(),'/pages/index/index');assert(!x.nav().includes('result'));
}
const files=fs.readdirSync(path.join(root,'pages/game')).filter(f=>f.endsWith('.uvue')&&f!=='sound-credits.uvue');assert.equal(files.length,24);
{
 const h=harness();let started=false;h.s.setStartedCheck(()=>started);
 assert.equal(h.life.back({from:'backbutton'}),false);assert.equal(h.s.paused.value,false);assert.equal(h.timers.size,0);
 // 试玩结束仍未正式开始；包括先点暂停再点导航返回的情况。
 h.s.pause();assert.equal(h.life.back({from:'backbutton'}),false);h.s.resume();
 started=true;assert.equal(h.life.back({from:'backbutton'}),true);assert.equal(h.s.paused.value,true);
 const ready=harness();ready.s.setStartedCheck(()=>false);ready.s.back();assert.equal(ready.nav(),'/pages/index/index');assert.equal(ready.s.paused.value,false);
 const playing=harness();playing.s.setStartedCheck(()=>true);playing.s.back();assert.equal(playing.nav(),'');assert.equal(playing.s.paused.value,true);
}
for(const file of files){const p=fs.readFileSync(path.join(root,'pages/game',file),'utf8');assert(p.includes('training.setStartedCheck('),file);if(/\bstarted\s*=\s*ref\(false\)/.test(p))assert(p.includes('training.setStartedCheck((): boolean => started.value)') || (['audio-sequence.uvue','breathing-planet.uvue'].includes(file) && p.includes('training.setStartedCheck((): boolean => started.value && !trial.value)')),file);}
for(const file of files){const p=fs.readFileSync(path.join(root,'pages/game',file),'utf8');assert.equal((p.match(/<TrainingFrame /g)||[]).length,1,file);assert.equal((p.match(/<\/TrainingFrame>/g)||[]).length,1,file);assert(p.indexOf('</TrainingFrame>')<p.lastIndexOf('</template>'),file);assert(!/(?<!\.)\b(?:setTimeout|setInterval|clearTimeout|clearInterval)\(/.test(p),file);assert(!p.includes('Date.now()'),file);assert(!p.includes('uni.createInnerAudioContext()'),file);assert(!p.includes('class="pause-cover"'),file);assert(/if \(trainingPaused\.value(?:\)| \|\|)/.test(p),file);}
const frame=fs.readFileSync(path.join(root,'components/TrainingFrame.uvue'),'utf8');for(const text of ['继续训练','重新训练','退出训练'])assert(frame.includes(text));
assert(frame.indexOf('class="training-back"')<frame.indexOf('class="training-nav-title"'));assert(frame.indexOf('class="training-nav-title"')<frame.indexOf('class="training-pause"'));
const routes=JSON.parse(fs.readFileSync(path.join(root,'pages.json'),'utf8')).pages;
for(const file of files){const route=routes.find(p=>p.path==='pages/game/'+file.replace('.uvue',''));assert.equal(route.style.navigationStyle,'custom',file);}
console.log('PASS: 24-game coverage; remaining deadlines, repeat/duplicate pause, active duration, cancellation/unload, tween/audio freeze, back interception, exact restart params and navigation failure');
