"""
Cut the cockpit drawing into views.

TWO VIEWS. ONE STRAIGHT CROP EACH. NOTHING IS MOVED.

An earlier version composed views out of pieces to fill a 16:9 frame — it cut
the left console in half and stood the halves side by side, which put the AFT
half to the RIGHT of the forward half. That is a lie about the aeroplane, and
the whole point of the trainer is knowing where to look.

A later version fixed that but ended up with six tabs, which is its own kind of
wrong: a switch you only ever see on a tab called "L Console · Mid" is a switch
you cannot place in a real cockpit. So there are two views now:

  front    the forward instrument panel, close enough to read
  panels   EVERYTHING else, in one frame, in true relative position —
           left knee, pedestal, right knee, both consoles, the rails

The second one is dense at fit-to-screen. That is the honest trade: one map you
can orient yourself on beats six crops you cannot assemble in your head, and the
app has zoom, pan, and a SHOW ME that flies to whatever the checklist wants.

A region that is not 16:9 is scaled to FIT and centred on the drawing's own
backdrop. It is never stretched — a squashed view lies about where things are —
and it is never padded with cockpit borrowed from somewhere else.
"""
import json, os
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
SRC = Image.open('/home/claude/f18-work/base_grey.png').convert('RGB')
W, H = 1920, 1080
BACKDROP = (127, 127, 127)        # the drawing's own grey, so padding is invisible

# (x0, y0, x1, y1) in the drawing, which is FA18C_grey cropped at (560, 1250).
VIEWS = {
  # 16:9 exactly, so it fills the frame: forward panel, UFC, IFEI, AMPCD, standby
  'front':  (1790, 1600, 5879, 3900),
  # everything below the glare shield, in one piece. Taller than 16:9, so it is
  # fitted to the height and centred.
  'panels': ( 105, 3700, 7147, 8620),
}

os.makedirs('assets', exist_ok=True)
layout = {}
for name, (x0, y0, x1, y1) in VIEWS.items():
    sw, sh = x1 - x0, y1 - y0
    k = min(W / sw, H / sh)                 # fit, never fill, never stretch
    dw, dh = round(sw * k), round(sh * k)
    dx, dy = (W - dw) // 2, (H - dh) // 2
    frame = Image.new('RGB', (W, H), BACKDROP)
    frame.paste(SRC.crop((x0, y0, x1, y1)).resize((dw, dh), Image.LANCZOS), (dx, dy))
    frame.save(f'assets/{name}.jpg', quality=88, optimize=True, progressive=True, subsampling=1)
    layout[name] = [dict(src=[x0, y0, sw, sh], dst=[dx, dy], scale=k)]
    print(f'{name:7} {sw:5}x{sh:5}  scale {k:.3f}  placed at {dx},{dy}  '
          f'{os.path.getsize(f"assets/{name}.jpg")/1e3:5.0f} KB')

json.dump(layout, open('layout.json', 'w'), indent=1)
print('\nwrote layout.json')
