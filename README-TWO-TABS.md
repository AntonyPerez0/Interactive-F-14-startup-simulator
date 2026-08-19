# Two tabs, your artwork, and instruments that actually read

**This supersedes every previous zip.** Apply it over whatever you have.

---

## Before you upload: three files to delete

Drag-and-drop cannot remove files, and your own `nothing on disk is left out`
test fails if these linger:

```
assets/fa18c/lower.jpg
assets/fa18c/lcon.jpg
assets/fa18c/rcon.jpg
```

`front.jpg` is replaced in place, and `panels.jpg` is new.

Then drag the **`src`**, **`assets`**, **`tests`** and **`tools`** folders plus
the loose **`sw.js`**, **`README.md`** and **`CREDITS.md`**. Not *Choose your
files*.

---

## Two tabs

| tab | what |
| --- | --- |
| **Front Panel** | forward instrument panel, UFC, HUD control, IFEI, AMPCD, standby instruments |
| **Panels & Consoles** | **everything else, in one frame** — left knee panel, centre pedestal, right knee panel, both consoles, both canopy rails |

You were right about the six tabs. A switch you only ever see on a tab called
"L Console · Mid" is a switch you cannot place in a real cockpit, which defeats
the point. `panels` is dense at fit-to-screen — that is the trade, and it is
the right one. One map you can orient yourself on, plus the zoom buttons and a
**SHOW ME** that flies to whatever the checklist wants, beats six crops you have
to assemble in your head.

Both views are still **single straight crops**. Nothing is moved, rotated or
rearranged. Left knee is on the left, right knee on the right, the pedestal
between them, the consoles running aft down either side — because those are
literally the same pixels in the same places.

## Your grey artwork

`FA18C_grey.png` is now the source. It turned out to be the same drawing on the
same 8420 x 11980 canvas as the one I already had — I checked a landmark region
and it matched to a mean difference of **1.3 out of 255** — so every hotspot
measurement carried straight over with nothing to re-measure.

The white page and my recolouring are both gone; what you see is your file's own
grey. `tools/compose-fa18c.py` holds the two crop rectangles and refuses to
write one that is not 16:9 unless it fits and centres it, because a stretched
view lies about where things are.

## The instruments read for real

The drawing has numbers printed on it — the IFEI shows 99% RPM and 8,070 lb
whatever the jet is doing. A printed 99% on a cold aeroplane is worse than no
number at all: it is the one reading you are trying to learn to trust. So
anything the model simulates is now covered and rewritten:

**Screens, dark until powered** — both DDIs, the AMPCD, the IFEI. On a cold jet
they are black. The DDIs stay black until you turn their brightness knobs off
OFF, which is exactly what the checklist asks for.

**Live numbers** — RPM, EGT, fuel flow and fuel quantity per engine; a clock
that ticks; the INS alignment counting down in seconds and then reading
`GRND QUAL OK`; brake and hydraulic pressure; battery volts; cabin altitude;
radar altimeter; standby airspeed and altitude.

**Lamps that light from state** — APU READY goes green when it is, the HOOK
light with the hook, READY/DISCH with both engines running, the FLAPS advisory
off AUTO, and the whole standby caution panel whenever any of its nine captions
is up.

**Needles that move** — brake and hydraulic pressure, over their own dials, with
the pivot and sweep measured off the drawing.

Fuel now burns while the engines run, so the quantity is not a number that never
changes.

## Also fixed on the way through

- The four display hotspots were sized from a single radius, which cannot
  describe a 553 x 579 screen — the right DDI's box sat half off its own bezel.
  Displays now carry an explicit `box` measured off the art.
- Hotspots on the dense `panels` view are floored at 21 px so they stay hittable
  at fit-to-screen. Your overlap test is what keeps that floor honest.

## Everything from the earlier fixes

- picking the Hornet opened the Tomcat
- the F-14 flash during the swap
- the APU never reaching READY
- switch travel, state order and knob detent angles
- panels sitting where they do in the jet

Full suite green from a clean clone of your repo, including the new
`tests/fa18c.mjs`, which drives every step of every checklist through the
systems model.
