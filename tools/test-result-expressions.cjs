const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),ts=require('/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const source=fs.readFileSync(path.join(root,'utils/result-dialogue.uts'),'utf8').replace(/^export /gm,'');const ctx={Math};vm.createContext(ctx);vm.runInContext(ts.transpile(source+'\nglobalThis.api={resultCharacter,resultVoiceBand}',{target:ts.ScriptTarget.ES2020}),ctx);
const paths=new Set();let size=0;
for(const role of ['yueyue','nuannuan'])for(const [score,band] of [[59,'encourage'],[60,'normal'],[89,'normal'],[90,'praise'],[120,'praise']]){
 assert.equal(ctx.api.resultVoiceBand(score),band);const rel=ctx.api.resultCharacter(role,band);assert(rel.includes(role+'-'+band+'-v1.webp'));if(paths.has(rel))continue;paths.add(rel);
 const file=path.join(root,rel),pixels=cp.execFileSync('/usr/local/bin/ffmpeg',['-v','error','-i',file,'-f','rawvideo','-pix_fmt','rgba','pipe:1'],{maxBuffer:2e6});assert.equal(pixels.length,384*384*4);
 let clear=0,solid=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)clear++;if(pixels[i]>240)solid++}
 assert(clear/(384*384)>.35,'real transparency, not an opaque card');assert(solid/(384*384)>.15,'visible character');for(const [x,y] of [[0,0],[383,0],[0,383],[383,383]])assert.equal(pixels[(y*384+x)*4+3],0);
 size+=fs.statSync(file).size;
}
assert.equal(paths.size,6);assert(size<150000);
const component=fs.readFileSync(path.join(root,'components/ResultCelebration.uvue'),'utf8');assert(!component.includes('border-radius'));assert(!component.includes('background-color'));assert(component.includes(':src="props.character"'));
console.log('PASS: six role/band expressions, real alpha and clear corners, no opaque image container, '+size+' bytes');
