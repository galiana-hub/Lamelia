#!/usr/bin/env python3
"""Draws the Lamelia app icons (dark wood, brass bridge, steel keys, sound hole).

Usage: python3 tools/make_icons.py   (needs Pillow)
Writes PNG files into icons/.
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "icons"
OUT.mkdir(exist_ok=True)

S = 4  # supersampling factor
BASE = 512


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def artwork(rounded: bool) -> Image.Image:
    """512x512 artwork, drawn at 4x and scaled down. Key art stays inside the central 80%."""
    n = BASE * S
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))

    # wood background with a vertical gradient and faint grain
    wood = Image.new("RGBA", (n, n))
    px = ImageDraw.Draw(wood)
    top, bottom = (58, 36, 21), (22, 12, 7)
    for y in range(n):
        px.line([(0, y), (n, y)], fill=lerp(top, bottom, y / n) + (255,))
    for x in range(0, n, 23 * S):
        px.line([(x, 0), (x, n)], fill=(0, 0, 0, 12), width=max(1, S))

    mask = Image.new("L", (n, n), 0)
    md = ImageDraw.Draw(mask)
    if rounded:
        md.rounded_rectangle([0, 0, n - 1, n - 1], radius=int(n * 0.22), fill=255)
    else:
        md.rectangle([0, 0, n, n], fill=255)
    img.paste(wood, (0, 0), mask)

    d = ImageDraw.Draw(img)

    def sc(v):
        return int(v * S)

    # steel keys: centre one longest, alternating outwards like the real instrument
    key_w, gap, count = 22, 10, 7
    total = count * key_w + (count - 1) * gap
    x0 = (BASE - total) / 2
    lengths = [150, 176, 202, 224, 202, 176, 150]
    y_top = 112
    for i in range(count):
        x = x0 + i * (key_w + gap)
        h = lengths[i]
        # steel shading: dark edge, bright middle
        for k, shade in enumerate([(112, 116, 122), (200, 204, 210), (245, 247, 249), (194, 198, 204), (122, 126, 132)]):
            seg = key_w / 5
            d.rounded_rectangle(
                [sc(x + k * seg), sc(y_top), sc(x + (k + 1) * seg), sc(y_top + h)],
                radius=sc(4) if k in (0, 4) else 0,
                fill=shade,
            )
        d.rounded_rectangle([sc(x), sc(y_top + h - 18), sc(x + key_w), sc(y_top + h)], radius=sc(9), outline=None)

    # brass bridge
    by = 186
    for k in range(14):
        c = lerp((240, 212, 143), (92, 69, 33), k / 13)
        d.rounded_rectangle([sc(132), sc(by + k), sc(380), sc(by + 15 - 0)], radius=sc(7), fill=c)
    d.rounded_rectangle([sc(132), sc(by), sc(380), sc(by + 15)], radius=sc(7), outline=(70, 52, 24), width=S)

    # sound hole with brass ring
    cx, cy, r = 256, 392, 34
    d.ellipse([sc(cx - r - 9), sc(cy - r - 9), sc(cx + r + 9), sc(cy + r + 9)], fill=(26, 17, 10), outline=(138, 106, 53), width=sc(3))
    d.ellipse([sc(cx - r), sc(cy - r), sc(cx + r), sc(cy + r)], fill=(3, 2, 1))

    return img.resize((BASE, BASE), Image.LANCZOS)


def save(img: Image.Image, name: str, size: int) -> None:
    img.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
    print("wrote", OUT / name)


rounded = artwork(rounded=True)
square = artwork(rounded=False)

save(rounded, "icon-192.png", 192)
save(rounded, "icon-512.png", 512)
save(square, "icon-maskable-512.png", 512)  # full-bleed: Android applies its own mask
save(square, "apple-touch-icon.png", 180)
save(rounded, "favicon-32.png", 32)
