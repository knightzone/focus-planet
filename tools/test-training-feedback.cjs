const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),ts=require('/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const source=['training-clock','training-feedback','result-dialogue'].map(n=>fs.readFileSync(path.join(root,'utils/'+n+'.uts'),'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,'')).join('\n');
let now=0,id=0;const tasks=new Map(),players=[];
const ctx={Math,Date:{now:()=>now},setTimeout:(f,ms)=>{tasks.set(++id,{f,at:now+ms});return id},clearTimeout:i=>tasks.delete(i),uni:{createInnerAudioContext(){
 const p={paused:true,destroyed:false,onPlay(f){this.started=f},onEnded(f){this.ended=f},onError(f){this.error=f},play(){this.paused=false;this.started?.()},pause(){this.paused=true},stop(){this.paused=true},destroy(){this.destroyed=true}};players.push(p);return p;
}}};vm.createContext(ctx);vm.runInContext(ts.transpile(source+'\nglobalThis.api={TrainingClock,createTrainingFeedback,nextFinishVoice,FINISH_VOICE_LINES,RESULT_DIALOGUES,selectResultDialogue,resultVoiceBand,resultCharacter}',{target:ts.ScriptTarget.ES2020}),ctx);
function tick(ms){const end=now+ms;while(true){const due=[...tasks].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;tasks.delete(due[0]);now=due[1].at;due[1].f()}now=end}
const {TrainingClock,createTrainingFeedback,nextFinishVoice}=ctx.api,c=new TrainingClock(),sound=createTrainingFeedback(c);
sound.play('correct');assert.equal(players.length,1);assert(players[0].src.endsWith('/correct.mp3'));
sound.play('wrong');assert.equal(players.length,1,'rapid input does not stack');
tick(200);sound.play('wrong');assert(players[0].destroyed);assert.equal(c.players.length,1);const old=players[0];old.ended();assert.equal(c.players.length,1,'stale callbacks cannot stop new sound');
tick(500);assert.equal(c.players.length,0);assert.equal(tasks.size,0);
const question=c.createAudio();question.play();sound.play('missed');assert.equal(c.players.length,1,'question audio has priority');c.destroyAudio(question);
sound.play('missed');sound.stop();c.pause();sound.play('correct');assert.equal(c.players.length,0);c.resume();assert.equal(c.players.length,0,'feedback does not replay on resume');
sound.play('finish-1');assert(players.at(-1).src.endsWith('/finish-1.mp3'));players.at(-1).error();assert.equal(c.players.length,0);assert.equal(tasks.size,0);
let last=-1;for(let i=0;i<100;i++){const next=nextFinishVoice();assert(next>=0&&next<4);assert.notEqual(next,last);last=next}
sound.stop();c.dispose();sound.play('correct');assert.equal(c.players.length,0);
ctx.defineProps=()=>({dialogue:0});
const life={};ctx.onMounted=f=>life.mount=f;ctx.onHide=f=>life.hide=f;ctx.onUnmounted=f=>life.unmount=f;
const component=fs.readFileSync(path.join(root,'components/ResultVoice.uvue'),'utf8');
assert(!component.includes('停止语音'));assert(!component.includes('<button'));assert(component.includes('{{ entry.line }}'));
assert(!fs.readFileSync(path.join(root,'pages/result/result.uvue'),'utf8').includes('characterName'));
const resultUi=fs.readFileSync(path.join(root,'pages/result/result.uvue'),'utf8');
assert(!resultUi.includes('下次难度'));assert(!resultUi.includes('difficulty-card'));
assert(resultUi.includes('updateGameDifficulty(gameId.value, playedDifficulty.value, score.value, completedAt, getRecords())'),'silent difficulty progression remains');
vm.runInContext(ts.transpile('(function(){'+component.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'')+'})()', {target:ts.ScriptTarget.ES2020}),ctx);
const before=players.length;life.mount();tick(349);assert.equal(players.length,before);tick(1);assert.equal(players.length,before+1);life.hide();assert(players.at(-1).destroyed);tick(20000);assert.equal(players.length,before+1);life.unmount();assert.equal(tasks.size,0);
const games=fs.readdirSync(path.join(root,'pages/game')).filter(f=>f.endsWith('.uvue')).filter(f=>fs.readFileSync(path.join(root,'pages/game',f),'utf8').includes('<TrainingFrame'));
assert.equal(games.length,25);for(const f of games)assert(fs.readFileSync(path.join(root,'pages/game',f),'utf8').includes('training.playFeedback('),f+' feedback missing');
let bytes=0;for(const f of ['correct','wrong','missed',...ctx.api.RESULT_DIALOGUES.map(x=>x.clip)]){const file=path.join(root,'static/audio/feedback',f+'.mp3');bytes+=fs.statSync(file).size;const duration=Number(cp.execFileSync('/usr/local/bin/ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',file],{encoding:'utf8'}));assert(duration>0&&duration<12);if(!f.startsWith('finish'))assert(duration<.5)}assert(bytes<700000);
console.log('PASS: 25-page semantic coverage, 15 valid clips/'+bytes+' bytes, no stacking/stale callbacks, question priority, pause/dispose/error cleanup, non-repeating neutral voice selection');

for(const [score,band] of [[0,'encourage'],[59,'encourage'],[60,'normal'],[89,'normal'],[90,'praise'],[100,'praise'],[120,'praise'],[200,'praise']]){let last=-1;const seen=new Set();for(let i=0;i<100;i++){const id=ctx.api.selectResultDialogue(score),entry=ctx.api.RESULT_DIALOGUES[id];assert.equal(entry.band,band);assert.notEqual(id,last);last=id;seen.add(entry.role);assert(entry.clip.includes(entry.role));assert(fs.existsSync(path.join(root,ctx.api.resultCharacter(entry.role,entry.band))));assert(!entry.line.includes('今天的探索先到这里'));}assert.equal(seen.size,2)}
const result=fs.readFileSync(path.join(root,'pages/result/result.uvue'),'utf8');assert(result.includes(':dialogue="dialogueIndex"'));assert(result.includes(':character="characterImage"'));assert(result.indexOf('score.value = performance.value.score')<result.indexOf('dialogueIndex.value = selectResultDialogue(score.value)'));
assert(!fs.readFileSync(path.join(root,'components/ResultCelebration.uvue'),'utf8').includes(':src="THEME_PLANET"'));
console.log('PASS: 60/90 score boundaries, 12 actor-specific lines, role/clip/image consistency, actual result score selection and no central planet');
