"""
Cut the cockpit drawing into views.

ONE STRAIGHT CROP PER VIEW. NOTHING IS MOVED.

The earlier version composed views out of pieces — it cut the left console in
half and stood the two halves side by side to fill a 16:9 frame. That is a lie
about the aeroplane. It put the AFT half of the console to the RIGHT of the
forward half, so anyone learning from it would go looking for the OBOGS switch
in the wrong place in the real jet. The whole point of the trainer is knowing
where to look; a view that rearranges the cockpit to be convenient is worse than
no view at all.

So every view here is a single rectangle taken out of the drawing. Relative
positions inside a view are exactly the aeroplane's. Where a panel is too long
to be legible in one frame — the left console runs about 3,500 pixels fore to
aft — it is split into SEQUENTIAL views along its own axis and named for where
it sits: forward, middle, aft. That is a zoom, not a rearrangement.

Empty page around a crop is left as page. Filling it by importing a panel from
somewhere else in the cockpit is the mistake this file exists to avoid.
"""
import json, os
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
SRC = Image.open('/home/claude/f18-work/base.png').convert('RGB')   # 7570 x 8840
W, H = 1920, 1080
BG = (150, 166, 172)

# (x0, y0, x1, y1) in the drawing. Each is 16:9 so nothing is distorted, and
# each contains whole panels — see the panel extents printed by the measuring
# script that produced these numbers.
VIEWS = {
  'front':  (1950, 1700, 5700, 3810),   # forward instrument panel + centre panel
  'knees':  (1300, 3620, 6320, 6444),   # left vertical · pedestal · right vertical
  'lconF':  ( 540, 4930, 2673, 6130),   # left console, forward  — power, ext lights
  'lconM':  ( 762, 6390, 2362, 7290),   # left console, middle   — engine, fuel, FCS
  'lconA':  ( 447, 7250, 2776, 8560),   # left console, aft      — comm, IFF, oxygen
  'rcon':   (3694, 4880, 7570, 7060),   # right console, whole
}


def dewhite(tile):
    """
    Replace the drawing's white page with the cockpit's own grey.

    Only PURE white goes. Panel highlights, the HOOK lever and the placard
    lettering are all off-white and have to survive, so the threshold is 250
    rather than something safer-sounding like 235.
    """
    px = tile.load()
    w, h = tile.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if r >= 250 and g >= 250 and b >= 250:
                px[x, y] = BG
    return tile


os.makedirs('assets', exist_ok=True)
layout = {}
for name, (x0, y0, x1, y1) in VIEWS.items():
    sw, sh = x1 - x0, y1 - y0
    ar = sw / sh
    if abs(ar - W / H) > 0.02:
        raise SystemExit(f'{name}: {sw}x{sh} is {ar:.3f}, not 16:9 — it would be squashed')
    im = dewhite(SRC.crop((x0, y0, x1, y1))).resize((W, H), Image.LANCZOS)
    im.save(f'assets/{name}.jpg', quality=86, optimize=True, progressive=True, subsampling=1)
    layout[name] = [dict(src=[x0, y0, sw, sh], dst=[0, 0], scale=W / sw)]
    print(f'{name:7} {sw:5}x{sh:5}  scale {W/sw:.3f}  {os.path.getsize(f"assets/{name}.jpg")/1e3:5.0f} KB')

json.dump(layout, open('layout.json', 'w'), indent=1)
print('\nwrote layout.json')
