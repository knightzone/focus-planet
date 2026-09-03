from collections import deque
from pathlib import Path
import shutil

from PIL import Image, ImageChops, ImageDraw, ImageFilter


GENERATED = Path("/Users/zhoukang/.codex/generated_images/01a06039-5955-77d3-800c-454436e17497")
OUTPUT = Path("/Users/zhoukang/zk/focus-planet/static/images/runtime/illustrations/shadow-match")

GROUPS = [
    {
        "name": "easy-animals",
        "source": GENERATED / "exec-147e2a6f-48b7-4758-857b-7c6a354ea49c.png",
        "columns": 3,
        "rows": 1,
        "items": ["rabbit", "squirrel", "owl"],
    },
    {
        "name": "easy-animals",
        "sheet": "easy-animals-extra",
        "source": GENERATED / "exec-284fbb64-7398-4777-9112-2ec7a9a2e19f.png",
        "columns": 2,
        "rows": 1,
        "items": ["turtle", "elephant"],
    },
    {
        "name": "easy-fruits",
        "source": GENERATED / "exec-62b3aba7-e687-43a6-ba54-9b091fc9abe5.png",
        "columns": 5,
        "rows": 1,
        "items": ["apple", "banana", "pineapple", "strawberry", "grapes"],
    },
    {
        "name": "easy-vehicles",
        "source": GENERATED / "exec-bebe0dc8-5ae2-46ff-bb09-9a5b130cb5a8.png",
        "columns": 5,
        "rows": 1,
        "items": ["car", "sailboat", "train", "airplane", "rocket"],
    },
    {
        "name": "easy-garden",
        "source": GENERATED / "exec-97e4f3fd-bca6-431e-bf5d-e144b6475114.png",
        "columns": 5,
        "rows": 1,
        "items": ["mushroom", "flower", "tree", "cactus", "snail"],
    },
    {
        "name": "easy-foods",
        "source": GENERATED / "exec-3bb4875d-cc10-4399-8124-ad4d7a74219f.png",
        "columns": 5,
        "rows": 1,
        "items": ["cupcake", "ice-cream", "donut", "pizza", "birthday-cake"],
    },
    {
        "name": "medium-similar-cars",
        "source": GENERATED / "exec-976bcb65-a6bd-4af5-b34d-66c5d3118e57.png",
        "columns": 3,
        "rows": 2,
        "items": ["car-1", "car-2", "car-3", "car-4", "car-5", "car-6"],
    },
    {
        "name": "hard-similar-cats",
        "sheet": "hard-similar-cats-a",
        "source": GENERATED / "exec-fd374e7e-c5d1-46e3-b13b-531ac380af1b.png",
        "columns": 4,
        "rows": 1,
        "items": ["cat-1", "cat-2", "cat-3", "cat-4"],
    },
    {
        "name": "hard-similar-cats",
        "sheet": "hard-similar-cats-b",
        "source": GENERATED / "exec-4b205e52-dca3-4abb-89e2-e90ba09ca7ea.png",
        "columns": 4,
        "rows": 1,
        "items": ["cat-5", "cat-6", "cat-7", "cat-8"],
    },
    {
        "name": "high-similar-cars-extra",
        "sheet": "high-similar-car-7",
        "source": OUTPUT / "source-sheets-v2" / "high-similar-car-7.png",
        "columns": 1,
        "rows": 1,
        "items": ["car-7"],
    },
    {
        "name": "high-similar-cars-extra",
        "sheet": "high-similar-car-8",
        "source": OUTPUT / "source-sheets-v2" / "high-similar-car-8.png",
        "columns": 1,
        "rows": 1,
        "items": ["car-8"],
    },
    {
        "name": "medium-similar-birds",
        "sheet": "medium-birds",
        "source": OUTPUT / "source-sheets-v2" / "medium-birds.png",
        "columns": 3,
        "rows": 2,
        "items": ["bird-1", "bird-2", "bird-3", "bird-4", "bird-5", "bird-6"],
    },
    {
        "name": "medium-similar-sailboats",
        "sheet": "medium-sailboats",
        "source": OUTPUT / "source-sheets-v2" / "medium-sailboats.png",
        "columns": 3,
        "rows": 2,
        "items": ["sailboat-1", "sailboat-2", "sailboat-3", "sailboat-4", "sailboat-5", "sailboat-6"],
    },
    {
        "name": "medium-similar-flowers",
        "sheet": "medium-flowers",
        "source": OUTPUT / "source-sheets-v2" / "medium-flowers.png",
        "columns": 3,
        "rows": 2,
        "items": ["flower-1", "flower-2", "flower-3", "flower-4", "flower-5", "flower-6"],
    },
    {
        "name": "medium-forest-animals",
        "sheet": "medium-forest-animals",
        "source": OUTPUT / "source-sheets-v2" / "medium-forest-animals.png",
        "columns": 3,
        "rows": 2,
        "items": ["rabbit", "fox", "bear", "deer", "squirrel", "hedgehog"],
    },
    {
        "name": "medium-farm-animals",
        "sheet": "medium-farm-animals",
        "source": OUTPUT / "source-sheets-v2" / "medium-farm-animals.png",
        "columns": 3,
        "rows": 2,
        "items": ["cow", "pig", "sheep", "horse", "chicken", "duck"],
    },
    {
        "name": "medium-musical-instruments",
        "sheet": "medium-musical-instruments",
        "source": OUTPUT / "source-sheets-v2" / "medium-musical-instruments.png",
        "columns": 3,
        "rows": 2,
        "items": ["guitar", "drum", "trumpet", "violin", "piano", "maracas"],
    },
    {
        "name": "medium-playground-toys",
        "sheet": "medium-playground-toys",
        "source": OUTPUT / "source-sheets-v2" / "medium-playground-toys.png",
        "columns": 3,
        "rows": 2,
        "items": ["duck", "spinning-top", "kite", "scooter", "rocking-horse", "blocks"],
    },
    {
        "name": "medium-puppies",
        "sheet": "medium-puppies",
        "source": OUTPUT / "source-sheets-v2" / "medium-puppies.png",
        "columns": 3,
        "rows": 2,
        "items": ["puppy-1", "puppy-2", "puppy-3", "puppy-4", "puppy-5", "puppy-6"],
    },
    {
        "name": "medium-cottages",
        "sheet": "medium-cottages",
        "source": OUTPUT / "source-sheets-v2" / "medium-cottages.png",
        "columns": 3,
        "rows": 2,
        "items": ["cottage-1", "cottage-2", "cottage-3", "cottage-4", "cottage-5", "cottage-6"],
    },
    {
        "name": "medium-trees",
        "sheet": "medium-trees",
        "source": OUTPUT / "source-sheets-v2" / "medium-trees.png",
        "columns": 3,
        "rows": 2,
        "items": ["tree-1", "tree-2", "tree-3", "tree-4", "tree-5", "tree-6"],
    },
    {
        "name": "medium-similar-birds",
        "sheet": "high-birds-extra",
        "source": OUTPUT / "source-sheets-v2" / "high-birds-extra.png",
        "columns": 2,
        "rows": 1,
        "items": ["bird-7", "bird-8"],
    },
    {
        "name": "medium-similar-sailboats",
        "sheet": "high-sailboats-extra",
        "source": OUTPUT / "source-sheets-v2" / "high-sailboats-extra.png",
        "columns": 2,
        "rows": 1,
        "items": ["sailboat-7", "sailboat-8"],
    },
    {
        "name": "high-similar-rockets",
        "sheet": "high-rockets",
        "source": OUTPUT / "source-sheets-v2" / "high-rockets.png",
        "columns": 4,
        "rows": 2,
        "items": ["rocket-1", "rocket-2", "rocket-3", "rocket-4", "rocket-5", "rocket-6", "rocket-7", "rocket-8"],
    },
    {
        "name": "high-similar-airplanes",
        "sheet": "high-airplanes",
        "source": OUTPUT / "source-sheets-v2" / "high-airplanes.png",
        "columns": 4,
        "rows": 2,
        "items": ["airplane-1", "airplane-2", "airplane-3", "airplane-4", "airplane-5", "airplane-6", "airplane-7", "airplane-8"],
    },
    {
        "name": "high-similar-penguins",
        "sheet": "high-penguins",
        "source": OUTPUT / "source-sheets-v2" / "high-penguins.png",
        "columns": 4,
        "rows": 2,
        "items": ["penguin-1", "penguin-2", "penguin-3", "penguin-4", "penguin-5", "penguin-6", "penguin-7", "penguin-8"],
    },
    {
        "name": "high-similar-teddy-bears",
        "sheet": "high-teddy-bears",
        "source": OUTPUT / "source-sheets-v2" / "high-teddy-bears.png",
        "columns": 4,
        "rows": 2,
        "items": ["bear-1", "bear-2", "bear-3", "bear-4", "bear-5", "bear-6", "bear-7", "bear-8"],
    },
]


def is_background(pixel):
    r, g, b = pixel[:3]
    return min(r, g, b) >= 232 and max(r, g, b) - min(r, g, b) <= 20


def foreground_alpha(image):
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    background = bytearray(width * height)
    queue = deque()

    def add(x, y):
        index = y * width + x
        if background[index] == 0 and is_background(pixels[x, y]):
            background[index] = 1
            queue.append((x, y))

    for x in range(width):
        add(x, 0)
        add(x, height - 1)
    for y in range(height):
        add(0, y)
        add(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if x > 0:
            add(x - 1, y)
        if x + 1 < width:
            add(x + 1, y)
        if y > 0:
            add(x, y - 1)
        if y + 1 < height:
            add(x, y + 1)

    foreground = bytearray(0 if value else 1 for value in background)
    visited = bytearray(width * height)
    components = []
    for start in range(width * height):
        if foreground[start] == 0 or visited[start] != 0:
            continue
        component = []
        visited[start] = 1
        queue.append((start % width, start // width))
        while queue:
            x, y = queue.popleft()
            index = y * width + x
            component.append(index)
            if x > 0:
                neighbor = index - 1
                if foreground[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append((x - 1, y))
            if x + 1 < width:
                neighbor = index + 1
                if foreground[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append((x + 1, y))
            if y > 0:
                neighbor = index - width
                if foreground[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append((x, y - 1))
            if y + 1 < height:
                neighbor = index + width
                if foreground[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append((x, y + 1))
        components.append(component)

    largest = max(components, key=len) if components else []
    kept = bytearray(width * height)
    for index in largest:
        kept[index] = 255
    alpha = Image.new("L", (width, height))
    alpha.putdata(kept)
    return alpha.filter(ImageFilter.GaussianBlur(0.45))


def normalize(cell, size=384, padding=20):
    rgba = cell.convert("RGBA")
    alpha = foreground_alpha(rgba)
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError("No foreground found")
    rgba.putalpha(alpha)
    rgba = rgba.crop(bbox)
    max_dimension = size - padding * 2
    rgba.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    x = (size - rgba.width) // 2
    y = (size - rgba.height) // 2
    canvas.alpha_composite(rgba, (x, y))
    return canvas


def clear_enclosed_background_holes(image, min_pixels=250, max_pixels=1200):
    """Remove large, enclosed white source-background regions from an RGBA cutout."""
    rgba = image.copy()
    width, height = rgba.size
    pixels = rgba.load()
    candidates = bytearray(width * height)
    for y in range(height):
        for x in range(width):
            if pixels[x, y][3] > 128 and is_background(pixels[x, y]):
                candidates[y * width + x] = 1

    visited = bytearray(width * height)
    hole = Image.new("L", (width, height), 0)
    hole_pixels = hole.load()
    for start in range(width * height):
        if candidates[start] == 0 or visited[start] != 0:
            continue
        component = []
        visited[start] = 1
        queue = deque([(start % width, start // width)])
        while queue:
            x, y = queue.popleft()
            index = y * width + x
            component.append((x, y))
            if x > 0:
                neighbor = index - 1
                if candidates[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append((x - 1, y))
            if x + 1 < width:
                neighbor = index + 1
                if candidates[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append((x + 1, y))
            if y > 0:
                neighbor = index - width
                if candidates[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append((x, y - 1))
            if y + 1 < height:
                neighbor = index + width
                if candidates[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append((x, y + 1))
        if min_pixels <= len(component) <= max_pixels:
            for x, y in component:
                hole_pixels[x, y] = 255

    hole = hole.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.45))
    rgba.putalpha(ImageChops.subtract(rgba.getchannel("A"), hole))
    return rgba


def shadow_for(image):
    shadow = Image.new("RGBA", image.size, (166, 175, 190, 0))
    shadow.putalpha(image.getchannel("A"))
    return shadow


def checkerboard(size):
    image = Image.new("RGB", size, "#F6F7FB")
    draw = ImageDraw.Draw(image)
    tile = 16
    for y in range(0, size[1], tile):
        for x in range(0, size[0], tile):
            if (x // tile + y // tile) % 2 == 0:
                draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill="#E9ECF2")
    return image


def main():
    previews = []
    source_dir = OUTPUT / "source-sheets-v2"
    source_dir.mkdir(parents=True, exist_ok=True)

    for group in GROUPS:
        source = Image.open(group["source"]).convert("RGBA")
        group_dir = OUTPUT / group["name"]
        group_dir.mkdir(parents=True, exist_ok=True)
        sheet_name = group.get("sheet", group["name"])
        source_copy = source_dir / f"{sheet_name}.png"
        if group["source"].resolve() != source_copy.resolve():
            shutil.copy2(group["source"], source_copy)
        cell_width = source.width // group["columns"]
        cell_height = source.height // group["rows"]

        for index, item in enumerate(group["items"]):
            column = index % group["columns"]
            row = index // group["columns"]
            box = (
                column * cell_width,
                row * cell_height,
                (column + 1) * cell_width,
                (row + 1) * cell_height,
            )
            illustration = normalize(source.crop(box))
            # The curled tail in cat-5 encloses source background. Preserve that
            # negative space so its silhouette does not become a solid gray blob.
            if group["name"] == "hard-similar-cats" and item == "cat-4":
                illustration = clear_enclosed_background_holes(illustration, 2500, 4000)
            if group["name"] == "hard-similar-cats" and item == "cat-5":
                illustration = clear_enclosed_background_holes(illustration)
            if group["name"] == "easy-foods" and item == "donut":
                illustration = clear_enclosed_background_holes(illustration, 5000, 12000)
            shadow = shadow_for(illustration)
            illustration.save(group_dir / f"{item}.png", optimize=True)
            shadow.save(group_dir / f"{item}-shadow.png", optimize=True)
            previews.append((group["name"], item, illustration, shadow))

    card = 180
    columns = 4
    rows = (len(previews) + columns - 1) // columns
    preview = Image.new("RGB", (columns * card * 2, rows * (card + 28)), "white")
    draw = ImageDraw.Draw(preview)
    for index, (group_name, item, illustration, shadow) in enumerate(previews):
        column = index % columns
        row = index // columns
        y = row * (card + 28)
        for offset, asset in ((0, illustration), (card, shadow)):
            background = checkerboard((card, card))
            small = asset.copy()
            small.thumbnail((card - 12, card - 12), Image.Resampling.LANCZOS)
            background.paste(small, ((card - small.width) // 2, (card - small.height) // 2), small)
            preview.paste(background, (column * card * 2 + offset, y))
        draw.text((column * card * 2 + 6, y + card + 5), f"{group_name}/{item}", fill="#25324A")
    preview.save(OUTPUT / "generated-groups-v2-preview.jpg", quality=90)


if __name__ == "__main__":
    main()
