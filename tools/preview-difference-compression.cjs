// User-requested compression audition only. Never replaces runtime assets.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),dest=path.join(root,'outputs/image-review/spot-difference-10mb');
fs.mkdirSync(dest,{recursive:true});const rows=[];
for(const width of [640,768])for(const tier of ['low','medium','high'])for(const side of ['a','b']){
 const filename=`${tier}-${side}-${width}.webp`,out=path.join(dest,filename);
 cp.execFileSync('/usr/local/bin/cwebp',['-quiet','-m','6','-resize',String(width),String(width*9/16),'-size','32000','-pass','10',path.join(root,`content/brand/spot-difference-v2/${tier}-${side}.png`),'-o',out]);
 rows.push({tier,side,width,bytes:fs.statSync(out).size,filename});
}
for(const width of [640,768]){const group=rows.filter(r=>r.width===width),sum=group.reduce((s,r)=>s+r.bytes,0);console.log(JSON.stringify({width,rows:group,totalBytes:sum,estimated150PairsBytes:sum*50}));}
