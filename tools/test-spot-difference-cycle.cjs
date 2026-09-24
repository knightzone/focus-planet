const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),ts=require('/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const code=['spot-difference-story','spot-difference-scenes','spot-difference-cycle'].map(n=>fs.readFileSync(path.join(root,'utils/'+n+'.uts'),'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,'')).join('\n');
const saved=new Map(),c={Math,JSON,localTestKey:k=>k,uni:{getStorageSync:k=>saved.get(k),setStorageSync:(k,v)=>saved.set(k,v)}};vm.createContext(c);vm.runInContext(ts.transpile(code+'\nglobalThis.api={chooseUnseenDifference,markDifferenceShown,differenceSessionPlan}',{target:ts.ScriptTarget.ES2020}),c);const a=c.api;
const scenes=['low','medium','high'].flatMap(tier=>Array.from({length:50},(_,i)=>({id:tier+'-'+i,tier,imageA:'a',imageB:'b',regions:[]})));
for(const tier of ['low','medium','high']){const seen=new Set();let last='';for(let i=0;i<50;i++){const scene=a.chooseUnseenDifference(tier,scenes);assert(!seen.has(scene.id));a.markDifferenceShown(scene,scenes);seen.add(scene.id);last=scene.id}assert.equal(seen.size,50);const next=a.chooseUnseenDifference(tier,scenes);assert.notEqual(next.id,last);a.markDifferenceShown(next,scenes);assert.equal(saved.get('focus_difference_seen_v1_'+tier).length,1)}
assert.deepEqual(Array.from(a.differenceSessionPlan(1)),['low','low','medium']);assert.deepEqual(Array.from(a.differenceSessionPlan(2)),['low','medium','high']);assert.deepEqual(Array.from(a.differenceSessionPlan(10)),['low','medium','medium','high','high']);
for(let level=1;level<=10;level++)assert(a.differenceSessionPlan(level).length>=3&&a.differenceSessionPlan(level).length<=5);
const before=JSON.stringify([...saved]);a.chooseUnseenDifference('low',scenes);assert.equal(JSON.stringify([...saved]),before,'selection/prefetch alone does not consume');
const added={id:'low-new',tier:'low',imageA:'a',imageB:'b',regions:[]};for(const scene of scenes.filter(s=>s.tier==='low'))a.markDifferenceShown(scene,scenes);assert.equal(a.chooseUnseenDifference('low',scenes.concat(added)).id,added.id);
assert.equal(a.chooseUnseenDifference('low',[]),null,'empty packs return null instead of undefined/crash');
saved.clear();
const variable=[3,4,5,6,7].map((count,i)=>({id:'mixed-'+i,tier:'low',imageA:'a',imageB:'b',regions:Array.from({length:count},(_,j)=>({id:'d'+j,zone:j,x:j*12,y:0,w:10,h:10}))}));
a.markDifferenceShown(variable[0],variable,2);
for(let cycle=0;cycle<3;cycle++){
 const visited=new Set();
 for(let i=0;i<3;i++){
  const scene=a.chooseUnseenDifference('low',variable,5);
  assert(scene.regions.length>=5);assert(!visited.has(scene.id));
  visited.add(scene.id);a.markDifferenceShown(scene,variable,5);
 }
 assert(saved.get('focus_difference_seen_v1_low').includes('mixed-0'),'high-level cycling preserves previously seen smaller scenes');
}
assert.equal(a.chooseUnseenDifference('low',variable,8),null);
console.log('PASS: tier cycles, display-only marking, variable candidate eligibility, eligible-cycle reset without forgetting smaller scenes, 3–5 mixed rounds');
