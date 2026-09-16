"""Install the user-approved audio review clips and preserve attribution."""
import json
import subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
review=ROOT/'outputs/audio-review'
out=ROOT/'static/audio/sound-source'
out.mkdir(parents=True,exist_ok=True)
records=[]
for batch in ['cats-v1','cartoon-library-v1']:
    data=json.loads((review/batch/'edits.json').read_text())
    for row in data['clips'] if batch=='cats-v1' else data:
        if row.get('objectId') in ['bicycle','telephone']:
            continue
        source=review/batch/row['file']
        dest=out/(row['id']+'.mp3')
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-ac','1','-ar','44100','-c:a','libmp3lame','-b:a','96k',str(dest)],check=True)
        records.append(dict(row,runtimeFile=str(dest.relative_to(ROOT))))
(out/'credits.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
print(f'Installed {len(records)} audio clips')
