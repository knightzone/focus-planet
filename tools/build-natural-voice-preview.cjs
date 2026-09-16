// Audition only: sends the public script below, never user/account data. Does not alter runtime assets.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const dir=path.resolve(__dirname,'../outputs/audio-review/natural-finish-v1');fs.mkdirSync(dir,{recursive:true});
const cli=process.env.EDGE_TTS_CLI||'/private/tmp/focus-natural-voice-env/bin/edge-tts';
const line='这一段训练完成啦。休息一下，放松小手，我们慢慢来。';
for(const [name,voice] of [['xiaoxiao','zh-CN-XiaoxiaoNeural'],['xiaoyi','zh-CN-XiaoyiNeural']]){
 const raw=path.join(dir,name+'-raw.mp3'),file=path.join(dir,name+'.mp3');
 if(fs.existsSync(file))continue;
 cp.execFileSync(cli,['--voice',voice,'--rate=-8%','--text',line,'--write-media',raw],{timeout:60000,stdio:'inherit'});
 cp.execFileSync('/usr/local/bin/ffmpeg',['-v','error','-i',raw,'-af','loudnorm=I=-21:TP=-3:LRA=7','-ar','24000','-ac','1','-c:a','libmp3lame','-b:a','64k',file],{timeout:20000,stdio:'inherit'});
 console.log(file);
}
