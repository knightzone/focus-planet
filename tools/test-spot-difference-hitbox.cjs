const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),ts=require('/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const source=['spot-difference-story','spot-difference-scenes','spot-difference-hitbox'].map(n=>fs.readFileSync(path.join(root,'utils/'+n+'.uts'),'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,'')).join('\n');
const c={Math};vm.createContext(c);vm.runInContext(ts.transpile(source+'\nglobalThis.api={differenceCandidates,differenceHitboxes}',{target:ts.ScriptTarget.ES2020}),c);
for(const width of [272,342,382,720])for(const level of [1,5,10]){
 const height=width*9/16,items=c.api.differenceCandidates(level),hits=c.api.differenceHitboxes(items,width,height);
 for(let i=0;i<items.length;i++){const r=items[i],h=hits[i],x=parseFloat(h.left),y=parseFloat(h.top),w=parseFloat(h.width),hh=parseFloat(h.height);
 assert(x>=0&&y>=0&&x+w<=width+.001&&y+hh<=height+.001);
 assert(x<=r.x*width/100+.001&&y<=r.y*height/100+.001);assert(x+w>= (r.x+r.w)*width/100-.001&&y+hh>=(r.y+r.h)*height/100-.001);
 assert(w>=r.w*width/100&&hh>=r.h*height/100-.001);
 }
 const one=c.api.differenceHitboxes([items[2]],width,height)[0];assert(parseFloat(one.width)>=32-.001);assert(parseFloat(one.height)>=32-.001);
}
const p=fs.readFileSync(path.join(root,'pages/game/spot-difference.uvue'),'utf8');assert.equal((p.match(/v-for="hit in hitAreas"/g)||[]).length,2);assert(p.includes("found.value.indexOf(hit.id) < 0"));assert(p.includes('z-index: 4'));
console.log('PASS: 30 zones across 4 widths, expanded/clamped hit areas, original areas retained, minimum target and both images');
