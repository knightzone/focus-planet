const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict'),vm=require('vm');
const root=path.resolve(__dirname,'..'),base=path.join(root,'content/brand/spot-difference-story-v2');
const manifest=JSON.parse(fs.readFileSync(path.join(base,'runtime-review/manifest.json')));
assert.equal(manifest.scenes.length,34);assert.equal(new Set(manifest.scenes.map(s=>s.id)).size,34);
const ts=require('/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const code=['spot-difference-story','spot-difference-scenes','spot-difference-cycle','spot-difference-hitbox'].map(n=>fs.readFileSync(path.join(root,'utils/'+n+'.uts'),'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,'')).join('\n');
const storage=new Map(),ctx={Math,JSON,localTestKey:k=>k,uni:{getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>storage.set(k,v)}};
vm.createContext(ctx);vm.runInContext(ts.transpile(code+'\nglobalThis.api={DIFFERENCE_SCENES,chooseUnseenDifference,markDifferenceShown,differenceHitboxes}',{target:ts.ScriptTarget.ES2020}),ctx);const api=ctx.api;
assert.equal(api.DIFFERENCE_SCENES.length,34);
let total=0;
for(const s of manifest.scenes){
 assert(api.DIFFERENCE_SCENES.some(x=>x.id===s.id));assert(s.regions.length>=5);
 const [a,b]=[s.imageA,s.imageB].map(file=>cp.execFileSync('/usr/local/bin/ffmpeg',['-v','error','-i',path.join(root,file),'-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:1100000}));
 assert.equal(a.length,768*432*3);assert.equal(b.length,a.length);
 const mask=new Uint8Array(768*432);
 for(const r of s.regions){let changed=0,pixels=0;
  for(let y=Math.floor(r.y*4.32);y<Math.ceil((r.y+r.h)*4.32);y++)for(let x=Math.floor(r.x*7.68);x<Math.ceil((r.x+r.w)*7.68);x++){
   const p=y*768+x;mask[p]=1;const k=p*3;pixels++;
   if(Math.abs(a[k]-b[k])+Math.abs(a[k+1]-b[k+1])+Math.abs(a[k+2]-b[k+2])>45)changed++;
  }
  assert(changed/pixels>.01,s.id+'/'+r.label+' must survive compression');
 }
 let leakage=0,outside=0;
 for(let p=0;p<mask.length;p++)if(!mask[p]){outside++;const k=p*3;if(Math.abs(a[k]-b[k])+Math.abs(a[k+1]-b[k+1])+Math.abs(a[k+2]-b[k+2])>90)leakage++;}
 assert(leakage/outside<.005,s.id+' unintended outside-region changes');
 total+=s.regions.length;
 for(const width of [272,342,720])for(let count=2;count<=5;count++){
  const active=api.DIFFERENCE_SCENES.find(x=>x.id===s.id).regions.slice(0,count),hits=api.differenceHitboxes(active,width,width*9/16);
  assert.equal(hits.length,count);for(const hit of hits){assert(parseFloat(hit.width)>0);assert(parseFloat(hit.height)>0);}
 }
}
for(const tier of ['low','medium','high']){
 const pool=api.DIFFERENCE_SCENES.filter(s=>s.tier===tier),seen=new Set();let last='';assert(pool.length>=10);
 for(let n=0;n<pool.length;n++){const s=api.chooseUnseenDifference(tier,api.DIFFERENCE_SCENES);assert(!seen.has(s.id));seen.add(s.id);api.markDifferenceShown(s,api.DIFFERENCE_SCENES);last=s.id;}
 assert.notEqual(api.chooseUnseenDifference(tier,api.DIFFERENCE_SCENES).id,last);
}
console.log(`PASS: 34 story pairs / ${total} visible compressed candidates; 768x432; outside-region consistency; 2–5 targets across phone/tablet widths; real pack cycles`);
