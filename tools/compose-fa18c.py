"""
Cut the cockpit drawing into views.

TWO VIEWS. ONE STRAIGHT CROP EACH. NOTHING IS MOVED.

  front    the forward instrument panel, close enough to read
  panels   EVERYTHING else, in one frame, in true relative position --
           left knee, pedestal, right knee, both consoles, the rails

A region that is not 16:9 keeps its own shape: the browser fits it into the
1920x1080 box and letterboxes it over the drawing's grey (see `object-fit` in
style.css). It is never stretched -- a squashed view lies about where things
are -- and never padded with cockpit borrowed from somewhere else.

RESOLUTION
----------
The app's coordinate world is 1920x1080, so the hotspot maths is always done in
1920x1080. The image FILE is not: the browser scales it into that box, and when
the user zooms in, the file's extra pixels are what they see.

Each view is written as the EXACT crop of the drawing -- no resampling in
either direction, at any stage. What ships is the pixels the artwork has:

  front   4089x2300   9.4 Mpx   16:9 already, so it fills the frame
  panels  7042x4920  34.6 Mpx   1.43:1, letterboxed into the frame by the
                                browser (`object-fit:contain` in style.css,
                                over the drawing's own grey)

Letting CSS do the letterboxing rather than baking grey bars into the file is
what makes 1:1 possible at all. Bars baked in would push the panels file to
8752x4923 = 43 Mpx for the same amount of cockpit, and Chrome starts refusing
to decode around there -- measured: a 43 Mpx decode fails outright once a
second one is live, where 34.6 Mpx is steady at about a second.

Going higher would only be upscaling. The drawing has no more detail to give,
and inventing some would be a lie about a cockpit.

Lossless, so what reaches the screen is the drawing and not an approximation
of it.

BLANKED NUMBERS
---------------
The drawing has readings printed on it -- 99% RPM, 8,070 lb, 8:00:39. Those are
painted out here (see blank.py) and the app draws live ones into the same
windows, so the IFEI reads what the model is actually doing.
"""
import json, os, sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import blank_readouts as blank

# The drawing, cropped from the artwork the trainer was built against
# (FA18C_grey.png at 560,1250 -> 8130,10090). Override with:
#   python3 tools/compose-fa18c.py /path/to/base_grey.png
DRAWING = sys.argv[1] if len(sys.argv) > 1 else 'art/base_grey.png'

Image.MAX_IMAGE_PIXELS = None
SRC = Image.open(DRAWING).convert('RGB')
n = blank.apply(SRC)
print(f'blanked {n} printed readouts')

W, H = 1920, 1080                 # the coordinate world; never changes

# (x0, y0, x1, y1) in the drawing. Nothing else: the file IS this crop.
VIEWS = {
  # 16:9 exactly: forward panel, UFC, IFEI, AMPCD, standby instruments
  'front':  (1790, 1600, 5879, 3900),
  # everything below the glare shield, in one piece, in true relative position
  'panels': ( 105, 3700, 7147, 8620),
}

os.makedirs('assets', exist_ok=True)
layout = {}
for name, (x0, y0, x1, y1) in VIEWS.items():
    sw, sh = x1 - x0, y1 - y0
    piece = SRC.crop((x0, y0, x1, y1))
    path = f'assets/{name}.webp'
    piece.save(path, format='WEBP', lossless=True, method=5)

    # Where CSS will put it: contain-fit into 1920x1080, centred. The hotspot
    # generator reads this, so the picture and the hitboxes come from one sum.
    k = min(W / sw, H / sh)
    dx, dy = (W - round(sw * k)) // 2, (H - round(sh * k)) // 2
    layout[name] = [dict(src=[x0, y0, sw, sh], dst=[dx, dy], scale=k)]
    print(f'{name:7} {sw}x{sh} = {sw*sh/1e6:.1f} Mpx exact  '
          f'world scale {k:.4f} at ({dx},{dy})  {os.path.getsize(path)/1e6:5.2f} MB')

json.dump(layout, open('layout.json', 'w'), indent=1)
print('wrote layout.json')
