/* ============================================================
   F-14B · INSTRUMENTS
   Tape geometry measured off the photo: each vertical tape has two
   indicator channels (L at +0px, R at +37px, 10px wide) running
   from the top of the scale down to zero. The scales are not linear
   — each has a compressed low segment and an expanded working range,
   with breakpoints taken from the printed numbers.
   ============================================================ */

export const TAPE_CH = { l: 0, r: 37, w: 10 };

const seg = (v, a, b, fa, fb) => fa + ((v - a) / (b - a)) * (fb - fa);

export const gauges = [
  /* ---------------- pilot front panel: engine cluster ---------------- */
  { id:'tapeRpm', view:'front', kind:'tape', x:485, y:737, w:56, h:193,
    name:'RPM %', empty:'#191a1a', bar:'#b8b5b0',
    read: s => [s.eng.L.n2, s.eng.R.n2],
    frac: v => v <= 60 ? seg(v, 0, 60, 0, 0.223) : seg(Math.min(v, 110), 60, 110, 0.223, 1),
    fmt: (l, r) => Math.round(l) + '/' + Math.round(r) },

  { id:'tapeTit', view:'front', kind:'tape', x:559, y:739, w:56, h:194,
    name:'TIT °C', empty:'#2b363e', bar:'#b2bbc1',
    read: s => [s.eng.L.egt, s.eng.R.egt],
    frac: v => v <= 600 ? seg(v, 0, 600, 0, 0.155) : seg(Math.min(v, 1400), 600, 1400, 0.155, 1),
    fmt: (l, r) => Math.round(l) + '/' + Math.round(r) },

  { id:'tapeFf', view:'front', kind:'tape', x:633, y:737, w:56, h:196,
    name:'FUEL FLOW pph', empty:'#374047', bar:'#c6d0d7',
    read: s => [s.eng.L.ff, s.eng.R.ff],
    frac: v => v <= 5000 ? seg(v, 0, 5000, 0, 0.617) : seg(Math.min(v, 13000), 5000, 13000, 0.617, 1),
    fmt: (l, r) => (l / 1000).toFixed(1) + '/' + (r / 1000).toFixed(1) },

  /* readouts sit on the face of the instrument they belong to */
  { id:'dgNoz', view:'front', kind:'chip', x:339, y:769, w:130, h:20, name:'NOZZLE',
    read: s => 'NOZ ' + Math.round(s.eng.L.noz) + '/' + Math.round(s.eng.R.noz) + ' %' },
  { id:'dgOil', view:'front', kind:'chip', x:339, y:828, w:130, h:20, name:'OIL PRESSURE',
    read: s => 'OIL ' + Math.round(s.eng.L.oil) + '/' + Math.round(s.eng.R.oil) + ' PSI' },
  { id:'dgHyd', view:'front', kind:'chip', x:339, y:910, w:130, h:20, name:'HYD PRESSURE',
    read: s => 'CMB' + Math.round(s.hydComb) + ' FLT' + Math.round(s.hydFlt) },   // COMP left, FLT right, as on the dial
  { id:'dgRadalt', view:'front', kind:'chip', x:280, y:498, w:112, h:20, name:'RADAR ALTIMETER',
    read: s => 'RALT ' + Math.round(s.radalt.value) + ' FT' },
  /* Pointer over the radar altimeter dial, pivot (327,524) r80, set by hand in
     Calibrate. Zero at the top, full scale 350 degrees clockwise. */
  { id:'ndRadalt', view:'front', kind:'needle', x:247, y:444, w:160, h:160,
    name:'RADAR ALTIMETER NEEDLE',
    lit: s => s.power && s.sw.radAltKnob === 'on',
    read: s => s.radalt.value, min: 0, max: 5000, a0: 0, a1: 350 },
  // the ELEV LEAD window sits just above the knob
  { id:'dgElevLead', view:'front', kind:'chip', x:1843, y:920, w:60, h:22,
    name:'ELEV LEAD', read: s => s.sw.gunLead + '+' },
  { id:'dgFuel', view:'front', kind:'chip', x:1306, y:812, w:100, h:20, name:'FUEL',
    read: s => Math.round(s.fuel) + ' LB' },

  /* ---------------- displays that go dark without power ---------------- */
  { id:'scVdi', view:'front', kind:'screen', x:822, y:302, w:284, h:296,
    name:'VDI', lit: s => s.power && s.sw.vdiPower === 'on' },
  { id:'scHsd', view:'front', kind:'screen', x:804, y:714, w:312, h:332,
    name:'HSD', lit: s => s.power && s.sw.hsdPower === 'on', ins: true },
  { id:'scUhfA', view:'front', kind:'screen', x:1446, y:266, w:128, h:36,
    name:'UHF', led: true, lit: s => s.power },

  { id:'scUhfB', view:'consoles', kind:'screen', x:449, y:483, w:134, h:38,
    name:'UHF', led: true, lit: s => s.power },
  { id:'scVdiC', view:'consoles', kind:'screen', x:822, y:302, w:284, h:296,
    name:'VDI', lit: s => s.power && s.sw.vdiPower === 'on' },
  { id:'scHsdC', view:'consoles', kind:'screen', x:804, y:714, w:312, h:332,
    name:'HSD', lit: s => s.power && s.sw.hsdPower === 'on', ins: true },
];

/* ---------------- RIO displays, identical position in all three photos ----------------
   TID bezel measured at (959,630) r199. DDD raster is the largest connected
   green region: x 880-1054, y 118-269 — not the bounding box of all green,
   which wrongly swept in the lit RDR and PULSE STT buttons. */
for (const v of ['rioL', 'rioC', 'rioR']) {
  gauges.push(
    { id:'scTid_' + v, view:v, kind:'screen', x:768, y:439, w:382, h:382,
      name:'TID', lit: s => s.power && s.rio.wcsUp, ins: true, tid: true, round: true },
    { id:'scDdd_' + v, view:v, kind:'screen', x:874, y:112, w:188, h:164,
      name:'DDD', lit: s => s.power && s.rio.wcsUp },
    { id:'dgCap_' + v, view:v, kind:'chip', x:800, y:450, w:320, h:22,
      name:'CAP ENTRY', read: s => s.rio.capLine },
  );
}
