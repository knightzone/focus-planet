const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../static/audio/audio-match'),frequencies=[261.6256,329.6276,391.9954,523.2511,659.2551,783.9909];
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.mp3'));assert.equal(files.length,216);
let bytes=0,maxPeak=0;const hashes=new Set();
for(const file of files){
 const match=file.match(/^i([0-5])-p([0-5])-r([0-5])\.mp3$/);assert(match,file);
 const buffer=fs.readFileSync(path.join(dir,file));bytes+=buffer.length;
 const hash=require('node:crypto').createHash('sha256').update(buffer).digest('hex');assert(!hashes.has(hash),file+' duplicate');hashes.add(hash);
 const pcm=cp.execFileSync('/usr/local/bin/ffmpeg',['-v','error','-i',path.join(dir,file),'-f','f32le','-ar','22050','-ac','1','pipe:1']);
 let peak=0;for(let i=0;i<pcm.length;i+=4)peak=Math.max(peak,Math.abs(pcm.readFloatLE(i)));assert(peak>.05&&peak<.95,file+' silent/clipped');maxPeak=Math.max(maxPeak,peak);
 const energy=frequencies.map(f=>{let re=0,im=0;for(let i=4410;i<6615;i++){const sample=pcm.readFloatLE(i*4),angle=2*Math.PI*f*i/22050;re+=sample*Math.cos(angle);im+=sample*Math.sin(angle)}return re*re+im*im});
 assert.equal(energy.indexOf(Math.max(...energy)),Number(match[2]),file+' pitch');
}
console.log(`PASS: ${files.length} distinct MP3s decoded, six pitches verified, no silence/clipping; ${bytes} bytes (${(bytes/1048576).toFixed(2)} MiB), peak ${maxPeak.toFixed(3)}`);
