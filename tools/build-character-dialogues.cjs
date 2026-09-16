// Public fictional-character lines only; generate all before installing. No user data.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'outputs/audio-review/character-dialogues-v1'),runtime=path.join(root,'static/audio/feedback');
fs.mkdirSync(stage,{recursive:true});
const source=fs.readFileSync(path.join(root,'utils/result-dialogue.uts'),'utf8');
const lines=[...source.matchAll(/role: '([^']+)', band: '([^']+)', clip: '([^']+)', line: '([^']+)'/g)].map(m=>({role:m[1],clip:m[3],text:m[4]}));
if(lines.length!==12)throw Error('Expected 12 lines');
const cli=process.env.EDGE_TTS_CLI||'/private/tmp/focus-natural-voice-env/bin/edge-tts';
for(const entry of lines){
 const raw=path.join(stage,entry.clip+'-raw.mp3'),file=path.join(stage,entry.clip+'.mp3');
 if(!fs.existsSync(file)){
 cp.execFileSync(cli,['--voice',entry.role==='yueyue'?'zh-CN-YunxiaNeural':'zh-CN-XiaoxiaoNeural','--rate=-8%','--text',entry.text,'--write-media',raw],{timeout:60000,stdio:'inherit'});
 cp.execFileSync('/usr/local/bin/ffmpeg',['-v','error','-i',raw,'-af','loudnorm=I=-21:TP=-3:LRA=7','-ar','24000','-ac','1','-c:a','libmp3lame','-b:a','64k',file],{timeout:20000,stdio:'inherit'});
 }
 const duration=Number(cp.execFileSync('/usr/local/bin/ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',file],{encoding:'utf8'}));
 if(!(duration>1&&duration<11))throw Error('Invalid duration '+entry.clip);
 console.log(entry.clip+' '+duration+'s');
}
if(process.argv.includes('--install')){for(const e of lines)fs.copyFileSync(path.join(stage,e.clip+'.mp3'),path.join(runtime,e.clip+'.mp3'));console.log('Installed 12 character lines.');}
