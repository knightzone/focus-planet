const assert = require('node:assert/strict');
const path = require('node:path');
const base = path.join(__dirname, '../content/brand/spot-difference-story-v2');
const spec = require(path.join(base, 'runtime-regions.json'));
const reviewed = require(path.join(base, 'reviewed-object-regions.json'));
const runtime = require(path.join(base, 'runtime-review/manifest.json'));
const regions = n => spec.scenes.find(s => s.n === n).regions;
for (const [n, label] of [[10,'左轮'],[11,'花盆纹'],[19,'卷垫'],[110,'喷泉中心'],[116,'左边花朵'],[129,'手中花朵']]) {
  assert(!regions(n).some(r => r[4] === label), `${n}: removed candidate returned`);
}
for (const [n,label,rect] of [
  [50,'篮子图案',[92.5,66,5,9.5]],
  [106,'右前花朵移除',[80,88,15,12]],
  [149,'第一朵花灯',[20.5,9.5,4.5,8.5]],
  [150,'纪念册小鼓图画',[40.5,72,5.5,8.8]],
]) {
  assert.deepEqual(regions(n).find(r => r[4] === label).slice(0,4), rect);
}
assert.deepEqual(regions(18).find(r=>r[4]==='熊围巾'), [71,36,12,7,'熊围巾']);
assert.equal(regions(116).length,9, 'six original candidates plus three new independent props; removed flower stays absent');
assert.equal(regions(129).length,5);
for (const s of spec.scenes) {
  if(s.n >= 35) assert.deepEqual(s.regions, reviewed[String(s.n)], `reviewed source drift: ${s.n}`);
  const built = runtime.scenes.find(r=>r.id === 'SD2-'+String(s.n).padStart(3,'0'));
  assert.deepEqual(built.regions.map(r=>[r.x,r.y,r.w,r.h,r.label]),s.regions);
}
assert.equal(runtime.sourceCount,150);
const splits = require(path.join(base, 'independent-region-splits.json')).changes;
const supplements=require(path.join(base,'runtime-supplements.json'));
assert.equal(runtime.regionCount,833 + splits.reduce((n,c)=>n+c.to.length-1,0)+supplements.scenes.reduce((n,s)=>n+s.regions.length,0));
for (const change of splits) {
  for (const item of change.to) assert.deepEqual(regions(change.n).find(r=>r[4]===item[4]), item);
  if (!change.to.some(r=>r[4]===change.from)) assert(!regions(change.n).some(r=>r[4]===change.from));
}
assert.equal(regions(87).length, 10, 'cart cloth is now independent too');
assert(!regions(122).some(r=>r[4]==='右侧玩具箱与跃跃围巾'));
for(const label of ['跃跃围巾','敞口玩具箱','右侧带盖玩具箱'])assert(regions(122).some(r=>r[4]===label));
const scarf122=regions(122).find(r=>r[4]==='跃跃围巾'),box122=regions(122).find(r=>r[4]==='敞口玩具箱');
assert(box122[1]>=scarf122[1]+scarf122[3], '122 box must not copy the scarf');
for(const [n,label] of [[71,'镜框'],[79,'屏风外框'],[84,'工具板底座'],[130,'沙盘底座'],[139,'水盘']])assert(!regions(n).some(r=>r[4]===label),'large enclosing candidate must not return: '+n);
for(const n of [33,36,39])assert(!regions(n).some(r=>r[4].includes('倒影')),'weak reflection must not count: '+n);
const batch=require(path.join(base,'expanded-region-splits.json')).changes;
for(const c of batch)for(const a of c.to)for(const b of c.to)if(a!==b)assert(!(a[0]<=b[0]&&a[1]<=b[1]&&a[0]+a[2]>=b[0]+b[2]&&a[1]+a[3]>=b[1]+b[3]),c.n+': split must not retain a parent containing an entire child');
for(const n of [33,34,36,38,39,71])assert(!regions(n).some(r=>/和倒影|与镜中倒影/.test(r[4])),`${n}: reflection must not be bundled`);
console.log('PASS visibility decisions: 6 removed, 4 corrected; scarf preserved; source/runtime consistent.');
