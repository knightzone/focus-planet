const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),ts=require('/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const source=['sky-planets','spot-change-assets','spot-change'].map(n=>fs.readFileSync(path.join(root,'utils',n+'.uts'),'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,'')).join('\n');
const ctx={Math};vm.createContext(ctx);vm.runInContext(ts.transpile(source+'\nglobalThis.api={spotChangePool,spotChangeBoard,spotChangeConfig,CHANGE_LOW_GROUPS,CHANGE_MID_GROUPS,CHANGE_HIGH_GROUPS,skyPlanetSources}',{target:ts.ScriptTarget.ES2020}),ctx);
const a=ctx.api,images=new Set([...a.CHANGE_LOW_GROUPS.flat(),...a.CHANGE_MID_GROUPS.flat(),...a.CHANGE_HIGH_GROUPS.flat(),...a.skyPlanetSources]);
for(const file of images){assert(fs.existsSync(path.join(root,file)),file);assert(!file.includes('-shadow.webp'));assert(!file.includes('rejected'))}
for(let level=1;level<=10;level++)for(let seed=0;seed<120;seed++){
 let planets=0;for(let round=0;round<6;round++){
 const pool=a.spotChangePool(level,round,seed),c=a.spotChangeConfig(level),board=a.spotChangeBoard(pool,c.cells);
 assert.equal(pool.length,new Set(pool).size);assert(pool.length>=5);assert.equal(board.length,c.cells);assert.equal(new Set(board).size,Math.min(c.cells,pool.length));
 for(const image of board)assert(pool.includes(image));if(pool[0].includes('/sky-planets/')){planets++;if(level<=6)assert.equal(pool.length,6)}
 if(level<=3)assert(!pool.some(p=>p.includes('/hard-')||p.includes('/medium-similar-')));
 const replacement=pool.find(p=>p!==board[0]),after=board.slice();after[0]=replacement;assert.equal(after.filter((p,i)=>p!==board[i]).length,1);
 }assert.equal(planets,2);
}
console.log('PASS: '+images.size+' existing colorful assets, 7200 level/round pools, 2 planet rounds per session, entry-level separation, unique-first boards and one changed cell');
