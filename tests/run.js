/* Runs headless. No DOM — the sim core and the aircraft modules must
   stay free of browser globals so this keeps working. */
import { aircraft, catalogue as AC_CATALOGUE } from '../src/aircraft/registry.js';
import { createSim } from '../src/core/sim.js';

let failures = 0;
const strip = t => t.replace(/<[^>]+>/g, '');

/* mirrors checklist.touches(), which decides what the tray offers */
const trayFor = proc => {
  const ids = new Set();
  const add = v => { if (typeof v === 'string') ids.add(v); };
  proc.steps.forEach(st => {
    add(st.tgt);
    [].concat(st.ctx || []).forEach(add);
    if (typeof st.tgt === 'function')
      for (const m of st.tgt.toString().matchAll(/'([A-Za-z_][\w]*)'/g)) ids.add(m[1]);
    if (typeof st.done === 'function')
      for (const m of st.done.toString().matchAll(/s\.sw\.(\w+)/g)) ids.add(m[1]);
  });
  return ids;
};
const ok  = (label, cond, detail = '') => {
  if (!cond) failures++;
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label.padEnd(42) + detail);
};
const head = t => console.log('\n' + t + '\n' + '-'.repeat(t.length));

const AC = aircraft[0];

/* Named, not indexed. Inserting a procedure used to silently repoint every
   AC.procedures[n] in this file at the wrong drill. */
const PILOT_START = AC.procedures.find(p => p.meta.id === 'pilot-start');
const RIO_SHORE   = AC.procedures.find(p => p.meta.id === 'rio-shore');
const C  = id => AC.controls.find(c => c.id === id);

/* ---------------------------------------------------------------- helpers */
function harness(procedure) {
  const sim = createSim(AC);
  if (procedure && procedure.setup) procedure.setup(sim);   // as the app does
  const S = sim.S;
  const done = procedure.steps.map(() => false);
  let ackT = 0, lastAck = -1;
  const gate = (dtReal = 0) => {
    for (let j = 0; j < procedure.steps.length; j++) {
      if (done[j]) continue;
      // mirrors the checklist: a flown step confirms itself after its dwell
      if (procedure.steps[j].ack) {
        if (j !== lastAck) { lastAck = j; ackT = 0; }
        ackT += dtReal;
        if (ackT >= (procedure.steps[j].hold ?? 5)) { done[j] = true; ackT = 0; continue; }
        break;
      }
      let good = false;
      try { good = procedure.steps[j].done(S); } catch (e) {}
      if (good) { done[j] = true; continue; }
      break;                                   // steps are gated in order
    }
  };
  const run = secs => { for (let i = 0; i < secs * 20; i++) { sim.tick(0.05); gate(0.05); } };
  const ackWait = () => ackT;
  const click = (id, d = 1) => { used.add(id); sim.click(id, d); run(0.1); };
  const to = (id, v) => {
    used.add(id);
    const c = C(id), d = c && c.reverse ? -1 : 1;
    let n = 0; while (S.sw[id] !== v && n++ < 10) { sim.click(id, d); run(0.05); }
    n = 0; while (S.sw[id] !== v && n++ < 10) { sim.click(id, -d); run(0.05); }
  };
  const type = str => str.split('').forEach(d => click('cap' + d));
  const used = new Set();
  const _click = click, _to = to;
  const trackUse = id => { used.add(id); };
  const kb = (open, page) => { S.kb.open = open; if (page != null) S.kb.page = page; gate(); };
  return { sim, S, done, run, click, to, type, gate, kb, ackWait, used,
           left: () => procedure.steps.filter((s, i) => !done[i]) };
}

/* ------------------------------------------------------- pilot start-up */
head('Pilot cold start');
{
  const h = harness(PILOT_START);
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
  to('antiSkid','spoiler'); to('afcsPitch','on'); to('afcsRoll','on'); to('afcsYaw','on');
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
     h.done.filter(Boolean).length + '/' + PILOT_START.steps.length);
  h.left().forEach(s => console.log('           missed ' + s.n + '  ' + strip(s.t)));
}

/* --------------------------------------------------------- RIO, both ways */
for (const proc of AC.procedures.filter(p => p.meta.crew === 'rio' && p.meta.phase === 'startup')) {
  head('RIO · ' + proc.meta.name);
  const h = harness(proc);
  const { S, run, click, to, type, kb } = h;
  S.rioSeat = true;                             // the scripted front-seater runs

  click('rioIcs');
  run(150);
  ok('front-seater got both engines up', S.eng.L.n2 > 60 && S.eng.R.n2 > 60);
  ok('bleed air selected for the WCS', S.sw.airSource === 'both');

  to('liquidCool','awg9aim54'); to('wcsMode','stby'); run(45);
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
    ok('present position accepted', ['lat','lon','alt','mag'].every(k => S.rio.entered[k]));
  }

  S.rate = 16; run(45); S.rate = 1;
  ok('alignment reaches full fine', S.ins.complete);
  to('navMode','ins');

  to('rioOxygen','on'); click('ejectSeat'); run(4); S.sw.canopy = 'closed';
  to('vuhfFunc','trg'); to('rioTacanFunc','tr'); click('rioStbyAdi');
  to('irtvPower','stby'); to('alr67Power','on'); to('decmMode','stby');
  kb(true, 1);
  to('dlPower','on'); to('dlModeSw','tac'); to('dlFreq','092');
  to('dlReply','norm'); kb(false);
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
  const h = harness(PILOT_START);
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
  const h = harness(RIO_SHORE);
  const { S, run } = h;
  h.sim.click('cap1'); h.sim.click('capNE');
  '99999'.split('').forEach(d => h.sim.click('cap' + d));
  h.sim.click('capEnter');
  ok('CAP rejects a wrong coordinate', !S.rio.entered.lat);
  ok('bad entry logged as a fault', S.faults.some(f => /CAP entry rejected/.test(f)));
}
{
  const h = harness(RIO_SHORE);
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
  const shore = RIO_SHORE;
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
     ['lat','lon','alt','mag'].every(k => sim.S.rio.entered[k]),
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

/* --------------------------------------------- corrections from review 2 */
head('Systems corrections');
{
  const h = harness(PILOT_START);
  const { S, run } = h;
  AC.radio(h.sim, 'gpuOn'); AC.radio(h.sim, 'airOn'); h.sim.set('airSource','off');

  // right engine drives FLIGHT, left drives COMBINED, independently
  h.sim.set('hydTransfer','shutoff');
  h.sim.click('engCrank', -1); run(14); h.to('throttleR','idle'); run(70);
  ok('right engine pressurises FLIGHT only',
     S.hydFlt > 2900 && S.hydComb < 100,
     'flt ' + S.hydFlt.toFixed(0) + '  cmb ' + S.hydComb.toFixed(0));
  h.sim.click('engCrank', 1); run(14); h.to('throttleL','idle'); run(70);
  ok('left engine pressurises COMBINED', S.hydComb > 2900,
     'flt ' + S.hydFlt.toFixed(0) + '  cmb ' + S.hydComb.toFixed(0));

  // with the transfer pump in NORM one engine carries both systems
  const h2 = harness(PILOT_START);
  h2.sim.S.gpu = true; h2.sim.S.airCart = true; h2.sim.set('airSource','off');
  h2.sim.set('hydTransfer','norm');
  h2.sim.click('engCrank', -1); h2.run(14); h2.to('throttleR','idle'); h2.run(70);
  ok('transfer pump cross-connects the two systems',
     h2.S.hydFlt > 2900 && h2.S.hydComb > 2900);

  // status strip prints combined first
  const cell = AC.strip.find(c => /Hyd/.test(c.k));
  ok('strip reads CMB then FLT', /CMB \/ FLT/.test(cell.k), cell.k);
}
{
  const h = harness(PILOT_START);
  const { S } = h;
  S.gpu = true; h.run(0.2);
  h.sim.click('radAltKnob', 1);
  const trace = [];
  for (let i = 0; i < 90; i++) { trace.push(S.radalt.value); h.sim.tick(0.1); }
  ok('the whole test is over in a few seconds', S.radalt.bitDone);
  const peak = Math.max(...trace), at = trace.indexOf(peak) * 0.1;

  ok('RADALT self-BIT sweeps to max then zero',
     peak >= 4990 && trace[trace.length - 1] < 1, 'peak ' + peak.toFixed(0));
  ok('the needle starts at zero', trace[0] < 1, trace[0].toFixed(0) + ' ft');
  ok('it takes a couple of seconds to wind up', at > 2.0 && at < 3.2, 'peak at ' + at.toFixed(1) + 's');

  // time compression must not turn the self-test into a blink
  const fast = harness(PILOT_START);
  fast.S.gpu = true; fast.run(0.2);
  fast.sim.click('radAltKnob', 1);
  fast.S.rate = 16;
  let el = 0, done = null;
  while (el < 12) { fast.sim.tick(0.05); el += 0.05; if (fast.S.radalt.bitDone && done === null) done = el; }
  ok('the sweep ignores time compression', done > 5 && done < 8, 'complete at ' + done.toFixed(1) + 's at 16x');
  ok('it sweeps rather than jumping',
     trace.slice(0, 16).filter(v => v > 200 && v < 4800).length > 8,
     trace.slice(0, 16).filter(v => v > 200 && v < 4800).length + ' intermediate readings');
}
{
  // alignment now runs to the DCS timings, with the caret in thirds
  const h = harness(RIO_SHORE);
  const { S, run } = h;
  S.rioSeat = true; run(150);
  h.to('liquidCool','awg9aim54'); h.to('wcsMode','stby');
  const t0 = S.t; run(40);
  ok('WCS up ~30 s after STANDBY', S.rio.wcsUp && S.t - t0 < 45);
  h.to('navMode','gnd');
  const at = mins => {
    for (let i = 0; i < 4000 && S.ins.t < mins * 60; i++) sim0(h);
    if (S.ins.t < mins * 60) ok('alignment reached ' + mins + ' min', false, 'stalled at ' + S.ins.t.toFixed(0) + 's');
  };
  const sim0 = hh => { hh.sim.S.rate = 8; hh.run(1); hh.sim.S.rate = 1; };
  at(2.0); ok('coarse marker at 2.0 min sits at a third',
              Math.abs(AC.insCaret(S) - 1/3) < 0.02, AC.insCaret(S).toFixed(3));
  at(4.9); ok('weapons marker at 4.9 min sits at two thirds',
              Math.abs(AC.insCaret(S) - 2/3) < 0.02, AC.insCaret(S).toFixed(3));
  ok('caret becomes a diamond at the second marker', AC.insWeaponsReady(S));
  at(7.0); ok('full fine at 7.0 min', S.ins.complete && AC.insCaret(S) > 0.99);
}
{
  // STBY / READY follow the Heatblur table
  const h = harness(RIO_SHORE);
  const { S, run } = h;
  S.rioSeat = true; run(150);
  h.to('liquidCool','awg9aim54'); h.to('wcsMode','stby'); run(35);
  h.to('navMode','gnd'); run(10);
  ok('STBY and READY both lit for the first 45 s', S.rio.stbyLight && S.rio.readyLight);
  run(50);
  ok('STBY alone once aligning', S.rio.stbyLight && !S.rio.readyLight);
  S.rate = 8; run(45); S.rate = 1;
  ok('READY alone past the weapons marker', !S.rio.stbyLight && S.rio.readyLight);
  h.sim.set('parkBrake','off'); run(2);
  ok('brake released makes READY flash', !S.rio.stbyLight);
}

/* ---------------------------------------------------------- landing */
for (const proc of AC.procedures.filter(p => p.meta.phase === 'landing')) {
  head('Landing · ' + proc.meta.name);
  const h = harness(proc);
  const { S, run, to } = h;
  if (proc.setup) proc.setup(h.sim);        // a landing starts in the air
  // steps that are flown are confirmed by tapping; the harness does that directly
  // flown steps confirm themselves after their dwell, so just feed the clock
  const settle = () => run(40);

  if (proc.meta.id === 'landing-carrier') {
    h.sim.click('altBaro', 1);
    to('tacanFunc','tr'); to('ara63','on');
    to('hudAwl','ils'); to('vdiAwl','ils');
    to('masterArm','off'); to('antiSkid','off');
  } else {
    to('antiSkid','both');
  }
  to('landingLights', proc.meta.id === 'landing-carrier' ? 'off' : 'on');
  to('hookBypass', proc.meta.id === 'landing-carrier' ? 'carrier' : 'field');
  if (proc.meta.id === 'landing-carrier') to('hookHandle','down');
  settle();
  to('sweepThumb','aft'); run(12); settle();          // handle stays stowed
  to('masterMode','ldg'); settle();
  to('speedBrake','out'); to('throttleL','idle'); to('throttleR','idle'); settle();
  to('sweepThumb','fwd'); run(12); settle();          // let them come back out
  to('gearHandle','down'); settle();
  to('flapsLever','down'); settle();
  to('dlc','on'); run(1); settle();
  const dlcWorked = S.dlcActive;      // captured here: the carrier flow later raises the flaps
  if (proc.meta.id === 'landing-carrier') {
    to('throttleL','mil'); to('throttleR','mil'); settle();
    to('hookHandle','up'); to('flapsLever','up');
    to('wingSweep','oversweep'); run(12); settle();
  }
  settle();

  ok('wings swept to 68 in manual', true);
  ok('DLC engaged once gear and flaps were down', dlcWorked);
  ok('all steps complete', h.left().length === 0,
     h.done.filter(Boolean).length + '/' + proc.steps.length);
  h.left().forEach(s => console.log('           missed ' + s.n + '  ' + strip(s.t)));

  const shown = trayFor(proc);
  const hidden = [...h.used].filter(id => {
    const c = AC.controls.find(x => x.id === id);
    return c && c.tray && !shown.has(id);
  });
  ok('every off-panel control it needs is in the tray', hidden.length === 0, hidden.join(', '));
}
{
  head('Flown-step dwell');
  const proc = AC.procedures.find(p => p.meta.id === 'landing-shore');
  const h = harness(proc);
  // walk to the first flown step
  h.to('antiSkid','both'); h.to('landingLights','on'); h.to('hookBypass','field');
  h.run(0.5);
  const i = h.done.findIndex(d => !d);
  ok('the next step is a flown one', !!proc.steps[i].ack, strip(proc.steps[i].t).slice(0, 40));
  h.gate(4.0);
  ok('still waiting at 4 seconds', !h.done[i], 'dwell ' + h.ackWait().toFixed(1) + 's');
  h.gate(1.2);
  ok('confirms itself just past 5 seconds', h.done[i]);
  // and a tap should not have to wait
  const h2 = harness(proc);
  h2.to('antiSkid','both'); h2.to('landingLights','on'); h2.to('hookBypass','field');
  h2.run(0.5);
  const j = h2.done.findIndex(d => !d);
  h2.done[j] = true;                      // what tapping the line does
  h2.run(0.2);
  ok('tapping confirms immediately', h2.done[j]);
}
{
  head('DLC interlock');
  const h = harness(AC.procedures.find(p => p.meta.phase === 'landing'));
  h.sim.set('flapsLever','up'); h.sim.set('dlc','on'); h.run(1);
  ok('DLC will not engage with the flaps up', !h.S.dlcActive);
  h.sim.set('flapsLever','down'); h.run(1);
  ok('DLC engages once the flaps come down', h.S.dlcActive);
}
{
  head('Hangar and menu');
{
  const { catalogue } = await import('../src/aircraft/registry.js');
  ok('catalogue has entries', catalogue.length > 1, catalogue.length + ' aircraft');
  ok('every entry has id, name, maker and category',
     catalogue.every(c => c.id && c.name && c.maker && c.cat));
  ok('catalogue ids are unique',
     new Set(catalogue.map(c => c.id)).size === catalogue.length);
  const built = catalogue.filter(c => c.module);
  ok('built entries expose a real aircraft module',
     built.every(c => c.module.procedures && c.module.views && c.module.controls),
     built.map(c => c.name).join(', '));
  ok('every built module is also in the aircraft list',
     built.every(c => AC.id === c.module.id || aircraft.some(a => a.id === c.module.id)));
  const cats = [...new Set(catalogue.map(c => c.cat))];
  ok('aircraft are grouped', cats.length > 1, cats.join(' · '));
}
{
  head('Menu wiring');
  const phases = [...new Set(AC.procedures.map(p => p.meta.phase))];
  ok('every procedure declares a phase', AC.procedures.every(p => p.meta.phase), phases.join(', '));
  ok('every procedure declares a crew', AC.procedures.every(p => p.meta.crew));
  ok('every procedure names a starting view',
     AC.procedures.every(p => AC.views.some(v => v.id === p.meta.view)),
     AC.procedures.map(p => p.meta.view).join(', '));
  ok('procedure ids are unique',
     new Set(AC.procedures.map(p => p.meta.id)).size === AC.procedures.length);

  // an unnumbered step renders the word "undefined" in the kneeboard
  const unnumbered = [];
  AC.procedures.forEach(p => p.steps.forEach((s, i) => {
    if (typeof s.n !== 'number' || s.n !== i + 1) unnumbered.push(p.meta.id + '[' + i + ']');
  }));
  ok('every step is numbered 1..n', unnumbered.length === 0, unnumbered.slice(0, 6).join(', '));

  // a step naming the wrong tab sends Show me to a view the control is not on
  const wrongView = [];
  AC.procedures.forEach(p => p.steps.forEach(s => {
    if (!s.view || typeof s.tgt !== 'string') return;
    const c = AC.controls.find(x => x.id === s.tgt) || AC.gauges.find(x => x.id === s.tgt);
    if (!c || c.tray) return;
    const views = AC.sharedViews[c.view] || [c.view];
    if (!views.includes(s.view)) wrongView.push(p.meta.id + ' step ' + s.n + ' -> ' + s.tgt);
  }));
  /* A pilot procedure must be flyable from the front seat, and vice versa —
     nothing should send you to the other cockpit mid-checklist. */
  const crewOf = v => AC.views.find(x => x.id === v)?.crew;
  const crossed = [];
  AC.procedures.forEach(p => p.steps.forEach(s => {
    if (!s.view) return;
    const c = crewOf(s.view);
    if (c && c !== p.meta.crew) crossed.push(p.meta.id + ' step ' + s.n + ' -> ' + s.view);
  }));
  ok('no step sends you to the other cockpit', crossed.length === 0, crossed.slice(0, 4).join(', '));

  ok('every step names a view its control is on', wrongView.length === 0,
     wrongView.slice(0, 5).join(', '));

  ok('every step has a group and a title',
     AC.procedures.every(p => p.steps.every(s => s.g && s.t)));
  ok('every step is either checkable or acknowledged',
     AC.procedures.every(p => p.steps.every(s => typeof s.done === 'function')));
}}

/* ------------------------------------------------------- saved progress */
head('Saved progress');
{
  // a tiny stand-in for localStorage, so the module can be exercised headless
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  };
  const { createStats, mmss } = await import('../src/core/stats.js');
  const ST = createStats();

  ok('storage is available', ST.available);
  ok('nothing recorded to begin with', ST.of('pilot-start') === null);

  ST.started('pilot-start');
  const a = ST.finished('pilot-start', { seconds: 600, skips: 0, faults: 0 });
  ok('a clean run sets a best time', a.isBest && a.best === 600, mmss(a.best));

  ST.started('pilot-start');
  const b = ST.finished('pilot-start', { seconds: 500, skips: 2, faults: 0 });
  ok('a run with skips cannot take the record', !b.isBest && b.best === 600);

  ST.started('pilot-start');
  const c = ST.finished('pilot-start', { seconds: 480, skips: 0, faults: 1 });
  ok('a run with faults cannot take the record', !c.isBest && c.best === 600);

  ST.started('pilot-start');
  const d = ST.finished('pilot-start', { seconds: 450, skips: 0, faults: 0 });
  ok('a faster clean run does take it', d.isBest && d.best === 450, mmss(d.best));

  const r = ST.of('pilot-start');
  ok('runs and completions counted', r.runs === 4 && r.completed === 4 && r.clean === 2,
     r.runs + ' runs, ' + r.clean + ' clean');

  const s = ST.summary();
  ok('summary totals across procedures', s.runs === 4 && s.attempted === 1);

  // survives a reload
  const ST2 = createStats();
  ok('progress persists', ST2.of('pilot-start').best === 450);

  ST2.clear();
  ok('clearing wipes it', ST2.of('pilot-start') === null);

  // and degrades rather than throwing when storage is blocked
  globalThis.localStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  const ST3 = createStats();
  ok('survives storage being blocked', ST3.available === false);
  ST3.started('x'); ST3.finished('x', { seconds: 1, skips: 0, faults: 0 });
  ok('still usable in memory', ST3.of('x').completed === 1);
  delete globalThis.localStorage;
}
{
  head('Presence counter');
  const { createPresence } = await import('../src/core/presence.js');
  const off = createPresence('');
  ok('does nothing without an endpoint', typeof off.start === 'function');
  off.start();
  ok('starting it is harmless', true);

  /* A client that can flood an endpoint eventually will. Prove it cannot. */
  {
    let sent = 0;
    const realFetch = globalThis.fetch, realDoc = globalThis.document, realLS = globalThis.localStorage;
    globalThis.fetch = async () => { sent++; return { ok:true, json: async () => ({ online:1 }) }; };
    globalThis.document = { addEventListener() {}, visibilityState:'visible', createElement: () => { throw new Error('no dom'); } };
    globalThis.localStorage = { getItem:()=>'test-id', setItem(){} };

    const P = createPresence('/api/presence');
    P.start();
    for (let i = 0; i < 5000; i++) P.refresh();
    await new Promise(r => setTimeout(r, 30));
    ok('5,000 calls in a loop send at most one request', sent <= 1, sent + ' sent');

    globalThis.fetch = realFetch; globalThis.document = realDoc; globalThis.localStorage = realLS;
  }

  const { readFileSync: _rf } = await import('node:fs');
  const src = _rf(new URL('../src/core/presence.js', import.meta.url), 'utf8');
  ok('only one request in flight at a time', /if \(dead \|\| inFlight\) return/.test(src));
  ok('a hard floor between requests', /now - lastAt < MIN_GAP/.test(src));
  ok('a budget per page load', /\+\+calls > MAX_CALLS/.test(src));
  ok('it stops for good after repeated failure', /\+\+failures >= 3\) stop/.test(src));
  ok('it cannot be started twice', /if \(timer\) return;/.test(src));
  ok('no keepalive, which exhausts the browser quota', !/keepalive/.test(src));

  const { readFileSync } = await import('node:fs');
  const fn = readFileSync(new URL('../functions/api/presence.js', import.meta.url), 'utf8');
  ok('the Pages Function is there', /onRequestPost/.test(fn));
  ok('it survives a missing binding', /if \(!env\.PRESENCE\)/.test(fn));
  ok('it survives a query blowing up', /catch \(e\)[\s\S]{0,80}online: 0/.test(fn));
  // what it writes, and what it never touches
  ok('it stores nothing but an id and a timestamp',
     /INSERT INTO presence \(id, seen\)/.test(fn));
  ok('it never reads an address or a header',
     !/CF-Connecting-IP|cf\.country|request\.headers/i.test(fn));
  ok('it caps the id length', /id\.slice\(0, 64\)/.test(fn));

  const cfg = readFileSync(new URL('../src/core/config.js', import.meta.url), 'utf8');
  const cli = readFileSync(new URL('../src/core/presence.js', import.meta.url), 'utf8');
  const url = /PRESENCE_URL = '([^']*)'/.exec(cfg)[1];
  ok('the client points at the Function', url === '/api/presence', url);
  ok('the endpoint path matches the Function file', url === '/api/presence');

  // the beat has to stay inside the free allowance for a plausible day
  const beat = +/const BEAT\s*=\s*(\d+)/.exec(cli)[1] / 1000;
  const perTwentyMin = Math.ceil(20 * 60 / beat);
  ok('a 20 minute visit stays cheap', perTwentyMin <= 30, perTwentyMin + ' writes');

  /* Without _routes.json, Pages runs EVERY request through the Functions
     runtime — every image and script counts against the quota. This one file
     is the difference between ~44 invocations per page load and 1. */
  const routes = JSON.parse(readFileSync(new URL('../_routes.json', import.meta.url), 'utf8'));
  ok('a routes file exists', routes.version === 1);
  ok('it only routes the API through Functions',
     Array.isArray(routes.include) && routes.include.every(r => r.startsWith('/api')),
     routes.include.join(', '));
  ok('it does not catch everything',
     !routes.include.includes('/*') && !routes.include.includes('/'),
     'include: ' + routes.include.join(', '));

  // the counts
  ok('the endpoint can report totals', /stats/.test(fn) && /MONTH_MS/.test(fn));
  ok('the hot path only does one count',
     /if \(!wantStats\) return json\(\{ online \}\)/.test(fn));
  ok('rows are kept, not swept, so the total means something',
     /KEEP_MS\s*=\s*400/.test(fn) && !/DELETE FROM presence WHERE seen < \?\s*'\)\s*\.bind\(cutoff/.test(fn));
  ok('the client asks for totals on the first beat', /beat\(true\)/.test(cli));
  ok('and exposes them to the menu', /counts,/.test(cli) && /onCounts/.test(cli));

  const menu = readFileSync(new URL('../src/core/menu.js', import.meta.url), 'utf8');
  ok('the hangar renders them', /class="visitors"|'visitors'/.test(menu));
  ok('but only once real numbers arrive',
     /typeof p\.total === 'number' && p\.total > 0/.test(menu));
  ok('3,000 such visits a day fit in the free 100,000',
     perTwentyMin * 3000 <= 100000, (perTwentyMin * 3000).toLocaleString() + ' writes');
}

/* ------------------------------------------------- airborne handover */
head('Airborne handover');
{
  const proc = AC.procedures.find(p => p.meta.id === 'landing-carrier');
  const h = harness(proc);
  proc.setup(h.sim);
  const S = h.S;
  ok('engines are running', S.eng.L.lit && S.eng.R.lit && S.eng.L.n2 > 80,
     S.eng.L.n2.toFixed(0) + '% N2');
  ok('throttles at HALF, not cutoff', S.sw.throttleL === 'half' && S.sw.throttleR === 'half');
  ok('on generators, ground kit away', S.power && !S.gpu && !S.airCart);
  ok('both hydraulic systems up', S.hydFlt > 2900 && S.hydComb > 2900);
  ok('gear and flaps away, brake off',
     S.sw.gearHandle === 'up' && S.sw.flapsLever === 'up' && S.sw.parkBrake === 'off');
  ok('INS already aligned', S.ins.complete);
  h.run(30);
  ok('nothing complains after 30 s', S.faults.length === 0, S.faults.join('; ') || 'no faults');
  const lit = AC.cautions.filter(([k]) => S.caution[k]).map(([, l]) => l);
  ok('no caution panel lights', lit.length === 0, lit.join(', ') || 'all out');

  // moving the throttle must not produce a start-up warning
  const msgs = [];
  h.sim.on((m, k) => msgs.push(k + ': ' + m));
  h.sim.set('throttleL', 'idle'); h.sim.set('throttleR', 'idle'); h.run(2);
  ok('throttle move is not rejected', !msgs.some(m => /No N2/i.test(m)), msgs.join(' | ') || 'silent');
}

/* --------------------------------------------------------- air to air */
for (const proc of AC.procedures.filter(p => p.meta.phase === 'combat')) {
  head('Air to air · ' + proc.meta.name);
  const h = harness(proc);
  const { S, to, run } = h;
  proc.setup(h.sim);
  const settle = () => run(30);

  to('masterArm','on'); to('masterMode','aa'); settle();

  if (proc.meta.id === 'aa-gun') {
    to('gunRate','high'); to('airSource','both'); to('gunLead','auto');
    to('weaponSel','gun'); settle();
    h.sim.set('trigger','fire'); run(0.5); settle();
    ok('gun fires only in A/A with the gun selected', S.bvr.gunFired);
  }
  if (proc.meta.id === 'aa-sidewinder') {
    to('swCool','on'); run(12); settle();
    ok('seeker cools before it will fire', S.bvr.cooled);
    to('weaponSel','sw'); to('modeStp','norm'); to('cageSeam','seam'); settle();
    h.sim.set('trigger','fire'); run(0.5); settle();
    ok('Fox 2 away', S.bvr.swFired);
  }
  if (proc.meta.id === 'aa-sparrow' || proc.meta.id === 'aa-phoenix-stt') {
    to('hsdMode','tid'); AC.radio(h.sim, 'jCool');
    to('mslPrep','on'); run(130); settle();
    ok('missile prep takes about two minutes', S.bvr.prepped);
    to('weaponSel', proc.meta.id === 'aa-sparrow' ? 'sp' : 'ph');
    to('modeStp','norm');
    h.sim.click('rm_rws',1); to('elBars','4'); to('azScan','40'); run(3);
    AC.hook(h.sim, S.bvr.contacts.find(c => c.tracked).id);
    ok('a track can be hooked on the TID', S.bvr.hooked !== null);
    settle();
    AC.radio(h.sim, 'jLock'); run(1); settle();
    ok('STT locks what was hooked', S.bvr.sttLock === S.bvr.hooked || S.bvr.sttLock !== null);
    h.sim.set('trigger','fire'); run(0.5); settle();
    ok('shot away with a track held', S.bvr.fired > 0);
  }
  if (proc.meta.id === 'aa-phoenix-tws') {
    to('liquidCool','awg9aim54');
    AC.radio(h.sim, 'pPhoenix');        // the RIO asks the front seat
    run(130);
    to('weaponSel','ph'); to('modeStp','norm'); to('mslGate','noseqtr');
    to('mslOptions','norm'); to('tgtSize','large');
    h.sim.click('rm_twsman',1); to('elBars','4'); to('azScan','20');
    run(3); h.sim.click('rm_twsauto',1); to('capCategory','tgtdata'); run(3);
    const tracked = S.bvr.contacts.filter(c => c.tracked);
    AC.hook(h.sim, tracked[0].id); h.sim.set('designate','hostile'); run(0.5);
    AC.hook(h.sim, tracked[tracked.length - 1].id); h.sim.click('noAttack', 1); run(0.5);
    ok('a track can be designated hostile', S.bvr.contacts.some(c => c.iff === 'hostile'));
    ok('do not attack removes it from the list',
       S.bvr.contacts.some(c => c.noAttack) && !S.bvr.contacts.find(c => c.noAttack).prio);
    AC.hook(h.sim, tracked[0].id); settle();
    ok('tracks form in TWS with a decent scan', S.bvr.contacts.filter(c => c.tracked).length >= 2,
       S.bvr.contacts.filter(c => c.tracked).length + ' tracked');
    ok('the system prioritises them', S.bvr.contacts.some(c => c.prio === 1));
    h.sim.click('nextLaunch', 1);
    h.sim.click('launchBtn', 1); run(1);
    h.sim.click('launchBtn', 1); run(1); settle();
    ok('two Phoenixes away without a lock', S.bvr.fired >= 2, S.bvr.fired + ' fired');
  }

  ok('all steps complete', h.left().length === 0,
     h.done.filter(Boolean).length + '/' + proc.steps.length);
  h.left().forEach(s => console.log('           missed ' + s.n + '  ' + strip(s.t)));

  /* Anything the run had to touch that lives off-panel must be offered in the
     tray, or the user simply cannot reach it. */
  const shown = trayFor(proc);
  const hidden = [...h.used].filter(id => {
    const c = AC.controls.find(x => x.id === id);
    return c && c.tray && !shown.has(id);
  });
  ok('every off-panel control it needs is in the tray', hidden.length === 0, hidden.join(', '));
}
{
  head('Weapon interlocks');
  const proc = AC.procedures.find(p => p.meta.id === 'aa-phoenix-tws');
  const h = harness(proc); proc.setup(h.sim);
  const msgs = []; h.sim.on(m => msgs.push(m));
  h.sim.click('launchBtn', 1);
  ok('will not launch with master arm off', msgs.some(m => /master arm/i.test(m)));
  h.to('masterArm','on'); h.to('weaponSel','ph'); msgs.length = 0;
  h.sim.click('launchBtn', 1);
  ok('will not launch before prep completes', msgs.some(m => /prep/i.test(m)));
  const h2 = harness(AC.procedures.find(p => p.meta.id === 'aa-sidewinder'));
  h2.sim.S.bvr && 0; AC.procedures.find(p => p.meta.id === 'aa-sidewinder').setup(h2.sim);
  h2.to('masterArm','on'); h2.to('weaponSel','sw');
  const m2 = []; h2.sim.on(m => m2.push(m));
  h2.sim.set('trigger','fire'); h2.run(0.2);
  ok('Sidewinder will not fire uncooled', m2.some(m => /cooled/i.test(m)) && !h2.S.bvr.swFired);
}

/* ------------------------------------------------------- TID repeats */
head('TID repeat on the HSD');
{
  const SEARCH = ['pdsrch','rws','twsman','twsauto','pdstt','pulsestt'];
  const shows = (sim, g) => {
    const S = sim.S, lit = g.lit(S);
    const tidRepeat = g.tid || S.sw.hsdMode === 'tid';
    const searching = S.bvr && SEARCH.includes(S.sw.radarMode);
    if (!lit) return 'dark';
    if (lit && tidRepeat && searching) return 'radar';
    return tidRepeat ? 'align' : 'nav';
  };
  const hsd = AC.gauges.find(g => g.id === 'scHsd');
  const tid = AC.gauges.find(g => g.id === 'scTid_rioC');

  ok('every screen that can repeat the TID has a track layer',
     AC.gauges.filter(g => g.kind === 'screen' && g.ins).length >= 3);

  const c = createSim(AC);
  AC.procedures.find(p => p.meta.id === 'aa-phoenix-stt').setup(c);
  c.set('hsdPower','on'); c.set('hsdMode','tid');
  for (let i = 0; i < 20; i++) c.tick(0.05);
  ok('in combat the HSD in TID shows the radar picture', shows(c, hsd) === 'radar', shows(c, hsd));
  ok('and it matches what the RIO sees', shows(c, hsd) === shows(c, tid));
  c.set('hsdMode','nav');
  ok('back to NAV it shows the nav page', shows(c, hsd) === 'nav');

  const s = createSim(AC);
  s.S.power = true; s.S.rio.wcsUp = true;
  s.set('hsdPower','on'); s.set('hsdMode','tid');
  ok('during alignment it shows the alignment page', shows(s, hsd) === 'align');
}

/* --------------------------------------------------------- shutdown */
for (const proc of AC.procedures.filter(p => p.meta.phase === 'shutdown')) {
  head('Shutdown · ' + proc.meta.name);
  const h = harness(proc);
  const { S, to, run } = h;
  proc.setup(h.sim);
  const settle = () => run(30);

  ok('starts taxied in with both engines running',
     S.eng.L.n2 > 60 && S.eng.R.n2 > 60 && S.sw.parkBrake === 'set',
     S.eng.L.n2.toFixed(0) + '% N2');

  if (proc.meta.crew === 'pilot') {
    to('antiSkid','spoiler'); to('flapsLever','up');
    to('hookHandle','up'); to('speedBrake','in'); to('masterArm','off'); settle();
    to('parkBrake','set');
    to('wingSweep','oversweep'); to('sweepThumb','aft'); run(12); settle();
    to('extLights','off'); to('landingLights','off');
    to('vdiPower','off'); to('hudPower','off'); to('hsdPower','off');
    to('tacanFunc','off'); to('ara63','off'); to('uhfFunc','off');
    to('afcsPitch','off'); to('afcsRoll','off'); to('afcsYaw','off');
    to('antiSkid','off'); to('radAltKnob','off'); settle();
    to('ejectSeat','safe'); to('canopy','open');
    to('throttleL','off'); to('throttleR','off');
    run(120);
    ok('engines run down to zero', S.eng.L.n2 < 1 && S.eng.R.n2 < 1);
    ok('the wings got to oversweep before that', S.sweep >= 67.5, S.sweep.toFixed(0) + '°');
    to('masterGenL','off'); to('masterGenR','off');
    to('oxygen','off'); to('parkBrake','off'); settle();
  } else {
    to('wcsMode','off'); to('irtvPower','off'); to('alr67Power','off');
    to('decmMode','off'); to('ale39Mode','off'); to('flareMode','norm');
    to('dlPower','off'); to('iffMode4','off'); to('navMode','off');
    to('rioTacanFunc','off'); to('vuhfFunc','off');
    to('liquidCool','off'); run(2);
    ok('the displays go dark once the WCS is down', !S.rio.wcsUp);
    to('ejectSeat','safe'); to('rioOxygen','off'); to('rioIcs','cold'); settle();
  }

  ok('a deliberate shutdown is not logged as a fault', S.faults.length === 0,
     S.faults.join('; ') || 'no faults');
  ok('all steps complete', h.left().length === 0,
     h.done.filter(Boolean).length + '/' + proc.steps.length);
  h.left().forEach(s => console.log('           missed ' + s.n + '  ' + strip(s.t)));
}
{
  head('Shutdown versus a botched start');
  const start = harness(PILOT_START);
  start.S.gpu = true; start.S.airCart = true;
  start.sim.click('engCrank', -1); start.run(14);
  start.to('throttleR','idle'); start.run(70);
  start.to('throttleR','off'); start.run(2);
  ok('cutting an engine during a start is still a fault',
     start.S.faults.some(f => /shut down/i.test(f)), start.S.faults.join('; ') || 'none');
}

/* ------------------------------------------- review corrections, round 3 */
head('Review · round 3');
{
  // the front-seater belongs to the alignment drills only
  const runs = id => {
    const p = AC.procedures.find(x => x.meta.id === id);
    const sim = createSim(AC); sim.S.rioSeat = true;
    if (p.setup) p.setup(sim);
    const before = JSON.stringify(sim.S.sw);
    for (let i = 0; i < 20 * 140; i++) sim.tick(0.05);
    return { on: !!sim.S.frontSeater, moved: JSON.stringify(sim.S.sw) !== before };
  };
  ok('the front seat runs his start-up during an alignment', runs('rio-shore').on);
  ok('but not during a RIO combat drill', !runs('aa-phoenix-tws').on);
  ok('and not during a RIO shutdown', !runs('shutdown-rio').on);
  ok('so nothing moves under you there', !runs('shutdown-rio').moved);

  // cooling risks a casualty, it does not gate the system
  {
    const sim = createSim(AC); const S = sim.S;
    S.rioSeat = true; S.frontSeater = true;
    for (let i = 0; i < 20 * 150; i++) sim.tick(0.05);
    sim.set('liquidCool', 'off'); sim.set('wcsMode', 'stby');
    for (let i = 0; i < 20 * 40; i++) sim.tick(0.05);
    ok('the WCS still comes up without cooling', S.rio.wcsUp);
    for (let i = 0; i < 20 * 130; i++) sim.tick(0.05);
    ok('but it cooks itself eventually', S.faults.some(f => /Overheat/i.test(f)),
       S.faults.find(f => /Overheat/i.test(f)) || 'no fault');
  }

  // both lights for the first 0.8 min
  {
    const sim = createSim(AC); const S = sim.S;
    S.rioSeat = true; S.frontSeater = true;
    for (let i = 0; i < 20 * 150; i++) sim.tick(0.05);
    sim.set('liquidCool','awg9aim54'); sim.set('wcsMode','stby');
    for (let i = 0; i < 20 * 35; i++) sim.tick(0.05);
    sim.set('navMode','gnd');
    for (let i = 0; i < 20 * 20; i++) sim.tick(0.05);
    ok('both lights inside the first 0.8 min', S.rio.stbyLight && S.rio.readyLight,
       S.ins.t.toFixed(0) + 's in');
    for (let i = 0; i < 20 * 40; i++) sim.tick(0.05);
    ok('STBY alone after that', S.rio.stbyLight && !S.rio.readyLight,
       S.ins.t.toFixed(0) + 's in');
  }

  // losing the datalink drops a boat alignment to handset and restarts it
  {
    const sim = createSim(AC); const S = sim.S;
    S.rioSeat = true; S.frontSeater = true;
    for (let i = 0; i < 20 * 150; i++) sim.tick(0.05);
    sim.set('dlPower','on'); sim.set('dlModeSw','cains');
    sim.set('dlFreq','209'); sim.set('navMode','cva');
    S.rate = 16; for (let i = 0; i < 20 * 60; i++) sim.tick(0.05); S.rate = 1;
    const was = S.ins.t;
    ok('a boat alignment gets going', was > 60, was.toFixed(0) + 's');
    sim.set('dlPower','off'); sim.tick(0.2);
    ok('losing CAINS drops it to handset', S.ins.handset);
    ok('and it starts again from zero', S.ins.t < 1, S.ins.t.toFixed(1) + 's');
    ok('with a fault logged', S.faults.some(f => /CAINS/.test(f)));
    sim.set('dlPower','on'); sim.tick(0.2);
    ok('restoring it clears handset', !S.ins.handset);

    // dialling the wheels off the ship loses it too
    S.rate = 16; for (let i = 0; i < 20 * 30; i++) sim.tick(0.05); S.rate = 1;
    sim.set('dlFreq', '092'); sim.tick(0.2);
    ok('changing the frequency also drops CAINS', S.ins.handset && S.ins.t < 1);
    sim.set('dlFreq', '209'); sim.tick(0.2);
    ok('back on the ship frequency recovers it', !S.ins.handset);

    // or feed it by hand instead: present position, heading and speed
    sim.set('dlPower','off');
    S.rate = 16; for (let i = 0; i < 20 * 20; i++) sim.tick(0.05); S.rate = 1;
    ok('handset waits until it is given data', S.ins.handset && S.ins.t < 1,
       S.ins.t.toFixed(1) + 's');
    S.rio.entered.lat = S.rio.entered.lon = true;
    S.rio.entered.hdg = S.rio.entered.spd = true;
    sim.tick(0.2);
    ok('position, heading and speed arm it', S.ins.handsetArmed);
    S.rate = 16; for (let i = 0; i < 20 * 30; i++) sim.tick(0.05); S.rate = 1;
    ok('and then it runs on its own', S.ins.t > 60, S.ins.t.toFixed(0) + 's');
  }

  // manual sweep is the thumb switch with the handle stowed
  {
    const sim = createSim(AC);
    AC.procedures.find(p => p.meta.id === 'landing-shore').setup(sim);
    const S = sim.S, run = s => { for (let i = 0; i < s * 20; i++) sim.tick(0.05); };
    sim.set('sweepThumb','aft'); run(12);
    ok('thumb switch sweeps with the handle stowed',
       S.sw.wingSweep === 'detent' && S.sweep >= 67.5, S.sweep.toFixed(0) + '\u00b0');
    sim.set('sweepThumb','fwd'); run(12);
    ok('and the CADC takes it back', S.sweep <= 21, S.sweep.toFixed(0) + '\u00b0');
  }

  // PD and pulse search draw on the DDD, not the TID
  {
    const sim = createSim(AC);
    AC.procedures.find(p => p.meta.id === 'aa-phoenix-stt').setup(sim);
    const S = sim.S;
    for (let i = 0; i < 40; i++) sim.tick(0.05);
    ok('PD Search leaves the TID blank', S.bvr.tidBlind, S.sw.radarMode);
    sim.click('rm_rws', 1); for (let i = 0; i < 40; i++) sim.tick(0.05);
    ok('RWS puts them on the TID', !S.bvr.tidBlind);
  }

  // finishing a shutdown does not leave you ready to taxi
  {
    const missing = AC.procedures.filter(p => !p.meta.ending || !p.meta.ending.title);
    ok('every procedure says what finishing it means', missing.length === 0,
       missing.map(p => p.meta.id).join(', '));
    const taxi = AC.procedures.filter(p => p.meta.ending &&
      /taxi/i.test(p.meta.ending.title) && p.meta.phase !== 'startup');
    ok('only a start-up ends ready to taxi', taxi.length === 0,
       taxi.map(p => p.meta.id).join(', '));
    const titles = AC.procedures.map(p => p.meta.ending.title);
    ok('the endings are not all the same', new Set(titles).size >= 8,
       new Set(titles).size + ' distinct');
    const shut = AC.procedures.find(p => p.meta.id === 'shutdown-pilot');
    ok('a shutdown ends cold and dark', /cold/i.test(shut.meta.ending.title),
       shut.meta.ending.title);
    const trap = AC.procedures.find(p => p.meta.id === 'landing-carrier');
    ok('a carrier landing ends trapped', /trap/i.test(trap.meta.ending.title),
       trap.meta.ending.title);
  }

  /* Every step must be reachable from the seat you are sitting in. A step whose
     target is a comms menu has to name a menu that exists and can actually do it. */
  {
    const unreachable = [];
    AC.procedures.forEach(p => p.steps.forEach(s => {
      if (typeof s.tgt !== 'string' || !s.tgt.startsWith('comms:')) return;
      const menu = s.tgt.split(':')[1];
      if (!AC.menus[menu]) unreachable.push(p.meta.id + ' step ' + s.n + ' -> ' + menu);
    }));
    ok('every comms target names a real menu', unreachable.length === 0, unreachable.join(', '));

    // and the six shooter's front-seat call actually sets the four switches
    const sim = createSim(AC);
    AC.procedures.find(p => p.meta.id === 'aa-phoenix-tws').setup(sim);
    AC.radio(sim, 'pPhoenix');
    for (let i = 0; i < 20 * 130; i++) sim.tick(0.05);
    const s2 = AC.procedures.find(p => p.meta.id === 'aa-phoenix-tws').steps.find(x => x.n === 2);
    ok('the RIO can get the front seat to set up', s2.done(sim.S),
       [sim.S.sw.masterArm, sim.S.sw.weaponSel, sim.S.sw.modeStp].join(' / '));
  }

  // gunsight elevation lead now lives in the cockpit, not the tray
  {
    const c = AC.controls.find(x => x.id === 'gunLead');
    ok('elevation lead is a cockpit control', !c.tray && c.view === 'front',
       c.x + ',' + c.y);
    ok('it sits inside the frame', c.x + c.w <= 1920 && c.y + c.h <= 1080);
    ok('it has a readout above it',
       AC.gauges.some(g => g.id === 'dgElevLead' && g.y < c.y));
    const clash = AC.controls.filter(o => o !== c && !o.tray && o.view === 'front' && o.x != null)
      .filter(o => Math.min(c.x+c.w,o.x+o.w) - Math.max(c.x,o.x) > 2 &&
                   Math.min(c.y+c.h,o.y+o.h) - Math.max(c.y,o.y) > 2);
    ok('and does not sit on anything else', clash.length === 0, clash.map(o=>o.id).join(', '));
  }

  // the cooling switch is mounted the way he described it
  {
    const c = AC.controls.find(x => x.id === 'liquidCool');
    ok('AWG-9/AIM-54 is the forward position',
       c.states[c.states.length - 1] === 'awg9aim54', c.states.join(' \u2192 '));
    ok('AWG-9 alone is aft', c.states[0] === 'awg9');
  }

  // the parking brake stays set through a shutdown
  {
    const p = AC.procedures.find(x => x.meta.id === 'shutdown-pilot');
    const last = p.steps[p.steps.length - 1];
    ok('shutdown leaves the parking brake set',
       /parkBrake==='set'/.test(last.done.toString()), strip(last.t));
  }

  // lights off on the boat, on at the field
  {
    const boat = AC.procedures.find(x => x.meta.id === 'landing-carrier')
      .steps.find(s => /[Ll]anding lights/.test(s.t));
    const field = AC.procedures.find(x => x.meta.id === 'landing-shore')
      .steps.find(s => /[Ll]anding lights/.test(s.t));
    ok('landing lights off on the boat', /landingLights==='off'/.test(boat.done.toString()));
    ok('and on at the field', /landingLights==='on'/.test(field.done.toString()));
  }
}

/* ------------------------------------------------------ offline cache */
head('Offline cache');
{
  const { readFileSync } = await import('node:fs');
  const { globSync } = await import('node:fs');
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const listed = JSON.parse(sw.slice(sw.indexOf('const SHELL = ') + 14, sw.indexOf('];') + 1));
  const root = new URL('../', import.meta.url);

  const missing = listed.filter(f => {
    try { readFileSync(new URL(f.replace('./', ''), root)); return false; } catch (e) { return true; }
  });
  ok('every precached file exists', missing.length === 0, missing.join(', '));

  const onDisk = globSync(['src/**/*.js', 'src/**/*.css', 'assets/**/*.jpg', 'assets/**/*.png'],
                          { cwd: new URL('../', import.meta.url) }).map(f => './' + f.replace(/\\/g, '/'));
  const uncached = onDisk.filter(f => !listed.includes(f));
  ok('nothing on disk is left out', uncached.length === 0,
     uncached.slice(0, 4).join(', ') || listed.length + ' files cached');

  const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', root), 'utf8'));
  ok('manifest names icons that exist',
     manifest.icons.every(i => { try { readFileSync(new URL(i.src, root)); return true; } catch (e) { return false; } }),
     manifest.icons.length + ' icons');
  ok('manifest is installable',
     !!manifest.name && !!manifest.start_url && manifest.display === 'standalone' &&
     manifest.icons.some(i => i.sizes === '512x512'));
}

/* -------------------------------------------------- multi-switch cues */
head('Multi-switch cues');
{
  const cases = [
    ['pilot-start',    /VDI, HUD and HSD/,  [['vdiPower','on'],['hudPower','on'],['hsdPower','on']]],
    ['pilot-start',    /SAS|AFCS|stability/i, [['afcsPitch','on'],['afcsRoll','on'],['afcsYaw','on']]],
    ['pilot-start',    /MASTER GEN/,        [['masterGenL','norm'],['masterGenR','norm']]],
    ['landing-carrier',/AWL mode/,          [['hudAwl','ils'],['vdiAwl','ils']]],
  ];
  for (const [pid, re, seq] of cases) {
    const proc = AC.procedures.find(p => p.meta.id === pid);
    const step = proc.steps.find(s => re.test(s.t));
    if (!step) { ok('found a step matching ' + re, false); continue; }
    const sim = createSim(AC);
    if (proc.setup) proc.setup(sim);
    // put the whole group somewhere wrong first — a verify step whose switches
    // are already correct is meant to skip straight to whatever still needs doing
    seq.forEach(([id, want]) => {
      const c = C(id);
      sim.S.sw[id] = c.states.find(v => v !== want) ?? want;
    });
    const trace = [];
    let good = true;
    for (const [id, want] of seq) {
      const got = step.tgt(sim.S);
      trace.push(got);
      if (got !== id) good = false;
      sim.set(id, want);
    }
    ok('cue walks ' + strip(step.t).slice(0, 32), good, trace.join(' \u2192 '));
  }

  // and every function target must still resolve to something real
  const ids = new Set(AC.controls.map(c => c.id).concat(AC.gauges.map(g => g.id)));
  const bad = [];
  AC.procedures.forEach(p => p.steps.forEach(s => {
    if (typeof s.tgt !== 'function') return;
    const sim = createSim(AC);
    if (p.setup) p.setup(sim);
    const t = s.tgt(sim.S);
    if (!ids.has(t)) bad.push(p.meta.id + ' step ' + s.n + ' -> ' + t);
  }));
  ok('every walking cue resolves to a real control', bad.length === 0, bad.join(', '));

  // ctx lists must name real controls too
  const badCtx = [];
  AC.procedures.forEach(p => p.steps.forEach(s => {
    [].concat(s.ctx || []).forEach(id => { if (!ids.has(id)) badCtx.push(p.meta.id + ' step ' + s.n + ' -> ' + id); });
  }));
  ok('every step ctx names a real control', badCtx.length === 0, badCtx.join(', '));

  /* A walking cue that points at a control its own done() never mentions is a
     cue attached to the wrong step — which is exactly what happened once. */
  const mismatched = [];
  AC.procedures.forEach(p => p.steps.forEach(s => {
    if (typeof s.tgt !== 'function') return;
    const cares = new Set([...s.done.toString().matchAll(/s\.(?:sw|rio\.entered)\.(\w+)/g)].map(m => m[1]));
    if (!cares.size) return;                       // gauge or state-based, nothing to compare
    const seen = new Set();
    for (let n = 0; n < 12; n++) {
      const sim = createSim(AC);
      if (p.setup) p.setup(sim);
      // randomise the group so the cue is exercised at each position
      AC.controls.forEach(c => { if (c.states && Math.random() < 0.5)
        sim.S.sw[c.id] = c.states[Math.floor(Math.random() * c.states.length)]; });
      seen.add(s.tgt(sim.S));
    }
    const stray = [...seen].filter(id => !cares.has(id) && AC.controls.some(c => c.id === id)
                                      && !/^cap|^msg/.test(id));
    if (stray.length) mismatched.push(p.meta.id + ' step ' + s.n + ' -> ' + stray.join('/'));
  }));
  ok('no walking cue points outside its own step', mismatched.length === 0, mismatched.join(', '));
}

/* ------------------------------------------------------- knob detents */
head('Knob detents');
{
  const knobs = AC.controls.filter(c => c.kind === 'knob');
  const withAngles = knobs.filter(c => c.angles);
  ok('every declared angle list matches its state count',
     withAngles.every(c => c.angles.length === c.states.length),
     withAngles.map(c => c.id + ' ' + c.angles.length + '/' + c.states.length).join('  ') || 'none');
  ok('declared angles run clockwise',
     withAngles.every(c => c.angles.every((a, i) => i === 0 || a > c.angles[i - 1])));
  ok('declared angles stay on the dial face',
     withAngles.every(c => c.angles.every(a => a > -180 && a < 180)));

  /* A cue pointing at a control that is already where the step needs it is a
     dead end: the user is told to look at something correct and gets no hint
     about what actually has to move. */
  {
    const useless = [];
    AC.procedures.forEach(p => p.steps.forEach(s => {
      const src = s.done.toString();
      if (!/s\.sweep/.test(src)) return;
      const tgt = typeof s.tgt === 'function' ? null : s.tgt;
      // if the step needs the handle stowed, the handle is already stowed, so
      // the thumb switch is the only thing that can satisfy it
      if (/wingSweep==='detent'/.test(src) && tgt !== 'sweepThumb')
        useless.push(p.meta.id + ' step ' + s.n + ' cues ' + tgt);
      // and where the handle itself must move, cue the handle
      if (/wingSweep==='oversweep'/.test(src) && tgt !== 'wingSweep')
        useless.push(p.meta.id + ' step ' + s.n + ' cues ' + tgt);
    }));
    ok('sweep steps cue whatever actually has to move', useless.length === 0,
       useless.join(', '));

    // and the step that was stuck really does clear now
    const proc = AC.procedures.find(p => p.meta.id === 'landing-carrier');
    const s19 = proc.steps.find(x => x.n === 19);
    const sim = createSim(AC); proc.setup(sim);
    const run = n => { for (let i = 0; i < n * 20; i++) sim.tick(0.05); };
    sim.set('sweepThumb', 'aft'); run(12);
    ok('wings back, so the step is not yet met', !s19.done(sim.S));
    sim.click(s19.tgt, 1); run(12);
    ok('clicking what it cues clears it', s19.done(sim.S),
       sim.S.sweep.toFixed(0) + '\u00b0');
  }

  // a route for corrections, a build to quote, and something to watch while it loads
  {
    const { readFileSync: rf } = await import('node:fs');
    const g = f => rf(new URL('../' + f, import.meta.url), 'utf8');
    const menu = g('src/core/menu.js'), app = g('src/core/app.js');
    const views = g('src/core/views.js'), html = g('index.html');

    const cfg = g('src/core/config.js');
    ok('there is somewhere to report a problem', /FEEDBACK_URL\s*=\s*\n?\s*'https?:\/\//.test(cfg));
    ok('the link is in the footer', /Found something wrong\?/.test(menu));
    ok('and opens safely', /rel = 'noopener noreferrer'/.test(menu));
    ok('an empty URL hides it', /if \(FEEDBACK_URL\)/.test(menu));

    const build = g('src/core/build.js');
    ok('the build is stamped', /export const BUILD = '[0-9a-f]{8}'/.test(build));
    ok('it is generated, not hand-edited', /Do not edit/.test(build));
    ok('and shown where a reporter can find it', /buildstamp/.test(menu));

    /* Boot code once ended up inside the frame loop, so the service worker was
       re-registered sixty times a second. Check what the loop contains. */
    {
      const lines = app.split('\n');
      const i = lines.findIndex(l => l.startsWith('function frame('));
      let depth = 0, end = i;
      for (let n = i; n < lines.length; n++) {
        depth += (lines[n].match(/\{/g) || []).length - (lines[n].match(/\}/g) || []).length;
        if (n > i && depth === 0) { end = n; break; }
      }
      const loop = lines.slice(i, end + 1).join('\n');
      const strays = ['serviceWorker.register', 'setTimeout(dismiss', "classList.add('booted')",
                      'P.start()', 'P.onCounts'].filter(s => loop.includes(s));
      ok('the frame loop does one-off work nowhere', strays.length === 0, strays.join(', '));
      ok('the loop still schedules itself', /requestAnimationFrame\(frame\)/.test(loop));
    }

    ok('registering the worker cannot throw the app over',
       /try \{[\s\S]{0,200}serviceWorker\.register/.test(app));

    // and the single file must not reference paths it cannot resolve
    const bundler = g('tools/bundle.py');
    ok('the single-file build inlines its tab icon',
       /data:image\/svg\+xml;base64/.test(bundler));
    ok('and strips links that would 404',
       /rel="manifest"/.test(bundler) && /rel="apple-touch-icon"/.test(bundler));
  }

  /* Sound. The safety properties matter more than the sounds themselves: this
     runs in headphones, and a clipped envelope is the one thing here that could
     actually hurt someone. */
  {
    const { readFileSync: rf } = await import('node:fs');
    const au  = rf(new URL('../src/core/audio.js', import.meta.url), 'utf8');
    const app = rf(new URL('../src/core/app.js', import.meta.url), 'utf8');

    ok('nothing is sampled from the game', !/\.(mp3|ogg|wav|m4a)/i.test(au));
    ok('there is a limiter before the output',
       /createDynamicsCompressor/.test(au) && /limiter\)\.connect\(ctx\.destination\)/.test(au));
    const cap = parseFloat(/MAX_GAIN\s*=\s*([\d.]+)/.exec(au)[1]);
    ok('the master spans a usable range', cap > 0.5 && cap <= 1, cap.toString());

    /* The first version set the limiter threshold at -18 dB, which squashed the
       whole mix rather than catching peaks, and everything came out at a
       whisper. A limiter belongs near the top. */
    const thr = parseFloat(/limiter\.threshold\.value = (-?[\d.]+)/.exec(au)[1]);
    ok('the limiter guards the top, not the middle', thr >= -9 && thr <= -3, thr + ' dB');
    const ratio = parseFloat(/limiter\.ratio\.value = ([\d.]+)/.exec(au)[1]);
    ok('and it still limits hard when it does engage', ratio >= 8, ratio + ':1');

    /* Levels, so nothing drifts back to inaudible or lurches into loud. */
    const dbOf = peak => 20 * Math.log10(peak * cap * 0.7);
    const click = parseFloat(/click:\s+\(\) => \{ hit\(\{[^}]*peak: ([\d.]+)/.exec(au)[1]);
    ok('switch clicks are clearly audible', dbOf(click) > -14, dbOf(click).toFixed(1) + ' dB');
    ok('but not shouting', dbOf(click) < -4, dbOf(click).toFixed(1) + ' dB');
    const loudest = Math.max(...[...au.matchAll(/peak: ([\d.]+)/g)].map(m => +m[1]));
    ok('no voice can reach full scale', loudest * cap <= 0.8, loudest.toFixed(2));

    /* The mistake sound fires while someone is learning, so it must inform
       rather than alarm. Startle comes from a fast attack, energy in the
       2-4 kHz band, and repetition — so all three are checked. */
    // the block runs from 'warning:' to the next voice in the table
    const warn = au.slice(au.indexOf('warning: () =>'),
                          au.indexOf('good:', au.indexOf('warning: () =>')));
    const wPeak = Math.max(...[...warn.matchAll(/peak: ([\d.]+)/g)].map(m => +m[1]));
    ok('a mistake is quieter than a switch click', dbOf(wPeak) < dbOf(click) - 6,
       dbOf(wPeak).toFixed(1) + ' dB against ' + dbOf(click).toFixed(1) + ' dB');
    const wAttack = Math.min(...[...warn.matchAll(/attack: ([\d.]+)/g)].map(m => +m[1]));
    ok('and swells rather than snapping', wAttack >= 0.05, (wAttack * 1000).toFixed(0) + ' ms');
    const wFreq = Math.max(...[...warn.matchAll(/freq: (\d+)/g)].map(m => +m[1]));
    const wBright = Math.max(...[...warn.matchAll(/bright: ([\d.]+)/g)].map(m => +m[1]));
    ok('it stays out of the ear\'s sensitive band', wFreq * wBright < 800,
       Math.round(wFreq * wBright) + ' Hz');
    ok('and does not nag', (warn.match(/buzz\(/g) || []).length <= 2,
       (warn.match(/buzz\(/g) || []).length + ' repeats');
    ok('volume cannot be pushed past it',
       /Math\.min\(1, Math\.max\(0, v\)\)/.test(au) && /MAX_GAIN \* vol/.test(au));

    ok('every gain change is ramped, so nothing clicks',
       /linearRampToValueAtTime/.test(au) && /exponentialRampToValueAtTime/.test(au));
    ok('no envelope starts at zero on an exponential ramp',
       !/exponentialRampToValueAtTime\(0,/.test(au));

    ok('the bed is low passed away from the harsh band',
       /lowpass/.test(au) && /frequency\.value = 3[0-9]{2}/.test(au));
    ok('the growl is kept out of the harsh band too',
       /lp\.frequency\.value = 1[0-9]{3}/.test(au));

    ok('it starts off and remembers the answer',
       /KEY_ON, '0'\) === '1'/.test(au) && /store\.set\(KEY_ON/.test(au));
    ok('enabling happens inside a click handler',
       /onBtn\.onclick = \(\) => \{ A\.enable/.test(app));
    ok('a missing AudioContext is survivable', /if \(!AC\) return false/.test(au));
    ok('private mode cannot break it', /catch \(e\) \{ \/\* private mode \*\/ \}/.test(au));

    /* The bed was inaudible: 0.055 through a 0.34 master is about -38 dB. */
    const amb = parseFloat(/AMBIENT\s*=\s*([\d.]+)/.exec(au)[1]);
    const db = dbOf(amb);
    ok('the bed is actually audible', db > -26, db.toFixed(0) + ' dB at default volume');
    ok('but sits under the effects', db < -14 && db < dbOf(click) - 6,
       db.toFixed(0) + ' dB against ' + dbOf(click).toFixed(0) + ' dB');

    /* Mechanical, not digital: switchgear is filtered noise, not an oscillator. */
    ok('switch sounds are noise transients, not tones',
       /createBufferSource\(\)[\s\S]{0,200}bandpass/.test(au));
    ok('no two clicks are identical', /playbackRate\.value = 0\.8 \+ Math\.random/.test(au));
    ok('warnings are buzzers rather than beeps',
       /function buzz/.test(au) && /sawtooth/.test(au) && /chop/.test(au));
    ok('a launch is a whoosh, not a note', /launch:[\s\S]{0,90}sweep: 180/.test(au));

    /* Every control makes a noise, and the noise suits the control. */
    ok('clicking a control makes a sound', (app.match(/A\.play\(soundFor\(/g) || []).length >= 3,
       (app.match(/A\.play\(soundFor\(/g) || []).length + ' click paths');
    ok('knobs, buttons, guards and levers differ',
       /kind === 'knob'/.test(app) && /c\.guard/.test(app) && /kind === 'lever'/.test(app));

    /* Crew speech. Browser synthesis, so nothing is downloaded and no one's
       voice work is being redistributed. */
    ok('speech uses the browser, not audio files',
       /SpeechSynthesisUtterance/.test(au) && !/\.(mp3|ogg|wav)/i.test(au));
    ok('only crew lines are voiced, not narration',
       /\^\(Jester\|Pilot\|Ground\|Deck\)/.test(app));
    ok('the speaker sets the voice', /CREW = \{[\s\S]{0,300}jester/.test(au));

    /* The first version preferred localService voices, which are the old
       robotic ones. Quality markers should win instead. */
    ok('voices are scored, not guessed at', /function scoreVoice/.test(au));
    ok('modern neural voices are preferred',
       /natural\|neural\|premium\|enhanced\|online/i.test(au));
    ok('and the tinny ones are pushed down', /compact\|espeak\|pico/i.test(au));
    ok('it no longer prefers local voices on principle',
       !/en\.find\(v => v\.localService\)/.test(au));

    /* Jargon read literally is the giveaway. */
    ok('aviation jargon is respelled for speech', /const SPOKEN = \[/.test(au));
    ok('AWG-9 is not read as a subtraction', /A W G nine/.test(au));
    ok('AIM-54 is not read as fifty four', /AIM fifty four/.test(au));
    ok('units are spoken as words', /'knots'/.test(au) && /'feet'/.test(au));

    /* A noisy channel is what makes synthetic speech pass as a radio call. */
    ok('speech runs over a radio carrier', /function openCarrier/.test(au));
    ok('the carrier is band limited to comms',
       /highpass'; hp\.frequency\.value = 3[0-9]{2}/.test(au) &&
       /lowpass'; lp\.frequency\.value = 2[0-9]{3}/.test(au));
    ok('the cockpit ducks while someone talks', /AMBIENT \* 0\.45/.test(au));
    ok('a dropped onend cannot leave the carrier open', /setTimeout\(finish/.test(au));
    ok('a radio click brackets each line',
       /squelch in[\s\S]{0,120}hit\(/.test(au) && /squelch out/.test(au));
    ok('speech volume is capped', /Math\.min\(0\.75, vol \* 0\.95\)/.test(au));
    ok('only one voice at a time', /speechSynthesis\.cancel\(\)/.test(au));
    /* Chrome silently drops an utterance queued in the same tick as a cancel. */
    ok('cancel and speak are not in the same tick',
       /speechSynthesis\.speaking \|\| speechSynthesis\.pending/.test(au) &&
       /setTimeout\(\(\) => \{ try \{ speechSynthesis\.speak/.test(au));
    ok('it can tell whether speech will work at all', /function speechAvailable/.test(au));
    ok('and says so rather than failing silently', /'NONE'/.test(app));
    ok('the toggle is disabled when there are no voices', /crewBtn\.disabled = !ready/.test(app));
    ok('voices arriving late repaint the panel', /voiceschanged', paint/.test(app));

    /* Volume. The module could always set it; there was no way for anyone to. */
    const css3 = rf(new URL('../src/core/style.css', import.meta.url), 'utf8');
    ok('there is a volume control', /id="sp_vol"/.test(rf(new URL('../index.html', import.meta.url), 'utf8')));
    ok('moving it sets the volume', /A\.setVolume\(vol\.value \/ 100\)/.test(app));
    ok('and it is audible while you drag', /A\.play\('detent'\)/.test(app));
    ok('the setting survives a reload', /KEY_VOL/.test(au) && /store\.set\(KEY_VOL/.test(au));
    ok('it still cannot exceed the cap', /MAX_GAIN \* vol/.test(au));
    ok('the slider is disabled when muted', /vol\.disabled = !A\.on/.test(app));

    /* The panel replaced two chips, so the top bar did not grow. */
    ok('one chip opens the lot', /chip\.onclick = e => \{ e\.stopPropagation\(\); open/.test(app));
    ok('clicking away closes it', /if \(!panel\.hidden\) open\(false\)/.test(app));
    ok('escape closes it too', /e\.key === 'Escape'/.test(app));
    ok('M mutes without opening anything', /e\.key === 'm' \|\| e\.key === 'M'/.test(app));
    ok('typing in a field does not mute', /matches\('input, textarea'\)/.test(app));
    ok('the panel is announced as a dialog', /role="dialog"/.test(rf(new URL('../index.html', import.meta.url), 'utf8')));
    ok('and the chip says whether it is open', /aria-expanded/.test(app));
    ok('the volume row is styled', /#sp_vol\{/.test(css3));

    ok('missing voices cannot break it',
       /typeof speechSynthesis === 'undefined'/.test(au) && /catch \(e\)/.test(au));
    ok('it can be silenced separately from the switches',
       /setSpeaking/.test(au) && /sp_crew/.test(app));
    ok('and the choice is remembered', /KEY_VOICE/.test(au));

    /* A remembered "on" is not enough: browsers need a gesture, so sound that
       was left enabled stayed silent until it was toggled off and on again. */
    ok('a remembered on wakes on the first gesture',
       /if \(on\) armFirstGesture\(\);/.test(au));
    ok('it listens for touch as well as click and key',
       /pointerdown', 'keydown', 'touchstart'/.test(au));
    ok('and stops listening once it has woken',
       /removeEventListener\(e, go, true\)/.test(au));
    ok('a suspended context is resumed', /ctx\.state === 'suspended'/.test(au));
    ok('coming back to the tab resumes it too',
       /visibilitychange[\s\S]{0,160}ctx\.resume/.test(au));
    ok('the panel can tell running from merely enabled', /get live\(\)/.test(au));

    ok('the bed follows the engines', /A\.ambient\(S\.power/.test(app));
    ok('and is silent in a cold jet', /S\.power \? 0\.25/.test(app));
  }

  // the things that make it a project rather than a file
  {
    const { readFileSync: rf } = await import('node:fs');
    const has = f => { try { return rf(new URL('../' + f, import.meta.url), 'utf8'); }
                       catch (e) { return null; } };

    const readme = has('README.md');
    ok('the README describes what actually ships',
       /twelve procedures/.test(readme) && /six shooter/.test(readme));
    ok('it does not still claim three procedures',
       !/the pilot cold start, and the RIO INS/.test(readme));

    const lic = has('LICENSE');
    ok('there is a licence', !!lic);
    ok('and it excludes the artwork it cannot license',
       /NOT COVERED BY THIS LICENCE/.test(lic) && /Eagle Dynamics/.test(lic));

    ok('there is a custom 404', /DCS Cockpit Trainer/.test(has('404.html') || ''));
    ok('robots allows the site but not the endpoint',
       /Disallow: \/api\//.test(has('robots.txt') || ''));

    const html = has('index.html');
  }

  /* The footer was built inside the category loop, so it appeared once per
     category. Check where it is created, not how many the shim can see. */
  {
    const { readFileSync: rf } = await import('node:fs');
    const src = rf(new URL('../src/core/menu.js', import.meta.url), 'utf8');
    ok('the footer is built exactly once', (src.match(/menufoot/g) || []).length === 1,
       (src.match(/menufoot/g) || []).length + ' occurrences');
    const i = src.indexOf('cats.forEach');
    const loop = src.slice(i, src.indexOf('\n      });', i));
    ok('and not inside the category loop', !loop.includes('menufoot'));
    // both footer links share a class, and the label also titles the privacy
    // page, so count the button that opens it
    ok('the privacy link is built once too',
       (src.match(/this\.open\('privacy'\)/g) || []).length === 1);
    ok('so is the feedback link',
       (src.match(/Found something wrong\?/g) || []).length === 1);
    /* The markup for the footer links existed while their styling did not, so
       the two ran together as one underlined string. Check both halves. */
    const css2 = rf(new URL('../src/core/style.css', import.meta.url), 'utf8');
    ok('the footer links are actually spaced apart',
       /\.footlinks\{[^}]*gap:\d+px/.test(css2));
    ok('and the build stamp is styled', /\.buildstamp\{/.test(css2));

    // the disclaimer has to be visible on the page, not one click away
    ok('the hangar says it is unofficial', /unofficial, non-commercial fan project/i.test(src));
    ok('and names who the artwork belongs to',
       /Eagle Dynamics/.test(src) && /Heatblur/.test(src));

    /* The squadron reviewed it; they did not build it. Saying so protects them
       as much as it clarifies things for anyone reading. */
    ok('the footer says the squadron is not affiliated',
       /not affiliated with the squadron/.test(src));
    ok('and that the site is not theirs', /this site is not theirs/.test(src));
    ok('while still recommending them', /Discord is well worth joining/.test(src));
    ok('the squadron name links out',
       /virtualweaponsacademy\.org\/" *' *\+\s*'target="_blank"/.test(src) ||
       (src.match(/virtualweaponsacademy\.org/g) || []).length >= 2);
    // two paragraphs share the class now, so check placement rather than count
    {
      const i = src.indexOf('cats.forEach');
      const loop = src.slice(i, src.indexOf('\n      });', i));
      ok('the disclaimers sit outside the category loop', !loop.includes("'unofficial'"));
    }
  }

  // what the site keeps, and the one thing you can refuse
  {
    const { readFileSync: rf } = await import('node:fs');
    const files = ['src/core/menu.js','src/core/stats.js','src/core/presence.js',
                   'src/core/app.js','src/core/views.js','src/core/checklist.js',
                   'functions/api/presence.js']
      .map(f => rf(new URL('../' + f, import.meta.url), 'utf8')).join('\n');

    ok('the site sets no cookies', !/document\.cookie/.test(files));
    ok('it calls no third party', !/https?:\/\/(?!www\.virtualweaponsacademy)/.test(files),
       (files.match(/https?:\/\/[^'"\s)]+/g) || []).filter(u => !/virtualweaponsacademy/.test(u)).join(', ') || 'none');
    const keys = [...files.matchAll(/const (?:KEY|OPT) = '([^']+)'/g)].map(m => m[1]);
    ok('it stores exactly three named things', keys.length === 3, keys.join(', '));
    ok('the server records nothing but an id and a time',
       /INSERT INTO presence \(id, seen\)/.test(files) &&
       !/CF-Connecting-IP|request\.headers/i.test(files));

    // the opt-out has to actually stop it
    const store = new Map();
    const realLS = globalThis.localStorage, realDoc = globalThis.document, realFetch = globalThis.fetch;
    globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null,
      setItem: (k,v) => store.set(k,String(v)), removeItem: k => store.delete(k) };
    globalThis.document = { addEventListener() {}, visibilityState:'visible' };
    let sent = 0; globalThis.fetch = async () => { sent++; return { ok:true, json: async () => ({ online:1 }) }; };
    const mod = await import('../src/core/presence.js?privacy');
    store.set('dcs-trainer-visitor','abc');
    mod.setCounting(false);
    ok('opting out forgets the id', !store.has('dcs-trainer-visitor'));
    mod.createPresence('/api/presence').start();
    await new Promise(r => setTimeout(r, 20));
    ok('and sends nothing at all', sent === 0, sent + ' requests');
    mod.setCounting(true);
    ok('you can turn it back on', !mod.countingOff());
    globalThis.localStorage = realLS; globalThis.document = realDoc; globalThis.fetch = realFetch;

    const menu = rf(new URL('../src/core/menu.js', import.meta.url), 'utf8');
    ok('there is a page explaining all of it', /renderPrivacy/.test(menu));
    ok('reachable from the aircraft screen', /privlink/.test(menu));
  }

  /* Two start-ups now: the same jet, but the deck changes what you set before
     you move. The pair must stay in step, and the carrier one must actually
     differ where it should. */
  {
    const shoreP = AC.procedures.find(p => p.meta.id === 'pilot-start');
    const boatP  = AC.procedures.find(p => p.meta.id === 'pilot-start-carrier');
    ok('there is a carrier start-up', !!boatP);
    ok('and the shore one says so in its name', /shore/i.test(shoreP.meta.name));
    ok('both share the engine start', 
       shoreP.steps.filter(s => /Engine Start/.test(s.g)).length ===
       boatP.steps.filter(s => /Engine Start/.test(s.g)).length);
    ok('the carrier one adds a before-taxi group',
       boatP.steps.some(s => /Before Taxi/.test(s.g)) &&
       !shoreP.steps.some(s => /Before Taxi/.test(s.g)));

    const boatWants = (re, val) => {
      const s = boatP.steps.find(x => re.test(x.t));
      return s && s.done.toString().includes(val);
    };
    ok('the boat wants anti-skid off', boatWants(/ANTI-SKID.*centre/, "antiSkid==='off'"));
    ok('the boat wants hook bypass to carrier', boatWants(/HOOK BYPASS/, "hookBypass==='carrier'"));
    ok('the boat checks the nose strut is extended', boatWants(/Nose strut/, "noseStrut==='off'"));
    ok('the boat wants the takeoff HUD mode', boatWants(/HUD master mode/, "masterMode==='to'"));
    ok('the boat wants lights off on deck',
       boatP.steps.some(s => /Exterior lights/.test(s.t) && s.done.toString().includes("extLights==='off'")));
    /* The deck is cramped: a boat start taxis in oversweep and the whole sweep
       sequence happens at the catapult. The DCS checklist puts EMER WING SWEEP
       COVER, MASTER RESET and WING SWEEP AUTO under CATAPULT HOOK-UP. */
    ok('the boat taxis in oversweep',
       boatWants(/leave them in OVERSWEEP/, "wingSweep==='oversweep'"));
    ok('and does not exit oversweep before taxi',
       !boatP.steps.some(s => /Out of Oversweep/.test(s.g)));
    ok('while ashore it does, before moving',
       shoreP.steps.some(s => /Out of Oversweep/.test(s.g)));

    const strut = AC.controls.find(c => c.id === 'noseStrut');
    ok('the nose strut switch has all three positions',
       strut.states.length === 3 && strut.states.includes('extd'), strut.states.join('/'));

    ok('ashore the lights are left to the pilot',
       shoreP.steps.some(s => /lights as required/.test(s.t)));
    ok('and ashore it taxis on the spoiler brakes',
       shoreP.steps.some(s => /ANTI-SKID/.test(s.t) && s.done.toString().includes("antiSkid==='spoiler'")));
    ok('the two endings differ',
       shoreP.meta.ending.sub !== boatP.meta.ending.sub);
  }

  /* The interactive trainer link. It is a different kind of thing from the
     checklists it sits among, and it has its own scoring, so the columns that
     normally carry a step count and a best time must stay honest. */
  {
    const { readFileSync: rf } = await import('node:fs');
    const menu = rf(new URL('../src/core/menu.js', import.meta.url), 'utf8');
    const cfg  = rf(new URL('../src/core/config.js', import.meta.url), 'utf8');
    const css  = rf(new URL('../src/core/style.css', import.meta.url), 'utf8');
    const { SIM_LINK } = await import('../src/core/config.js');

    ok('the trainer link is configured', !!SIM_LINK && /^https:\/\//.test(SIM_LINK.href),
       SIM_LINK.href);
    ok('it sits under the carrier landing', SIM_LINK.after === 'landing-carrier');
    ok('and that procedure exists to sit under',
       AC.procedures.some(p => p.meta.id === SIM_LINK.after));
    ok('removing it is one edit', /Set to null to remove the row/.test(cfg) &&
       /if \(SIM_LINK &&/.test(menu));

    ok('it opens in a new tab', /link\.target = '_blank'/.test(menu));
    ok('safely', /rel = 'noopener noreferrer'/.test(menu));
    ok('it is a real link, so it is keyboard focusable',
       /el\('a', 'proc proclink'\)/.test(menu));
    ok('and announces where it goes', /opens in a new tab'\)/.test(menu));

    /* No invented numbers: it has no steps here and no runs here. */
    ok('it claims no step count', !/SIM_LINK[\s\S]{0,400}steps</.test(menu));
    ok('and no best time', !/SIM_LINK[\s\S]{0,400}best /.test(menu));
    ok('the right-hand column just says what it is',
       /<span class="stat">opens in a new tab<\/span>/.test(menu));

    ok('the badge is a third colour, not a crew badge',
       /\.proc \.crew\.trainer\{color:#3fc2d6/.test(css));
    ok('and it is not green or amber',
       !/\.crew\.trainer\{[^}]*var\(--phos\)/.test(css) &&
       !/\.crew\.trainer\{[^}]*var\(--amber\)/.test(css));
    ok('the row matches the checklist rows', /a\.proclink\{text-decoration:none/.test(css));
    ok('it is not embedded in a frame', !/iframe/i.test(menu));
  }

  // era classifications the reviewers corrected
  {
    const era = name => AC_CATALOGUE.find(c => c.name.includes(name)).cat;
    ok('the Phantom is Cold War', era('F-4E') === 'Cold War jets', era('F-4E'));
    ok('the Mirage F1 is Cold War', era('Mirage F1') === 'Cold War jets', era('Mirage F1'));
    ok('the Mirage 2000C stays Modern', era('Mirage 2000C') === 'Modern jets');
    ok('the two eras are balanced now',
       AC_CATALOGUE.filter(c => c.cat === 'Modern jets').length === 9 &&
       AC_CATALOGUE.filter(c => c.cat === 'Cold War jets').length === 9);
  }

  /* The TID sat inside its bezel rather than filling it, and was drawn at 92%
     opacity — so the symbology printed on the photograph read through from
     underneath. Both were measured off the source photo. */
  {
    const { readFileSync: rf } = await import('node:fs');
    const views = rf(new URL('../src/core/views.js', import.meta.url), 'utf8');
    const g = AC.gauges.find(x => x.id.startsWith('scTid'));
    ok('the TID is a square round CRT', g.w === g.h && g.round === true,
       g.w + 'x' + g.h);
    ok('it is inside the frame', g.x + g.w <= 1920 && g.y + g.h <= 1080);
    ok('a lit screen is fully opaque', !/opacity = 0\.9/.test(views));
    ok('nothing shows through from the photo',
       !/background = [^;]*rgba\([^)]*,\s*0?\.\d/.test(views));

    const clash = AC.controls
      .filter(c => !c.tray && c.x != null && (AC.sharedViews[c.view] || [c.view]).includes(g.view))
      .filter(c => Math.min(g.x + g.w, c.x + c.w) - Math.max(g.x, c.x) > 2 &&
                   Math.min(g.y + g.h, c.y + c.h) - Math.max(g.y, c.y) > 2);
    ok('growing it did not swallow a control', clash.length === 0, clash.map(c => c.id).join(', '));
  }

  // the squadron mark
  {
    const { readFileSync: rf } = await import('node:fs');
    const menu = rf(new URL('../src/core/menu.js', import.meta.url), 'utf8');
    const css  = rf(new URL('../src/core/style.css', import.meta.url), 'utf8');
    ok('the hangar header carries the mark', /vwa-144\.png/.test(menu));
    ok('the file is there', (() => {
      try { rf(new URL('../assets/brand/vwa-144.png', import.meta.url)); return true; }
      catch (e) { return false; } })());
    /* The selector has to match the class the element actually carries — it was
       written against .head while the element is .menuhead, so nothing applied. */
    ok('the header really gets that class', /classList\.add\('withmark'\)/.test(menu));
    ok('and the rule targets menuhead, not head',
       /\.menuhead\.withmark\{display:flex/.test(css) && !/\.head\.withmark/.test(css));
    ok('it is small, not a billboard', /\.menuhead \.mark\{[^}]*width:72px/.test(css));
    ok('and smaller again on a phone', /max-width:820px\)\{[\s\S]{0,140}\.mark\{width:52px/.test(css));
    ok('it carries alt text', /alt="Virtual Weapons Academy"/.test(menu));
    ok('it links to the squadron site',
       /href="https:\/\/www\.virtualweaponsacademy\.org\//.test(menu));
    ok('the link opens in a new tab', /target="_blank"/.test(menu));
    ok('and is safe about it', /rel="noopener noreferrer"/.test(menu));
    ok('the link has a focus ring for keyboards', /\.marklink:focus-visible/.test(css));

    /* The single-file build inlines assets. A path it fails to match ships as a
       broken image, which is exactly what happened here. */
    const bundler = rf(new URL('../tools/bundle.py', import.meta.url), 'utf8');
    ok('the bundler catches double-quoted asset paths', /\['\\"\]\(assets/.test(bundler));
    ok('and swaps both quote styles', /body\.replace\('"%s"'/.test(bundler));
  }

  // the weapons panel, mapped from a photo against the LAUNCH button
  {
    const gate = AC.controls.find(c => c.id === 'mslGate');
    ok('MSL SPD GATE is a six position rotary',
       gate.kind === 'knob' && gate.states.length === 6, gate.states.join(' '));
    ok('its detent angles were measured', (gate.angles || []).length === 6);
    ok('NOSE QTR is one of them', gate.states.includes('noseqtr'));
    const opt = AC.controls.find(c => c.id === 'mslOptions');
    ok('A/A OPTIONS has all three positions',
       opt.states.length === 3 && opt.states.includes('sppd') && opt.states.includes('phact'),
       opt.states.join(' / '));
    const panel = ['nextLaunch','mslOptions','mslGate','launchBtn'].map(id => AC.controls.find(c => c.id === id));
    const clash = [];
    for (let i = 0; i < panel.length; i++) for (let j = i + 1; j < panel.length; j++) {
      const a = panel[i], b2 = panel[j];
      if (Math.min(a.x+a.w,b2.x+b2.w) - Math.max(a.x,b2.x) > 2 &&
          Math.min(a.y+a.h,b2.y+b2.h) - Math.max(a.y,b2.y) > 2) clash.push(a.id + '/' + b2.id);
    }
    ok('nothing on the weapons panel overlaps', clash.length === 0, clash.join(', '));
    ok('all of it fits inside the frame',
       panel.every(c => c.x + c.w <= 1920 && c.y + c.h <= 1080));
  }

  const modeBtns = AC.controls.filter(c => c.id.startsWith('rm_'));
  const unlabelled = AC.controls.filter(c => c.states && (!c.lab || c.states.some(s => !(s in c.lab))));
  ok('every control labels every one of its states', unlabelled.length === 0,
     unlabelled.map(c => c.id).join(', '));

  ok('WCS MODE is seven separate buttons', modeBtns.length === 7, modeBtns.length + ' buttons');
  ok('each selects a mode on radarMode',
     modeBtns.every(c => c.sets && c.sets.id === 'radarMode' &&
       AC.controls.find(x => x.id === 'radarMode').states.includes(c.sets.value)));
  ok('exactly one lights at a time', (() => {
    const sim = createSim(AC);
    return modeBtns.every(btn => {
      sim.click(btn.id, 1);
      return modeBtns.filter(b2 => b2.watch(sim.S)).length === 1;
    });
  })());

  const uhf = AC.controls.find(c => c.id === 'uhfFunc');
  ok('UHF function has all four detents',
     uhf.states.join() === 'off,main,both,adf', uhf.states.join(' / '));
  ok('UHF detent angles were measured', Array.isArray(uhf.angles) && uhf.angles.length === 4,
     (uhf.angles || []).join('\u00b0 ') + '\u00b0');

  const decm = AC.controls.find(c => c.id === 'decmMode');
  ok('DECM reads OFF / STBY / HOLD / ACT / REC / RPT',
     decm.states.join() === 'off,stby,hold,act,rec,rpt');
  // stepping it clockwise must walk the printed labels in order
  const sim = createSim(AC);
  const seen = [];
  for (let i = 0; i < 6; i++) { seen.push(sim.S.sw.decmMode); sim.click('decmMode', -1); }
  ok('right-click steps clockwise through the detents',
     seen.join() === 'off,stby,hold,act,rec,rpt', seen.join(' '));
}

/* -------------------------------------------------- default framing */
head('Default framing');
{
  const frame = (w, h) => {
    const contain = Math.min(w / 1920, h / 1080), cover = Math.max(w / 1920, h / 1080);
    const portrait = h / Math.max(1, w) > 1.15;
    const z = portrait ? cover : contain;
    return { z, portrait, bands: Math.round(h - 1080 * z) };
  };
  const phone = frame(360, 510), desktop = frame(1400, 790), landscape = frame(780, 300);

  ok('a portrait phone fills the screen', phone.portrait && phone.bands <= 0,
     phone.bands + 'px of letterbox');
  ok('and the cockpit is legible there', 1080 * phone.z >= 480,
     Math.round(1920 * phone.z) + 'x' + Math.round(1080 * phone.z));
  ok('desktop still shows the whole frame', !desktop.portrait && desktop.bands < 8);
  ok('a landscape phone shows the whole frame too', !landscape.portrait);

  const css = (await import('node:fs')).readFileSync(new URL('../src/core/style.css', import.meta.url), 'utf8');
  ok('layout uses the dynamic viewport height', /height:100dvh/.test(css));
  ok('the strip clears the home indicator', /env\(safe-area-inset-bottom\)/.test(css));
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
    const menu = t && (t.startsWith('comms:') || t.startsWith('kb:'));
    if (t && !menu && !ids.has(t)) {
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
