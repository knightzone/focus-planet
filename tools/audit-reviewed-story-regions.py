"""Fast preflight of reviewed source regions. Diagnostic only."""
import json
from pathlib import Path
from PIL import Image, ImageChops

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'content/brand/spot-difference-story-v2'
spec=json.loads((BASE/'reviewed-object-regions.json').read_text())
supplements={str(s['n']):s for s in json.loads((BASE/'runtime-supplements.json').read_text())['scenes']}
for chapter in range(4,16):
    directory=BASE/f'chapter-{chapter:02d}'
    for scene in json.loads((directory/'manifest.json').read_text())['scenes']:
        n=str(int(scene['id'][4:]))
        if n not in spec: continue
        a=Image.open(directory/scene.get('aFile',scene.get('file'))).convert('RGB').resize((768,432))
        b=Image.open(directory/scene['bFile']).convert('RGB').resize((768,432))
        extra=supplements.get(n)
        extra_image=Image.open(ROOT/extra['image']).convert('RGB').resize((768,432)) if extra else None
        extra_labels={r[4] for r in extra['regions']} if extra else set()
        for x,y,w,h,label in spec[n]:
            box=(int(x*7.68),int(y*4.32),min(768,round((x+w)*7.68)),min(432,round((y+h)*4.32)))
            pixels=extra_image if label in extra_labels else b
            diff=ImageChops.difference(a.crop(box),pixels.crop(box))
            changed=sum(sum(p)>60 for p in diff.getdata())/(diff.width*diff.height)
            if changed<.018: print(n,label,round(changed,4),flush=True)
