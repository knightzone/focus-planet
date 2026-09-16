"""Fetch public, page-linked previews only. Never use authenticated downloads."""
import concurrent.futures
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
catalog = json.loads((PROJECT / 'docs/SOUND_CANDIDATES_60.json').read_text())
(ROOT / 'sources').mkdir(parents=True, exist_ok=True)

def dog(author, sid, title):
    return dict(id=f'dog-{sid}', author=author, sourceId=sid, title=title,
        sourceUrl=f'https://freesound.org/people/{author}/sounds/{sid}/',
        license='CC0-1.0', licenseUrl='https://creativecommons.org/publicdomain/zero/1.0/')

jobs = []
for obj in catalog['objects']:
    if obj['id'] == 'cat':
        continue
    sounds = obj['sounds'][:2]
    if obj['id'] == 'dog':
        sounds = [dog('AustinXYZ', 350591, 'Chihuahua Puppy Bark'),
                  dog('dtmendes', 591137, 'Dog barking and making noises.wav')]
    if obj['id'] == 'pig':
        sounds = [obj['sounds'][0], obj['sounds'][2]]
    for sound in sounds:
        jobs.append(dict(objectId=obj['id'], label=obj['label'], image=obj['image'],
                         objectNotes=obj['notes'], **sound))

def fetch(job):
    sid = job['sourceId']
    metadata = ROOT / 'sources' / f'{sid}.json'
    audio = ROOT / 'sources' / f'{sid}-hq.mp3'
    if metadata.exists() and audio.exists():
        return json.loads(metadata.read_text())
    try:
        page = subprocess.run(['curl', '-sSL', '--fail', '--max-time', '25', '--retry', '1', job['sourceUrl']],
                              capture_output=True, text=True, check=True).stdout
        expected = job['licenseUrl'].replace('https://', '')
        if expected not in page:
            raise RuntimeError('Expected license not found in current source page')
        match = re.search(r'data-static-file-url="(https://cdn\.freesound\.org/previews/[^\"]+-hq\.mp3)"', page)
        if not match:
            raise RuntimeError('No public HQ preview link in source page')
        url = match[1]
        download = ['curl', '-sSL', '--fail', '--max-time', '50', '--retry', '0']
        if audio.exists() and audio.stat().st_size:
            download += ['-C', '-']
        subprocess.run(download + [url, '-o', str(audio)], check=True, capture_output=True)
        probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(audio)], check=True, capture_output=True, text=True)
        record = dict(job, downloaded=True, downloadedUrl=url, downloadedDate='2026-09-11',
            sourceFormat='public HQ MP3 preview; not original download',
            downloadedDurationSeconds=float(json.loads(probe.stdout)['format']['duration']),
            sha256=hashlib.sha256(audio.read_bytes()).hexdigest(),
            pageLicenseVerified=True, audioFile=str(audio.relative_to(ROOT)))
        metadata.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
        print(f'OK {job["objectId"]} {sid}', flush=True)
        return record
    except Exception as exc:
        print(f'FAILED {job["objectId"]} {sid}: {exc}', flush=True)
        return dict(job, downloadError=str(exc))

with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    results = list(pool.map(fetch, jobs))
(ROOT / 'sources.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
print(f'Downloaded {sum("downloadError" not in r for r in results)}/{len(results)}', flush=True)
