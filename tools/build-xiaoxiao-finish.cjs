// Public settlement copy only; no user data. Validate all clips before installing.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'outputs/audio-review/xiaoxiao-finish-v1'),runtime=path.join(root,'static/audio/feedback');
fs.mkdirSync(stage,{recursive:true});
const source=fs.readFileSync(path.join(root,'utils/training-feedback.uts'),'utf8');
const lines=[...source.match(/FINISH_VOICE_LINES = \[([^\n]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
if(lines.length!==4)throw Error('Expected four settlement lines');
const cli=process.env.EDGE_TTS_CLI||'/private/tmp/focus-natural-voice-env/bin/edge-tts';
for(let i=0;i<lines.length;i++){
 const file=path.join(stage,'finish-'+(i+1)+'.mp3'),raw=path.join(stage,'raw-'+(i+1)+'.mp3');
 if(!fs.existsSync(file)){
 cp.execFileSync(cli,['--voice','zh-CN-XiaoxiaoNeural','--rate=-8%','--text',lines[i],'--write-media',raw],{timeout:60000,stdio:'inherit'});
 cp.execFileSync('/usr/local/bin/ffmpeg',['-v','error','-i',raw,'-af','loudnorm=I=-21:TP=-3:LRA=7','-ar','24000','-ac','1','-c:a','libmp3lame','-b:a','64k',file],{timeout:20000,stdio:'inherit'});
 }
 const duration=Number(cp.execFileSync('/usr/local/bin/ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',file],{encoding:'utf8'}));
 if(!(duration>1&&duration<11))throw Error('Invalid duration: '+file);
 console.log('Validated '+path.basename(file)+' '+duration+'s');
}
if(process.argv.includes('--install')){
 const backup=path.join(stage,'previous-tingting');fs.mkdirSync(backup,{recursive:true});
 for(let i=1;i<=4;i++){const name='finish-'+i+'.mp3',old=path.join(runtime,name);if(!fs.existsSync(path.join(backup,name)))fs.copyFileSync(old,path.join(backup,name));fs.copyFileSync(path.join(stage,name),old)}
 console.log('Installed four Xiaoxiao clips; old Tingting clips retained outside runtime.');
}
