const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),ts=require('/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const assets=['spot-difference-story','spot-difference-scenes','spot-difference-cycle','spot-difference-hitbox'].map(n=>fs.readFileSync(path.join(root,'utils/'+n+'.uts'),'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,'')).join('\n');
const page=fs.readFileSync(path.join(root,'pages/game/spot-difference.uvue'),'utf8');
const context={Math};vm.createContext(context);vm.runInContext(ts.transpile(assets+'\nglobalThis.api={differenceCandidates,differenceImage,differenceTargetCount}',{target:ts.ScriptTarget.ES2020}),context);const a=context.api;
for(const level of [1,5,10]){
 const regions=a.differenceCandidates(level);assert.equal(regions.length,10);assert.equal(new Set(regions.map(r=>r.id)).size,10);
 const images=[false,true].map(alt=>cp.execFileSync('/usr/local/bin/ffmpeg',['-v','error','-i',path.join(root,a.differenceImage(level,alt)),'-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:4000000}));
 for(const b of images)assert.equal(b.length,768*432*3);
 for(const r of regions){assert(r.x>=0&&r.y>=0&&r.x+r.w<=100&&r.y+r.h<=100);let changed=0,pixels=0;
  for(let y=Math.floor(r.y*4.32);y<Math.floor((r.y+r.h)*4.32);y++)for(let x=Math.floor(r.x*7.68);x<Math.floor((r.x+r.w)*7.68);x++){const i=(y*768+x)*3;pixels++;if(Math.abs(images[0][i]-images[1][i])+Math.abs(images[0][i+1]-images[1][i+1])+Math.abs(images[0][i+2]-images[1][i+2])>45)changed++}
  assert(changed/pixels>.015,level+'/'+r.id+' must contain a real visible difference');
 }
}
function harness(level,trial=false){let now=10000,id=0,url='';const tasks=new Map(),life={},storage=new Map();
 const c={localTestKey:k=>k+'_test',Math,Number,Date:{now:()=>now},ref:value=>({value}),computed:f=>({get value(){return f()}}),getGameDifficulty:()=>level,onLoad:f=>life.load=f,onUnload:f=>life.unload=f,onResize:()=>{},onHide:f=>life.hide=f,setTimeout:(f,ms)=>{tasks.set(++id,{f,at:now+ms});return id},clearTimeout:i=>tasks.delete(i),uni:{getWindowInfo:()=>({windowWidth:390}),getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>storage.set(k,v),redirectTo:o=>url=o.url}};
 vm.createContext(c);require('./training-test-env.cjs').install(c);vm.runInContext(ts.transpile(assets+'\n'+page.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'')+'\nglobalThis.api={started,begin,setupTrial,elapsed,roundComplete,activeIds,found,targetCount,roundScores,errors,find,miss,showHint,newRound,hintId,training,isAlternate,candidates,topUsesAlternate,onSceneShown,onAssetLoaded,onAssetFailed,retryScene,preloadAssets,imageShown,imageLoadFailed,currentScene,renderVersion,sessionStep,sessionPlan}',{target:ts.ScriptTarget.ES2020}),c);life.load();if(!trial)c.api.begin();c.api.preloadAssets.value.forEach(a=>c.api.onAssetLoaded(a.key));
 return{t:c.api,life,tasks,storage,url:()=>url,tick(ms){const end=now+ms;while(true){const due=[...tasks].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;tasks.delete(due[0]);now=due[1].at;due[1].f()}now=end}};
}
for(let level=1;level<=10;level++){
 const h=harness(level),t=h.t;assert.equal(t.targetCount.value,[2,2,3,3,3,4,4,4,5,5][level-1]);
 for(let n=0;n<50;n++){t.newRound();t.preloadAssets.value.forEach(a=>t.onAssetLoaded(a.key));assert.equal(t.activeIds.value.length,t.targetCount.value);assert.equal(new Set(t.activeIds.value).size,t.targetCount.value);for(const r of t.candidates.value)assert.equal(Number(t.isAlternate(r,true))+Number(t.isAlternate(r,false)),t.activeIds.value.includes(r.id)?1:0)}
 t.find('invalid');assert.equal(t.found.value.length,0);t.showHint();t.newRound();t.preloadAssets.value.forEach(a=>t.onAssetLoaded(a.key));h.tick(2000);assert.equal(t.hintId.value,'');
 t.training.pause();t.find(t.activeIds.value[0]);assert.equal(t.found.value.length,0);h.tick(10000);t.training.resume();
 for(const id of t.activeIds.value.slice()){t.find(id);t.find(id)}assert.equal(t.roundScores.length,1);t.miss();assert.equal(t.errors.value,0);t.newRound();h.tick(650);while(!h.url()){t.preloadAssets.value.forEach(a=>t.onAssetLoaded(a.key));for(const id of t.activeIds.value.slice())t.find(id);h.tick(650)}assert.equal(t.roundScores.length,t.sessionPlan.value.length);assert(h.url().includes('scoreVersion=goal-v2'));h.life.unload();assert.equal(h.tasks.size,0);
}
assert(!page.includes('object-symbol'));assert(page.includes('v-if="isAlternate(item, true)"'));assert(page.includes('v-if="isAlternate(item, false)"'));
{
 const h=harness(1),t=h.t; t.newRound();
 const old=t.preloadAssets.value.map(a=>a.key),before=JSON.stringify([...h.storage]);
 t.onAssetLoaded(old[0]);t.onAssetLoaded(old[0]);
 assert.equal(t.imageShown.value,false,'one image or duplicate callback is not a ready pair');
 t.find(t.activeIds.value[0]);assert.equal(t.found.value.length,0);
 assert.equal(JSON.stringify([...h.storage]),before,'loading alone must not consume a scene or recipe');
 t.onAssetFailed(old[1]);assert.equal(t.imageLoadFailed.value,true);
 t.retryScene();t.onAssetLoaded(old[1]);assert.equal(t.imageShown.value,false,'old generation callback ignored');
 h.tick(12000);assert.equal(t.imageLoadFailed.value,true,'hung loader exposes retry');
 t.retryScene();t.preloadAssets.value.forEach(a=>t.onAssetLoaded(a.key));assert.equal(t.imageShown.value,true);
 const key='spot_last_recipe_'+t.currentScene.value.id+'_test';
 assert.equal(h.storage.get(key),t.activeIds.value.slice().sort().join(','),'recipe storage uses same stable scene key');
 const ready=JSON.stringify([...h.storage]);t.preloadAssets.value.forEach(a=>t.onAssetLoaded(a.key));assert.equal(JSON.stringify([...h.storage]),ready);
 h.life.unload();assert.equal(h.tasks.size,0);
}
{
 const h=harness(10,true),t=h.t;
 assert.equal(t.started.value,false);assert.equal(t.targetCount.value,2);assert.equal(h.storage.size,0);
 t.miss();assert.equal(t.errors.value,0);
 for(const id of t.activeIds.value.slice())t.find(id);
 h.tick(30000);assert(t.roundComplete.value);assert.equal(t.roundScores.length,0);assert.equal(h.url(),'');assert.equal(h.storage.size,0);assert.equal(t.elapsed.value,0);
 t.setupTrial();t.preloadAssets.value.forEach(a=>t.onAssetLoaded(a.key));assert.equal(t.found.value.length,0);
 const stale=t.preloadAssets.value.map(a=>a.key);
 t.begin();t.begin();assert(t.started.value);assert.equal(t.targetCount.value,5);assert.equal(t.found.value.length,0);assert.equal(t.roundScores.length,0);
 stale.forEach(k=>t.onAssetLoaded(k));assert.equal(t.imageShown.value,false);
 t.preloadAssets.value.forEach(a=>t.onAssetLoaded(a.key));assert(t.imageShown.value);assert(h.storage.size>0);
 h.life.unload();assert.equal(h.tasks.size,0);
 const skip=harness(1,true);skip.t.begin();assert(skip.t.started.value);skip.life.unload();
}
console.log('PASS: trial completion/replay/skip without scores/history/timing; 500 story recipes; full sessions/scoring/pause; loader lifecycle; display-only history');
