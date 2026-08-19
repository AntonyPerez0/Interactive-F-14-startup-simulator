/* ============================================================
   F/A-18C · every step of every checklist can actually be completed.

   The trainer confirms a step by evaluating done(S) against live aircraft
   state. That is a much better model than "tap to continue" and it has a
   matching failure: a step whose done() reads a switch the systems model never
   moves, or waits on a condition that never arrives, is a dead end. Nothing
   errors — the checklist simply stops, forever, and the only way past is SKIP.

   So this drives each procedure the way a pilot would. For a switch step it
   sets the switch the done() names; for anything else it lets the clock run.
   If a step cannot be satisfied within its budget, that is a failure and the
   step is named.
   ============================================================ */
import { createSim } from '../src/core/sim.js';
import fa18c from '../src/aircraft/fa18c/index.js';

let bad = 0;
const ok = (m, cond, note = '') => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${m.padEnd(46)} ${note}`);
  if (!cond) bad++;
};

/** The switch settings a done() is asking for, read off its source. */
function wants(step) {
  if (!step.done) return [];
  const src = step.done.toString();
  const out = [];
  for (const m of src.matchAll(/s\.sw\.(\w+)\s*===\s*['"]([^'"]+)['"]/g)) out.push([m[1], m[2]]);
  return out;
}

console.log('\nF/A-18C checklists');
console.log('------------------');

for (const proc of fa18c.procedures) {
  const sim = createSim(fa18c);
  const stuck = [];
  let acks = 0;

  for (const step of proc.steps) {
    if (step.ack) { acks++; continue; }

    // Do what the step asks.
    for (const [id, value] of wants(step)) {
      const c = fa18c.controls.find(x => x.id === id);
      if (!c) { stuck.push(`${step.n} names ${id}, which is not a control`); continue; }
      if (!c.states.includes(value)) { stuck.push(`${step.n} wants ${id}=${value}, not a position it has`); continue; }
      sim.set(id, value);
    }

    /* A step whose done() names no switch is asking for something a position
       cannot express — rotating the bleed air knob a full turn back to where it
       started, for one. Those are a CLICK, and a click is also the only path
       that runs beforeChange, so the harness has to make one rather than
       assigning state directly or it would never exercise that half of the
       model. */
    if (!wants(step).length && typeof step.tgt === 'string'
        && fa18c.controls.some(c => c.id === step.tgt && c.states)) {
      sim.click(step.tgt, 1);
    }

    // Then let the aeroplane catch up. 20 simulated minutes is longer than the
    // slowest thing on the jet (an 8 minute alignment) by a wide margin.
    let done = false;
    for (let i = 0; i < 4800 && !done; i++) {
      sim.tick(0.25);
      try { done = !!step.done(sim.S); } catch (e) { stuck.push(`${step.n} threw: ${e.message}`); break; }
    }
    if (!done && !stuck.some(s => s.startsWith(String(step.n)))) {
      stuck.push(`${step.n} never completes: ${String(step.t).replace(/<[^>]+>/g, '').slice(0, 54)}`);
    }
  }

  ok(proc.meta.name, stuck.length === 0,
     stuck.length ? stuck.slice(0, 3).join(' | ') : `${proc.steps.length} steps, ${acks} acknowledged`);
}

/* ---------------- the start-up actually starts the aeroplane ---------------- */
console.log('\nF/A-18C systems');
console.log('---------------');
{
  const sim = createSim(fa18c);
  const S = sim.S;
  const run = (n) => { for (let i = 0; i < n * 4; i++) sim.tick(0.25); };

  ok('cold and dark', !S.power && S.eng.R.n2 === 0 && !S.apu.ready);

  sim.set('battSw', 'on'); run(1);
  ok('battery brings the bus up', S.power);

  sim.set('engCrank', 'r'); run(20);
  ok('cranking without the APU does nothing', S.eng.R.n2 === 0);
  sim.set('engCrank', 'off');

  sim.set('apuSw', 'on'); run(5);
  ok('APU ACC caution while it spools', S.caution.apuAcc);
  run(15);
  ok('APU reaches READY', S.apu.ready);

  sim.set('engCrank', 'r'); run(25);
  ok('right engine motors to 25%', S.eng.R.n2 >= 24 && S.eng.R.n2 < 30, S.eng.R.n2.toFixed(1) + '%');

  sim.set('throttleR', 'idle'); run(60);
  ok('and lights off to ground idle', S.eng.R.lit && S.eng.R.n2 >= 60, S.eng.R.n2.toFixed(1) + '%');
  ok('right generator online, caution out', S.eng.R.gen && !S.caution.rGen);
  ok('EGT stayed inside the limit', S.eng.R.egt < 750, Math.round(S.eng.R.egt) + ' °C');
  ok('and hydraulic B came up with it', S.hyd.b > 2500, Math.round(S.hyd.b) + ' psi');

  // The hung start: throttle out of OFF before the engine is turning.
  const s2 = createSim(fa18c);
  s2.set('battSw', 'on'); s2.set('throttleL', 'idle');
  for (let i = 0; i < 40; i++) s2.tick(0.25);
  ok('a throttle opened below 25% hangs the start',
     s2.S.eng.L.hung && s2.S.faults.some(f => /hung/i.test(f)));

  // The fire test closes the bleed air valves and leaves them closed.
  const s3 = createSim(fa18c);
  s3.set('battSw', 'on');
  s3.set('fireTest', 'testa');
  ok('the fire test closes the bleed air valves', s3.S.bleedClosed);
  s3.click('bleedAir', 1);
  ok('and rotating BLEED AIR re-opens them, even though it ends where it started',
     !s3.S.bleedClosed);

  // Alignment.
  const s4 = createSim(fa18c);
  s4.set('battSw', 'on'); s4.set('insKnob', 'cv');
  for (let i = 0; i < 4 * 60 * 4; i++) s4.tick(0.25);
  ok('a CV alignment is not finished at 4 minutes', !s4.S.ins.complete);
  for (let i = 0; i < 5 * 60 * 4; i++) s4.tick(0.25);
  ok('and is complete by 9', s4.S.ins.complete);
}

console.log(bad ? `\n${bad} FAILURE(S)\n` : '\nF/A-18C checks passed\n');
process.exit(bad ? 1 : 0);
