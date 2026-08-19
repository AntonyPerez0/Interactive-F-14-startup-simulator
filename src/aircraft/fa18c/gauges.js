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

export const gauges = [
  /* ---------------- the displays, dark until they are powered ------------ */
  { id:'scDdiL', view:'front', kind:'screen', x:370, y:249, w:260, h:272,
    name:'LEFT DDI',  lit: s => s.power && s.sw.ddiLBright !== 'off' },
  { id:'scDdiR', view:'front', kind:'screen', x:1204, y:249, w:260, h:272,
    name:'RIGHT DDI', lit: s => s.power && s.sw.ddiRBright !== 'off' },
  { id:'scAmpcd', view:'front', kind:'screen', x:744, y:699, w:320, h:310,
    name:'AMPCD', lit: s => s.power && s.sw.ampcdBright !== 'off' },
  { id:'scIfei', view:'front', kind:'screen', x:391, y:647, w:275, h:195,
    name:'IFEI', led: true, lit: s => s.power },

  /* ---------------- IFEI, the numbers a start-up is flown on ------------- */
  { id:'dgRpm', view:'front', kind:'chip', x:399, y:657, w:255, h:24, name:'RPM % L / R',
    read: s => s.power ? `RPM ${n0(s.eng.L.n2)} ${n0(s.eng.R.n2)}` : '' },
  { id:'dgEgt', view:'front', kind:'chip', x:399, y:687, w:255, h:24, name:'EGT °C L / R',
    read: s => s.power ? `EGT ${n0(s.eng.L.egt)} ${n0(s.eng.R.egt)}` : '' },
  { id:'dgFf', view:'front', kind:'chip', x:399, y:717, w:255, h:24, name:'FUEL FLOW pph',
    read: s => s.power ? `FF  ${n0(s.eng.L.ff)} ${n0(s.eng.R.ff)}` : '' },
  { id:'dgFuel', view:'front', kind:'chip', x:399, y:747, w:255, h:24, name:'FUEL QUANTITY',
    read: s => s.power ? `${n0(s.fuel)} LB` : '' },
  { id:'dgClock', view:'front', kind:'chip', x:399, y:777, w:255, h:24, name:'CLOCK',
    read: s => s.power ? clock(s) : '' },

  /* ---------------- the alignment, where you actually read it ------------ */
  { id:'dgIns', view:'front', kind:'chip', x:752, y:962, w:300, h:24, name:'INS ALIGNMENT',
    read: s => !s.power ? ''
             : !s.ins.mode ? 'INS  OFF'
             : s.ins.complete ? 'GRND QUAL   OK'
             : `GRND QUAL   ${Math.max(0, n0(s.insLeft(s)))}` },

  /* ---------------- standby instruments --------------------------------- */
  { id:'dgStbyAlt', view:'front', kind:'chip', x:1294, y:872, w:106, h:20, name:'STANDBY ALTIMETER',
    read: s => `${n0(s.alt)} FT` },
  { id:'dgStbyAsi', view:'front', kind:'chip', x:1145, y:872, w:106, h:20, name:'STANDBY AIRSPEED',
    read: s => `${n0(s.ias)} KT` },

  /* ---------------- pressures, on their own dials ----------------------- */
  { id:'dgBrake', view:'panels', kind:'chip', x:498, y:250, w:58, h:14, name:'BRAKE PRESSURE',
    read: s => `${n0(s.brakePsi / 100) / 10}k` },
  { id:'ndBrake', view:'panels', kind:'needle', x:506, y:209, w:41, h:38,
    name:'BRAKE PRESSURE NEEDLE',
    read: s => s.brakePsi, min: 0, max: 4000, a0: -140, a1: 140 },

  { id:'dgHyd', view:'panels', kind:'chip', x:1336, y:234, w:62, h:14, name:'HYD PRESSURE',
    read: s => `${n0(s.hyd.a / 100) / 10}/${n0(s.hyd.b / 100) / 10}k` },
  { id:'ndHyd', view:'panels', kind:'needle', x:1344, y:191, w:46, h:42,
    name:'HYDRAULIC PRESSURE NEEDLE',
    read: s => (s.hyd.a + s.hyd.b) / 2, min: 0, max: 4000, a0: -140, a1: 140 },

  { id:'dgCabin', view:'panels', kind:'chip', x:998, y:228, w:70, h:14, name:'CABIN ALTITUDE',
    read: s => `${n0(s.cabinAlt / 1000)}k FT` },
  { id:'dgBatt', view:'panels', kind:'chip', x:1356, y:316, w:60, h:14, name:'BATTERY VOLTS',
    read: s => `${(s.power ? 24.5 : 0).toFixed(1)}V` },
  { id:'dgRadalt', view:'panels', kind:'chip', x:1340, y:172, w:76, h:14, name:'RADAR ALTIMETER',
    read: s => s.power ? `${n0(s.radalt)} FT` : 'OFF' },
];
