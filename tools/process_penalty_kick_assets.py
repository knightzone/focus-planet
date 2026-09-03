from pathlib import Path

from PIL import Image, ImageDraw

from process_generated_shadow_match import normalize


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tools" / "assets" / "penalty-kick"
CHARACTERS = ROOT / "static" / "images" / "runtime" / "game-characters"
OBJECTS = ROOT / "static" / "images" / "runtime" / "game-objects"


def main():
    sheet = Image.open(SOURCE / "goalkeeper-actions-v2.png").convert("RGBA")
    names = [
        "goalkeeper-ready-v2",
        "goalkeeper-hold-ball-v2",
        "goalkeeper-dive-left-v2",
        "goalkeeper-dive-right-v2",
    ]
    cell_width = sheet.width // 4
    for index, name in enumerate(names):
        cell = sheet.crop((index * cell_width, 0, (index + 1) * cell_width, sheet.height))
        normalize(cell, size=512, padding=18).save(CHARACTERS / f"{name}.png", optimize=True)

    # The image generator may render a checkerboard instead of returning alpha.
    # Use the ball's circular silhouette as alpha so its opaque white panels are
    # never mistaken for background pixels.
    football = Image.open(SOURCE / "football-complete-v2.png").convert("RGBA")
    alpha = Image.new("L", football.size, 0)
    ImageDraw.Draw(alpha).ellipse((126, 100, 1128, 1102), fill=255)
    football.putalpha(alpha)
    normalize(football, size=256, padding=8).save(OBJECTS / "football-v2.png", optimize=True)


if __name__ == "__main__":
    main()
