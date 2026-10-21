#!/usr/bin/env python3
"""Prépare les illustrations de Rai pour le widget (D-044).

Entrée : assets/rai/source/rai-*.webp|png (générées par ChatGPT : fond transparent, sinon blanc
ou vert).
Sortie : src/assets/rai/<pose>.webp, 256 × 256, fond transparent, personnage posé sur la même
ligne de pieds et à la même échelle ; plus assets/rai/planche.png pour vérifier d'un coup d'œil.

Détourage : on remplit depuis les bords tout ce qui est « fond » (blanc pur ou vert #00FF00),
de proche en proche. Les zones crème du personnage (museau, ventre, pattes) sont entourées d'un
trait sombre et d'une teinte chaude : elles ne sont pas atteintes. Le liseré reçoit une
transparence progressive pour éviter le halo blanc.

Usage : python3 scripts/rai-assets.py   (Pillow requis)
"""

from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/rai/source"
OUT = ROOT / "src/assets/rai"
SIZE = 256
BASELINE = 250  # ligne des pieds, en pixels de sortie
WORK = 627  # les sources (1254 px) sont traitées à moitié de taille

# Échelle relative quand le générateur a dessiné un personnage plus petit ou plus grand.
# Repères : debout ≈ 212 px, assis ≈ 185 px.
SCALE = {
    "base": 0.87,
    "focus-a": 0.9,
    "focus-b": 0.88,
    "pause-a": 0.88,
    "pause-b": 0.92,
    "dodo-b": 0.9,
    "esquive": 0.95,
}
# Poses en l'air : décalées vers le haut d'autant (pixels de sortie).
LIFT = {"victoire": 6, "sursaut": 8}


def is_bg(p):
    r, g, b = p[:3]
    white = min(r, g, b) >= 236 and max(r, g, b) - min(r, g, b) <= 14
    green = g >= 200 and r <= 90 and b <= 90
    return white or green


def cutout(im: Image.Image) -> Image.Image:
    rgba = im.convert("RGBA")
    if rgba.getpixel((0, 0))[3] == 0:  # déjà détourée par le générateur
        return rgba.resize((WORK, WORK), Image.LANCZOS)
    im = rgba.convert("RGB").resize((WORK, WORK), Image.LANCZOS)
    w, h = im.size
    px = im.load()
    bg = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            q.append((x, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if bg[i] or not is_bg(px[x, y]):
            continue
        bg[i] = 1
        if x > 0:
            q.append((x - 1, y))
        if x < w - 1:
            q.append((x + 1, y))
        if y > 0:
            q.append((x, y - 1))
        if y < h - 1:
            q.append((x, y + 1))
    mask = Image.frombytes("L", (w, h), bytes(0 if v else 255 for v in bg))
    # Liseré : transparence progressive selon la clarté, sur 2 px autour du fond.
    edge = mask.filter(ImageFilter.MinFilter(5))
    out = im.convert("RGBA")
    op = out.load()
    mp, ep = mask.load(), edge.load()
    for y in range(h):
        for x in range(w):
            if not mp[x, y]:
                op[x, y] = (0, 0, 0, 0)
            elif not ep[x, y]:
                r, g, b = op[x, y][:3]
                light = min(r, g, b)
                a = max(0, min(255, int((255 - light) * 255 / 120)))
                op[x, y] = (r, g, b, max(a, 40))
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = sorted(SRC.glob("rai-*.*"))
    cut = {}
    for f in files:
        name = f.stem.removeprefix("rai-")
        if name == "icon":
            continue
        cut[name] = cutout(Image.open(f))
    ref = cut["attente-a"].getbbox()  # pose debout de référence, au cadrage le plus courant
    k0 = 212 / (ref[3] - ref[1])
    sheet = Image.new("RGBA", (SIZE * 6, SIZE * ((len(cut) + 5) // 6)), (236, 231, 220, 255))
    for i, (name, im) in enumerate(sorted(cut.items())):
        x0, y0, x1, y1 = im.getbbox()
        part = im.crop((x0, y0, x1, y1))
        k = k0 * SCALE.get(name, 1.0)
        # Une pose trop grande (bras levé, saut) est réduite pour tenir dans le carré.
        k = min(k, (SIZE - 4) / part.width, (BASELINE - 2) / part.height)
        part = part.resize((max(1, round(part.width * k)), max(1, round(part.height * k))), Image.LANCZOS)
        canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        left = (SIZE - part.width) // 2
        top = BASELINE - part.height - LIFT.get(name, 0)
        canvas.alpha_composite(part, (left, max(0, top)))
        canvas.save(OUT / f"{name}.webp", "WEBP", quality=88, method=6)
        sheet.alpha_composite(canvas, ((i % 6) * SIZE, (i // 6) * SIZE))
        print(f"{name:12s} échelle {k:.3f}  {part.width}×{part.height}")
    for row in range(sheet.height // SIZE):  # repères : ligne des pieds, hauteur debout
        for y in (row * SIZE + BASELINE, row * SIZE + BASELINE - 212):
            for x in range(0, sheet.width, 4):
                sheet.putpixel((x, y), (200, 60, 60, 255))
    sheet.save(ROOT / "assets/rai/planche.png")


if __name__ == "__main__":
    main()
