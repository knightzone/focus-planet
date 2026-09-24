const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const ts=require('/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const code=['spot-difference-story','spot-difference-cycle','spot-difference-hitbox'].map(n=>fs.readFileSync(path.join(root,'utils',n+'.uts'),'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,'')).join('\n');
const saved=new Map(),ctx={Math,JSON,localTestKey:k=>k,uni:{getStorageSync:k=>saved.get(k),setStorageSync:(k,v)=>saved.set(k,v)}};vm.createContext(ctx);
vm.runInContext(ts.transpile(code+'\nglobalThis.api={STORY_DIFFERENCE_SCENES,differenceCandidatesConflict,canMakeDifferenceRecipe,chooseDifferenceRecipe,chooseUnseenDifference,markDifferenceShown,differenceHitboxes}',{target:ts.ScriptTarget.ES2020}),ctx);const a=ctx.api;
const rect=(id,x,y,w,h,zone)=>({id,x,y,w,h,zone});
const overlap=(x,y)=>Math.max(x.x,y.x)<Math.min(x.x+x.w,y.x+y.w)-1e-8&&Math.max(x.y,y.y)<Math.min(x.y+x.h,y.y+y.h)-1e-8;
const trap=[rect('wide',0,0,30,10,1),rect('left',0,0,10,10,2),rect('right',20,0,10,10,3)];
assert(a.canMakeDifferenceRecipe(trap,2));assert(!a.canMakeDifferenceRecipe(trap,3));
for(let i=0;i<100;i++)assert.deepEqual(Array.from(a.chooseDifferenceRecipe(trap,2)).sort(),['left','right'],'must backtrack, not return short greedy recipe');
assert.deepEqual(Array.from(a.chooseDifferenceRecipe(trap,3)),[]);
assert(!a.differenceCandidatesConflict(rect('a',0,0,10,10,1),rect('b',10,0,10,10,2)),'edge contact permitted');
assert(a.differenceCandidatesConflict(rect('a',0,0,10,10,1),rect('b',9.99,0,10,10,2)),'even small overlap exclusive');
assert(a.differenceCandidatesConflict(rect('a',0,0,10,10,1),rect('b',50,0,10,10,1)),'legacy zone exclusivity retained');
const bad={id:'bad',tier:'low',regions:trap},good={id:'good',tier:'low',regions:[...trap,rect('extra',50,0,10,10,4)]};
assert.equal(a.chooseUnseenDifference('low',[bad],3),null);
assert.equal(a.chooseUnseenDifference('low',[bad,good],3).id,'good');
a.markDifferenceShown(bad,[bad,good],2);a.markDifferenceShown(good,[bad,good],3);a.markDifferenceShown(good,[bad,good],3);
assert(saved.get('focus_difference_seen_v1_low').includes('bad'),'eligible cycle reset must preserve incompatible scene history');
let recipes=0;
for(const s of a.STORY_DIFFERENCE_SCENES)for(let count=2;count<=5;count++){
 if(!a.canMakeDifferenceRecipe(s.regions,count)){assert.equal(a.chooseDifferenceRecipe(s.regions,count).length,0);continue;}
 for(let trial=0;trial<20;trial++){
  const ids=a.chooseDifferenceRecipe(s.regions,count),items=s.regions.filter(r=>ids.includes(r.id));assert.equal(items.length,count);
  for(let i=0;i<items.length;i++)for(let j=0;j<i;j++)assert(!a.differenceCandidatesConflict(items[i],items[j]),s.id+' conflicting answers');
  for(const width of [272,342,720]){const hits=a.differenceHitboxes(items,width,width*9/16).map(h=>({x:parseFloat(h.left),y:parseFloat(h.top),w:parseFloat(h.width),h:parseFloat(h.height)}));for(let i=0;i<hits.length;i++)for(let j=0;j<i;j++)assert(!overlap(hits[i],hits[j]),s.id+' expanded click areas overlap');}
  recipes++;
 }
}
console.log(`PASS ${recipes} full-size mutually exclusive recipes; backtracking, eligibility, cycle history and nonoverlapping expanded hit areas`);
// Exercise generated review controls: selecting a conflict replaces it instead
// of presenting an impossible all-candidates round to the reviewer.
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.style={};this.classes=new Set();this.classList={toggle:(name,on)=>{if(on)this.classes.add(name);else this.classes.delete(name)}};}
 append(child){this.children.push(child)}
}
const main=new Element('main'),browser={Math,Number,Set,location:{hash:''},document:{createElement:t=>new Element(t),querySelector:()=>main}};
vm.createContext(browser);
const review=path.join(root,'content/brand/spot-difference-story-v2/runtime-review');
vm.runInContext(fs.readFileSync(path.join(review,'recipe-rules.js'),'utf8'),browser);
const html=fs.readFileSync(path.join(review,'independent-regions.html'),'utf8');
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],browser);
const scene=main.children.find(s=>s.id==='SD2-087'),buttons=scene.children[2].children;
const body=buttons.find(b=>b.textContent==='推车车身'),hub=buttons.find(b=>b.textContent==='前轮轮心');
scene.children[3].children.find(b=>b.textContent==='清空').onclick();
body.onclick();assert(body.classes.has('active'));hub.onclick();assert(hub.classes.has('active'));assert(!body.classes.has('active'));
for(let i=0;i<30;i++){scene.children[3].children.find(b=>b.textContent==='随机5处').onclick();assert.equal(buttons.filter(b=>b.classes.has('active')).length,5);assert(!(body.classes.has('active')&&hub.classes.has('active')))}
console.log('PASS generated review manual conflict replacement and random-five controls');
