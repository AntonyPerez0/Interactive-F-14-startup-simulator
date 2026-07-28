/* Runs headless. No DOM — the sim core and the aircraft modules must
   stay free of browser globals so this keeps working. */
import { aircraft } from '../src/aircraft/registry.js';
import { createSim } from '../src/core/sim.js';

let failures = 0;
const strip = t => t.replace(/<[^>]+>/g, '');
const ok  = (label, cond, detail = '') => {
  if (!cond) failures++;
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label.padEnd(42) + detail);
};
const head = t => console.log('\n' + t + '\n' + '-'.repeat(t.length));

const AC = aircraft[0];
const C  = id => AC.controls.find(c => c.id === id);

/* ---------------------------------------------------------------- helpers */
function harness(procedure) {
  const sim = createSim(AC);
  const S = sim.S;
  const done = procedure.steps.map(() => false);
  const gate = () => {
    for (let j = 0; j < procedure.steps.length; j++) {
      if (done[j]) continue;
      let good = false;
      try { good = procedure.steps[j].done(S); } catch (e) {}
      if (good) { done[j] = true; continue; }
      break;                                   // steps are gated in order
    }
  };
  const run = secs => { for (let i = 0; i < secs * 20; i++) { sim.tick(0.05); gate(); } };
  const click = (id, d = 1) => { sim.click(id, d); run(0.1); };
  const to = (id, v) => {
    const c = C(id), d = c && c.reverse ? -1 : 1;
    let n = 0; while (S.sw[id] !== v && n++ < 10) { sim.click(id, d); run(0.05); }
    n = 0; while (S.sw[id] !== v && n++ < 10) { sim.click(id, -d); run(0.05); }
  };
  const type = str => str.split('').forEach(d => click('cap' + d));
  return { sim, S, done, run, click, to, type, gate,
           left: () => procedure.steps.filter((s, i) => !done[i]) };
}

/* ------------------------------------------------------- pilot start-up */
head('Pilot cold start');
{
  const h = harness(AC.procedures[0]);
  const { S, run, click, to } = h;

  AC.radio(h.sim, 'gpuOn'); AC.radio(h.sim, 'airOn');
  click('ics');
  AC.radio(h.sim, 'jStartup'); run(7); AC.radio(h.sim, 'jLoud');
  click('ejectSeat'); run(4);
  click('oxygen'); run(2);

  to('hydTransfer', 'shutoff');
  h.sim.click('engCrank', -1); run(14); to('throttleR', 'idle'); run(70);
  h.sim.click('engCrank',  1); run(14); to('throttleL', 'idle'); run(70);
  to('hydTransfer', 'norm'); run(8);
  to('airSource', 'both');
  AC.radio(h.sim, 'gpuOff'); AC.radio(h.sim, 'airOff'); run(2);

  const e = S.eng.R;
  ok('idle RPM inside 62-78%',   e.n2 >= 62 && e.n2 <= 78,   e.n2.toFixed(0) + '%');
  ok('idle TIT near 500 C',      e.egt > 450 && e.egt < 550, e.egt.toFixed(0) + ' C');
  ok('idle FF inside 950-1400',  e.ff > 950 && e.ff < 1400,  e.ff.toFixed(0) + ' pph');
  ok('oil pressure 25-35 psi',   e.oil >= 25 && e.oil <= 35, e.oil.toFixed(0) + ' psi');
  ok('both hydraulics 3000 psi', S.hydFlt > 2900 && S.hydComb > 2900);

  to('vdiPower','on'); to('hudPower','on'); to('hsdPower','on'); to('hsdMode','tid');
  S.rate = 16; run(40); S.rate = 1;
  ok('Jester aligns unprompted', S.ins.complete);

  click('gunRate', -1); to('swCool','off'); to('mslPrep','off');
  to('antiSkid','off'); to('afcsPitch','on'); to('afcsRoll','on'); to('afcsYaw','on');
  to('uhfFunc','both'); to('tacanFunc','tr'); to('ara63','on');
  click('radAltKnob'); S.rate = 16; run(60); S.rate = 1;
  ok('RADALT reads 0 after BIT', S.radalt.bitDone && Math.round(S.radalt.value) === 0);
  click('stbyAdi');
  AC.radio(h.sim,'dlMode'); AC.radio(h.sim,'dlHost');
  to('extLights','brt');
  to('wingSweep','detent'); run(12); click('masterReset'); run(12);
  ok('wings driven to 20 deg', S.sweep <= 20.5, S.sweep.toFixed(0) + '°');
  ok('CADC reset by master reset', S.cadcReset);

  ok('all pilot steps complete', h.left().length === 0,
     h.done.filter(Boolean).length + '/' + AC.procedures[0].steps.length);
  h.left().forEach(s => console.log('           missed ' + s.n + '  ' + strip(s.t)));
}

/* --------------------------------------------------------- RIO, both ways */
for (const proc of AC.procedures.filter(p => p.meta.crew === 'rio')) {
  head('RIO · ' + proc.meta.name);
  const h = harness(proc);
  const { S, run, click, to, type } = h;
  S.rioSeat = true;                             // the scripted front-seater runs

  click('rioIcs');
  run(150);
  ok('front-seater got both engines up', S.eng.L.n2 > 60 && S.eng.R.n2 > 60);
  ok('bleed air selected for the WCS', S.sw.airSource === 'both');

  to('liquidCool','fwd'); to('wcsMode','stby'); run(45);
  ok('TID and DDD up after warm-up', S.rio.wcsUp);

  if (proc.meta.variant === 'carrier') {
    to('dlPower','on'); to('dlModeSw','cains'); to('navMode','cva');
    ok('turning through GND did not latch a shore align', S.ins.mode === 'cva', S.ins.mode);
  } else {
    to('navMode','gnd');
    ok('alignment waits for GND ALIGN', S.ins.mode === 'fine');
    click('capClear'); click('cap1'); click('capNE'); type('25014'); click('capEnter');
    click('capClear'); click('cap6'); click('capNE'); type('55226'); click('capEnter');
    click('capClear'); click('cap4'); click('capNE'); type('197');   click('capEnter');
    click('msgMagVar'); click('cap8'); click('capNE'); type('17');   click('capEnter');
    ok('present position accepted', Object.values(S.rio.entered).every(Boolean));
  }

  S.rate = 16; run(45); S.rate = 1;
  ok('alignment reaches full fine', S.ins.complete);
  to('navMode','ins');

  to('rioOxygen','on'); click('ejectSeat'); run(4); S.sw.canopy = 'closed';
  to('vuhfFunc','trg'); to('rioTacanFunc','tr'); click('rioStbyAdi');
  to('irtvPower','stby'); to('alr67Power','on'); to('decmMode','stby');
  to('dlPower','on'); to('dlModeSw','tac'); to('iffMode4','on');
  to('ale39Mode','man'); to('flareMode','pilot');
  to('wcsMode','xmt'); to('irtvPower','on'); run(2);

  ok('all steps complete', h.left().length === 0,
     h.done.filter(Boolean).length + '/' + proc.steps.length);
  h.left().forEach(s => console.log('           missed ' + s.n + '  ' + strip(s.t)));
}

/* ------------------------------------------------------- failure paths */
head('Failure paths');
{
  const h = harness(AC.procedures[0]);
  const { S, run } = h;
  h.sim.click('engCrank', -1);
  ok('crank refused with no power', S.sw.engCrank === 'off');
  AC.radio(h.sim, 'gpuOn'); h.sim.click('engCrank', -1);
  ok('crank refused with no air cart', S.sw.engCrank === 'off');
  AC.radio(h.sim, 'airOn'); h.sim.set('airSource', 'both');
  h.sim.click('engCrank', -1); run(14);
  ok('N2 hangs with bleed air stolen', S.eng.R.n2 < 16, S.eng.R.n2.toFixed(0) + '%');
  ok('hung start logged as a fault', S.faults.some(f => /hung/i.test(f)));
}
{
  const h = harness(AC.procedures[1]);
  const { S, run } = h;
  h.sim.click('cap1'); h.sim.click('capNE');
  '99999'.split('').forEach(d => h.sim.click('cap' + d));
  h.sim.click('capEnter');
  ok('CAP rejects a wrong coordinate', !S.rio.entered.lat);
  ok('bad entry logged as a fault', S.faults.some(f => /CAP entry rejected/.test(f)));
}
{
  const h = harness(AC.procedures[1]);
  const { S, run } = h;
  S.rioSeat = true; run(150);
  h.sim.set('liquidCool','fwd'); h.sim.set('wcsMode','stby'); run(45);
  h.sim.set('navMode','gnd'); run(20);
  const before = AC.insPct(S);
  h.sim.set('parkBrake','off'); run(60);
  ok('brake release hangs the alignment', Math.abs(AC.insPct(S) - before) < 0.001);
}

/* ------------------------------------------------------------- geometry */
head('Geometry and wiring');
{
  const viewsOf = c => c.tray ? []
    : (AC.sharedViews[c.view] || [c.view]);
  let overlaps = 0;
  for (const v of AC.views.map(v => v.id)) {
    const cs = AC.controls.filter(c => viewsOf(c).includes(v) && c.x != null);
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 2 && oy > 2) { overlaps++; console.log('           ' + v + ': ' + a.id + ' / ' + b.id); }
    }
  }
  ok('no overlapping hotspots in any view', overlaps === 0);

  const ids = new Set(AC.controls.map(c => c.id).concat(AC.gauges.map(g => g.id)));
  let unresolved = 0;
  AC.procedures.forEach(p => p.steps.forEach(s => {
    if (s.tgt && !s.tgt.startsWith('comms:') && !ids.has(s.tgt)) {
      unresolved++; console.log('           ' + p.meta.id + ' step ' + s.n + ' -> ' + s.tgt);
    }
  }));
  ok('every step target resolves', unresolved === 0);

  let holes = 0;
  AC.procedures.forEach(p => { for (let i = 0; i < p.steps.length; i++) if (!p.steps[i]) holes++; });
  ok('no holes in any step list', holes === 0);

  const leaks = AC.controls.filter(c => c.view === 'pilotBoth')
    .filter(c => (AC.sharedViews.pilotBoth || []).some(v => v.startsWith('rio')));
  ok('shared controls stay in the pilot pit', leaks.length === 0);
}

console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'all checks passed'));
process.exit(failures ? 1 : 0);
