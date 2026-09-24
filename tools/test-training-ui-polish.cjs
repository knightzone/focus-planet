const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict')
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8')
const ts=require('/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
for(const p of ['star-catcher','sky-watcher']){
 const source=read('pages/game/'+p+'.uvue'),template=source.split('<script')[0]
 assert(!template.includes('training-preview-card'),p+' 内层不再叠加底板')
 assert(source.includes('background-color: rgba(255,255,255,0.5)'),p+' 保留50%外层底板')
}
const water=read('pages/game/water-sort.uvue'),body=water.match(/type LiquidBand[\s\S]*?\n}\n/)[0]
const ctx={WATER_SORT_COLORS:['red','blue','yellow','green','purple']};vm.createContext(ctx)
vm.runInContext(ts.transpile(body+'\nglobalThis.bands=tubeBands',{target:ts.ScriptTarget.ES2020}),ctx)
for(const input of [[],[0],[0,0,1,1],[0,1,0,1],[4,4,4,4]]){
 const before=JSON.stringify(input),bands=ctx.bands(input);assert.equal(JSON.stringify(input),before)
 assert.equal(bands.reduce((n,b)=>n+b.units,0),input.length)
 const actual=bands.flatMap(b=>Array(b.units).fill(b.color));assert.equal(actual.join(),input.slice().reverse().map(i=>ctx.WATER_SORT_COLORS[i]).join())
 for(let i=1;i<bands.length;i++)assert.notEqual(bands[i-1].color,bands[i].color)
}
assert.equal(ctx.bands([1,1,1,1]).length,1)
assert.equal((water.match(/class="liquid-chamber"/g)||[]).length,2,'试玩与正式共用水层渲染')
assert(!water.includes('tubeSlotColors'));assert(water.includes('class="liquid-surface"'))
assert.equal((water.match(/part == tubeBands\(tube\).length - 1/g)||[]).length,2,'两处底层液体自身圆角')
assert(water.includes('.liquid-band-bottom { border-bottom-left-radius: 20px; border-bottom-right-radius: 20px; overflow: hidden; }'))
assert(water.includes('bottom: 20px; width: 28%'),'水体侧边高光不伸进弧形杯底')
const base=water.match(/\.tube-base \{([^}]+)\}/)[1]
assert(base.includes('border-width: 0; border-bottom-width: 2px;'),'底部反光仅保留弧形底边')
assert(!base.includes('background-color:'),'杯底不使用实心白色底条')
const dual=read('pages/game/dual-track.uvue');assert(dual.includes('class="dt-demo-actions"'));assert(!dual.includes('measure(); startDemo()'))
console.log('PASS: 两星空页单层50%底板、同色液体连续合并/容量守恒/原顺序不变、试玩正式同款玻璃效果、上天入海可选试玩入口')
