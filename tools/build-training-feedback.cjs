// Original synthesized feedback tones. Settlement voices use build-xiaoxiao-finish.cjs.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const dir=path.resolve(__dirname,'../static/audio/feedback');fs.mkdirSync(dir,{recursive:true});
const rate=24000,ff='/usr/local/bin/ffmpeg';
for(const name of ['correct','wrong','missed']){
 const out=path.join(dir,name+'.mp3');if(fs.existsSync(out))continue;
 const samples=new Float64Array(rate*.4);
 if(name==='missed') {
 // User-selected option 01-classic wrong cue now means missed.
 const duration=.30;
 for(let i=0;i<Math.floor(duration*rate);i++){
 const t=i/rate,p=175*t+(125-175)*t*t/(2*duration),env=Math.min(1,t/.008,(duration-t)/.045)*Math.exp(-t/duration*1.6);
 samples[i]+=.43*env*(Math.sin(2*Math.PI*p)+.32*Math.sin(2*Math.PI*p*3)+.13*Math.sin(2*Math.PI*p*5));
 }
 } else {
 // User-selected option 03-toy; identical synthesis to the audition.
 const toy=name==='correct'?[[0,.19,784,784,.47],[.13,.24,1175,1175,.47]]:[[0,.20,190,130,.55],[.17,.21,130,85,.55]];
 for(const [start,duration,f,end,gain] of toy)for(let i=0;i<Math.floor(duration*rate);i++){
 const t=i/rate,p=f*t+(end-f)*t*t/(2*duration),env=Math.min(1,t/.008,(duration-t)/.045)*Math.exp(-t/duration*5),at=Math.floor(start*rate)+i;
 if(at<samples.length)samples[at]+=gain*env*(Math.sin(2*Math.PI*p)+.38*Math.sin(2*Math.PI*p*2.76)+.12*Math.sin(2*Math.PI*p*4.1));
 }
 }
 const pcm=Buffer.alloc(samples.length*2);samples.forEach((v,i)=>pcm.writeInt16LE(Math.round(Math.max(-.8,Math.min(.8,v))*32767),i*2));
 cp.execFileSync(ff,['-v','error','-f','s16le','-ar',''+rate,'-ac','1','-i','pipe:0','-c:a','libmp3lame','-b:a','64k',out],{input:pcm});
}
console.log('Feedback tones ready. To generate/install settlement speech: node tools/build-xiaoxiao-finish.cjs --install');
