const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require('/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js'),root=path.resolve(__dirname,'..');
const page=fs.readFileSync(path.join(root,'pages/game/breathing-planet.uvue'),'utf8');
const source=fs.readFileSync(path.join(root,'utils/breathing-planet.uts'),'utf8').replace(/^export /gm,'')+page.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'');
function harness(level){let now=10000,id=0,url='',unload;const timers=new Map(),watchers=new Map();
 const ctx={Math,Date:{now:()=>now},ref(v){let value=v;const r={get value(){return value},set value(x){const changed=x!==value;value=x;if(changed)watchers.get(r)?.(x)}};return r},computed:f=>({get value(){return f()}}),watch:(r,f)=>watchers.set(r,f),onLoad:f=>f(),onUnload:f=>unload=f,onHide:()=>{},getGameDifficulty:()=>level,
 setTimeout:(f,ms)=>{timers.set(++id,{f,at:now+ms});return id},clearTimeout:i=>timers.delete(i),uni:{redirectTo:o=>url=o.url,createInnerAudioContext:()=>({paused:true,src:'',onPlay(f){this.playHook=f},play(){this.paused=false;this.playHook()},pause(){this.paused=true},stop(){this.paused=true},destroy(){this.paused=true}})}};
 vm.createContext(ctx);require('./training-test-env.cjs').install(ctx);vm.runInContext(ts.transpile(source+'\nglobalThis.api={trial,started,beginTrial,begin,press,release,cancelPress,training,phase,held,elapsed,cycleIndex,completed,rings,links,config,guided,feedback,pressOnTime,releaseOnTime,pressWindowStyle,releaseWindowStyle,phaseProgress,ringPop,runningScore,getBreathingConfig,breathingCycleQuality,breathingReleaseWindow,BREATHING_INHALE_MS}',{target:ts.ScriptTarget.ES2020}),ctx);
 function tick(ms){const end=now+ms;for(let guard=0;guard<100000;guard++){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;timers.delete(due[0]);now=due[1].at;due[1].f()}now=end}
 return {t:ctx.api,tick,timers,url:()=>url,unload:()=>unload()};
}
for(let level=1;level<=10;level++){
 const h=harness(level),t=h.t,c=t.config.value;assert(c.cycles*8>=60&&c.cycles*8<=180);assert(c.toleranceMs>=750);
 if(level>1){const prev=t.getBreathingConfig(level-1);assert(c.cycles>=prev.cycles);assert(c.toleranceMs<=prev.toleranceMs)}
 t.press();assert(!t.held.value);t.begin();t.begin();
 for(let r=0;r<c.cycles;r++){t.press();h.tick(3000);assert.equal(t.phase.value,'exhale');t.release();t.release();h.tick(4000);assert.equal(t.completed.value,r+1);assert.equal(t.rings.value,r+1);h.tick(1000)}
 assert.equal(t.phase.value,'finished');assert(h.url().includes('&score=100&accuracy=100'));assert(h.url().includes('&precision=100'));assert(h.url().includes('&rings=' + String(c.cycles)));assert.equal(h.timers.size,0);h.unload();
}
{
 const h=harness(10),t=h.t;t.begin();h.tick(160000);assert.equal(t.completed.value,0);assert(h.url().includes('&score=0&'));
 const x=harness(1),a=x.t;a.begin();a.press();x.tick(500);a.release();x.tick(7500);assert.equal(a.completed.value,1);assert.equal(a.rings.value,0);
 a.press();x.tick(1000);a.training.pause();x.tick(90000);a.release();assert.equal(a.elapsed.value,1000);a.training.resume();assert.equal(a.elapsed.value,0);assert(!a.held.value);a.press();x.tick(3000);a.release();x.tick(4000);assert.equal(a.rings.value,1);a.training.pause();x.tick(10000);a.training.resume();x.tick(1000);assert.equal(a.completed.value,2);a.press();a.cancelPress();a.release();x.tick(8000);assert.equal(a.completed.value,2);x.unload();x.tick(30000);assert.equal(x.timers.size,0);
 assert.equal(a.breathingCycleQuality(0,100,1500),0);
 // 松手容错挂在「呼气提示音」上：以提示音片段为中心、前后等量，总宽度 = 该档容差。
 assert.equal(a.BREATHING_INHALE_MS,3000);
 const wideWindow=a.breathingReleaseWindow(1500);
 assert.equal(wideWindow.min,2550,'L1 指令前容错 = (1500-600)/2 = 450ms');
 assert.equal(wideWindow.max,4050,'L1 指令读完后容错也是 450ms');
 assert.equal(wideWindow.target,3300,'理想松手点 = 提示音中点');
 assert.equal(wideWindow.max-wideWindow.min,1500,'松手窗口总宽度 = 该档容差');
 const narrowWindow=a.breathingReleaseWindow(750);
 assert.equal(narrowWindow.min,2925);assert.equal(narrowWindow.max,3675);assert.equal(narrowWindow.max-narrowWindow.min,750);
 assert.equal(a.breathingCycleQuality(0,2550,1500),2,'L1 窗口早边（指令前 450ms）仍是星环');
 assert.equal(a.breathingCycleQuality(0,2549,1500),1,'比窗口再早就不算星环');
 assert.equal(a.breathingCycleQuality(0,2000,1500),1,'吸气中段（2.0s）松手不再算星环——旧口径这里是 2');
 assert.equal(a.breathingCycleQuality(0,4050,1500),2,'L1 窗口晚边仍是星环');
 assert.equal(a.breathingCycleQuality(0,4051,1500),1,'晚边同样收紧');
 assert.equal(a.breathingCycleQuality(0,2925,750),2,'L10 窗口早边');
 assert.equal(a.breathingCycleQuality(0,3675,750),2,'L10 窗口晚边');
 assert.equal(a.breathingCycleQuality(0,3676,750),1);
 assert.equal(a.breathingCycleQuality(0,3750,750),1,'L10 旧口径的 3750 现在已超窗');
}
console.log('PASS: 10 levels, 136 perfect cycles, idle/early release/cancel/pause/resume/no duplicate reward/unload; fixed breathing timing');

{
 const h=harness(10),t=h.t;t.beginTrial();t.press();h.tick(3000);t.release();h.tick(5000);
 assert.equal(t.phase.value,'trial-done');assert.equal(h.url(),'');assert.equal(h.timers.size,0);
 t.beginTrial();h.tick(1000);t.begin();assert.equal(t.trial.value,false);assert.equal(t.completed.value,0);assert.equal(t.cycleIndex.value,0);assert.equal(t.config.value.cycles,20);h.unload();assert.equal(h.timers.size,0);
 const x=harness(1);x.t.beginTrial();x.tick(8000);assert.equal(x.t.phase.value,'trial-done');assert.equal(x.t.completed.value,0);assert.equal(x.url(),'');x.unload();
}
console.log('PASS: optional breathing trial, idle trial ends, replay/direct start, no result or score carry-over');

// ---------- 进度与方向反馈：按晚了 / 松早了 / 松晚了 都要能看见 ----------
{
  // 按下偏晚：L10 容差 750ms，2.0s 才按下 → 明确提示，并且拿不到星环。
  const late = harness(10), lt = late.t;
  lt.begin();
  late.tick(2000); lt.press();
  assert.equal(lt.held.value, true, '吸气段按下要生效');
  assert.ok(/按晚了/.test(lt.feedback.value), '按下偏晚要有明确反馈：' + lt.feedback.value);
  assert.equal(lt.pressOnTime.value, false, '偏晚的按下标记应判为不准（橙色）');
  late.tick(1000); lt.release();
  assert.equal(lt.releaseOnTime.value, true, '3.0s 松开应判为准（绿色）');
  assert.ok(/松得刚好/.test(lt.feedback.value), '松开准点也要有反馈：' + lt.feedback.value);
  late.tick(4200);
  assert.equal(lt.rings.value, 0, '按晚了拿不到星环');
  assert.ok(/按晚了/.test(lt.feedback.value), '结算要告诉孩子是按下偏晚：' + lt.feedback.value);
  assert.ok(/本轮 50 分/.test(lt.feedback.value), '没拿星环的本轮分（50）要报出来：' + lt.feedback.value);
  late.unload();

  // 松早了：0.1s 按下、1.5s 松手 → 提示松早并说明差了多少。
  const early = harness(10), et = early.t;
  et.begin();
  early.tick(100); et.press();
  assert.ok(/按住/.test(et.feedback.value), '按得准就提示继续按住：' + et.feedback.value);
  early.tick(1400); et.release();
  assert.equal(et.releaseOnTime.value, false, '1.5s 松开应判为不准');
  assert.ok(/松早了/.test(et.feedback.value), '松早了要有明确反馈：' + et.feedback.value);
  early.tick(6200);
  assert.ok(/松早了/.test(et.feedback.value), '结算要告诉孩子是松早了：' + et.feedback.value);
  early.unload();

  // 松晚了：按住越过转换点 1.6s 才松 → 提示松晚。
  const slow = harness(10), st = slow.t;
  st.begin();
  slow.tick(200); st.press();
  slow.tick(4400); st.release();
  assert.ok(/松晚了/.test(st.feedback.value), '松晚了要有明确反馈：' + st.feedback.value);
  slow.tick(3200);
  assert.ok(/松晚了/.test(st.feedback.value), '结算要告诉孩子是松晚了：' + st.feedback.value);
  slow.unload();

  // 吸气以外按下不能静静地吞掉，要说清等下一轮。
  const off = harness(1), ot = off.t;
  ot.begin();
  off.tick(4000); ot.press();
  assert.equal(ot.held.value, false, '呼气段按下不生效');
  assert.ok(/吸气/.test(ot.feedback.value), '按错阶段也要给原因：' + ot.feedback.value);
  off.unload();

  // 时间轴把「该按/该松」的窗口画出来，并按档位容差变化。
  const narrow = harness(10).t, wide = harness(1).t;
  assert.match(narrow.pressWindowStyle.value, /^left: 0%; width: 9\.375%$/, 'L10 按住窗口 = 750ms/8000ms');
  assert.match(wide.pressWindowStyle.value, /^left: 0%; width: 18\.75%$/, 'L1 按住窗口 = 1500ms/8000ms');
  assert.match(wide.releaseWindowStyle.value, /^left: 31\.875%; width: 18\.75%$/, 'L1 松开窗口 = 提示音前后各 450ms（2550–4050）');
  assert.match(narrow.releaseWindowStyle.value, /^left: 36\.5625%; width: 9\.375%$/, 'L10 松开窗口 = 前后各 75ms（2925–3675）');
  assert.match(narrow.phaseProgress.value, /^left: /, '播放头要随时钟走');

  // 星环奖励与得分展示：完美一轮要报 100 分、星环 +1、金环放大并显示本局分。
  const ring = harness(10), rt = ring.t;
  rt.begin();
  ring.tick(100); rt.press();
  ring.tick(2900); rt.release();
  ring.tick(4200);
  assert.equal(rt.rings.value, 1, '准点按/松要拿到星环');
  assert.ok(/本轮 100 分/.test(rt.feedback.value), '星环轮要报 100 分：' + rt.feedback.value);
  assert.equal(rt.runningScore.value, 5, 'L10 一轮满分 = 本局 (1+1)/(2×20) = 5 分');
  assert.match(rt.ringPop.value, /^scale\(/, '星环要有放大的动效值');
  ring.unload();
}
console.log('PASS: 按/松都有时间轴窗口与偏差标记，慢了/快了有明确方向反馈');
