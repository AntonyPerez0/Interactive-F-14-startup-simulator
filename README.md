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
  menu.js                      home screen: aircraft, then procedure by phase
  app.js                       bootstrap, tabs, radio menus, frame loop
  dom.js  style.css
src/aircraft/
  registry.js                  built modules, plus the hangar catalogue
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

Then add it to the `procedures` array in `src/aircraft/f14b/index.js`. It appears
on the home screen automatically, filed under its `phase` — `startup`, `combat`,
`landing` or `shutdown`. A phase with nothing in it shows as "Not built yet".

`meta` needs `id`, `crew`, `phase`, `name` and `view` (the tab to open on).

`tick(sim, dt, dtReal)` gets both the compressed and the real elapsed time.
Use `dtReal` for anything that should run at wall-clock speed regardless of the
time chip — instrument self-tests, for instance.

A procedure may also export `setup(sim)`, run straight after the reset, to hand
the aircraft over in some other state. The landing procedures use
`setAirborne()` — engines at half throttle, generators on, hydraulics up, INS
aligned, gear and flaps away — because a landing obviously does not start cold
and dark. **Restart** re-applies it.

Steps that are flown rather than switched carry `ack:true` and a `done` that
never returns true. Tap the line to confirm one, or leave it and it confirms
itself after five real seconds — the badge counts down. Override the dwell with
`hold: <seconds>` per step, or `hold: 0` to require a tap. The landing
procedures use these for the pattern work.

A step is just `done(state) -> boolean`. Steps are gated in order, so one whose
condition already holds on a cold jet still waits its turn instead of passing
for free.

A rotary may declare `angles`, one entry per state, giving the angle of each
printed detent in degrees with 0 pointing up and clockwise positive. Without it
the pointer sweeps a generic arc, which moves but will not line up with the
labels. Measure them off the photo rather than guessing.

A momentary button may declare `sets`, selecting a state on another control —
that is how the seven WCS MODE buttons drive one `radarMode`:

```js
{ id:'rm_twsauto', kind:'push', sets:{ id:'radarMode', value:'twsauto' },
  watch: s => s.sw.radarMode === 'twsauto' }
```

`watch` may be a predicate as well as a caution-flag name; a control lights when
it returns true.

A control may also declare `ctx`, naming a readout that should stay on screen
when **Show me** frames it — the CAP keys do this so the TID line showing what
you have typed stays visible while you type. Framing fits everything named at
once rather than zooming to a fixed level.

`view` names the tab the step belongs to and must match where its control lives —
a test enforces that. **Show me** derives the view from the control itself, so a
wrong value is harmless but misleading.

`tgt` names the control the cue ring and the **Show me** button point at. It can
also be a function of state, which is how a step that needs several controls
walks the cue from one to the next as you work them:

```js
{ n:30, t:'VDI, HUD and HSD power switches — <b>ON</b>',
  tgt: s => nextOf(s, [['vdiPower','on'], ['hudPower','on'], ['hsdPower','on']]),
  ctx: ['hudPower','hsdPower'],
  done: s => s.sw.vdiPower==='on' && s.sw.hudPower==='on' && s.sw.hsdPower==='on' },
```

`nextOf` points at the first control not yet where it should be, so a verify
step whose switches are already correct skips straight to whatever still needs
doing. The same pattern drives the CAP keypad:

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

## Saved progress

Times and attempts are kept in the browser's own storage — runs, completions,
clean runs and a best time per procedure. Nothing is sent anywhere, and it works
on a static host. The hangar shows your totals with a **Clear** button, each
procedure card shows its best time, and the completion card flags a new record.

A best time only counts for a **clean** run — no skipped steps, no faults —
otherwise skipping everything would win.

If the browser blocks storage, the trainer says so and keeps working; it just
forgets on reload.

## Working offline

There is a web app manifest and a service worker, so the site keeps working with
no connection and can be added to a phone's home screen from Chrome or Safari —
useful given the point is practising away from your PC. It stays an ordinary
website; nothing is packaged or published anywhere.

Code is fetched **network-first**, so a deploy is always picked up and nobody can
get stranded on a stale build. Only the cockpit photos are cache-first, because
they are large and never change.

Run `python3 tools/build-sw.py` after changing files. The cache version is a hash
of file contents, so any edit invalidates the old one. A test fails if the list
drifts from what is on disk.

## Counting who is online

GitHub Pages serves files and runs no code, so it cannot count visitors by
itself. That needs a small endpoint somewhere else.

The client side is written and switched off. Deploy `tools/presence-worker.js`
to Cloudflare Workers — it is about forty lines and free — then paste its URL
into `PRESENCE_URL` in `src/core/config.js`. A chip appears in the top bar
reading "7 here".

The contract is deliberately trivial, so any host will do:

```
POST { "id": "<random per browser>" }   ->   { "online": 7 }
```

With no URL configured nothing is requested and no chip appears. If the endpoint
stops answering, the client gives up after three tries and hides the chip rather
than retrying forever. The only thing stored is a random id per browser and a
timestamp — no addresses, no cookies.

## Adding an aircraft

The hangar lists every entry in `catalogue` in `src/aircraft/registry.js`.
Entries without a `module` are shown greyed out, so the list doubles as a
roadmap. To build one, copy the shape of `src/aircraft/f14b/`:

- `controls.js` — one record per switch with its pixel position in the photo,
  its states listed bottom-to-top, and the label for each state
- `gauges.js` — instruments and the covers that black out unpowered displays
- `systems.js` — `initState`, `onChange`, `tick`; the core calls these and knows
  nothing else about the jet
- `index.js` — views, procedures, radio menus, status strip
- import it in `src/aircraft/registry.js`, add it to `aircraft`, and hang it on
  its catalogue entry as `module`

It then appears as selectable in the hangar. `?aircraft=<id>` still works for
jumping straight in.

The catalogue reflects the DCS line-up as I knew it; add or correct entries
freely — they are plain data.

## The tray

Controls that are not visible in any photo — stick and throttle switches, the
seat and canopy — live in a small panel top left. It is rebuilt for each
procedure and only lists what that procedure actually involves, worked out from
what its steps point at, list as `ctx`, or read in `done()`. A cold start shows
two entries, a Phoenix engagement four.

If a step needs an off-panel control that none of that catches, name it in
`ctx`. A test drives every procedure to completion and fails if it had to touch
a tray control the tray would not have offered.

## Placing hotspots

Getting a switch onto its photo coordinate is the fiddly part. Hit **Calibrate**,
drag any ring or gauge onto the real control, then **Copy layout JSON** and paste
the numbers back into `controls.js`.

Controls whose name ends in **(est)** were positioned by feature detection
without visual confirmation — check those first.

## Credits

Cockpit artwork belongs to Heatblur and Eagle Dynamics. Procedures are taken from
Chuck's DCS F-14B guide.
