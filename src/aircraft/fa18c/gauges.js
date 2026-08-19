/* ============================================================
   F/A-18C HORNET · INSTRUMENTS
   Live readouts drawn over the view images.

   The layout drawing has numbers printed on it — the IFEI shows 99% RPM and
   8070 lb of fuel whatever the jet is doing. So anything the model actually
   simulates is covered with an opaque chip and rewritten, and the displays
   that should be dark on a cold jet are covered with a screen that only lifts
   when they are powered. A printed 99% on a cold aeroplane is worse than no
   number at all: it is the one reading a student is trying to learn to trust.
   ============================================================ */

export const TAPE_CH = { l: 0, r: 0, w: 0 };   // no tapes on this aeroplane

const n0 = v => Math.round(v);

export const gauges = [
  /* ---------------- IFEI, over the printed panel ---------------- */
  { id:'dgRpm', view:'front', kind:'chip', x:366, y:742, w:118, h:20, name:'RPM % L / R',
    read: s => 'RPM ' + n0(s.eng.L.n2) + ' / ' + n0(s.eng.R.n2) },
  { id:'dgEgt', view:'front', kind:'chip', x:366, y:768, w:118, h:20, name:'EGT °C L / R',
    read: s => 'EGT ' + n0(s.eng.L.egt) + ' / ' + n0(s.eng.R.egt) },
  { id:'dgFf', view:'front', kind:'chip', x:366, y:794, w:118, h:20, name:'FUEL FLOW pph',
    read: s => 'FF ' + n0(s.eng.L.ff) + ' / ' + n0(s.eng.R.ff) },
  { id:'dgFuel', view:'front', kind:'chip', x:366, y:820, w:118, h:20, name:'FUEL',
    read: s => n0(s.fuel) + ' LB' },

  /* ---------------- what is dark until it is powered ---------------- */
  { id:'scDdiL', view:'front', kind:'screen', x:364, y:276, w:190, h:190,
    name:'LEFT DDI',  lit: s => s.power && s.sw.ddiLBright !== 'off' },
  { id:'scDdiR', view:'front', kind:'screen', x:1259, y:276, w:190, h:190,
    name:'RIGHT DDI', lit: s => s.power && s.sw.ddiRBright !== 'off' },
  { id:'scAmpcd', view:'front', kind:'screen', x:810, y:788, w:190, h:190,
    name:'AMPCD', lit: s => s.power && s.sw.ampcdBright !== 'off' },

  /* ---------------- the alignment, where you actually read it ---------------- */
  { id:'dgIns', view:'front', kind:'chip', x:812, y:944, w:186, h:22, name:'INS ALIGNMENT',
    read: s => !s.ins.mode ? 'INS OFF'
             : s.ins.complete ? 'GRND QUAL  OK'
             : 'GRND QUAL  ' + Math.max(0, Math.round(insLeft(s))) + 's' },

  /* ---------------- hydraulics and brakes ---------------- */
  { id:'dgBrake', view:'lower', kind:'chip', x:516, y:892, w:164, h:20, name:'BRAKE PRESSURE',
    read: s => n0(s.brakePsi) + ' PSI' },
  { id:'dgHyd', view:'rcon', kind:'chip', x:82, y:916, w:174, h:20, name:'HYD PRESSURE',
    read: s => 'A ' + n0(s.hyd.a) + '  B ' + n0(s.hyd.b) },
];

/* Seconds left on the alignment. Kept here rather than in systems so the chip
   owns its own formatting and systems.js stays about the aeroplane. */
function insLeft(s) {
  const total = s.ins.mode === 'stored' ? 90 : 480;
  return total - s.ins.t;
}
