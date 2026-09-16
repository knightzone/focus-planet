// Read-only source review: labeled independent A/B rows in temporary contact sheets.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),base=path.join(root,'content/brand/spot-difference-story-v2');
const rows=[];
if(process.argv.includes('--runtime')){
 for(const s of JSON.parse(fs.readFileSync(path.join(base,'runtime-review/manifest.json'))).scenes)rows.push({id:s.id,a:path.join(root,s.imageA),b:path.join(root,s.imageB)});
} else for(let chapter=1;chapter<=4;chapter++){
 const dir=path.join(base,'chapter-'+String(chapter).padStart(2,'0'));
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
 for(const s of manifest.scenes){const resolve=p=>path.isAbsolute(p)?p:path.join(dir,p);rows.push({id:s.id,a:resolve(s.aFile||s.file),b:resolve(s.bFile)});}
}
rows.sort((a,b)=>a.id.localeCompare(b.id));
fs.mkdirSync('/tmp/focus-story-review',{recursive:true});
fs.writeFileSync('/tmp/focus-story-review/sources.json',JSON.stringify(rows,null,2));
for(let i=0;i<rows.length;i+=3){
 const group=rows.slice(i,i+3),canvas=Buffer.alloc(1536*432*group.length*3);
 group.forEach((r,y)=>['a','b'].forEach((side,x)=>{
 const pixels=cp.execFileSync('/usr/local/bin/ffmpeg',['-v','error','-i',r[side],'-vf','scale=768:432','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:2000000});
 for(let line=0;line<432;line++)pixels.copy(canvas,((y*432+line)*1536+x*768)*3,line*768*3,(line+1)*768*3);
 }));
 cp.execFileSync('/usr/local/bin/ffmpeg',['-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',`1536x${432*group.length}`,'-i','pipe:0','-frames:v','1',`/tmp/focus-story-review/${String(i+1).padStart(3,'0')}.png`],{input:canvas});
}
console.log(`${rows.length} A/B pairs; /tmp/focus-story-review (three rows per sheet, A left / B right)`);
