// 可复现、无外部采样的柔和音乐音色。生成资源，不更改其他游戏已有音效。
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const dir=path.resolve(__dirname,'../static/audio/audio-match');fs.mkdirSync(dir,{recursive:true});
const pitches=[261.6256,329.6276,391.9954,523.2511,659.2551,783.9909],patterns=[[400],[950],[320,320],[320,780],[780,320],[300,300,300]],rate=22050;
for(let instrument=0;instrument<6;instrument++)for(let p=0;p<pitches.length;p++)for(let r=0;r<patterns.length;r++){
 const file=path.join(dir,`i${instrument}-p${p}-r${r}.mp3`);if(fs.existsSync(file))continue;
 const notes=patterns[r],gap=220,total=160+notes.reduce((a,b)=>a+b,0)+gap*(notes.length-1)+180;
 const pcm=Buffer.alloc(Math.ceil(total/1000*rate)*2);let at=160;
 for(const ms of notes){const count=Math.round(ms/1000*rate),start=Math.round(at/1000*rate);for(let i=0;i<count;i++){
   const t=i/rate,f=pitches[p],s=multiple=>Math.sin(2*Math.PI*f*multiple*t);
   // 铃音、木琴、笛音、拨弦、簧管、风琴的合成近似；保留明显音长差。
   const attack=instrument===1?.008:.025,edge=Math.min(1,t/attack,(count-i)/rate/.10);
   const tone=instrument===0 ? s(1)+.28*s(2.76)+.10*s(5.4) : instrument===1 ? s(1)+.46*s(3)+.18*s(5) : instrument===2 ? s(1)+.08*s(2) : instrument===3 ? s(1)+.55*s(2)+.30*s(3)+.14*s(4) : instrument===4 ? s(1)+.65*s(3)+.30*s(5)+.14*s(7) : s(1)+.60*s(2)+.35*s(4);
   const decay=instrument===0 ? Math.exp(-t*1.3) : instrument===1 ? .40+.60*Math.exp(-t*8) : instrument===3 ? .28+.72*Math.exp(-t*5) : instrument===4 ? .90+.10*Math.sin(2*Math.PI*4*t) : 1;
   const value=tone*.18*edge*decay;
   pcm.writeInt16LE(Math.round(value*32767),(start+i)*2);
 }at+=ms+gap;}
 cp.execFileSync(process.env.FFMPEG_PATH||'/usr/local/bin/ffmpeg',['-hide_banner','-loglevel','error','-f','s16le','-ar',''+rate,'-ac','1','-i','pipe:0','-c:a','libmp3lame','-b:a','64k',file],{input:pcm});
}
console.log('216 clips: 6 synthesized instrument timbres × C4/E4/G4/C5/E5/G5 × 6 duration/rhythm patterns. Existing files preserved.');
