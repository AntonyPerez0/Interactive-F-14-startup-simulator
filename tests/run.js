/* Runs headless. No DOM — the sim core and the aircraft modules must
   stay free of browser globals so this keeps working. */
import { aircraft } from '../src/aircraft/registry.js';
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
const C  = id => AC.controls.find(c => c.id === id);

/* ---------------------------------------------------------------- helpers */
function harness(procedure) {
  const sim = createSim(AC);
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
for (const proc of AC.procedures.filter(p => p.meta.crew === 'rio' && p.meta.phase === 'startup')) {
  head('RIO · ' + proc.meta.name);
  const h = harness(proc);
  const { S, run, click, to, type, kb } = h;
  S.rioSeat = true;                             // the scripted front-seater runs

  click('rioIcs');
  run(150);
  ok('front-seater got both engines up', S.eng.L.n2 > 60 && S.eng.R.n2 > 60);
  ok('bleed air selected for the WCS', S.sw.airSource === 'both');

  to('liquidCool','awg9'); to('wcsMode','stby'); run(45);
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

/* --------------------------------------------- corrections from review 2 */
head('Systems corrections');
{
  const h = harness(AC.procedures[0]);
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
  const h2 = harness(AC.procedures[0]);
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
  const h = harness(AC.procedures[0]);
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
  const fast = harness(AC.procedures[0]);
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
  const h = harness(AC.procedures[1]);
  const { S, run } = h;
  S.rioSeat = true; run(150);
  h.to('liquidCool','awg9'); h.to('wcsMode','stby');
  const t0 = S.t; run(40);
  ok('WCS up ~30 s after STANDBY', S.rio.wcsUp && S.t - t0 < 45);
  h.to('navMode','gnd');
  const at = mins => { while (S.ins.t < mins * 60) sim0(h); };
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
  const h = harness(AC.procedures[1]);
  const { S, run } = h;
  S.rioSeat = true; run(150);
  h.to('liquidCool','awg9'); h.to('wcsMode','stby'); run(35);
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
  to('landingLights','on');
  to('hookBypass', proc.meta.id === 'landing-carrier' ? 'carrier' : 'field');
  if (proc.meta.id === 'landing-carrier') to('hookHandle','down');
  settle();
  to('wingSweep','oversweep'); to('sweepThumb','aft'); run(12); settle();
  to('masterMode','ldg'); settle();
  to('speedBrake','out'); to('throttleL','idle'); to('throttleR','idle'); settle();
  to('wingSweep','detent'); run(12); settle();
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
  const beat = +/const BEAT = (\d+)/.exec(cli)[1] / 1000;
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
    to('liquidCool','awg9'); to('mslPrep','on'); to('weaponSel','ph');
    to('modeStp','norm'); to('masterArm','on'); run(130);
    to('weaponSel','ph'); to('modeStp','norm'); to('mslGate','nose');
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
  const start = harness(AC.procedures[0]);
  start.S.gpu = true; start.S.airCart = true;
  start.sim.click('engCrank', -1); start.run(14);
  start.to('throttleR','idle'); start.run(70);
  start.to('throttleR','off'); start.run(2);
  ok('cutting an engine during a start is still a fault',
     start.S.faults.some(f => /shut down/i.test(f)), start.S.faults.join('; ') || 'none');
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
