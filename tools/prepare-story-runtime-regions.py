#!/usr/bin/env python3
"""Import reviewed object boundaries; never infer crops from colour density.

Preserve existing scenes 001–034. Review both object silhouettes; reflections
and attached props may be independent. Intersecting rectangles are exclusive.
Supplemental B inputs and their new regions live in runtime-supplements.json.
"""
import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[1] / 'content/brand/spot-difference-story-v2'

def main():
    target = BASE / 'runtime-regions.json'
    data = json.loads(target.read_text())
    reviewed = json.loads((BASE / 'reviewed-object-regions.json').read_text())
    assert set(reviewed) == {str(n) for n in range(35, 151)}
    for scene in data['scenes']:
        n = scene['n']
        if n <= 34:
            continue
        regions = reviewed[str(n)]
        assert len(regions) >= 2, f'{n}: insufficient independent objects'
        for i, (x, y, w, h, label) in enumerate(regions):
            assert label and x >= 0 and y >= 0 and w > 0 and h > 0 and x+w <= 100 and y+h <= 100, (n, label)
            # Reviewed rectangles may overlap; the runtime recipe excludes such pairs.
        scene['regions'] = regions
        scene['method'] = 'manual-reviewed-local-composite'
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'scenes':len(data['scenes']), 'regions':sum(len(s['regions']) for s in data['scenes'])}))

if __name__ == '__main__':
    main()
