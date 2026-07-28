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
  const kb = (open, page) => { S.kb.open = open; if (page != null) S.kb.page = page; gate(); };
  return { sim, S, done, run, click, to, type, gate, kb,
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
  const { S, run, click, to, type, kb } = h;
  S.rioSeat = true;                             // the scripted front-seater runs

  click('rioIcs');
  run(150);
  ok('front-seater got both engines up', S.eng.L.n2 > 60 && S.eng.R.n2 > 60);
  ok('bleed air selected for the WCS', S.sw.airSource === 'both');

  to('liquidCool','fwd'); to('wcsMode','stby'); run(45);
  ok('TID and DDD up after warm-up', S.rio.wcsUp);

  if (proc.meta.variant === 'carrier') {
    kb(true, 1);
    to('dlPower','on'); to('dlFreq','209'); kb(false);
    to('dlModeSw','cains'); to('navMode','cva');
    ok('turning through GND did not latch a shore align', S.ins.mode === 'cva', S.ins.mode);
  } else {
    to('navMode','gnd');
    ok('alignment waits for GND ALIGN', S.ins.mode === 'fine');
    kb(true, 0);
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
  kb(true, 1);
  to('dlPower','on'); to('dlModeSw','tac'); to('dlFreq','092'); kb(false);
  to('iffMode4','on');
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

/* ------------------------------------------------- CAP entry cue sequence */
head('CAP data entry cue');
{
  const shore = AC.procedures.find(p => p.meta.variant === 'shore');
  const cases = [
    ['Enter latitude',  ['capClear','cap1','capNE','cap2','cap5','cap0','cap1','cap4','capEnter']],
    ['Enter longitude', ['capClear','cap6','capNE','cap5','cap5','cap2','cap2','cap6','capEnter']],
    ['Enter altitude',  ['capClear','cap4','capNE','cap1','cap9','cap7','capEnter']],
    ['Message button',  ['msgMagVar','cap8','capNE','cap1','cap7','capEnter']],
  ];
  const sim = createSim(AC);
  for (const [label, seq] of cases) {
    const step = shore.steps.find(s => s.t.includes(label));
    let good = true, trace = [];
    for (const expect of seq) {
      const got = typeof step.tgt === 'function' ? step.tgt(sim.S) : step.tgt;
      trace.push(got);
      if (got !== expect) good = false;
      sim.click(expect, 1);
    }
    ok('cue walks ' + label.toLowerCase(), good, trace.join(' '));
  }
}

/* --------------------------------------------------- kneeboard integrity */
head('Kneeboard');
{
  const kbp = AC.kneeboard.pages;
  ok('has the two pages the guide uses', kbp.length === 2,
     kbp.map(p => p.id).join(', '));

  // the figures printed on GROUND SETTINGS must be the ones the CAP will take
  const ground = kbp.find(p => p.id === 'ground');
  const printed = Object.fromEntries(ground.rows.map(([k, v]) => [k, v]));
  const digits = s => s.replace(/[^0-9]/g, '');
  const sim = createSim(AC);
  const enter = (field, keys) => {
    sim.click('capClear'); sim.click(field); sim.click('capNE');
    keys.split('').forEach(d => sim.click('cap' + d));
    sim.click('capEnter');
  };
  enter('cap1', digits(printed['LATITUDE']));
  enter('cap6', digits(printed['LONGITUDE']));
  enter('cap4', digits(printed['ELEVATION']));
  sim.click('msgMagVar');
  sim.click('cap8'); sim.click('capNE');
  digits(printed['MAGNETIC VARIATION']).split('').forEach(d => sim.click('cap' + d));
  sim.click('capEnter');
  ok('CAP accepts the printed coordinates',
     Object.values(sim.S.rio.entered).every(Boolean),
     JSON.stringify(sim.S.rio.entered));

  // the wheel column must match the frequency column
  const dl = kbp.find(p => p.id === 'datalink');
  // the wheels show the frequency with the fixed leading 3 and the trailing
  // zero dropped: 320.90 -> 20.9, 309.20 -> 09.2, 316.60 -> 16.6
  const wheelsOk = dl.table.rows.every(([, freq, wheels]) => freq.slice(1, -1) === wheels);
  ok('wheel settings match the frequencies', wheelsOk,
     dl.table.rows.map(r => r[1] + '->' + r[2]).join('  '));

  // and the wheel values must exist as states on the physical control
  const ctl = AC.controls.find(c => c.id === 'dlFreq');
  const missing = dl.table.rows
    .map(([, , w]) => w.replace('.', ''))
    .filter(w => !ctl.states.includes(w));
  ok('every printed wheel setting is selectable', missing.length === 0, missing.join(', '));
}

/* ------------------------------------------------ Show me framing */
head('Show me framing');
{
  const find = id => AC.controls.find(c => c.id === id) || AC.gauges.find(g => g.id === id);
  const frame = (rects, W = 1400, H = 790, maxZoom = 1.35) => {
    const pad = 70;
    const x0 = Math.min(...rects.map(r => r.x)) - pad, y0 = Math.min(...rects.map(r => r.y)) - pad;
    const x1 = Math.max(...rects.map(r => r.x + (r.w || 40))) + pad;
    const y1 = Math.max(...rects.map(r => r.y + (r.h || 40))) + pad;
    const fit = Math.min(W / 1920, H / 1080);
    const z = Math.max(Math.min(maxZoom, W / (x1 - x0), H / (y1 - y0)), fit);
    const panX = W / 2 - ((x0 + x1) / 2) * z, panY = H / 2 - ((y0 + y1) / 2) * z;
    return { z, vis: r => panX + r.x * z >= -2 && panY + r.y * z >= -2 &&
      panX + (r.x + (r.w || 40)) * z <= W + 2 && panY + (r.y + (r.h || 40)) * z <= H + 2 };
  };
  const withCtx = AC.controls.filter(c => c.ctx);
  let hidden = 0, maxZoom = 0;
  withCtx.forEach(c => {
    const rects = [c].concat([].concat(c.ctx).map(find).filter(Boolean));
    const f = frame(rects);
    maxZoom = Math.max(maxZoom, f.z);
    rects.forEach(r => { if (!f.vis(r)) { hidden++; console.log('           ' + c.id + ' hides ' + (r.id || '?')); } });
  });
  ok('controls declaring a readout keep it framed', hidden === 0,
     withCtx.length + ' controls, zoom <= ' + maxZoom.toFixed(2));
  ok('every ctx reference resolves',
     withCtx.every(c => [].concat(c.ctx).every(id => !!find(id))));
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
  const probe = createSim(AC).S;
  let unresolved = 0;
  AC.procedures.forEach(p => p.steps.forEach(s => {
    if (!s.tgt) return;
    // a target may be a function of state, for multi-press sequences
    const t = typeof s.tgt === 'function' ? s.tgt(probe) : s.tgt;
    if (t && !t.startsWith('comms:') && !ids.has(t)) {
      unresolved++; console.log('           ' + p.meta.id + ' step ' + s.n + ' -> ' + t);
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
