const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),ts=require('/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const read=p=>fs.readFileSync(path.join(root,p),'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,'');
const c={Number,Math};vm.createContext(c);vm.runInContext(ts.transpile(read('utils/star-rating.uts')+'\nglobalThis.api={resultStarCount,reportStarCount,hasPassStar,hasStarCelebration,orbitStar}',{target:ts.ScriptTarget.ES2020}),c);const a=c.api;
for(const [score,stars,report,special] of [[0,0,0,false],[19,0,0,false],[20,1,1,false],[39,1,1,false],[40,2,2,false],[60,3,3,false],[80,4,4,false],[89,4,4,false],[90,5,5,false],[99,5,5,false],[100,5,6,false],[110,5,6,false],[119,5,6,false],[120,5,6,true],[200,5,6,true]]){assert.equal(a.resultStarCount(score),stars);assert.equal(a.reportStarCount(score),report);assert.equal(a.hasStarCelebration(score),special);assert.equal(a.hasPassStar(score),score>=100)}
for(const score of [-1,NaN,Infinity]){assert.equal(a.resultStarCount(score),0);assert.equal(a.hasStarCelebration(score),false)}
for(let t=0;t<8000;t+=40){const points=[];for(let i=0;i<5;i++){const p=a.orbitStar(i,t);assert(p.x>=0&&p.x+36<=280);assert(p.y>=0&&p.y+36<=230);assert(p.z===1||p.z===3);points.push(p)}assert.equal(new Set(points.map(p=>p.x+','+p.y)).size,5)}
for(let i=0;i<5;i++){const x=a.orbitStar(i,0),y=a.orbitStar(i,8000);assert(Math.abs(x.x-y.x)<.001&&Math.abs(x.y-y.y)<.001)}
const component=fs.readFileSync(path.join(root,'components/ResultCelebration.uvue'),'utf8'),script=component.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'');
function harness(score){let now=10000,id=0,mount,unmount,hide,show,changed;const props={score},timers=new Map();const ctx={Number,Math,Date:{now:()=>now},ref:value=>({value}),computed:f=>({get value(){return f()}}),defineProps:()=>props,watch:(_s,f)=>changed=f,onMounted:f=>mount=f,onUnmounted:f=>unmount=f,onHide:f=>hide=f,onShow:f=>show=f,setTimeout:(f,ms)=>{timers.set(++id,{f,at:now+ms});return id},clearTimeout:i=>timers.delete(i)};vm.createContext(ctx);vm.runInContext(ts.transpile(read('utils/star-rating.uts')+read('utils/training-clock.uts')+script+'\nglobalThis.elapsedValue=()=>elapsed.value',{target:ts.ScriptTarget.ES2020}),ctx);mount();function tick(ms){const end=now+ms;while(true){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;timers.delete(due[0]);now=due[1].at;due[1].f()}now=end}return{timers,tick,hide,show,unmount,elapsed:ctx.elapsedValue,change:s=>{props.score=s;changed()}}}
const h=harness(119);assert.equal(h.timers.size,0);h.change(120);assert.equal(h.timers.size,1);h.tick(400);assert.equal(h.elapsed(),400);h.hide();h.tick(20000);assert.equal(h.elapsed(),400);h.show();h.tick(80);assert.equal(h.elapsed(),480);h.change(90);assert.equal(h.timers.size,0);h.change(200);assert.equal(h.timers.size,1);h.unmount();assert.equal(h.timers.size,0);
const result=fs.readFileSync(path.join(root,'pages/result/result.uvue'),'utf8').split('</template>')[0];assert(!/\{\{\s*(score|accuracy|reaction)/.test(result));assert(!result.includes('100分'));assert(result.includes('v-if="!specialCelebration"'));
const staticStars=read('components/ScoreStars.uvue');assert(!staticStars.includes('setInterval'));assert(!staticStars.includes('animation'));
for(const p of ['pages/report/report.uvue','pages/history/history.uvue']){const s=read(p);assert(s.includes('{{ record.score }}分'));assert(s.includes(':report="true"'));assert(!s.includes('ResultCelebration'))}
for(const p of ['pages/index/index.uvue','pages/mine/mine.uvue']) {
 const s=fs.readFileSync(path.join(root,p),'utf8');
 assert(s.includes("import { reportStarCount } from '../../utils/star-rating.uts'"));
 const expression=s.match(/energy.value = (records.reduce\([^\n]+)/)[1];
 const context={records:[0,19,20,40,60,80,90,99,100,120,200].map(score=>({score})),reportStarCount:a.reportStarCount};
 const value=vm.runInNewContext(ts.transpile(expression,{target:ts.ScriptTarget.ES2020}),context);
 assert.equal(value,38,p+' energy uses 0–6 report stars, not raw score');
 context.records=[];assert.equal(vm.runInNewContext(ts.transpile(expression),context),0);
}
console.log('PASS: 0–5 reward stars, independent 100-point sixth report star, home/mine star energy parity, 120-point orbit; 5 bounded stars, background pause/unmount cleanup, reports static and scores retained');
