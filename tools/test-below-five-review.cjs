const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const base=path.join(__dirname,'../content/brand/spot-difference-story-v2/runtime-review');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.style={};this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
 append(child){this.children.push(child)}
}
const main=new Element('main'),ctx={Math,Number,Set,location:{hash:''},document:{createElement:t=>new Element(t),querySelector:()=>main}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(base,'recipe-rules.js'),'utf8'),ctx);
const html=fs.readFileSync(path.join(base,'below-five-regions.html'),'utf8');
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
const expected=[10,41,57,65,76,85,90,95,98,112,115,116,121,126,144,149].map(n=>'SD2-'+String(n).padStart(3,'0'));
assert.deepEqual(main.children.map(s=>s.id),expected);
const scenes=vm.runInContext('scenes',ctx);
for(const section of main.children){
 const s=scenes.find(s=>s.id===section.id),buttons=section.children[2].children,toolbar=section.children[3].children;
 const active=()=>s.regions.filter((r,i)=>buttons[i].classes.has('active'));
 assert(active().length>=2);
 assert(active().every(r=>s.addedLabels.includes(r.label)));
 assert(!toolbar.find(b=>b.textContent==='随机5处').disabled);
 const check=()=>{const a=active();for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)assert(!ctx.differenceCandidatesConflict(a[i],a[j]));};
 check();toolbar.find(b=>b.textContent==='清空').onclick();assert.equal(active().length,0);
 for(const button of buttons){button.onclick();check();}
 for(const n of [2,3,4,5]){const b=toolbar.find(b=>b.textContent==='随机'+n+'处');assert(!b.disabled);b.onclick();assert.equal(active().length,n);check();}
 for(const file of [s.imageA,s.imageB])assert(fs.existsSync(path.resolve(base,'../../../..'+file)));
}
console.log('PASS 16-scene supplementation review: images, new defaults, individual toggles, random 2–5 counts, conflict exclusion.');
