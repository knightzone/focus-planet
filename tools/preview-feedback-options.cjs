// Original synthesized audition candidates; never changes runtime feedback.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const dir = path.resolve(__dirname, '../outputs/audio-review/feedback-options-v2');
fs.mkdirSync(dir, {recursive:true});
const rate = 24000, length = .4;
const sine = x => Math.sin(2*Math.PI*x);
function tone(out, start, duration, f, end, gain, style) {
  for(let i=0; i<Math.floor(duration*rate); i++) {
    const t=i/rate, u=t/duration, p=f*t+(end-f)*t*t/(2*duration);
    const env=Math.min(1,t/.008,(duration-t)/.045)*Math.exp(-u*(style==='wood'?5:1.6));
    let v=sine(p);
    if(style==='bell') v+=.22*sine(p*2)+.08*sine(p*3);
    if(style==='buzz') v+=.32*sine(p*3)+.13*sine(p*5);
    if(style==='wood') v+=.38*sine(p*2.76)+.12*sine(p*4.1);
    const at=Math.floor(start*rate)+i;
    if(at<out.length) out[at]+=gain*env*v;
  }
}
const choices = [
  {id:'01-classic', correct:[[0,.19,880,880,.34,'bell'],[.12,.24,1320,1320,.29,'bell']], wrong:[[0,.30,175,125,.43,'buzz']]},
  {id:'02-arcade', correct:[[0,.14,523,523,.34,'bell'],[.085,.14,659,659,.34,'bell'],[.17,.20,1047,1047,.34,'bell']], wrong:[[0,.17,330,270,.39,'buzz'],[.16,.20,220,140,.39,'buzz']]},
  {id:'03-toy', correct:[[0,.19,784,784,.47,'wood'],[.13,.24,1175,1175,.47,'wood']], wrong:[[0,.20,190,130,.55,'wood'],[.17,.21,130,85,.55,'wood']]}
];
function encode(name,samples) {
  const pcm=Buffer.alloc(samples.length*2);
  samples.forEach((v,i)=>pcm.writeInt16LE(Math.round(Math.max(-.95,Math.min(.95,v))*32767),i*2));
  cp.execFileSync('/usr/local/bin/ffmpeg',['-v','error','-y','-f','s16le','-ar',String(rate),'-ac','1','-i','pipe:0','-c:a','libmp3lame','-b:a','64k',path.join(dir,name+'.mp3')],{input:pcm});
}
for(const c of choices) {
  const pair=new Float64Array(rate*2.2);
  for(const [kind,offset] of [['correct',.15],['wrong',1.3]]) {
    const samples=new Float64Array(rate*length);
    for(const note of c[kind]) tone(samples,...note);
    encode(c.id+'-'+kind,samples);
    pair.set(samples,Math.round(offset*rate));
  }
  encode(c.id+'-pair',pair);
}
console.log('Created 3 pairs + 6 individual cues in '+dir);
