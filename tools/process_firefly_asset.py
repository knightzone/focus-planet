from pathlib import Path

from PIL import Image

from process_generated_shadow_match import normalize


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "static" / "images" / "runtime" / "game-objects" / "firefly-tracking-v1.png"
OUTPUT = ROOT / "static" / "images" / "runtime" / "game-objects" / "firefly-tracking-v2.png"


def main():
    firefly = Image.open(SOURCE).convert("RGBA")
    normalize(firefly, size=256, padding=8).save(OUTPUT, optimize=True)


if __name__ == "__main__":
    main()
