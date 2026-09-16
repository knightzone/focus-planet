"""Create review-only cartoon SFX, with provenance and explicit QA status."""
import array
import hashlib
import html
import json
import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PITCH = dict(dog=1.5, cow=3, sheep=2.5, horse=2, pig=2.5, chicken=2,
             duck=1.5, bird=0.5, car=1, train=1.5, airplane=2,
             guitar=0, drum=0, maracas=0, piano=0, violin=0, trumpet=0,
             bicycle=0, telephone=0)
CATEGORIES = [('animals', '动物', ['dog','cow','sheep','horse','pig','chicken','duck','bird']),
              ('vehicles', '交通', ['car','train','airplane']),
              ('instruments', '乐器', ['guitar','drum','maracas','piano','violin','trumpet']),
              ('bells', '铃声', ['bicycle','telephone'])]

def run(args):
    return subprocess.run(args, check=True, capture_output=True)

def signal(path, filters=None, rate=16000):
    args = ['ffmpeg', '-v', 'error', '-i', str(path)]
    if filters:
        args += ['-af', filters]
    raw = run(args + ['-ac','1','-ar',str(rate),'-f','f32le','-']).stdout
    samples = array.array('f')
    samples.frombytes(raw)
    return samples

def levels(samples):
    peak = max(abs(v) for v in samples)
    rms = math.sqrt(sum(v*v for v in samples)/len(samples))
    return (20*math.log10(max(rms,1e-12)),20*math.log10(max(peak,1e-12)))

def choose(path, kind):
    samples = signal(path)
    duration = len(samples)/16000
    if duration <= 2.5:
        return 0, duration, 'Complete short source'
    # Derive event boundaries from an RMS envelope, not from arbitrary fixed offsets.
    rms = [math.sqrt(sum(v*v for v in samples[i:i+160])/len(samples[i:i+160]))
           for i in range(0,len(samples),160)]
    env = [sum(rms[max(0,i-2):i+3])/len(rms[max(0,i-2):i+3]) for i in range(len(rms))]
    floor = sorted(env)[int(len(env)*0.2)]
    peak = max(env)
    threshold = max(peak*0.10, floor + (peak-floor)*0.22)
    spans = []
    start = None
    for i, value in enumerate(env + [0]):
        if value >= threshold and start is None:
            start = i
        if value < threshold and start is not None:
            if spans and start-spans[-1][1] <= 12:
                spans[-1] = (spans[-1][0], i)
            else:
                spans.append((start,i))
            start = None
    min_time = 2.5 if kind == 'airplane' else 0
    candidates = []
    for a,b in spans:
        a, b = a/100, b/100
        length = b-a
        if a < min_time or length < 0.16 or length > 6:
            continue
        segment = samples[int(a*16000):int(b*16000)]
        mean, maximum = levels(segment)
        # Penalize isolated clicks and strongly impulsive events.
        score = min(length,1.1) - abs(length-0.9)*0.15 - max(0,maximum-mean-15)*0.1
        candidates.append((score,a,b))
    if candidates:
        _,a,b = max(candidates)
        start = max(0,a-0.08)
        end = min(duration,b+0.16,start+2.6)
        return round(start,3), round(end,3), 'RMS event detection; semantic/auditory review pending'
    start = min(min_time, max(0,duration-2.2))
    return start, min(duration,start+2.2), 'Continuous source window; semantic/auditory review pending'

def reel(paths, output, pauses=0.65):
    args = ['ffmpeg','-v','error','-nostdin','-y']
    chains = []
    for i,path in enumerate(paths):
        args += ['-i', str(path)]
        chains.append(f'[{i}:a]apad=pad_dur={pauses}[a{i}]')
    chains.append(''.join(f'[a{i}]' for i in range(len(paths))) + f'concat=n={len(paths)}:v=0:a=1[out]')
    run(args + ['-filter_complex',';'.join(chains),'-map','[out]','-c:a','libmp3lame','-b:a','128k',str(output)])

sources = (json.loads((ROOT/'sources.json').read_text()) if (ROOT/'sources.json').exists()
           else [json.loads(path.read_text()) for path in sorted((ROOT/'sources').glob('*.json'))])
overrides = json.loads((ROOT/'trim_overrides.json').read_text()) if (ROOT/'trim_overrides.json').exists() else {}
(ROOT/'clips').mkdir(exist_ok=True)
(ROOT/'previews').mkdir(exist_ok=True)
existing = {r['sourceId']: r for r in json.loads((ROOT/'edits.json').read_text())} if (ROOT/'edits.json').exists() else {}
results=[]
counts={}
for source in sources:
    if 'downloadError' in source:
        continue
    kind=source['objectId']
    counts[kind]=counts.get(kind,0)+1
    ident=f'{kind}-{counts[kind]:02}'
    if len(sys.argv)>1 and kind != sys.argv[1] and source['sourceId'] in existing:
        results.append(existing[source['sourceId']])
        continue
    path=ROOT/source['audioFile']
    start,end,selection=choose(path,kind)
    if str(source['sourceId']) in overrides:
        start,end=overrides[str(source['sourceId'])]
        selection='Manually adjusted after waveform/spectrogram inspection; auditory review pending'
    duration=end-start
    pitch=PITCH[kind]
    filters=f'atrim=start={start}:end={end},asetpts=PTS-STARTPTS,aformat=channel_layouts=mono,volume=-15dB'
    cutoff=5000 if kind in ('dog','trumpet','car') else 6500
    filters+=f',highpass=f=85,lowpass=f={cutoff},equalizer=f=3000:t=q:w=0.7:g=-3'
    if pitch:
        filters+=f',rubberband=tempo=1:pitch={2**(pitch/12):.8f}:transients=smooth'
    attack=0.012 if kind in ('drum','piano','guitar','maracas','bicycle') else 0.03
    filters+=f',afade=t=in:d={attack},afade=t=out:st={max(0,duration-0.09):.3f}:d=0.09'
    working=ROOT/f'{ident}-working.wav'
    output=ROOT/'clips'/f'{ident}.wav'
    run(['ffmpeg','-v','error','-nostdin','-y','-i',str(path),'-af',filters,'-ar','44100','-ac','1','-c:a','pcm_f32le',str(working)])
    mean,peak=levels(signal(working,rate=44100))
    gain=min(-25-mean,-12-peak,18)
    run(['ffmpeg','-v','error','-nostdin','-y','-i',str(working),'-af',f'volume={gain:.3f}dB','-c:a','pcm_s16le',str(output)])
    working.unlink()
    final_mean,final_peak=levels(signal(output,rate=44100))
    assert final_peak <= -11.9, (ident,final_peak)
    # Full-rate peak check, independent of analysis downsampling.
    info=json.loads(run(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(output)]).stdout)
    run(['ffmpeg','-v','error','-i',str(output),'-f','null','-'])
    result=dict(id=ident,label=source['label'],objectId=kind,file=str(output.relative_to(ROOT)),
        durationSeconds=round(float(info['format']['duration']),3),sourceId=source['sourceId'],
        sourceTitle=source['title'],author=source['author'],sourceUrl=source['sourceUrl'],
        license=source['license'],licenseUrl=source['licenseUrl'],sourceSha256=source['sha256'],
        trimStartSeconds=start,trimEndSeconds=end,pitchSemitones=pitch,filter=filters,
        gainDb=round(gain,3),rmsDbfs=round(final_mean,2),peakDbfs=round(final_peak,2),
        selectionMethod=selection,status='awaiting_user_listening_review')
    results.append(result)
    print(f'{ident}: source {source["sourceId"]} {start:.2f}-{end:.2f}s -> {result["durationSeconds"]}s',flush=True)

for kind in counts:
    paths=[ROOT/r['file'] for r in results if r['objectId']==kind]
    reel(paths,ROOT/'previews'/f'{kind}.mp3')
for key,label,kinds in CATEGORIES:
    paths=[ROOT/r['file'] for kind in kinds for r in results if r['objectId']==kind]
    if paths:
        reel(paths,ROOT/'previews'/f'all-{key}.mp3',0.9)
(ROOT/'edits.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')

# Local-only index: no external scripts, analytics, or remote media dependencies.
page='''<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>卡通音效试听</title><style>body{font:16px system-ui;background:#eef4ff;color:#263650;max-width:980px;margin:40px auto;padding:20px}h1{font-size:28px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}.card{background:white;border-radius:20px;padding:20px}audio{width:100%}small{color:#65718b}a{color:#476aca}</style><h1>卡通音效 · 第一版</h1><p>19 类 × 2 段；每组按 01 → 02 播放。先用偏低音量试听。属于素材后期处理，不是 AI 新生成。</p><p>尚未听觉验收，不代表已达到儿童使用标准；未接入游戏。狗叫已换来源。请重点确认音色、辨识度与是否突兀。</p>'''
for key,label,kinds in CATEGORIES:
    page+=f'<h2>{label}</h2><audio controls preload="none" src="previews/all-{key}.mp3"></audio><div class="grid">'
    for kind in kinds:
        clips=[r for r in results if r['objectId']==kind]
        if not clips:
            continue
        page+=f'<div class="card"><h3>{html.escape(clips[0]["label"])}</h3><audio controls preload="none" src="previews/{kind}.mp3"></audio>'
        for clip in clips:
            page+=f'<p><a href="{clip["file"]}">{clip["id"]}</a> · {clip["durationSeconds"]} 秒<br><small>{html.escape(clip["sourceTitle"])} — {html.escape(clip["author"])} · <a href="{clip["sourceUrl"]}">来源</a> · <a href="{clip["licenseUrl"]}">{clip["license"]}</a> · 已裁剪及音色处理</small></p>'
        page+='</div>'
    page+='</div>'
page+='</html>'
(ROOT/'index.html').write_text(page,encoding='utf8')
print(f'Built {len(results)} review clips across {len(counts)} objects',flush=True)
