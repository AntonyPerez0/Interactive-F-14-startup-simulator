/* ============================================================
   F/A-18C HORNET · INSTRUMENTS

   The layout drawing has numbers printed on it — the IFEI shows 99% RPM and
   8,070 lb of fuel whatever the jet is doing, the standby altimeter reads 2,600
   ft on the ramp, the caution panel is lit. A printed 99% on a cold aeroplane
   is worse than no number at all: it is the one reading a student is trying to
   learn to trust.

   So everything the model actually simulates is covered and rewritten:

     screen   opaque, dark until powered — the DDIs, the AMPCD, the IFEI
     chip     opaque text over a printed number — RPM, EGT, fuel, pressures
     needle   a pointer over a dial — brake and hydraulic pressure

   Dial geometry (pivot, radius, zero angle, sweep) was read off the drawing at
   magnification. `a0` is the angle at `min` and `a1` the angle at `max`, both
   measured clockwise from straight up, which is how the renderer reads them.
   ============================================================ */

export const TAPE_CH = { l: 0, r: 0, w: 0 };   // no vertical tapes on this jet

const n0 = v => Math.round(v);
const pad = (v, n) => String(n0(v)).padStart(n, '0');

/* Zulu-ish clock, driven by the sim's own elapsed time so it ticks while you
   sit there and resets with the procedure. */
function clock(s) {
  const t = Math.floor(s.t);
  return `${pad((8 + Math.floor(t / 3600)) % 24, 2)}:${pad(Math.floor(t / 60) % 60, 2)}:${pad(t % 60, 2)}`;
}

/* The IFEI is dead until the battery is on: every window reads blank, which is
   what the drawing now shows underneath. */
const on = s => !!s.power;

/* Elapsed time, the second line under TIME — what the ET button runs. */
function et(s) {
  const t = Math.floor(s.t);
  return `${pad(Math.floor(t / 60) % 60, 2)}:${pad(t % 60, 2)}`;
}

/* Oil pressure is not separately modelled — it is a function of engine speed on
   a real one too, roughly 40 psi at motoring and a little over 100 at idle, and
   a window reading a live number that tracks the engine teaches more than a
   window reading nothing. */
const oil = e => (e.n2 <= 0 ? 0 : 38 + e.n2 * 1.05);

export const gauges = [
  /* ---------------- the displays, dark until they are powered ------------ */
  { id:'scDdiL', view:'front', kind:'screen', x:538, y:244, w:198, h:212,
    name:'LEFT DDI',  lit: s => s.power && s.sw.ddiLBright !== 'off' },
  { id:'scDdiR', view:'front', kind:'screen', x:1143, y:234, w:220, h:217,
    name:'RIGHT DDI', lit: s => s.power && s.sw.ddiRBright !== 'off' },
  { id:'scAmpcd', view:'front', kind:'screen', x:839, y:588, w:209, h:209,
    name:'AMPCD', lit: s => s.power && s.sw.ampcdBright !== 'off' },
  { id:'scIfei', view:'front', kind:'screen', x:598, y:554, w:192, h:121,
    name:'IFEI', led: true, lit: s => s.power },

  /* ---------------- IFEI, the numbers a start-up is flown on -------------
      The chip rects sit on the photograph's own IFEI LCD windows, measured
      off the front view the same way as the control hotspots (see the header
      of controls.js). Re-measure rather than nudge by hand.

      `bare` means the chip has no box of its own — the blanked LCD window it
      sits in is already the box. That also keeps the whole thing clear of the
      MODE / QTY / arrows / ZONE / ET column down the middle of the IFEI.
      ---------------------------------------------------------------------- */
  { id:'dgRpmL', view:'front', kind:'chip', bare:true, x:608, y:557, w:17, h:12,
    name:'RPM % L', read: s => on(s) ? n0(s.eng.L.n2) : '' },
  { id:'dgRpmR', view:'front', kind:'chip', bare:true, x:655, y:557, w:16, h:12,
    name:'RPM % R', read: s => on(s) ? n0(s.eng.R.n2) : '' },
  { id:'dgEgtL', view:'front', kind:'chip', bare:true, x:608, y:573, w:16, h:12,
    name:'EGT °C L', read: s => on(s) ? n0(s.eng.L.egt) : '' },
  { id:'dgEgtR', view:'front', kind:'chip', bare:true, x:657, y:573, w:16, h:12,
    name:'EGT °C R', read: s => on(s) ? n0(s.eng.R.egt) : '' },
  { id:'dgFfL', view:'front', kind:'chip', bare:true, x:610, y:588, w:12, h:10,
    name:'FUEL FLOW L', read: s => on(s) ? n0(s.eng.L.ff / 100) : '' },
  { id:'dgFfR', view:'front', kind:'chip', bare:true, x:660, y:588, w:12, h:10,
    name:'FUEL FLOW R', read: s => on(s) ? n0(s.eng.R.ff / 100) : '' },
  { id:'dgOilL', view:'front', kind:'chip', bare:true, x:610, y:647, w:18, h:13,
    name:'OIL PRESS L', read: s => on(s) ? n0(oil(s.eng.L)) : '' },
  { id:'dgOilR', view:'front', kind:'chip', bare:true, x:653, y:647, w:18, h:13,
    name:'OIL PRESS R', read: s => on(s) ? n0(oil(s.eng.R)) : '' },
  { id:'dgFuelT', view:'front', kind:'chip', bare:true, x:726, y:559, w:52, h:12,
    name:'FUEL TOTAL', read: s => on(s) ? n0(s.fuel) : '' },
  { id:'dgFuelI', view:'front', kind:'chip', bare:true, x:725, y:575, w:52, h:12,
    name:'FUEL INTERNAL', read: s => on(s) ? n0(s.fuel) : '' },
  { id:'dgBingo', view:'front', kind:'chip', bare:true, x:744, y:602, w:18, h:14,
    name:'BINGO', read: s => on(s) ? '0' : '' },
  { id:'dgClock', view:'front', kind:'chip', bare:true, x:730, y:632, w:49, h:12,
    name:'CLOCK', read: s => on(s) ? clock(s) : '' },
  { id:'dgEt', view:'front', kind:'chip', bare:true, x:729, y:647, w:49, h:13,
    name:'ELAPSED TIME', read: s => on(s) ? et(s) : '' },

  /* ---------------- the alignment, where you actually read it ------------ */
  { id:'dgIns', view:'front', kind:'chip', x:841, y:779, w:205, h:17, name:'INS ALIGNMENT',
    read: s => !s.power ? ''
             : !s.ins.mode ? 'INS  OFF'
             : s.ins.complete ? 'GRND QUAL   OK'
             : `GRND QUAL   ${Math.max(0, n0(s.insLeft(s)))}` },

  /* ---------------- standby instruments --------------------------------- */
  { id:'dgStbyAlt', view:'front', kind:'chip', x:1200, y:673, w:43, h:16, name:'STANDBY ALTIMETER',
    read: s => `${n0(s.alt)} FT` },
  { id:'dgStbyAsi', view:'front', kind:'chip', x:1118, y:676, w:28, h:15, name:'STANDBY AIRSPEED',
    read: s => `${n0(s.ias)} KT` },

  /* ---------------- pressures, on their own dials -----------------------
     Needles only. There were digital repeaters beside these three dials and
     they were a mistake: at this scale a chip big enough to read is bigger
     than the gap between the dial and the next placard, so BATTERY VOLTS sat
     across the L GEN switch label. The pointer on the drawn dial is the honest
     readout — it is where you would look in the jet — and the strip along the
     bottom of the screen already carries brake and hydraulic pressure as text.
     ---------------------------------------------------------------------- */
  { id:'ndBrake', view:'front', kind:'needle', x:289, y:996, w:70, h:70,
    name:'BRAKE PRESSURE NEEDLE',
    read: s => s.brakePsi, min: 0, max: 4000, a0: -140, a1: 140 },

  { id:'ndHyd', view:'front', kind:'needle', x:1388, y:945, w:72, h:74,
    name:'HYDRAULIC PRESSURE NEEDLE',
    read: s => (s.hyd.a + s.hyd.b) / 2, min: 0, max: 4000, a0: -140, a1: 140 },
];
