"""Light cartoon A/B test; never overwrites the accepted natural clips."""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ORIGINALS = ROOT.parent / 'cats-v1' / 'clips'
ROOT.mkdir(exist_ok=True)

def run(args):
    return subprocess.run(args, capture_output=True, text=True, check=True)

def levels(path):
    r = run(['ffmpeg', '-hide_banner', '-i', str(path), '-af', 'volumedetect', '-f', 'null', '-'])
    return {k: float(re.search(k + r'_volume: ([-\d.]+)', r.stderr)[1]) for k in ('mean', 'max')}

records = []
sequence = []
for name, semitones in [('cat-01', 1.2), ('cat-04', 0.7), ('cat-05', 1.2)]:
    source = ORIGINALS / (name + '.wav')
    target = ROOT / (name + '-cartoon.wav')
    working = ROOT / (name + '-working.wav')
    original_levels = levels(source)
    ratio = 2 ** (semitones / 12)
    # Pitch lift without speeding up; no decorative sounds or reverb.
    filters = (f'rubberband=tempo=1:pitch={ratio:.8f},'
               'equalizer=f=850:t=q:w=0.8:g=1.2,'
               'equalizer=f=3200:t=q:w=0.7:g=-1.5,lowpass=f=6000')
    run(['ffmpeg', '-v', 'error', '-nostdin', '-n', '-i', str(source),
         '-af', filters, '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', str(working)])
    processed_levels = levels(working)
    gain = min(original_levels['mean'] - processed_levels['mean'], -10.0 - processed_levels['max'])
    run(['ffmpeg', '-v', 'error', '-nostdin', '-n', '-i', str(working),
         '-af', f'volume={gain:.2f}dB', '-c:a', 'pcm_s16le', str(target)])
    working.unlink()
    measured = levels(target)
    assert measured['max'] <= -9.9
    records.append(dict(original=str(source), cartoon=target.name,
        pitchSemitones=semitones, filter=filters, finalGainDb=round(gain, 2),
        originalLevelsDbfs=original_levels, cartoonLevelsDbfs=measured,
        status='awaiting_user_AB_listening_review'))
    sequence += [source, target]

args = ['ffmpeg', '-v', 'error', '-nostdin', '-n']
chains = []
for i, path in enumerate(sequence):
    args += ['-i', str(path)]
    pause = 0.65 if i % 2 == 0 else 1.2
    chains.append(f'[{i}:a]apad=pad_dur={pause}[a{i}]')
chains.append(''.join(f'[a{i}]' for i in range(6)) + 'concat=n=6:v=0:a=1[out]')
run(args + ['-filter_complex', ';'.join(chains), '-map', '[out]',
    '-c:a', 'libmp3lame', '-b:a', '128k', str(ROOT / 'cats-cartoon-AB.mp3')])
(ROOT / 'processing.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(records, ensure_ascii=False, indent=2))
