# DCS Cockpit Trainer

A browser trainer for DCS cockpit procedures. Click the real switches on real
cockpit screenshots; the aircraft is simulated underneath, so each checklist step
ticks itself off when the jet actually reaches that state rather than when you
say it has.

Currently ships the **F-14B Tomcat**: the pilot cold start, and the RIO INS
alignment ashore and on the boat. Procedures follow Chuck's DCS F-14B guide,
Part 4.

## Running it

It is a static site — no build step, no dependencies.

```bash
npm run dev          # python3 -m http.server 8000
open http://localhost:8000
```

Deploy by pushing the repo and pointing GitHub Pages at the branch root.
The `.nojekyll` file matters: without it GitHub runs Jekyll over the site, which
silently drops any file or folder whose name starts with an underscore.

> Opening `index.html` straight off disk will not work: browsers block ES module
> imports over `file://`. Use the dev server, or build the single-file bundle.

```bash
npm run bundle       # -> dist/trainer.html, one portable file
npm test             # headless checks, no browser needed
```

`npm test` runs two suites:

- **`tests/run.js`** — drives every procedure to completion through the real sim,
  checks idle engine parameters against the guide's numbers, exercises the failure
  paths (hung start, rejected CAP entry, brake released mid-alignment) and verifies
  no hotspots overlap and every step target resolves.
- **`tests/dom-smoke.js`** — boots the actual app against a minimal fake DOM and
  renders 240 frames. It cannot tell you whether anything *looks* right, but it
  catches missing exports, missing element ids, bad selectors and anything that
  throws on load. Its `classList.toggle` also refuses a non-boolean, because
  passing `undefined` there flips the class every frame.

## Layout

```
index.html                     shell; all chrome is generated from the aircraft
src/core/                      everything aircraft-agnostic
  sim.js                       switch state machine, event bus, tick driver
  views.js                     photos, pan/zoom, hotspots, instruments, calibration
  checklist.js                 step gating, progress, completion card
  kneecard.js                  the in-game kneeboard (RSHIFT+K, page with [ and ])
  app.js                       bootstrap, seats, tabs, radio menus, frame loop
  dom.js  style.css
src/aircraft/
  registry.js                  the list of available aircraft
  f14b/
    index.js                   manifest: views, procedures, menus, status strip
    controls.js                every switch, with its photo coordinates
    gauges.js                  tapes, readouts, display covers
    systems.js                 engines, hydraulics, electrics, INS, CAP entry
    procedures/*.js            one file per checklist
assets/f14b/*.jpg              cockpit photos
.nojekyll                      stops GitHub Pages running Jekyll over the source
tools/bundle.py                single-file build
tests/run.js                   headless test suite
```

## Adding a procedure

Create `src/aircraft/f14b/procedures/shutdown.js`:

```js
export const meta = { id:'shutdown', crew:'pilot', name:'Shutdown', view:'consoles' };

export const steps = [
  { n:1, g:'1 · Shutdown', t:'Throttles — <b>CUTOFF</b>',
    tgt:'throttleL', done: s => s.sw.throttleL === 'off' && s.sw.throttleR === 'off' },
];
```

Then add it to the `procedures` array in `src/aircraft/f14b/index.js`. Anything
with more than one procedure per seat gets a variant button in the kneeboard
footer automatically.

A step is just `done(state) -> boolean`. Steps are gated in order, so one whose
condition already holds on a cold jet still waits its turn instead of passing
for free.

A rotary may declare `angles`, one entry per state, giving the angle of each
printed detent in degrees with 0 pointing up and clockwise positive. Without it
the pointer sweeps a generic arc, which moves but will not line up with the
labels. Measure them off the photo rather than guessing.

A control may also declare `ctx`, naming a readout that should stay on screen
when **Show me** frames it — the CAP keys do this so the TID line showing what
you have typed stays visible while you type. Framing fits everything named at
once rather than zooming to a fixed level.

`tgt` names the control the cue ring and the **Show me** button point at. It can
also be a function of state, which is how a multi-press sequence walks the cue
from one key to the next:

```js
{ n:9, g:'2 · Present Position', t:'Enter latitude — <b>N 25°01.4′</b>',
  tgt: s => capCue(s, 'lat', '25014'),
  done: s => s.rio.entered.lat },
```

## The kneeboard

`RSHIFT+K` opens it, `[` and `]` page through it. It is rendered from
`kneeboard.pages` on the aircraft module rather than being an image, so the
figures printed on it are the same ones the aircraft will accept — a test
actually types the printed coordinates into the CAP and fails if they are
rejected.

```js
kneeboard: {
  pages: [
    { id:'ground', title:'GROUND SETTINGS',
      rows: [['LATITUDE', "25°01'4  NORTH"], ...],
      foot: 'Degrees, minutes and TENTHS of a minute — not seconds.' },
    { id:'datalink', title:'TACTICAL DATALINK SYSTEMS',
      table: { head:['HOST','FREQ MHz','WHEELS'], rows:[[...]] } },
  ],
}
```

A step points at a page with `tgt:'kb:ground'`, the same way `tgt:'comms:ground'`
points at a radio menu.

## Adding an aircraft

Copy the shape of `src/aircraft/f14b/`:

- `controls.js` — one record per switch with its pixel position in the photo,
  its states listed bottom-to-top, and the label for each state
- `gauges.js` — instruments and the covers that black out unpowered displays
- `systems.js` — `initState`, `onChange`, `tick`; the core calls these and knows
  nothing else about the jet
- `index.js` — views, procedures, radio menus, status strip
- register it in `src/aircraft/registry.js`

Then `?aircraft=<id>` selects it.

## Placing hotspots

Getting a switch onto its photo coordinate is the fiddly part. Hit **Calibrate**,
drag any ring or gauge onto the real control, then **Copy layout JSON** and paste
the numbers back into `controls.js`.

Controls whose name ends in **(est)** were positioned by feature detection
without visual confirmation — check those first.

## Credits

Cockpit artwork belongs to Heatblur and Eagle Dynamics. Procedures are taken from
Chuck's DCS F-14B guide.
