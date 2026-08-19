"""
Cut the cockpit drawing into views.

TWO VIEWS. ONE STRAIGHT CROP EACH. NOTHING IS MOVED.

  front    the forward instrument panel, close enough to read
  panels   EVERYTHING else, in one frame, in true relative position --
           left knee, pedestal, right knee, both consoles, the rails

A region that is not 16:9 is scaled to FIT and centred on the drawing's own
backdrop. It is never stretched -- a squashed view lies about where things are
-- and it is never padded with cockpit borrowed from somewhere else.

RESOLUTION
----------
The app's coordinate world is 1920x1080 and its CSS pins every view image to
that size, so the hotspot maths below is always done in 1920x1080. The image
FILE, though, can carry more pixels than that: the browser scales it down to
1920 CSS px, and when the user zooms in those extra pixels are what they see.

Ship each view at the highest multiple that is still a DOWNSCALE of the
drawing, so zoom reveals real detail and never invented detail:

  front   4089 px of drawing wide -> 2x (3840) is 0.94 of source
  panels  7042 px of drawing wide -> 4x (7680, fitted to height) is 0.88

WebP, because line art at 7680x4320 is 0.5 MB there and 1.6 MB as JPEG, and
this file is precached for offline use.
"""
import json, os
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
SRC = Image.open('/home/claude/f18-work/base_grey.png').convert('RGB')
W, H = 1920, 1080                 # the coordinate world; never changes
BACKDROP = (127, 127, 127)        # the drawing's own grey, so padding is invisible

# (x0, y0, x1, y1) in the drawing, which is FA18C_grey cropped at (560, 1250),
# and the pixel multiple the image file is written at.
VIEWS = {
  # 16:9 exactly, so it fills the frame: forward panel, UFC, IFEI, AMPCD, standby
  'front':  ((1790, 1600, 5879, 3900), 2),
  # everything below the glare shield, in one piece. Taller than 16:9, so it is
  # fitted to the height and centred.
  'panels': (( 105, 3700, 7147, 8620), 4),
}

os.makedirs('assets', exist_ok=True)
layout = {}
for name, ((x0, y0, x1, y1), mult) in VIEWS.items():
    sw, sh = x1 - x0, y1 - y0
    k = min(W / sw, H / sh)                 # fit, never fill, never stretch
    dw, dh = round(sw * k), round(sh * k)
    dx, dy = (W - dw) // 2, (H - dh) // 2

    # the same placement, rendered at `mult` times the pixel density
    fw, fh = W * mult, H * mult
    frame = Image.new('RGB', (fw, fh), BACKDROP)
    piece = SRC.crop((x0, y0, x1, y1)).resize((dw * mult, dh * mult), Image.LANCZOS)
    frame.paste(piece, (dx * mult, dy * mult))
    path = f'assets/{name}.webp'
    frame.save(path, format='WEBP', quality=84, method=6)

    # hotspots live in the 1920x1080 world, so the transform recorded here is
    # the 1x one -- the extra pixels are invisible to the coordinate maths.
    layout[name] = [dict(src=[x0, y0, sw, sh], dst=[dx, dy], scale=k)]
    print(f'{name:7} {sw:5}x{sh:5} of drawing  world scale {k:.3f}  '
          f'file {fw}x{fh} ({mult}x, {dw*mult/sw:.2f} of source)  '
          f'{os.path.getsize(path)/1e6:5.2f} MB')

json.dump(layout, open('layout.json', 'w'), indent=1)
print('\nwrote layout.json')
