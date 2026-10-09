// Synchronise source manifests with the generated, pixel-validated runtime pack.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),base=path.join(root,'content/brand/spot-difference-story-v2');
function readJson(file){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch(error){throw new Error('无法解析 '+file+'：'+error.message)}}
const regions=readJson(path.join(base,'runtime-regions.json'));
const byId=new Map(regions.scenes.map(scene=>['SD2-'+String(scene.n).padStart(3,'0'),scene]));
const url='/static/images/runtime/spot-difference/story-v2/';
let updated=0;
for(let chapter=1;chapter<=15;chapter++){
  const file=path.join(base,`chapter-${String(chapter).padStart(2,'0')}`,'manifest.json');
  const manifest=readJson(file);
  for(const scene of manifest.scenes){
    const entry=byId.get(scene.id);if(!entry)throw new Error('missing regions '+scene.id);
    const stem=scene.id.toLowerCase();
    scene.runtimeInstalled=true;
    scene.runtimeCandidateCount=entry.regions.length;
    scene.runtimeImageA=url+stem+'-a.webp';
    scene.runtimeImageB=url+stem+'-b.webp';
    scene.runtimeRegionValidation=entry.method||'manual-reviewed-local-composite';
    scene.runtimeCompositeStrategy='manual-reviewed-local-composite';
    scene.runtimeMaximumTargets=Math.min(5,entry.regions.length);
    updated++;
  }
  fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
}
console.log(JSON.stringify({updated}));
