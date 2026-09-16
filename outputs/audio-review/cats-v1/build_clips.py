"""Reproducible CC0 cat preview edits; original downloads remain untouched."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCES = {
    '110011': ('tuberatanka', 'cat meow', '110/110011_1537422'),
    '476918': ('Luke100000', 'Kitten meows', '476/476918_3211895'),
    '414042': ('nekoninja', 'cat meowing', '414/414042_4682356'),
}
CUTS = [
    ('cat-01', '110011', 0.08, 1.43),
    ('cat-02', '476918', 2.00, 2.73),
    ('cat-03', '476918', 3.82, 4.55),
    ('cat-04', '476918', 9.05, 10.65),
    ('cat-05', '414042', 0.75, 1.63),
    ('cat-06', '414042', 4.27, 5.18),
]

def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True)

records = []
for name, source_id, start, end in CUTS:
    source = ROOT / 'sources' / (source_id + '-hq.mp3')
    output = ROOT / 'clips' / (name + '.wav')
    duration = round(end - start, 3)
    base_filter = 'volume=-12dB,highpass=f=100,lowpass=f=6500,equalizer=f=3000:t=q:w=0.8:g=-2.5'
    base_filter += f',afade=t=in:d=0.015,afade=t=out:st={duration-0.07:.3f}:d=0.07'
    command = ['ffmpeg', '-hide_banner', '-nostdin', '-i', str(source), '-ss', str(start), '-t', str(duration), '-ac', '1', '-ar', '44100']
    # Measure the actual trimmed mono signal, then use fixed gain (no pumping).
    trim_filter = f'atrim=start={start}:end={end},asetpts=PTS-STARTPTS,aformat=channel_layouts=mono,' + base_filter
    intermediate = ROOT / (name + '-working.wav')
    run(['ffmpeg', '-v', 'error', '-nostdin', '-y', '-i', str(source), '-af', trim_filter, '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', str(intermediate)])
    result = run(['ffmpeg', '-hide_banner', '-nostdin', '-i', str(intermediate), '-af', 'volumedetect', '-f', 'null', '-'])
    mean = float(re.search(r'mean_volume: ([-\d.]+)', result.stderr)[1])
    peak = float(re.search(r'max_volume: ([-\d.]+)', result.stderr)[1])
    gain = round(min(-24.0 - mean, -10.0 - peak, 8.0), 2)
    filters = trim_filter + f',volume={gain}dB'
    run(['ffmpeg', '-v', 'error', '-nostdin', '-y', '-i', str(intermediate), '-af', f'volume={gain}dB', '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', str(output)])
    intermediate.unlink()
    check = run(['ffmpeg', '-hide_banner', '-i', str(output), '-af', 'volumedetect', '-f', 'null', '-'])
    final_peak = float(re.search(r'max_volume: ([-\d.]+)', check.stderr)[1])
    assert final_peak <= -9.8, (name, final_peak)
    author, title, preview_key = SOURCES[source_id]
    records.append(dict(id=name, file='clips/' + output.name, durationSeconds=duration,
        sourceId=source_id, author=author, title=title,
        sourceUrl=f'https://freesound.org/people/{author}/sounds/{source_id}/',
        downloadedUrl=f'https://cdn.freesound.org/previews/{preview_key}-hq.mp3',
        sourceFormat='public HQ MP3 preview, not original WAV',
        sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
        license='CC0-1.0', licenseUrl='https://creativecommons.org/publicdomain/zero/1.0/',
        trimStartSeconds=start, trimEndSeconds=end, filters=filters,
        appliedGainDb=gain, measuredPeakDbfs=final_peak, status='awaiting_user_listening_review'))

# Listening reel: six clips in numeric order, 0.8 seconds silence between clips.
inputs = []
chains = []
for i, record in enumerate(records):
    inputs += ['-i', str(ROOT / record['file'])]
    chains.append(f'[{i}:a]apad=pad_dur=0.8[a{i}]' if i < 5 else f'[{i}:a]anull[a{i}]')
chains.append(''.join(f'[a{i}]' for i in range(6)) + 'concat=n=6:v=0:a=1[out]')
run(['ffmpeg', '-v', 'error', '-nostdin', '-y'] + inputs + ['-filter_complex', ';'.join(chains), '-map', '[out]', '-c:a', 'libmp3lame', '-b:a', '128k', str(ROOT / 'cats-01-to-06-preview.mp3')])
(ROOT / 'edits.json').write_text(json.dumps(dict(createdDate='2026-09-11',
    selectionMethod='Source descriptions, silence boundaries and spectrogram inspection; not a completed auditory quality assessment.',
    clips=records), ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print(json.dumps(records, ensure_ascii=False, indent=2))
