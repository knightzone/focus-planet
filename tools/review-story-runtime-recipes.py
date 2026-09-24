"""Review actual rectangle clipping, not the misleading all-candidates B alone."""
import json
import math
import sys
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'content/brand/spot-difference-story-v2/runtime-review'

def main():
    subprocess.run(['node', str(ROOT/'tools/build-story-review-rules.cjs')], check=True)
    data = json.loads((BASE / 'manifest.json').read_text())
    scenes = data['scenes']
    for scene in scenes:
        for i, r in enumerate(scene['regions']):
            r['zone'] = i + 1
    # Match the game: all selected B regions are clipped onto the same A canvas.
    html = ['<!doctype html><meta charset="utf-8"><title>实际游戏替换审核</title>',
        '<style>body{font:16px system-ui;margin:24px;background:#eef3fb}header{position:sticky;top:0;background:#eef3fb;padding:12px;z-index:2}.pair{display:flex;gap:12px}.canvas{position:relative;width:50%;aspect-ratio:16/9;overflow:hidden}.base{width:100%;height:100%}.crop{position:absolute;overflow:hidden}.crop img{position:absolute;max-width:none}.show .crop{outline:1px solid #d75b52}button{padding:10px;margin:4px}section{margin:32px 0}</style>',
        '<header><b>实际游戏裁切预览</b>：每组仅展示选中差异，其余画面相同。<br>',
        '<button onclick="setCount(2)">2处</button><button onclick="setCount(3)">3处</button><button onclick="setCount(4)">4处</button><button onclick="setCount(5)">5处</button><button onclick="document.body.classList.toggle(\'show\')">显示/隐藏边界</button>',
        '<span id="status">当前 5 处</span></header>']
    out = Path('/tmp/focus-runtime-recipes')
    out.mkdir(exist_ok=True)
    if "--html-only" not in sys.argv:
        for start in range(0,len(scenes),4):
            group=scenes[start:start+4]
            sheet=Image.new('RGB',(1200,360*len(group)),'white')
            for row,s in enumerate(group):
                a=Image.open(ROOT / s['imageA'].lstrip('/')).convert('RGB')
                b=Image.open(ROOT / s['imageB'].lstrip('/')).convert('RGB')
                canvases=[a.copy(),a.copy()]
                def choose(items, picked, count):
                    if len(picked) == count:
                        return picked
                    for i, r in enumerate(items):
                        if any(max(r['x'],o['x']) < min(r['x']+r['w'],o['x']+o['w']) and max(r['y'],o['y']) < min(r['y']+r['h'],o['y']+o['h']) for o in picked):
                            continue
                        result=choose(items[i+1:],picked+[r],count)
                        if result: return result
                    return []
                selected=[]
                for count in range(5,1,-1):
                    selected=choose(s['regions'],[],count)
                    if selected: break
                for i,r in enumerate(selected):
                    box=(math.floor(r['x']*7.68),math.floor(r['y']*4.32),math.ceil((r['x']+r['w'])*7.68),math.ceil((r['y']+r['h'])*4.32))
                    canvases[1].paste(b.crop(box),box[:2])
                for col,picture in enumerate(canvases):
                    sheet.paste(picture.resize((600,338)),(col*600,row*360+22))
                    ImageDraw.Draw(sheet).text((col*600+5,row*360+4),s['id']+' '+str(len(selected))+' selected, '+str(col),fill='black')
            sheet.save(out/(group[0]['id']+'.jpg'),quality=90)
    for s in scenes:
        url=lambda side: '../../../..'+s['image'+side]
        html.append(f'<section id="{s["id"]}" data-cap="{len(s["regions"])}"><h2>{s["id"]} · {s["title"]}</h2><div class="pair">')
        for side in range(2):
            html.append(f'<div class="canvas"><img class="base" loading="lazy" src="{url("A")}">')
            for i,r in enumerate(s['regions']):
                if side==0: continue
                x,y,w,h=(r[k] for k in ('x','y','w','h'))
                html.append(f'<div class="crop" data-index="{i}" style="left:{x}%;top:{y}%;width:{w}%;height:{h}%"><img loading="lazy" src="{url("B")}" style="width:{10000/w}%;height:{10000/h}%;left:{-100*x/w}%;top:{-100*y/h}%"></div>')
            html.append('</div>')
        html.append('</div><p>'+'、'.join(r['label'] for r in s['regions'])+'</p></section>')
    html.append('<script src="recipe-rules.js"></script><script>const scenes='+json.dumps(scenes,ensure_ascii=False).replace('<','\\u003c')+';function setCount(n){for(const scene of scenes){const section=document.getElementById(scene.id);const ids=chooseDifferenceRecipe(scene.regions,n);section.hidden=ids.length!==n;section.querySelectorAll(".crop").forEach(e=>e.hidden=!ids.includes(scene.regions[Number(e.dataset.index)].id));}document.getElementById("status").textContent="当前随机 "+n+" 处（重叠候选互斥，不足的图不参与本档）"}setCount(5)</script>')
    (BASE/'recipes.html').write_text('\n'.join(html))
    print(f'{len(scenes)} actual-clipping previews: {BASE / "recipes.html"}; contact sheets: {out}')

if __name__ == '__main__':
    main()
