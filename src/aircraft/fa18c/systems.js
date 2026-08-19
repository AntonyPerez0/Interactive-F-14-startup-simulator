/* ============================================================
   F/A-18C HORNET · SYSTEMS
   Everything physical: battery and generators, the APU, the two F404s,
   hydraulics, the INS alignment and the bleed air the fire test steals.
   The core sim knows none of it — it calls initState / beforeChange /
   onChange / tick and reads whatever we leave on the state object.

   The numbers are DCS numbers, not NATOPS ones, because that is what the
   student is about to sit in front of: ground idle 65% N2, a light-off
   above 25%, EGT peaking around 600 °C on a healthy start, generators
   online near 55%. Where the guide gives a figure it wins.
   ============================================================ */

import { clamp, approach } from '../../core/sim.js';

/* ---------------- engine constants ---------------- */
const MOTOR_N2   = 25;    // what the ATS can motor to on APU air
const LIGHT_MIN  = 24;    // below this a throttle to IDLE is a hung start
const IDLE_N2    = 65;    // ground idle, guide says 60-65
const MIL_N2     = 98;
const GEN_ONLINE = 55;    // generator picks up here, and its caution goes out
const EGT_LIMIT  = 750;   // guide: do not exceed until it stabilises

/* ---------------- APU ---------------- */
const APU_SPOOL = 12;     // seconds from switch ON to the green READY light
const APU_COOL  = 60;     // it shuts itself down this long after the second engine

/* ---------------- INS ----------------
   Guide: a normal alignment is about 8 minutes, a stored-heading one about 90
   seconds. CV is the carrier alignment and takes its position off the ship. */
const INS_TIME = { gnd: 480, cv: 480, stored: 90 };

export function initState(S, sw) {
  /* As parked: brake out, everything dark, canopy open, seat safe. Anything a
     control declares an `init` for is already set by the core — this is only
     for the handful the checklist expects to find somewhere specific. */
  Object.assign(sw, {
    parkBrake: 'engaged', canopy: 'open', ejectSeat: 'safe', harness: 'unlocked',
    throttleL: 'off', throttleR: 'off', engCrank: 'off', fingerLifts: 'down',
  });

  Object.assign(S, {
    power: false,                 // battery bus alive
    apu: { on: false, t: 0, ready: false },
    eng: {
      L: { n2: 0, egt: 15, ff: 0, lit: false, gen: false, hung: false, cranking: false },
      R: { n2: 0, egt: 15, ff: 0, lit: false, gen: false, hung: false, cranking: false },
    },
    bothIdleT: 0,
    /* The fire and bleed air test closes both engine bleed air valves and
       leaves them closed. Re-opening them is a step everybody forgets, so the
       model has to actually punish forgetting it. */
    bleedClosed: false,
    ecs: false,
    hyd: { a: 0, b: 0 }, brakePsi: 3100,
    fuel: 10400,
    /* Read by the instrument layer. On the ground they are static, which is
       the honest answer for a trainer that does not fly — but they are here
       rather than printed on the drawing, so a cold jet reads like a cold jet
       and they move the moment anything makes them move. */
    alt: 0, ias: 0, radalt: 0, cabinAlt: 0,
    ins: { mode: null, t: 0, complete: false, aligned: false },
    insLeft,
    fcsBit: { run: false, t: 0, done: false },
    fireTest: { held: 0, doneA: false, doneB: false },
    ltTestT: 0,
    chocks: true, launchRequested: false,
    caution: {
      apuAcc: false, ckSeat: false, battSw: false, fcsHot: false,
      genTie: false, fuelLo: false, fces: false, lGen: false, rGen: false,
      masterCaution: false, hook: false,
      /* Lamps rather than cautions: the renderer lights any control of kind
         `lamp` from this map, so anything on the panel that glows lives here
         too — the green APU READY, the HOOK light, READY/DISCH, the FLAPS
         advisory and the standby caution panel as a whole. */
      apuReady: false, hookDown: false, ready: false, flapsOut: false,
      stbyPanel: false, fireL: false, fireR: false,
    },
  });
}

/* ---------------- vetoes and side effects on a click ---------------- */

export function beforeChange(sim, c, dir) {
  const S = sim.S;

  /* Rotating the bleed air knob re-opens the valves the fire test closed.
     This is in beforeChange rather than onChange because the knob ENDS where it
     started: the guide says to turn it a full circle from NORMAL back to
     NORMAL. There is no state change to hear, only a click, so listening for
     the change would mean the one step everybody forgets could never be
     completed. */
  if (c.id === 'bleedAir' && S.bleedClosed) {
    S.bleedClosed = false;
    sim.emit('Bleed air valves re-opened. The ECS comes up.', 'good');
  }

  /* Cranking without the APU is the classic first mistake. It is allowed —
     the switch moves — but nothing happens and the fault says why. */
  if (c.id === 'engCrank' && !S.apu.ready && dir !== 0) {
    if (!S.apu.on) sim.emit('The engine crank switch does nothing until the APU is running.', 'warn');
    else sim.emit('The APU has not reached READY yet — wait for the green light.', 'warn');
  }
  return true;
}

export function onChange(sim, id, to) {
  const S = sim.S;

  if (id === 'battSw') S.power = to === 'on' || to === 'oride';

  if (id === 'apuSw' && to === 'on' && !S.power) {
    sim.emit('No electrical power — the battery has to be on first.', 'warn');
  }
  /* Note what is NOT here: nothing latches whether the APU is running. See the
     APU block in tick(). */

  /* The fire and bleed air test is spring-loaded, and closing both bleed air
     valves is its real consequence. */
  if (id === 'fireTest') {
    if (to === 'testa' || to === 'testb') {
      S.bleedClosed = true;
      if (to === 'testa') S.fireTest.doneA = true; else S.fireTest.doneB = true;
      sim.emit('Fire and bleed air test running — both bleed air valves are now closed.', 'info');
    }
  }
  if (id === 'bleedAir') S.bleedClosed = false;

  /* INS: selecting an alignment mode starts the clock; NAV/IFA only mean
     anything once it has finished. */
  if (id === 'insKnob') {
    if (to === 'gnd' || to === 'cv') {
      if (S.ins.mode !== to) { S.ins.mode = to; S.ins.t = 0; S.ins.complete = false; }
    } else if (to === 'nav' || to === 'ifa') {
      S.ins.aligned = S.ins.complete;
      if (!S.ins.complete) sim.emit('The INS has not finished aligning.', 'warn');
    } else if (to === 'off') {
      S.ins.mode = null; S.ins.t = 0; S.ins.complete = false; S.ins.aligned = false;
    }
  }

  if (id === 'fcsReset') S.fcsBit.done = true;

  if (id === 'masterCaution') S.caution.masterCaution = false;

  if (id === 'hookLever') S.caution.hook = to === 'down';

  /* A throttle out of the OFF detent is the fuel valve opening. Whether that
     lights the engine depends on how fast it is already turning. */
  if (id === 'throttleL' || id === 'throttleR') {
    const side = id === 'throttleL' ? 'L' : 'R';
    const e = S.eng[side];
    if (to !== 'off' && !e.lit) {
      if (e.n2 >= LIGHT_MIN) { e.lit = true; e.hung = false; }
      else { e.hung = true; sim.fault('hung start — throttle to IDLE below 25% N2'); }
    }
    if (to === 'off') { e.lit = false; e.hung = false; }
  }
}

/* ---------------- the clock ---------------- */

export function tick(sim, dt, real) {
  const S = sim.S, sw = S.sw;

  /* APU.
     DERIVED FROM BOTH SWITCHES, EVERY FRAME — never latched.

     The first version set `apu.on` in onChange when the APU switch moved, and
     cleared it in onChange when the battery went off. That produced a state
     the cockpit could not explain: battery ON, APU switch ON, APU dead, no
     caution, no way back short of restarting the procedure. All it took was
     cycling the battery — which the checklist explicitly asks you to do, two
     steps earlier, to rewind the fire test tape.

     Anything that depends on two switches has to be computed from both of them
     on every frame. A latch is only ever correct until the other input moves. */
  const apuPowered = sw.apuSw === 'on' && S.power;
  if (!apuPowered) {
    if (S.apu.on) sim.emit('APU stopped — it lost the bus.', 'warn');
    S.apu.on = false; S.apu.t = 0; S.apu.ready = false;
  } else {
    S.apu.on = true;
    S.apu.t += dt;
    if (!S.apu.ready && S.apu.t >= APU_SPOOL) {
      S.apu.ready = true;
      sim.emit('APU READY — green light on the left console.', 'good');
    }
  }

  /* And say so, once, rather than leaving somebody watching a light that is
     never going to come on. */
  if (sw.apuSw === 'on' && !S.power) {
    S.apuNoPowerT = (S.apuNoPowerT ?? 0) + real;
    if (S.apuNoPowerT > 3 && !S.apuNoPowerWarned) {
      S.apuNoPowerWarned = true;
      sim.emit('The APU switch is ON but the battery is OFF — it cannot spool.', 'warn');
    }
  } else { S.apuNoPowerT = 0; S.apuNoPowerWarned = false; }

  /* Engines */
  for (const side of ['L', 'R']) {
    const e = S.eng[side];
    const crankingThis = sw.engCrank === side.toLowerCase() && S.apu.ready;
    e.cranking = crankingThis;
    const thr = sw[side === 'L' ? 'throttleL' : 'throttleR'];

    let target;
    if (e.lit) target = thr === 'max' ? 100 : thr === 'mil' ? MIL_N2 : IDLE_N2;
    else if (crankingThis) target = MOTOR_N2;
    else target = 0;

    e.n2 = approach(e.n2, target, e.lit ? 0.28 : 0.42, dt);
    if (e.n2 < 0.4) e.n2 = 0;

    /* EGT overshoots on light-off and settles back — that hump is the thing a
       pilot is watching for, so it is modelled rather than faded in. */
    const peak = e.lit ? (e.n2 < IDLE_N2 - 5 ? 560 + (IDLE_N2 - e.n2) * 6 : 430) : 15;
    e.egt = approach(e.egt, peak, e.lit ? 0.5 : 0.25, dt);
    if (e.egt > EGT_LIMIT && e.lit) sim.fault('hot start — EGT above 750 °C');

    e.ff = e.lit ? 600 + e.n2 * 12 : 0;
    e.gen = e.n2 >= GEN_ONLINE;

    /* A crank with the throttle still at OFF just motors, and if it is left
       there the start hangs. */
    if (crankingThis && !e.lit && e.n2 >= MOTOR_N2 - 0.5) e.hung = false;
  }

  /* Both engines settled, so the APU steps aside — the pilot never does this. */
  const bothIdle = S.eng.L.n2 >= IDLE_N2 - 3 && S.eng.R.n2 >= IDLE_N2 - 3;
  if (bothIdle) {
    S.bothIdleT += dt;
    if (S.bothIdleT >= APU_COOL && S.apu.on) {
      sim.set('apuSw', 'off');
      sim.emit('APU shutting down on its own, as it does about a minute after the second engine.', 'info');
    }
  } else S.bothIdleT = 0;

  /* Hydraulics follow the engines; the brake accumulator does not. */
  S.hyd.a = clamp(S.eng.L.n2 / IDLE_N2, 0, 1) * 3000;
  S.hyd.b = clamp(S.eng.R.n2 / IDLE_N2, 0, 1) * 3000;
  S.brakePsi = Math.max(S.hyd.b, 3000 - (sw.parkBrake === 'engaged' ? 0 : 0));

  /* ECS, once the valves are open and there is air to move. */
  S.ecs = !S.bleedClosed && sw.bleedAir === 'norm' && (S.eng.L.lit || S.eng.R.lit || S.apu.ready);

  /* INS alignment */
  if (S.ins.mode && S.power) {
    S.ins.t += dt;
    if (!S.ins.complete && S.ins.t >= INS_TIME[S.ins.mode]) {
      S.ins.complete = true;
      sim.emit('INS alignment complete — OK next to GRND QUAL.', 'good');
    }
  }

  /* Fuel burns while the engines run, so the IFEI quantity is not a printed
     number that never changes. About 60 lb a minute at idle, per engine. */
  const burning = (S.eng.L.lit ? 1 : 0) + (S.eng.R.lit ? 1 : 0);
  if (burning) S.fuel = Math.max(0, S.fuel - burning * dt * (60 / 60));

  /* Cabin altitude follows the ECS once there is air to move. */
  S.cabinAlt = approach(S.cabinAlt, S.ecs ? 8000 : 0, 0.15, dt);

  /* Cautions. On battery alone the standby panel is all you have, which is
     exactly why the checklist reads it before the APU goes on. */
  const C = S.caution;
  C.apuAcc = S.power && S.apu.on && !S.apu.ready;
  C.ckSeat = S.power && sw.ejectSeat !== 'armed';
  C.battSw = S.power && sw.battSw === 'oride';
  C.lGen = S.power && !S.eng.L.gen;
  C.rGen = S.power && !S.eng.R.gen;
  C.fuelLo = S.power && S.fuel < 1500;
  C.genTie = S.power && sw.genTie === 'reset';
  C.fces = S.power && !S.fcsBit.done && (S.eng.L.lit || S.eng.R.lit);
  C.fcsHot = false;
  C.masterCaution = C.lGen || C.rGen || C.fces || C.ckSeat || C.fuelLo;

  /* Lamps. */
  C.apuReady = S.apu.ready;
  C.hookDown = sw.hookLever === 'down';
  C.ready = S.power && S.eng.R.lit && S.eng.L.lit;
  C.flapsOut = sw.flapSw !== 'auto';
  C.stbyPanel = C.ckSeat || C.apuAcc || C.battSw || C.genTie || C.fuelLo
             || C.fces || C.lGen || C.rGen;
  C.fireL = false;
  C.fireR = false;

}

/* ---------------- the comms menus ---------------- */

/**
 * Everything the ground crew and cockpit menus can do.
 *
 * The core calls this with the `act` string from whichever menu item was
 * picked; it is the aircraft's only chance to react to a radio call, so an
 * unrecognised one is worth saying out loud rather than swallowing.
 */
export function radio(sim, act) {
  const S = sim.S;
  switch (act) {
    case 'chocksIn':   S.chocks = true;  sim.emit('Chocks in.', 'info'); break;
    case 'chocksOut':
      if (S.sw.parkBrake !== 'engaged') { sim.emit('Set the parking brake before they pull the chocks.', 'warn'); break; }
      S.chocks = false; sim.emit('Chocks and chains away.', 'good'); break;
    case 'reqLaunch':  S.launchRequested = true; sim.emit('Launch requested — the director will wave you on.', 'info'); break;
    case 'pArm':       sim.set('masterArm', 'arm');  break;
    case 'pSafe':      sim.set('masterArm', 'safe'); break;
    case 'pLifts':     sim.set('fingerLifts', 'up'); break;
    default: sim.emit('Nothing on this aeroplane answers to "' + act + '".', 'warn');
  }
}

/* ---------------- helpers the procedures and the UI use ---------------- */

/** Seconds left on the alignment, for the chip over the AMPCD. */
export function insLeft(S) {
  if (!S.ins.mode || S.ins.complete) return 0;
  return Math.max(0, INS_TIME[S.ins.mode] - S.ins.t);
}

/** Alignment progress, 0..1. */
export function insPct(S) {
  if (!S.ins.mode) return 0;
  return clamp(S.ins.t / INS_TIME[S.ins.mode], 0, 1);
}

/** True once the jet is genuinely ready to taxi. */
export function readyToTaxi(S) {
  return S.eng.L.lit && S.eng.R.lit && S.eng.L.gen && S.eng.R.gen
      && S.ins.complete && S.sw.parkBrake === 'released';
}

/**
 * The first of these pairs that is not yet set.
 *
 * A step that asks for two or three switches at once should point at whichever
 * one you still have to move, not always at the first — otherwise the highlight
 * sits on a switch that is already correct and the student hunts for the fault.
 */
export function nextOf(S, pairs) {
  for (const [id, want] of pairs) if (S.sw[id] !== want) return id;
  return pairs[pairs.length - 1][0];
}
