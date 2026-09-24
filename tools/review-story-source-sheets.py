"""Diagnostic source A/B contact sheets; never modifies artwork."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'content/brand/spot-difference-story-v2'
OUT = Path('/tmp/focus-source-boundaries')
OUT.mkdir(exist_ok=True)
scenes = []
for chapter in range(4, 16):
    directory = BASE / f'chapter-{chapter:02d}'
    for scene in json.loads((directory / 'manifest.json').read_text())['scenes']:
        if int(scene['id'][4:]) >= 35:
            scenes.append((directory, scene))
for start in range(0, len(scenes), 4):
    group = scenes[start:start + 4]
    sheet = Image.new('RGB', (1200, 360 * len(group)), 'white')
    for row, (directory, scene) in enumerate(group):
        for col, side in enumerate(['a', 'b']):
            file = scene.get('aFile', scene.get('file')) if side == 'a' else scene['bFile']
            picture = Image.open(directory / file).convert('RGB').resize((600, 338))
            draw = ImageDraw.Draw(picture)
            for n in range(10, 100, 10):
                x, y = n * 6, round(n * 3.38)
                draw.line((x, 0, x, 338), fill='#aaaaaa', width=1)
                draw.text((x+2, 2), str(n), fill='black', stroke_width=1, stroke_fill='white')
                draw.line((0, y, 600, y), fill='#aaaaaa', width=1)
                draw.text((2, y+2), str(n), fill='black', stroke_width=1, stroke_fill='white')
            sheet.paste(picture, (col * 600, row * 360 + 22))
            ImageDraw.Draw(sheet).text((col*600+5, row*360+4), scene['id']+' '+side.upper(), fill='black')
    sheet.save(OUT / (group[0][1]['id'] + '.jpg'), quality=90)
print(f'{len(scenes)} pairs: {OUT}')
