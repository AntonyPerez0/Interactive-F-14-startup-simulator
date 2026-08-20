"""
The drawing has numbers printed on it. This blanks them so the app can put live
ones in the same windows.

Every rect below is an LCD window on the IFEI, measured off the drawing at
magnification. Filling one with the window's own unlit colour leaves the window,
its bezel and its printed label alone and takes away only the digits — so the
panel still looks like a panel, it just reads blank until the jet is powered.

Coordinates are pixels in base_grey.png (the drawing cropped at 560,1250).
"""
IFEI_OFF = (24, 21, 33)          # the unlit face of an IFEI window

# id                    x0    y0    x1    y1
BLANK = [
  ('ifeiRpmL',        2653, 3046, 2706, 3081),
  ('ifeiRpmR',        2777, 3046, 2833, 3081),
  ('ifeiTempL',       2638, 3094, 2708, 3131),
  ('ifeiTempR',       2777, 3094, 2856, 3131),
  ('ifeiFfL',         2628, 3139, 2708, 3176),
  ('ifeiFfR',         2777, 3139, 2858, 3176),
  ('ifeiOilL',        2647, 3337, 2708, 3372),
  ('ifeiOilR',        2777, 3337, 2840, 3372),
  ('ifeiFuel1',       3025, 3049, 3165, 3087),
  ('ifeiFuel2',       3025, 3104, 3165, 3142),
  ('ifeiBingo',       3025, 3198, 3149, 3231),
  ('ifeiTime1',       3009, 3286, 3167, 3324),
  ('ifeiTime2',       3009, 3338, 3167, 3374),
]

def apply(img):
    """Paint every window out. Returns the count, for the build log."""
    from PIL import ImageDraw
    d = ImageDraw.Draw(img)
    for _id, x0, y0, x1, y1 in BLANK:
        d.rectangle([x0, y0, x1 - 1, y1 - 1], fill=IFEI_OFF)
    return len(BLANK)
