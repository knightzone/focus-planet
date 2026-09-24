// Review individual runtime candidates, not just the all-candidates B picture.
const fs = require('node:fs');
const path = require('node:path');
const base = path.join(__dirname, '../content/brand/spot-difference-story-v2');
const changes = require(path.join(base, 'independent-region-splits.json')).changes;
const manifest = require(path.join(base, 'runtime-review/manifest.json'));
require('./build-story-review-rules.cjs');
const ids = new Set(changes.map(c => 'SD2-' + String(c.n).padStart(3, '0')));
const belowFive = process.argv.includes('--below-five');
const supplemented = process.argv.includes('--supplemented');
const supplements = require(path.join(base,'runtime-supplements.json'));
const supplementIds = new Set(supplements.scenes.map(s=>'SD2-'+String(s.n).padStart(3,'0')));
for(const id of supplementIds)ids.add(id);
const vm = require('node:vm');
const rules = { Math, JSON }; vm.createContext(rules);
vm.runInContext(fs.readFileSync(path.join(base,'runtime-review/recipe-rules.js'),'utf8'),rules);
const eligible = manifest.scenes.map(s=>{
 const regions=s.regions.map((r,i)=>({...r,zone:i+1}));
 let maxSelectable=0;
 for(let n=1;n<=regions.length;n++){if(!rules.canMakeDifferenceRecipe(regions,n))break;maxSelectable=n;}
 const extra=supplements.scenes.find(e=>'SD2-'+String(e.n).padStart(3,'0')===s.id);
 return {...s,maxSelectable,addedLabels:extra?extra.regions.map(r=>r[4]):[],beforeCount:extra?extra.originalRegions.length:s.regions.length};
});
const scenes = eligible.filter(s => supplemented ? supplementIds.has(s.id) : belowFive ? s.maxSelectable<5 : ids.has(s.id));
const title = supplemented ? '16组补充差异 · 独立物品替换审核' : belowFive ? '不足5处的'+scenes.length+'组 · 独立物品替换审核' : '独立物品替换审核';
const navigation = belowFive||supplemented ? '<p>'+scenes.map(s=>'<a style="display:inline-block;margin:6px" href="#'+s.id+'">'+s.id+' · 最多'+s.maxSelectable+'处</a>').join('')+'</p>' : '';
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font:16px system-ui;background:#eef3fb;margin:24px}section{margin:32px 0}.pair{display:flex;gap:16px}.canvas{position:relative;width:50%;aspect-ratio:16/9;overflow:hidden}.canvas>img{width:100%;height:100%}.crop{position:absolute;overflow:hidden;outline:1px solid #d75b52}.crop img{position:absolute;max-width:none}button{padding:9px;margin:4px;border:1px solid #9eb2c9;border-radius:8px;background:white;cursor:pointer}button.active{background:#c2e6ff}.no-outline .crop{outline:none}</style>
<h1>${title}</h1><p>左：原图。右：只替换选中的物品。点名称可单独开关，会自动取消与它重叠的候选；随机2—5处按游戏互斥规则重新抽取，不固定选前几项。无法凑足的档位不可选。</p>
${navigation}${belowFive ? '<p>默认展示每组能同时选择的最多差异；点击“清空”后再点名称，可单独查看某一处。</p>' : ''}
<button onclick="document.body.classList.toggle('no-outline')">显示／隐藏边界</button><main></main>
<script src="recipe-rules.js"></script><script>
const scenes=${JSON.stringify(scenes).replace(/</g,'\\u003c')};
const belowFive=${belowFive};
const supplemented=${supplemented};
for(const s of scenes){
 s.regions.forEach((r,i)=>r.zone=i+1);
 const section=document.createElement('section');section.id=s.id;
 const heading=document.createElement('h2');heading.textContent=s.id+' · '+s.title+(supplemented?' · 原'+s.beforeCount+' + 新增'+s.addedLabels.length+' = '+s.regions.length+'候选 / 同轮最多'+s.maxSelectable+'处':belowFive?' · 候选'+s.regions.length+'处 / 同轮最多'+s.maxSelectable+'处':'');section.append(heading);
 const pair=document.createElement('div');pair.className='pair';section.append(pair);
 const canvases=[0,1].map(()=>{const c=document.createElement('div');c.className='canvas';const img=document.createElement('img');img.src='../../../..'+s.imageA;img.loading='lazy';c.append(img);pair.append(c);return c});
 const selected=new Set();const controls=document.createElement('div');section.append(controls);
 const items=s.regions.map((r,i)=>{
  const crop=document.createElement('div');crop.className='crop';Object.assign(crop.style,{left:r.x+'%',top:r.y+'%',width:r.w+'%',height:r.h+'%'});
  const img=document.createElement('img');img.src='../../../..'+s.imageB;img.loading='lazy';Object.assign(img.style,{width:10000/r.w+'%',height:10000/r.h+'%',left:-100*r.x/r.w+'%',top:-100*r.y/r.h+'%'});crop.append(img);canvases[1].append(crop);
  const button=document.createElement('button');button.textContent=(s.addedLabels.includes(r.label)?'新增 · ':'')+r.label;button.onclick=()=>{if(selected.has(i))selected.delete(i);else{for(const j of selected)if(differenceCandidatesConflict(r,s.regions[j]))selected.delete(j);selected.add(i)}render()};controls.append(button);return {crop,button};
 });
 function render(){items.forEach((o,i)=>{o.crop.hidden=!selected.has(i);o.button.classList.toggle('active',selected.has(i))})}
 const toolbar=document.createElement('div');section.append(toolbar);
 for(const label of ['清空','随机2处','随机3处','随机4处','随机5处']){const b=document.createElement('button');b.textContent=label;const count=Number(label.slice(2,3));b.disabled=label!=='清空'&&!canMakeDifferenceRecipe(s.regions,count);b.onclick=()=>{selected.clear();if(label!=='清空')for(const id of chooseDifferenceRecipe(s.regions,count))selected.add(s.regions.findIndex(r=>r.id===id));render()};toolbar.append(b)}
 if(belowFive){const info=document.createElement('p');info.textContent=s.maxSelectable<s.regions.length?'存在重叠候选，不能全部同轮出现。':'候选总数不足5处。';section.append(info);}
 if(supplemented){for(let i=0;i<s.regions.length;i++)if(s.addedLabels.includes(s.regions[i].label)&&[...selected].every(j=>!differenceCandidatesConflict(s.regions[i],s.regions[j])))selected.add(i);}
 else for(const id of chooseDifferenceRecipe(s.regions,belowFive?s.maxSelectable:2))selected.add(s.regions.findIndex(r=>r.id===id));
 render();document.querySelector('main').append(section);
}
if(location.hash)document.getElementById(location.hash.slice(1))?.scrollIntoView();
</script>`;
fs.writeFileSync(path.join(base, belowFive||supplemented ? 'runtime-review/below-five-regions.html' : 'runtime-review/independent-regions.html'), html);
console.log(`Independent-candidate review: ${scenes.length} scenes`);
