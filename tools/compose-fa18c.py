"""
Build the F/A-18C view images, and the coordinate transform that goes with them.

WHY COMPOSE RATHER THAN CROP
The trainer's world is a fixed 1920x1080 per view. The source drawing is one
tall exploded layout: the consoles are 1000 x 3500 strips, which cropped to 16:9
would be a sliver of switches in an ocean of white. So each view is BUILT — the
relevant panels are cut out and placed into the frame, at a scale chosen per
piece so the switches end up a usable size.

THE IMAGES AND THE COORDINATES COME OUT OF THE SAME PASS.
That is the whole point. Every piece has a source rect and a destination rect,
and both the pixels and the hotspots go through the identical transform. There
is no second place for the arithmetic to be wrong, and no opportunity for the
picture and the hitboxes to drift apart.
"""
import json, os
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
SRC = Image.open('/home/claude/f18-work/base.png').convert('RGB')   # 7570 x 8840
W, H = 1920, 1080
BG = (150, 166, 172)      # the drawing's own panel grey, so pieces sit on it invisibly

# A piece: (source x, y, w, h) -> (dest x, y, scale). Dest size is derived.
VIEWS = {
  'front': [
    dict(src=(1950, 1700, 3750, 2110), dst=(0, 0), scale=1920/3750),
  ],
  'lower': [
    # left vertical panel (gear, brakes) and the centre pedestal, side by side
    dict(src=(1050, 3800, 1020, 1080), dst=(40, 30), scale=0.93),
    dict(src=(3280, 3860, 1010, 830),  dst=(1010, 140), scale=0.90),
  ],
  'lcon': [
    # the left console, cut in half and stood side by side
    dict(src=(1030, 4950, 1090, 1790), dst=(215, 12), scale=0.59),
    dict(src=(1030, 6740, 1090, 1790), dst=(1060, 12), scale=0.59),
  ],
  'rcon': [
    # right vertical panel, then the right console
    dict(src=(5350, 3690, 980, 1100), dst=(45, 15), scale=0.95),
    dict(src=(5400, 4930, 990, 2180), dst=(1090, 10), scale=0.49),
  ],
}

def dewhite(tile):
    """
    Replace the drawing's white page with the cockpit's own grey.

    The source is a layout drawing on white, so any crop that does not land
    entirely inside a panel brings a wedge of paper with it — which reads as a
    hole punched in the cockpit. Only PURE white goes: the panel highlights, the
    HOOK lever and the placard lettering are all off-white and have to survive,
    so the threshold is 250 rather than something safer-sounding like 235.
    """
    px = tile.load()
    w, h = tile.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if r >= 250 and g >= 250 and b >= 250:
                px[x, y] = BG
    return tile


def build(name, pieces):
    im = Image.new('RGB', (W, H), BG)
    placed = []
    for p in pieces:
        sx, sy, sw, sh = p['src']
        k = p['scale']
        dw, dh = round(sw * k), round(sh * k)
        dx, dy = p['dst']
        im.paste(dewhite(SRC.crop((sx, sy, sx + sw, sy + sh))).resize((dw, dh), Image.LANCZOS), (dx, dy))
        placed.append(dict(src=p['src'], dst=(dx, dy), scale=k, size=(dw, dh)))
        if dx + dw > W or dy + dh > H:
            raise SystemExit(f'{name}: piece {p["src"]} overflows the frame ({dx+dw}x{dy+dh})')
    os.makedirs('assets', exist_ok=True)
    im.save(f'assets/{name}.jpg', quality=86, optimize=True, progressive=True, subsampling=1)
    return placed

layout = {}
for name, pieces in VIEWS.items():
    layout[name] = build(name, pieces)
    print(f'{name:6} {len(pieces)} piece(s)  {os.path.getsize(f"assets/{name}.jpg")/1e3:6.0f} KB')

json.dump(layout, open('layout.json', 'w'), indent=1)
print('\nwrote layout.json')
