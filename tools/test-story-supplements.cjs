const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),base=path.join(root,'content/brand/spot-difference-story-v2');
const extras=require(path.join(base,'runtime-supplements.json')),spec=require(path.join(base,'runtime-regions.json')),built=require(path.join(base,'runtime-review/manifest.json'));
const rules={Math,JSON};vm.createContext(rules);vm.runInContext(fs.readFileSync(path.join(base,'runtime-review/recipe-rules.js'),'utf8'),rules);
assert.equal(extras.scenes.length,16);
assert.equal(extras.scenes.reduce((n,s)=>n+s.regions.length,0),60);
assert.equal(built.regionCount,1049);
for(const s of extras.scenes){
 assert.equal(s.regions.length,[41,57,90,95,98,144].includes(s.n)?5:3);
 const actual=spec.scenes.find(r=>r.n===s.n).regions;
 assert.deepEqual(actual.slice(0,s.originalRegions.length),s.originalRegions,'original candidates preserved '+s.n);
 assert.deepEqual(actual.slice(s.originalRegions.length),s.regions);
 const record=built.scenes.find(r=>r.id==='SD2-'+String(s.n).padStart(3,'0'));
 assert.equal(record.supplementSource,s.image);
 assert(fs.existsSync(path.join(root,s.image)));
 assert(rules.canMakeDifferenceRecipe(record.regions.map((r,i)=>({...r,zone:i+1})),5));
 for(const r of s.regions)assert(record.regions.find(x=>x.label===r[4]).changedRatio>.015);
}
for(const s of built.scenes)assert(rules.canMakeDifferenceRecipe(s.regions.map((r,i)=>({...r,zone:i+1})),5),s.id+' cannot select five');
console.log('PASS: 16 groups +60 candidates; original annotations intact; all 150 scenes can select five.');
