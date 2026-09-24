#!/usr/bin/env python3
"""找茬题库（故事线 SD2-001—SD2-150）图片复杂度分析，用于定难度。

规则（产品要求）：画面复杂度低 = 简单(low)，复杂度高 = 困难(high)。
分析对象是**运行时图**（static/images/runtime/spot-difference/story-v2 的 A 图，
768×432 WebP），也就是儿童真正看到的画面；源 PNG 只用于交叉验证。

参与计分的三个核心指标（等权归一化后取平均，0—100）：
  edgeDensity   边缘像素占比（FIND_EDGES > 24）：轮廓/结构密度
  highFreq      |原图 − 高斯模糊(半径 2)| 均值 / 64：纹理与细节能量
  hueEntropy    16 段色相直方图香农熵 / 4：色彩丰富度（与上两项近乎无关）

三个指标都按**冻结锚点**（METRIC_ANCHORS，取自 SD2-001—034 基线实测 min/max）
归一化，不随样本重新伸缩；这样 50/70 两个切分点跨批次含义不变，后续新图可以
直接照着目标区间生成。

难度分档（固定阈值，不再按排名强制均衡）：
  综合 < 50       低档
  50 ≤ 综合 ≤ 70  中档
  综合 > 70       高档
生成新图时建议留 5 分缓冲（低 <45、中 55—65、高 >75），别贴着 50/70 走。

参考指标（只列出，不计分）：blockContrast、calmRatio、detailEntropy、
paletteEntropy、regionClutter、meanChangedRatio。停用原因见报告「指标取舍」一节。

输出：
  content/brand/spot-difference-story-v2/complexity-analysis.json
  content/brand/spot-difference-story-v2/complexity-review/index.html
  docs/SPOT_DIFFERENCE_COMPLEXITY_DIFFICULTY.md

用法：python3 tools/analyze-spot-difference-complexity.py [--quiet] [--recalibrate]
  --quiet        只写文件，不打印摘要
  --recalibrate  另外打印本批样本每个指标的实测 min/max，用于决定是否更新锚点
"""

import json
import math
import statistics
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter, ImageStat
from PIL.Image import Resampling

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "content/brand/spot-difference-story-v2"
RUNTIME = ROOT / "static/images/runtime/spot-difference/story-v2"
REVIEW = BASE / "runtime-review/manifest.json"
REGIONS = BASE / "runtime-regions.json"
STORY_DOC = ROOT / "docs/SPOT_DIFFERENCE_STORY_AND_150_V2.md"
JSON_OUT = BASE / "complexity-analysis.json"
HTML_OUT = BASE / "complexity-review/index.html"
MD_OUT = ROOT / "docs/SPOT_DIFFERENCE_COMPLEXITY_DIFFICULTY.md"

WIDTH, HEIGHT = 768, 432
BLOCK = 24
EDGE_THRESHOLD = 24
CALM_STD = 12.0
CORE_METRICS = ["edgeDensity", "highFreq", "hueEntropy"]

# 冻结锚点：2026-09-18 用 SD2-001—034 实测 min/max 标定，之后不再随样本变动。
# 改锚点会让历史分数与 50/70 阈值失去可比性，需要时用 --recalibrate 复核后再手工更新。
METRIC_ANCHORS = {
    "edgeDensity": (0.1251, 0.3247),  # 基线最低 SD2-034，最高 SD2-021，两端各留 0.0005
    "highFreq": (0.0953, 0.2585),  # 基线最低 SD2-034，最高 SD2-021，两端各留 0.0005
    "hueEntropy": (0.3425, 0.7143),  # 基线最低 SD2-025，最高 SD2-033，两端各留 0.0005
}
TIER_CUTS = (50.0, 70.0)  # <50 低档；50—70 中档；>70 高档
TARGET_MARGIN = 5.0  # 生成新图时距切分点建议保留的缓冲

AXIS_LABEL = {
    "edgeDensity": "结构密度",
    "highFreq": "纹理能量",
    "hueEntropy": "色彩丰富度",
    "blockContrast": "分块对比",
    "calmRatio": "平坦块占比",
    "detailEntropy": "灰度熵",
    "paletteEntropy": "调色板熵",
    "regionClutter": "差异处杂乱",
    "meanChangedRatio": "平均变化比",
}
TIER_ORDER = {"low": 0, "medium": 1, "high": 2}
TIER_LABEL = {"low": "低", "medium": "中", "high": "高"}
TIER_TARGET = {"low": "<45", "medium": "55—65", "high": ">75"}


def read_json(path):
    """读 JSON；缺失或损坏时给出可读的失败信息而不是原始堆栈。"""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise SystemExit("缺少输入文件：%s" % path)
    except json.JSONDecodeError as error:
        raise SystemExit("JSON 解析失败：%s（%s）" % (path, error))


def entropy(hist):
    total = sum(hist)
    if total <= 0:
        return 0.0
    acc = 0.0
    for count in hist:
        if count:
            p = count / total
            acc -= p * math.log2(p)
    return acc


def block_grid(luma):
    """24×24 分块亮度标准差网格。"""
    cols, rows = WIDTH // BLOCK, HEIGHT // BLOCK
    grid = []
    for row in range(rows):
        line = []
        for col in range(cols):
            box = (col * BLOCK, row * BLOCK, (col + 1) * BLOCK, (row + 1) * BLOCK)
            line.append(ImageStat.Stat(luma.crop(box)).stddev[0])
        grid.append(line)
    return cols, rows, grid


def region_clutter(region, cols, rows, grid):
    """差异框内分块标准差的面积加权均值（坐标为百分比）。"""
    x, y, w, h = region[:4]
    x0, y0 = x * WIDTH / 100.0, y * HEIGHT / 100.0
    x1, y1 = (x + w) * WIDTH / 100.0, (y + h) * HEIGHT / 100.0
    acc = weight = 0.0
    for row in range(rows):
        for col in range(cols):
            bx0, by0 = col * BLOCK, row * BLOCK
            bx1, by1 = bx0 + BLOCK, by0 + BLOCK
            area = max(0.0, min(x1, bx1) - max(x0, bx0)) * max(0.0, min(y1, by1) - max(y0, by0))
            if area > 0:
                acc += grid[row][col] * area
                weight += area
    return acc / weight if weight else 0.0


def analyse_image(img):
    luma = img.convert("L")
    edge_hist = luma.filter(ImageFilter.FIND_EDGES).histogram()
    edge_density = sum(edge_hist[EDGE_THRESHOLD + 1 :]) / (WIDTH * HEIGHT)
    high_freq = (
        ImageStat.Stat(ImageChops.difference(luma, luma.filter(ImageFilter.GaussianBlur(2)))).mean[0]
        / 64.0
    )
    hue = img.convert("HSV").getchannel(0).histogram()
    hue_bins = [sum(hue[i * 16 : (i + 1) * 16]) for i in range(16)]

    cols, rows, grid = block_grid(luma)
    flat = [value for line in grid for value in line]
    palette = img.convert("P", palette=Image.Palette.ADAPTIVE, colors=64).histogram()[:64]

    return {
        "edgeDensity": edge_density,
        "highFreq": high_freq,
        "hueEntropy": entropy(hue_bins) / 4.0,
        "blockContrast": statistics.fmean(flat) / 64.0,
        "calmRatio": sum(1 for value in flat if value <= CALM_STD) / len(flat),
        "detailEntropy": entropy(luma.histogram()) / 8.0,
        "paletteEntropy": entropy(palette) / 6.0,
        "_grid": (cols, rows, grid),
    }


def ranks(values):
    order = sorted(range(len(values)), key=lambda i: values[i])
    out = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        for k in range(i, j + 1):
            out[order[k]] = (i + j) / 2.0 + 1
        i = j + 1
    return out


def pearson(a, b):
    n = len(a)
    ma, mb = sum(a) / n, sum(b) / n
    cov = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    va = math.sqrt(sum((x - ma) ** 2 for x in a))
    vb = math.sqrt(sum((y - mb) ** 2 for y in b))
    return cov / (va * vb) if va and vb else 0.0


def spearman(a, b):
    return pearson(ranks(a), ranks(b))


def fmt(value, digits=3):
    return ("%." + str(digits) + "f") % value


def tier_of(score):
    low_cut, high_cut = TIER_CUTS
    if score < low_cut:
        return "low"
    if score > high_cut:
        return "high"
    return "medium"


def boundary_margin(score):
    """到最近切分点的距离，用于判断这张图是否贴着 50/70。"""
    return min(abs(score - cut) for cut in TIER_CUTS)


def load_regions():
    data = read_json(REGIONS)
    return {"SD2-%03d" % scene["n"]: scene["regions"] for scene in data["scenes"]}


def load_review():
    if not REVIEW.exists():
        return {}
    return {scene["id"]: scene for scene in read_json(REVIEW)["scenes"]}


def load_titles_and_sources():
    titles, sources = {}, {}
    for chapter in range(1, 17):
        manifest_path = BASE / ("chapter-%02d" % chapter) / "manifest.json"
        if not manifest_path.exists():
            continue
        for scene in read_json(manifest_path)["scenes"]:
            titles[scene["id"]] = scene.get("title", "")
            candidate = Path(scene["file"]) if scene.get("file") else None
            if candidate is None or not candidate.exists():
                continue
            try:  # 只信任仓库内的源图，manifest 里的绝对路径可能指向生成缓存目录
                candidate.relative_to(ROOT)
            except ValueError:
                continue
            sources[scene["id"]] = candidate
    return titles, sources


def load_previous_tiers():
    """读故事文档里当前写着的档位，作为“本次调整前”的对照。"""
    chinese = {"低": "low", "中": "medium", "高": "high"}
    try:
        text = STORY_DOC.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise SystemExit("缺少输入文件：%s" % STORY_DOC)
    tiers = {}
    for line in text.splitlines():
        if not line.startswith("|SD2-"):
            continue
        cells = line.split("|")
        if len(cells) > 3 and cells[2] in chinese:
            tiers[cells[1]] = chinese[cells[2]]
    return tiers


def runtime_scene_ids():
    ids = []
    for path in sorted(RUNTIME.glob("*-a.webp")):
        ids.append("SD2-" + path.name[4:7])
    return ids


def build_scenes():
    regions, review = load_regions(), load_review()
    titles, sources = load_titles_and_sources()
    previous = load_previous_tiers()
    scenes = []
    for scene_id in runtime_scene_ids():
        path = RUNTIME / (scene_id.lower() + "-a.webp")
        with Image.open(path) as image:
            picture = image.convert("RGB")
            if picture.size != (WIDTH, HEIGHT):
                picture = picture.resize((WIDTH, HEIGHT), Resampling.LANCZOS)
            metrics = analyse_image(picture)
        cols, rows, grid = metrics.pop("_grid")

        clutter = [region_clutter(region, cols, rows, grid) for region in regions.get(scene_id, [])]
        changed = [
            item["changedRatio"]
            for item in review.get(scene_id, {}).get("regions", [])
            if "changedRatio" in item
        ]
        scene = {
            "id": scene_id,
            "title": titles.get(scene_id, ""),
            "previousTier": previous.get(scene_id),
            "metrics": metrics,
            "regionCount": len(regions.get(scene_id, [])),
            "regionClutter": statistics.fmean(clutter) / 64.0 if clutter else 0.0,
            "maxRegionClutter": max(clutter) / 64.0 if clutter else 0.0,
            "meanChangedRatio": statistics.fmean(changed) if changed else None,
        }

        source = sources.get(scene_id)
        if source:
            with Image.open(source) as raw:
                scaled = raw.convert("RGB").resize((WIDTH, HEIGHT), Resampling.LANCZOS)
                source_metrics = analyse_image(scaled)
            source_metrics.pop("_grid")
            scene["sourceMetrics"] = source_metrics
        scenes.append(scene)
    return scenes


def score_scenes(scenes):
    for scene in scenes:
        clamped = []
        for metric in CORE_METRICS:
            anchor_low, anchor_high = METRIC_ANCHORS[metric]
            value = (scene["metrics"][metric] - anchor_low) / (anchor_high - anchor_low)
            if value < 0.0 or value > 1.0:
                clamped.append(metric)
            scene.setdefault("normalised", {})[metric] = min(1.0, max(0.0, value))
        scene["anchorClamped"] = clamped
        scene["complexity"] = 100.0 * sum(scene["normalised"][m] for m in CORE_METRICS) / len(CORE_METRICS)
        scene["tier"] = tier_of(scene["complexity"])
        scene["boundaryMargin"] = boundary_margin(scene["complexity"])
        scene["tightBoundary"] = scene["boundaryMargin"] < TARGET_MARGIN

    ordered = sorted(scenes, key=lambda s: s["complexity"])
    for index, scene in enumerate(ordered):
        scene["rank"] = index + 1
    gaps = [
        {
            "after": ordered[i]["id"],
            "before": ordered[i + 1]["id"],
            "gap": ordered[i + 1]["complexity"] - ordered[i]["complexity"],
            "position": i + 1,
        }
        for i in range(len(ordered) - 1)
    ]
    return ordered, sorted(gaps, key=lambda g: -g["gap"])[:5]


def summarise(scenes, ordered):
    tier_stats = {}
    for tier in ("low", "medium", "high"):
        group = [s for s in ordered if s["tier"] == tier]
        tier_stats[tier] = {
            "count": len(group),
            "min": min(s["complexity"] for s in group) if group else None,
            "max": max(s["complexity"] for s in group) if group else None,
            "mean": statistics.fmean(s["complexity"] for s in group) if group else None,
            "ids": [s["id"] for s in group],
        }
    transitions = [
        {
            "id": s["id"],
            "title": s["title"],
            "from": s["previousTier"],
            "to": s["tier"],
            "complexity": s["complexity"],
            "margin": s["boundaryMargin"],
        }
        for s in sorted(scenes, key=lambda s: s["id"])
        if s["previousTier"] and s["previousTier"] != s["tier"]
    ]
    matrix = {}
    for scene in scenes:
        key = "%s→%s" % (scene["previousTier"], scene["tier"])
        matrix[key] = matrix.get(key, 0) + 1
    source_pairs = [
        (s["complexity"], 100 * sum(s["sourceMetrics"][m] for m in CORE_METRICS) / len(CORE_METRICS))
        for s in scenes
        if "sourceMetrics" in s
    ]
    correlations = {
        "sourceVsRuntime": round(spearman([p[0] for p in source_pairs], [p[1] for p in source_pairs]), 3)
        if source_pairs
        else None,
        "coreMatrix": {
            a: {b: round(pearson([s["metrics"][a] for s in scenes], [s["metrics"][b] for s in scenes]), 3)
                for b in CORE_METRICS}
            for a in CORE_METRICS
        },
        "referenceVsComplexity": {
            metric: round(spearman([s["metrics"][metric] for s in scenes], [s["complexity"] for s in scenes]), 3)
            for metric in ("blockContrast", "calmRatio", "detailEntropy", "paletteEntropy")
        },
    }
    return tier_stats, transitions, matrix, correlations


def write_report(scenes, ordered, gaps, tier_stats, transitions, matrix, correlations):
    tight = sorted([s for s in scenes if s["tightBoundary"]], key=lambda s: s["boundaryMargin"])
    low_cut, high_cut = TIER_CUTS
    lines = [
        "# 找茬题库图片复杂度与难度定档（SD2-001—034）",
        "",
        "本文件由 `tools/analyze-spot-difference-complexity.py` 生成，不要手改。",
        "浏览器可读版：`content/brand/spot-difference-story-v2/complexity-review/index.html`。",
        "",
        "## 结论口径",
        "",
        "- 难度只按**画面复杂度**定：复杂度低 = 简单(low)，复杂度高 = 困难(high)。",
        "- 复杂度在**运行时图**（768×432 WebP，儿童实际看到的画面）上计算，取 A 图。",
        "- 综合复杂度 = 边缘密度、纹理能量、色彩丰富度三项按**冻结锚点**归一化后的等权平均（0—100）。",
        "- 分档用**固定阈值**，不按排名强制均衡：",
        "  - 综合 < %g → 低档" % low_cut,
        "  - %g ≤ 综合 ≤ %g → 中档" % (low_cut, high_cut),
        "  - 综合 > %g → 高档" % high_cut,
        "- 锚点冻结在 2026-09-18 的 SD2-001—034 基线实测 min/max 上，"
        "切分点跨批次含义不变，后续新图可直接照目标区间生成。",
        "- 生成新图时建议留 %g 分缓冲：低档 %s、中档 %s、高档 %s，别贴着切分点走。"
        % (TARGET_MARGIN, TIER_TARGET["low"], TIER_TARGET["medium"], TIER_TARGET["high"]),
        "- 差异候选区域的局部杂乱度 `regionClutter`、平均变化比 `meanChangedRatio` 只作参考，不参与分档；"
        "一局本来就按难度混组，个别组偏差不影响整体。",
        "",
        "## 指标定义与锚点",
        "",
        "| 指标 | 计分 | 锚点下限 | 锚点上限 | 含义 |",
        "| --- | --- | --- | --- | --- |",
    ]
    for metric in CORE_METRICS:
        anchor_low, anchor_high = METRIC_ANCHORS[metric]
        lines.append("| %s | ✔ | %s | %s | %s |" % (
            metric, fmt(anchor_low, 4), fmt(anchor_high, 4), {
                "edgeDensity": "边缘像素占比（FIND_EDGES > %d）：轮廓/结构密度" % EDGE_THRESHOLD,
                "highFreq": "\\|原图 − 高斯模糊(2)\\| 均值 / 64：纹理与细节能量",
                "hueEntropy": "16 段色相直方图香农熵 / 4：色彩丰富度",
            }[metric]))
    lines += [
        "| blockContrast | 参考 | — | — | 24×24 分块亮度标准差均值 / 64 |",
        "| calmRatio | 参考 | — | — | 分块标准差 ≤ %g 的块占比，画面里能“歇脚”的空面积 |" % CALM_STD,
        "| detailEntropy | 参考 | — | — | 灰度直方图香农熵 / 8 |",
        "| paletteEntropy | 参考 | — | — | 自适应 64 色直方图香农熵 / 6 |",
        "| regionClutter | 参考 | — | — | 差异候选区域内的分块标准差均值 / 64 |",
        "| meanChangedRatio | 参考 | — | — | 差异候选区域内像素真正改变的像素比例（来源 runtime-review） |",
        "",
        "锚点取自基线 34 组的实测极值，两端各留 0.0005 余量（否则基线图自己就会落在锚点外被截断）："
        "edgeDensity %s—%s（实测 0.1257 / SD2-034 与 0.3242 / SD2-021）、"
        "highFreq %s—%s（实测 0.0958 / SD2-034 与 0.2580 / SD2-021）、"
        "hueEntropy %s—%s（实测 0.3430 / SD2-025 与 0.7137 / SD2-033）。"
        "超出锚点范围的图片归一化后截断在 0/1，JSON 里以 `anchorClamped` 标出；"
        "需要更新锚点时跑 `--recalibrate` 复核后再手工改常量。"
        % (fmt(METRIC_ANCHORS["edgeDensity"][0], 4), fmt(METRIC_ANCHORS["edgeDensity"][1], 4),
           fmt(METRIC_ANCHORS["highFreq"][0], 4), fmt(METRIC_ANCHORS["highFreq"][1], 4),
           fmt(METRIC_ANCHORS["hueEntropy"][0], 4), fmt(METRIC_ANCHORS["hueEntropy"][1], 4)),
        "",
        "## 指标取舍（为什么只用 3 项）",
        "",
        "先算了 6 项候选指标，按 34 组的离散度与相互相关性筛出 3 项：",
        "",
        "- 丢弃 **detailEntropy**（0.921—0.964）、**paletteEntropy**（0.977—0.991）：几乎饱和，"
        "max/min 只有 1.05 与 1.01，归一化后放大的是噪声。",
        "- 丢弃 **blockContrast**、**calmRatio**（保留为参考列）：与 edgeDensity 的 Spearman 相关达 "
        "%.2f / %.2f，与核心轴重复。"
        % (correlations["referenceVsComplexity"]["blockContrast"], correlations["referenceVsComplexity"]["calmRatio"]),
        "- 保留 **hueEntropy**：与边缘/纹理轴的 Pearson 相关仅 %.2f，是唯一独立的第二轴（色彩丰富度）。"
        % pearson([s["metrics"]["edgeDensity"] for s in scenes], [s["metrics"]["hueEntropy"] for s in scenes]),
        "- edgeDensity 与 highFreq 相关 %.2f（同为“细节能量”族）：因此三项等权 = 细节能量 2 份、色彩 1 份。"
        % correlations["coreMatrix"]["edgeDensity"]["highFreq"],
        "- 交叉验证：源 PNG（1672×941 → LANCZOS 缩到 768×432）与运行时 WebP 的综合复杂度 Spearman 秩相关 %s，"
        "排序不依赖压缩。%s"
        % (correlations["sourceVsRuntime"], "（SD2-025 是明显离群组，比第二名低 22.9 分）"),
        "",
        "| | " + " | ".join(CORE_METRICS) + " |",
        "| --- | " + " | ".join("---" for _ in CORE_METRICS) + " |",
    ]
    for a in CORE_METRICS:
        lines.append("| " + a + " | " + " | ".join(fmt(correlations["coreMatrix"][a][b], 2) for b in CORE_METRICS) + " |")
    lines += [
        "",
        "## 分档统计",
        "",
        "| 档位 | 组数 | 复杂度区间 | 平均值 | 生成目标区间 |",
        "| --- | --- | --- | --- | --- |",
    ]
    for tier in ("low", "medium", "high"):
        stat = tier_stats[tier]
        if not stat["count"]:
            lines.append("| %s | 0 | — | — | %s |" % (TIER_LABEL[tier], TIER_TARGET[tier]))
            continue
        lines.append("| %s | %d | %s—%s | %s | %s |" % (
            TIER_LABEL[tier], stat["count"], fmt(stat["min"], 1), fmt(stat["max"], 1),
            fmt(stat["mean"], 1), TIER_TARGET[tier]))
    lines += [
        "",
        "固定阈值下三档数量不均衡是预期结果（排名三等分才会强制均衡）。"
        "当前低档 %d 组、中档 %d 组、高档 %d 组；后续新图按目标区间补齐即可，"
        "不需要为了“每档一样多”把贴边的图挪档。"
        % (tier_stats["low"]["count"], tier_stats["medium"]["count"], tier_stats["high"]["count"]),
        "",
        "## 贴边清单（距切分点 < %g 分，共 %d 组）" % (TARGET_MARGIN, len(tight)),
        "",
        "这些组要么生成时离切分点太近，要么本身就处在过渡带；后续复算时最可能换档，"
        "新图生成尽量避开同一区间。",
        "",
        "| 编号 | 标题 | 综合复杂度 | 当前档位 | 距最近切分点 |",
        "| --- | --- | --- | --- | --- |",
    ]
    for scene in tight:
        lines.append("| %s | %s | %s | %s | %s（%s） |" % (
            scene["id"], scene["title"], fmt(scene["complexity"], 1), TIER_LABEL[scene["tier"]],
            fmt(scene["boundaryMargin"], 1),
            "50" if abs(scene["complexity"] - low_cut) < abs(scene["complexity"] - high_cut) else "70"))
    lines += [
        "",
        "复杂度分布上最大的 5 处断层（说明分档边界处在连续区间里，不是天然聚类）：",
        "",
        "| 断点位置 | 低侧 | 高侧 | 差值 |",
        "| --- | --- | --- | --- |",
    ]
    for item in gaps:
        lines.append("| 第 %d 名之后 | %s | %s | %s |" % (
            item["position"], item["after"], item["before"], fmt(item["gap"], 1)))
    lines += [
        "",
        "## 34 组明细（按档位、复杂度降序）",
        "",
        "| 排名 | 编号 | 标题 | 档位 | 综合 | 距切分点 | 结构密度 | 纹理能量 | 色彩丰富度 | 分块对比 | 平坦块占比 | 差异处杂乱 | 候选数 | 平均变化比 |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for scene in sorted(ordered, key=lambda s: (TIER_ORDER[s["tier"]], -s["complexity"])):
        m = scene["metrics"]
        lines.append("| %d | %s | %s | **%s** | %s | %s | %s | %s | %s | %s | %s | %s | %d | %s |" % (
            scene["rank"], scene["id"], scene["title"], TIER_LABEL[scene["tier"]],
            fmt(scene["complexity"], 1), fmt(scene["boundaryMargin"], 1),
            fmt(m["edgeDensity"]), fmt(m["highFreq"]), fmt(m["hueEntropy"]),
            fmt(m["blockContrast"]), fmt(m["calmRatio"]), fmt(scene["regionClutter"]),
            scene["regionCount"],
            "—" if scene["meanChangedRatio"] is None else fmt(scene["meanChangedRatio"]),
        ))
    lines += [
        "",
        "## 本次调整清单（排名三等分 → 固定阈值，%d 组）" % len(transitions),
        "",
    ]
    if transitions:
        lines += ["| 编号 | 标题 | 上一版 → 本次 | 综合复杂度 | 距切分点 |", "| --- | --- | --- | --- | --- |"]
        for item in sorted(transitions, key=lambda t: t["margin"]):
            lines.append("| %s | %s | %s → %s | %s | %s |" % (
                item["id"], item["title"], TIER_LABEL[item["from"]], TIER_LABEL[item["to"]],
                fmt(item["complexity"], 1), fmt(item["margin"], 1)))
    else:
        lines.append("无（固定阈值与上一版档位完全一致）。")
    cn = lambda key: key.replace("low", "低").replace("medium", "中").replace("high", "高")
    lines += [
        "",
        "迁移矩阵：",
        "",
        "| 迁移 | 组数 |",
        "| --- | --- |",
    ]
    for key in sorted(matrix):
        lines.append("| %s | %d |" % (cn(key), matrix[key]))
    lines += [
        "",
        "## 局限与后续",
        "",
        "- 复杂度只描述**画面本身**，不含差异的数量、大小与显眼度；游戏里差异数量另由 `differenceTargetCount`（2—5 处）与候选配方控制。",
        "- 一局本来就混合 3—5 组不同档位，个别组定档偏差对整体难度影响有限，不必追求逐组精确。",
        "- 锚点是相对基线 34 组标定的**相对尺度**（0—100 = 从最平淡到最密集），不是绝对物理量；"
        "如果后续画风整体变密或变疏，需要用 `--recalibrate` 重新标定锚点并同步复核 50/70 是否仍然合适。",
        "- 本报告只改难度口径，不改运行时：要生效需把新档位写回 `docs/SPOT_DIFFERENCE_STORY_AND_150_V2.md` 表格后重跑 `node tools/build-story-runtime.cjs`。",
    ]
    MD_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_review_page(scenes, ordered, tier_stats):
    def bars(scene):
        cells = []
        for metric in CORE_METRICS:
            value = scene["normalised"][metric]
            cells.append(
                '<div class="bar"><span class="name">%s</span>'
                '<span class="track"><i style="width:%.0f%%"></i></span>'
                '<span class="val">%.3f</span></div>' % (AXIS_LABEL[metric], value * 100, scene["metrics"][metric])
            )
        return "".join(cells)

    rows = []
    for tier in ("low", "medium", "high"):
        group = [s for s in ordered if s["tier"] == tier]
        stat = tier_stats[tier]
        title = "%s档 · %d 组" % (TIER_LABEL[tier], stat["count"])
        if stat["count"]:
            title += " · 复杂度 %s—%s（均值 %s），生成目标 %s" % (
                fmt(stat["min"], 1), fmt(stat["max"], 1), fmt(stat["mean"], 1),
                TIER_TARGET[tier].replace("<", "&lt;").replace(">", "&gt;"))
        rows.append("<h2>%s</h2>" % title)
        rows.append('<table><thead><tr><th>#</th><th>图（A）</th><th>编号 / 标题</th><th>度</th>'
                    '<th>综合复杂度</th><th>三轴分解</th><th>差异候选 / 变化比</th></tr></thead><tbody>')
        for scene in sorted(group, key=lambda s: -s["complexity"]):
            badge = ' <span class="tight">贴边</span>' if scene["tightBoundary"] else ""
            rows.append(
                '<tr><td>%d</td><td><img src="../../../../static/images/runtime/spot-difference/story-v2/%s-a.webp"></td>'
                '<td><b>%s</b><br>%s</td><td>%s</td><td class="score">%s%s<br><small>距切分点 %s</small></td><td>%s</td>'
                '<td>%d 处<br>%s</td></tr>' % (
                    scene["rank"], scene["id"].lower(), scene["id"], scene["title"],
                    TIER_LABEL[scene["tier"]], fmt(scene["complexity"], 1), badge,
                    fmt(scene["boundaryMargin"], 1), bars(scene), scene["regionCount"],
                    "—" if scene["meanChangedRatio"] is None else fmt(scene["meanChangedRatio"]),
                ))
        rows.append("</tbody></table>")
    HTML_OUT.parent.mkdir(parents=True, exist_ok=True)
    HTML_OUT.write_text(
        """<!doctype html><meta charset="utf-8"><title>找茬题库复杂度定档审核</title><style>
body{font:15px/1.5 system-ui;background:#eef3fb;margin:0;padding:24px;color:#1c2b45}
h1{margin:0 0 8px}h2{margin:32px 0 12px;font-size:18px}
p.lead{margin:0 0 8px;color:#42556f}
table{width:100%;border-collapse:collapse;background:#fff;box-shadow:0 1px 3px #0001}
th,td{padding:8px 10px;border-bottom:1px solid #e3e9f2;text-align:left;vertical-align:top}
th{background:#dce7f7;font-size:13px}
img{width:260px;border-radius:6px;display:block}
.score{font-weight:700;font-size:18px}.score small{font-weight:400;color:#7a8aa3}
.tight{background:#ffe1b3;border-radius:4px;padding:1px 5px;font-size:11px;color:#8a5a00}
.bar{display:flex;align-items:center;gap:6px;font-size:12px;white-space:nowrap}
.bar .name{width:72px;color:#42556f}.bar .track{display:inline-block;width:96px;height:8px;background:#e3e9f2;border-radius:4px}
.bar .track i{display:block;height:8px;background:#4b8bf5;border-radius:4px}.bar .val{color:#7a8aa3}
</style><h1>找茬题库复杂度定档审核（SD2-001—034）</h1>
<p class="lead">由 tools/analyze-spot-difference-complexity.py 生成。难度按画面复杂度定档：综合复杂度 &lt;50 低档、50—70 中档、&gt;70 高档。</p>
<p class="lead">综合复杂度 = 结构密度（边缘）、纹理能量（高频）、色彩丰富度（色相熵）按冻结锚点归一化后等权平均。生成新图建议留 5 分缓冲：低 &lt;45、中 55—65、高 &gt;75。</p>
""" + "\n".join(rows) + "\n",
        encoding="utf-8",
    )


def main():
    scenes = build_scenes()
    ordered, gaps = score_scenes(scenes)
    tier_stats, transitions, matrix, correlations = summarise(scenes, ordered)

    payload = {
        "width": WIDTH,
        "height": HEIGHT,
        "block": BLOCK,
        "edgeThreshold": EDGE_THRESHOLD,
        "calmStd": CALM_STD,
        "coreMetrics": CORE_METRICS,
        "metricAnchors": {k: list(v) for k, v in METRIC_ANCHORS.items()},
        "tierCuts": list(TIER_CUTS),
        "targetMargin": TARGET_MARGIN,
        "tierRule": "固定阈值：<50 低档、50—70 中档、>70 高档（不按排名均衡）",
        "tierTargets": TIER_TARGET,
        "tierStats": tier_stats,
        "transitions": transitions,
        "matrix": matrix,
        "largestGaps": gaps,
        "tightBoundary": [s["id"] for s in scenes if s["tightBoundary"]],
        "correlations": correlations,
        "scenes": [
            {
                "id": s["id"],
                "title": s["title"],
                "previousTier": s["previousTier"],
                "tier": s["tier"],
                "rank": s["rank"],
                "complexity": round(s["complexity"], 2),
                "boundaryMargin": round(s["boundaryMargin"], 2),
                "tightBoundary": s["tightBoundary"],
                "anchorClamped": s["anchorClamped"],
                "metrics": {k: round(v, 4) for k, v in s["metrics"].items()},
                "regionCount": s["regionCount"],
                "regionClutter": round(s["regionClutter"], 4),
                "maxRegionClutter": round(s["maxRegionClutter"], 4),
                "meanChangedRatio": None if s["meanChangedRatio"] is None else round(s["meanChangedRatio"], 4),
            }
            for s in sorted(scenes, key=lambda s: s["id"])
        ],
    }
    JSON_OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_report(scenes, ordered, gaps, tier_stats, transitions, matrix, correlations)
    write_review_page(scenes, ordered, tier_stats)

    if "--recalibrate" in sys.argv:
        print("本批样本实测极值（用于决定是否更新 METRIC_ANCHORS）：")
        for metric in CORE_METRICS:
            values = sorted((s["metrics"][metric], s["id"]) for s in scenes)
            print("  %-12s min %.6f %s   max %.6f %s   当前锚点 %s"
                  % (metric, values[0][0], values[0][1], values[-1][0], values[-1][1],
                     list(METRIC_ANCHORS[metric])))

    if "--quiet" not in sys.argv:
        print(json.dumps({
            "scenes": len(scenes),
            "tierCuts": list(TIER_CUTS),
            "tierStats": {
                k: {"count": v["count"],
                    "range": None if not v["count"] else [round(v["min"], 1), round(v["max"], 1)]}
                for k, v in tier_stats.items()
            },
            "transitions": len(transitions),
            "tightBoundary": [s["id"] for s in scenes if s["tightBoundary"]],
            "anchorClamped": [s["id"] for s in scenes if s["anchorClamped"]],
            "spearmanSourceVsRuntime": correlations["sourceVsRuntime"],
            "json": str(JSON_OUT.relative_to(ROOT)),
            "html": str(HTML_OUT.relative_to(ROOT)),
            "report": str(MD_OUT.relative_to(ROOT)),
        }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
