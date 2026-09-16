#!/usr/bin/env python3
"""Build transparent selected/inactive tab-bar variants from approved artwork."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
TAB_DIR = ROOT / "static/images/runtime/tabbar"
SOURCES = {
    "star-training-v1.png": ("star-training-selected-v2.png", "star-training-inactive-v2.png"),
    "star-companion-v1.png": ("star-companion-selected-v2.png", "star-companion-inactive-v2.png"),
    "star-home-v1.png": ("star-home-selected-v2.png", "star-home-inactive-v2.png"),
}


def circular_alpha(size: tuple[int, int]) -> Image.Image:
    """Return an antialiased mask that removes the baked-in square corners."""
    scale = 8
    width, height = size
    mask = Image.new("L", (width * scale, height * scale), 0)
    draw = ImageDraw.Draw(mask)
    inset = 1 * scale
    draw.ellipse((inset, inset, width * scale - inset - 1, height * scale - inset - 1), fill=255)
    return mask.resize(size, Image.Resampling.LANCZOS)


def build_variants(source: Path, selected: Path, inactive: Path) -> None:
    image = Image.open(source).convert("RGBA")
    alpha = circular_alpha(image.size)

    selected_image = image.copy()
    selected_image.putalpha(alpha)
    selected_image.save(selected, format="PNG", optimize=True)

    rgb = image.convert("RGB")
    rgb = ImageEnhance.Color(rgb).enhance(0.34)
    rgb = ImageEnhance.Contrast(rgb).enhance(0.92)
    rgb = ImageEnhance.Brightness(rgb).enhance(1.03)
    tint = Image.new("RGB", rgb.size, (137, 149, 171))
    rgb = Image.blend(rgb, tint, 0.16)
    result = rgb.convert("RGBA")
    result.putalpha(alpha)
    result.save(inactive, format="PNG", optimize=True)


for source_name, (selected_name, inactive_name) in SOURCES.items():
    build_variants(TAB_DIR / source_name, TAB_DIR / selected_name, TAB_DIR / inactive_name)
    print(f"built {selected_name} and {inactive_name}")
