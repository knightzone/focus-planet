// Deterministic packaging of approved artwork, not image generation.
// Source A/B PNGs remain untouched. Only annotated local regions enter runtime B.
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),base=path.join(root,'content/brand/spot-difference-story-v2');
const spec=JSON.parse(fs.readFileSync(path.join(base,'runtime-regions.json')));
const supplements=JSON.parse(fs.readFileSync(path.join(base,'runtime-supplements.json')));
const output=path.join(root,'static/images/runtime/spot-difference/story-v2');
const review=path.join(base,'runtime-review');fs.mkdirSync(output,{recursive:true});fs.mkdirSync(review,{recursive:true});
// Approved 768px samples used target-size encoding; equivalent mean q≈24.2.
// User selected q=30 for the first fixed-quality trial.
// Keep fixed quality across scenes, not a per-image byte target.
const quality=30,width=768,height=432,records=[],sources=[];
// Rebuild selected reviewed boundaries only; never silently reuse different specs.
const onlyArg=process.argv.find(arg=>arg.startsWith('--only='));
const only=onlyArg?new Set(onlyArg.slice(7).split(',').map(Number)):null;
const previous=only?JSON.parse(fs.readFileSync(path.join(review,'manifest.json'))):null;
for(let chapter=1;chapter<=15;chapter++){
 const dir=path.join(base,`chapter-${String(chapter).padStart(2,'0')}`);
 for(const s of JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))).scenes){const resolve=p=>path.isAbsolute(p)?p:path.join(dir,p);sources.push({...s,a:resolve(s.aFile||s.file),b:resolve(s.bFile)});}
}
const story=fs.readFileSync(path.join(root,'docs/SPOT_DIFFERENCE_STORY_AND_150_V2.md'),'utf8');
const decode=file=>cp.execFileSync('/usr/local/bin/ffmpeg',['-v','error','-i',file,'-vf',`scale=${width}:${height}`,'-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:2000000});
const png=buf=>cp.execFileSync('/usr/local/bin/ffmpeg',['-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',`${width}x${height}`,'-i','pipe:0','-frames:v','1','-f','image2pipe','-vcodec','png','pipe:1'],{input:buf,maxBuffer:2000000});
const overlap=(a,b)=>Math.max(a[0],b[0])<Math.min(a[0]+a[2],b[0]+b[2])&&Math.max(a[1],b[1])<Math.min(a[1]+a[3],b[1]+b[3]);
for(const s of spec.scenes){
 const id='SD2-'+String(s.n).padStart(3,'0'),source=sources.find(r=>r.id===id);assert(source,id);
 const extra=supplements.scenes.find(r=>r.n===s.n);
 assert(s.regions.length>=2,id+' needs independent candidates');
 assert(!s.method||s.method==='manual-reviewed-local-composite',id+' requires reviewed object boundaries');
 if(only&&!only.has(s.n)){
  assert.equal(previous.quality,quality);assert.equal(previous.width,width);assert.equal(previous.height,height);
  const old=previous.scenes.find(r=>r.id===id);assert(old,id+' no previous build');
  assert.equal(old.regionMethod,'manual-reviewed-local-composite');assert.equal(old.compositeScale,1);
  assert.deepEqual(old.regions.map(r=>[r.x,r.y,r.w,r.h,r.label]),s.regions,id+' changed spec missing from --only');
  for(const file of [source.a,source.b,...(extra?[path.join(root,extra.image)]:[])])assert(fs.statSync(file).mtimeMs<=Date.parse(previous.generatedAt),id+' changed source missing from --only');
  assert.equal(old.supplementSource||null,extra?extra.image:null,id+' supplement changed outside --only');
  for(const file of [old.imageA,old.imageB])assert(fs.existsSync(path.join(root,file)),id+' missing output');
  records.push(old);continue;
 }
 s.regions.forEach(r=>assert(r[0]>=0&&r[1]>=0&&r[2]>0&&r[3]>0&&r[0]+r[2]<=100&&r[1]+r[3]<=100,id+' bounds'));
 assert(s.regions.some((r,i)=>s.regions.slice(i+1).some(other=>!overlap(r,other))),id+' needs at least two compatible candidates');
 const a=decode(source.a),b=decode(source.b);let clean=Buffer.from(a);
 const extraPixels=extra?decode(path.join(root,extra.image)):null;
 const extraLabels=new Set(extra?extra.regions.map(r=>r[4]):[]);
 if(extra)for(const r of extra.regions){
  assert.deepEqual(s.regions.find(other=>other[4]===r[4]),r,id+' supplement annotation drift');
  for(const other of s.regions)if(!extraLabels.has(other[4]))assert(!overlap(r,other),id+'/'+r[4]+' supplemental crop overlaps original-source candidate');
 }
 const selectedPixels=Buffer.from(b);
 // Union of reviewed crops, independent of iteration order. Never erase an earlier
 // crop's interior with the feathered edge of an overlapping crop.
 const alphas=new Float32Array(width*height);
 const regions=s.regions.map(([x,y,w,h,label],i)=>{
  const pixels=extraLabels.has(label)?extraPixels:b;
  const x0=Math.floor(x*width/100),y0=Math.floor(y*height/100),x1=Math.ceil((x+w)*width/100),y1=Math.ceil((y+h)*height/100);
  let changed=0;
  for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++){
   const p=(yy*width+xx)*3,alpha=Math.min(1,Math.min(xx-x0,yy-y0,x1-1-xx,y1-1-yy)/3);
   if(Math.abs(a[p]-pixels[p])+Math.abs(a[p+1]-pixels[p+1])+Math.abs(a[p+2]-pixels[p+2])>60)changed++;
   if(alpha>alphas[yy*width+xx]){
    alphas[yy*width+xx]=alpha;
    for(let c=0;c<3;c++)selectedPixels[p+c]=pixels[p+c];
   }
  }
  if(changed/((x1-x0)*(y1-y0))<=.015){ console.error(id+'/'+label+' has no meaningful pixel change'); if(!process.argv.includes('--audit'))throw Error('Invalid region'); }
  return {id:'d'+(i+1),x,y,w,h,label,changedRatio:changed/((x1-x0)*(y1-y0))};
 });
 for(let pixel=0;pixel<alphas.length;pixel++){const alpha=alphas[pixel],p=pixel*3;for(let c=0;c<3;c++)clean[p+c]=Math.round(a[p+c]*(1-alpha)+selectedPixels[p+c]*alpha);}
 if(process.argv.includes('--audit'))continue;
 const stem=id.toLowerCase();
 for(const [side,pixels] of [['a',a],['b',clean]]){
  const out=path.join(output,`${stem}-${side}.webp`);
  if(process.argv.includes('--preserve-first-34') && s.n<=34 && fs.existsSync(out))continue;
  cp.execFileSync('/usr/local/bin/cwebp',['-quiet','-q',String(quality),'-m','6','-o',out,'--','-'],{input:png(pixels),timeout:60000});
 }
 const match=story.match(new RegExp('\\|'+id+'\\|([^|]+)\\|'));
 const tier=source.tier||{低:'low',中:'medium',高:'high'}[match&&match[1]];assert(tier,id+' tier');
 const url='/static/images/runtime/spot-difference/story-v2/';
 records.push({id,tier,title:source.title,imageA:url+stem+'-a.webp',imageB:url+stem+'-b.webp',regions,regionMethod:s.method||'manual-reviewed-local-composite',compositeScale:1,sourceA:source.a,sourceB:source.b,...(extra?{supplementSource:extra.image}:{})});
}
if(process.argv.includes('--audit'))process.exit(0);
const regionCode=r=>`storyRegion('${r.id}', ${r.x}, ${r.y}, ${r.w}, ${r.h}, ${r.id.slice(1)})`;
fs.writeFileSync(path.join(root,'utils/spot-difference-story.uts'),`// Generated by tools/build-story-runtime.cjs from reviewed local regions.\nimport { DifferenceCandidate, DifferenceScene } from './spot-difference-types.uts'\nfunction storyRegion(id: string, x: number, y: number, w: number, h: number, order: number): DifferenceCandidate {\n  return { id, x, y, w, h, left: x.toString() + '%', top: y.toString() + '%', width: w.toString() + '%', height: h.toString() + '%', difficulty: order, zone: order }\n}\nexport const STORY_DIFFERENCE_SCENES: DifferenceScene[] = [\n${records.map(r=>`  { id: '${r.id}', tier: '${r.tier}', imageA: '${r.imageA}', imageB: '${r.imageB}', regions: [${r.regions.map(regionCode).join(', ')}] }`).join(',\n')}\n]\n`);
fs.writeFileSync(path.join(review,'manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),width,height,quality,sourceCount:records.length,regionCount:records.reduce((n,r)=>n+r.regions.length,0),scenes:records},null,2));
const imgPath=r=>'../../../..'+r;
fs.writeFileSync(path.join(review,'index.html'),`<!doctype html><meta charset="utf-8"><title>故事运行素材审核</title><style>body{font:16px system-ui;background:#eef3fb;margin:24px}.pair{display:flex}.pair img{width:50%}section{margin-bottom:32px}button{padding:12px}</style><h1>${records.length}组故事运行素材</h1><p>已限定局部差异并柔化边缘；运行只抽取2–5处。左A / 右全部候选B。</p>${records.map(r=>`<section><h2>${r.id} ${r.title} · ${r.regions.length}候选</h2><div class="pair"><img src="${imgPath(r.imageA)}"><img src="${imgPath(r.imageB)}"></div><p>${r.regions.map(x=>x.label).join('、')}</p></section>`).join('')}`);
console.log(JSON.stringify({pairs:records.length,regions:records.reduce((n,r)=>n+r.regions.length,0),bytes:fs.readdirSync(output).reduce((n,f)=>n+fs.statSync(path.join(output,f)).size,0)}));
