const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),ts=require('/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const assetCode=['sky-planets','spot-change-assets'].map(n=>fs.readFileSync(path.join(root,'utils',n+'.uts'),'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,'')).join('\n');
const page=fs.readFileSync(path.join(root,'pages/game/grid-challenge.uvue'),'utf8');
function harness(level,mode='spot-change'){let now=10000,id=0,url='',load,unload;const timers=new Map();const ctx={Math,Number,Date:{now:()=>now},parseFloat,ref:value=>({value}),computed:f=>({get value(){return f()}}),getGameDifficulty:()=>level,getGameTuningAge:()=>level+4,getGameName:x=>x,GAME_OBJECT_IDS:['bunny','kitten','car','boat'],getGameObjectPath:x=>x,onLoad:f=>load=f,onUnload:f=>unload=f,onHide:()=>{},setTimeout:(f,ms)=>{timers.set(++id,{f,at:now+ms});return id},clearTimeout:i=>timers.delete(i),uni:{redirectTo:o=>url=o.url}};vm.createContext(ctx);require('./training-test-env.cjs').install(ctx);vm.runInContext(ts.transpile(assetCode+'\n'+page.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'')+'\nglobalThis.api={begin,choose,training,phase,gridSize,columns,previewDuration,answerTargetMs,board,originalBoard,answerIndex,roundScores,correct,spotChangeConfig,tryDetective,demoFound,foundIndices,wrongIndices}',{target:ts.ScriptTarget.ES2020}),ctx);load({gameId:mode});function tick(ms){const end=now+ms;for(let guard=0;guard<10000;guard++){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;timers.delete(due[0]);now=due[1].at;due[1].f()}now=end}return{t:ctx.api,tick,timers,url:()=>url,unload:()=>unload()};}
for(let level=1;level<=10;level++){const h=harness(level),t=h.t,c=t.spotChangeConfig(level);assert.equal(t.gridSize.value,c.cells);assert.equal(c.cells%c.columns,0);if(level>1){const prev=t.spotChangeConfig(level-1);assert(c.cells>=prev.cells);assert(c.previewMs<prev.previewMs);assert(c.targetMs<prev.targetMs)}t.begin();t.begin();for(let r=0;r<6;r++){assert.equal(t.phase.value,'preview');t.choose(0);assert.equal(t.roundScores.length,r);h.tick(c.previewMs);assert.equal(t.phase.value,'mask');t.choose(0);h.tick(500);assert.equal(t.phase.value,'search');assert.equal(t.board.value.filter((v,i)=>v!==t.originalBoard.value[i]).length,1);h.tick(c.targetMs/2);t.choose(t.answerIndex.value);t.choose(t.answerIndex.value);assert.equal(t.roundScores[r],200);h.tick(520)}assert(h.url().includes('scoreVersion=goal-v2'));assert.equal(t.correct.value,6);assert.equal(h.timers.size,0);h.unload();}
{const h=harness(1),t=h.t;t.begin();h.tick(1000);t.training.pause();h.tick(50000);assert.equal(t.phase.value,'preview');t.training.resume();h.tick(3500);assert.equal(t.phase.value,'search');h.tick(18000);assert.equal(t.roundScores[0],0);t.choose(t.answerIndex.value);assert.equal(t.roundScores.length,1);h.unload();h.tick(50000);assert.equal(h.timers.size,0);}
{const h=harness(3,'memory-search'),t=h.t;t.begin();h.tick(1100);h.tick(1000);t.choose(t.answerIndex.value);assert.equal(t.roundScores.length,1);h.unload();}
for(let level=1;level<=10;level++){
 const h=harness(level,'symbol-detective'),t=h.t;t.begin();let planets=0;
 for(let round=0;round<3;round++){
  const b=t.board.value,target=b[t.answerIndex.value],counts=new Map();for(const x of b)counts.set(x,(counts.get(x)||0)+1);
  const common=[...counts].sort((a,b)=>b[1]-a[1])[0][0],targets=b.map((x,i)=>x!==common?i:-1).filter(i=>i>=0);
  assert.equal(targets.length,[1,2,2,3,3,4,5,6,7,8][level-1]);assert.equal(b.length,[9,12,16,20,25,30,36,42,48,48][level-1]);
  assert.equal(t.columns.value,[3,3,4,4,5,5,6,6,6,6][level-1]);
  for(const image of b){assert(image.startsWith('/static/'));assert(fs.existsSync(path.join(root,image)));assert(!image.includes('rejected'))}
  if(target.includes('/sky-planets/'))planets++;
  h.tick(1000);for(let k=0;k<targets.length;k++){t.choose(targets[k]);t.choose(targets[k]);assert.equal(t.roundScores.length,round+(k===targets.length-1?1:0))}h.tick(520);
 }assert.equal(planets,1);h.unload();assert.equal(h.timers.size,0);
}
{
 const h=harness(10,'symbol-detective'),t=h.t;
 t.tryDetective(0);assert(!t.demoFound.value);t.tryDetective(2);assert(t.demoFound.value);assert.equal(t.roundScores.length,0);assert.equal(t.correct.value,0);
 t.begin();const b=t.board.value,counts=new Map();for(const x of b)counts.set(x,(counts.get(x)||0)+1);
 const common=[...counts].sort((a,b)=>b[1]-a[1])[0][0],targets=b.map((x,i)=>x!==common?i:-1).filter(i=>i>=0),wrong=b.indexOf(common);
 t.choose(wrong);t.choose(wrong);assert.equal(t.wrongIndices.value.length,1);
 t.choose(targets[0]);t.training.pause();h.tick(50000);t.choose(targets[1]);assert.equal(t.foundIndices.value.length,1);t.training.resume();
 h.tick(t.answerTargetMs.value);for(const i of targets.slice(1))t.choose(i);assert.equal(t.roundScores.length,1);assert.equal(t.roundScores[0],89);assert.equal(t.correct.value,1);h.unload();
}
console.log('PASS: change detection/memory regression; detective 9–48 images/1–8 targets, all-target completion, assets, planet rotation, duplicate/mistake penalty, optional trial, pause and cleanup');
