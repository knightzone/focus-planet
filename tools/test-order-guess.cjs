const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'..'),ts=require('/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),clean=s=>s.replace(/^import .*$/gm,'').replace(/^export /gm,'')
const logic=clean(read('utils/spot-change-assets.uts').split('export const CHANGE_MID_GROUPS')[0])+'\n'+clean(read('utils/memory-link.uts'))+'\n'+clean(read('utils/order-guess.uts'))
const c={Math};vm.createContext(c);vm.runInContext(ts.transpile(logic+'\nglobalThis.api={orderGuessConfig,orderGuessRound,orderGuessCorrect,orderGuessSwap,orderGuessScore}',{target:ts.ScriptTarget.ES2020}),c);const a=c.api
let seed=37;function random(){seed=seed*16807%2147483647;return(seed-1)/2147483646}
for(let l=1;l<=10;l++)for(let n=0;n<100;n++){
 const cfg=a.orderGuessConfig(l),r=a.orderGuessRound(cfg,random)
 assert.equal(r.paths.length,cfg.count);assert.equal(new Set(r.paths).size,cfg.count);assert.equal(new Set(r.paths.map(p=>path.dirname(p))).size,1)
 assert.equal(new Set(r.initial).size,cfg.count);assert.equal(a.orderGuessCorrect(r.initial,r.secret),cfg.initialCorrect);assert(cfg.initialCorrect<cfg.count-1)
 for(const p of r.paths){assert(fs.existsSync(path.join(root,p)));assert(!p.includes('-shadow'))}
}
assert.equal(a.orderGuessScore([2,2,2],2),100);assert.equal(a.orderGuessScore([1,2,3],2),100);assert(a.orderGuessScore([2,2,3],2)<100);assert(a.orderGuessScore([1,1,1],2)>100);assert.equal(a.orderGuessScore([100],2),0)
assert.equal(a.orderGuessScore([1,1,1],2,1),a.orderGuessScore([1,1,1],2)-60)
assert.equal(a.orderGuessScore([1,1,1],2,2),a.orderGuessScore([1,1,1],2)-120)
for(let l=1;l<=10;l++){const cfg=a.orderGuessConfig(l),r=a.orderGuessRound(cfg,()=>0.9999);assert.equal(a.orderGuessCorrect(r.initial,r.secret),cfg.initialCorrect)}
function harness(level){
 let now=1000,url='',redirects=0;const life={},ctx={Math,Date:{now:()=>now},ref:value=>({value}),computed:f=>({get value(){return f()}}),watch:()=>{},getGameDifficulty:()=>level,onLoad:f=>life.load=f,onUnload:f=>life.unload=f,setTimeout,clearTimeout,uni:{redirectTo:o=>{url=o.url;redirects++},switchTab(){},showToast(){}}}
 vm.createContext(ctx);require('./training-test-env.cjs').install(ctx)
 const script=clean(read('pages/game/order-guess.uvue').match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1])
 vm.runInContext(ts.transpile(logic+'\n'+script+'\nglobalThis.api={training,phase,started,solved,selected,draft,history,lastCorrect,attempts,round,results,config,notice,lockedPositions,totalHints,isLocked,useHint,begin,beginTrial,choose,submit,advance,getSecret:()=>secret}',{target:ts.ScriptTarget.ES2020}),ctx);life.load()
 return{t:ctx.api,life,url:()=>url,redirects:()=>redirects,tick:ms=>now+=ms}
}
function solve(t){const secret=t.getSecret();for(let i=0;i<secret.length;i++){const j=t.draft.value.indexOf(secret[i]);if(i!==j){t.choose(i);t.choose(j)}}t.submit()}
for(const level of [1,10]){
 const h=harness(level),t=h.t;assert.equal(t.phase.value,'ready');const initial=t.draft.value.join();t.choose(0);assert.equal(t.selected.value,-1)
 t.beginTrial();assert.equal(t.draft.value.length,3);assert.equal(t.lastCorrect.value,1);t.submit();assert.equal(t.attempts.value,0)
 assert.equal(t.lockedPositions.value.length,0)
 t.training.pause();t.choose(0);assert.equal(t.selected.value,-1);h.tick(6000);t.training.resume()
 solve(t);assert(t.solved.value);assert.equal(t.results.value.length,0);assert.equal(h.url(),'');t.submit();assert.equal(t.attempts.value,1)
 t.begin();assert.equal(t.results.value.length,0);assert.equal(t.draft.value.length,t.config.value.count);assert.equal(t.attempts.value,0)
 for(let r=0;r<t.config.value.rounds;r++){solve(t);assert(t.solved.value);const count=t.results.value.length;t.submit();assert.equal(t.results.value.length,count);t.advance()}
 assert(h.url().includes('gameId=order-guess&dimensionId=alternating'));const q=new URLSearchParams(h.url().split('?')[1]);assert.equal(Number(q.get('score')),a.orderGuessScore(Array(t.config.value.rounds).fill(1),t.config.value.targetAttempts));assert.equal(q.get('roundScores'),q.get('score'));t.advance();assert.equal(h.redirects(),1);h.life.unload();t.choose(0);assert.equal(t.phase.value,'finished')
}
{
 const h=harness(1),t=h.t;t.begin();t.useHint();assert.equal(t.lockedPositions.value.length,1);assert.equal(t.totalHints.value,1);assert.equal(t.attempts.value,1);assert(t.solved.value);assert(t.history.value[1].hinted)
 const locked=t.lockedPositions.value[0];t.choose(locked);assert.equal(t.selected.value,-1);t.advance();assert.equal(t.lockedPositions.value.length,0)
 for(let r=1;r<t.config.value.rounds;r++){solve(t);t.advance()}
 const score=Number(new URLSearchParams(h.url().split('?')[1]).get('score'));assert.equal(score,a.orderGuessScore(Array(t.config.value.rounds).fill(1),t.config.value.targetAttempts,1));assert(score<a.orderGuessScore(Array(t.config.value.rounds).fill(1),t.config.value.targetAttempts))
}
{
 const h=harness(10),t=h.t;t.begin();t.useHint();t.useHint();assert.equal(t.lockedPositions.value.length,2);assert.equal(t.totalHints.value,2);const fixed=t.lockedPositions.value[0];t.choose(fixed);assert.equal(t.selected.value,-1);h.life.unload()
}
{
 const h=harness(10),t=h.t;t.begin();const initial=t.draft.value.slice();t.choose(0);t.choose(1);t.submit();assert.equal(t.attempts.value,1);assert(!t.solved.value);t.choose(0);t.choose(1);t.submit();assert.equal(t.attempts.value,1);assert(t.notice.value.includes('试过'));assert.equal(t.history.value.length,2);assert.equal(t.history.value[0].order.join(),initial.join());h.life.unload()
}
console.log('PASS: 1000 same-group rounds, exact initial clues incl constant RNG, valid permutations, average-attempt score boundary, trial isolation, swaps, history snapshots, repeat prevention, pause, complete-once and unload')
