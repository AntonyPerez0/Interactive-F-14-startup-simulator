/* ============================================================
   F-14B · SYSTEMS
   Everything physical: engines, hydraulics, electrics, the WCS
   warm-up, the INS alignment and the CAP data entry. The core
   sim knows none of this — it just calls initState / onChange / tick.
   ============================================================ */

const IDLE_N2 = 69;
const CRUISE_N2 = 86;
const N2_TARGET = { off:IDLE_N2, idle:IDLE_N2, half:CRUISE_N2, mil:98 };      // the mid throttle detent, roughly a pattern power setting        // guide: stabilises 'around 70%', limits 62-78%
const MOTOR_N2 = 26;       // the pneumatic starter can motor to about 26%
const LIGHT_MIN = 18;      // minimum N2 for a clean light-off
const STARTER_CUTOUT = 50;
/* Timed in DCS: coarse 2.0 min, weapons employment 4.9 min, full align 7.0 min.
   The three markers split the TID track into thirds, so the caret advances
   piecewise rather than linearly with the clock. */
const INS_MARK = { coarse:120, weapons:294, fine:420 };
const INS_TIME = { now:20, coarse:120, min:294, fine:420, cva:540 };

/* the scripted front-seater, used when you are drilling the back seat */
export const AUTOPILOT = [
    [2,   'Pilot: “Ground power coming on.”',            s=>{ s.gpu=true; }],
    [7,   'Pilot: “Air cart is hooked up.”',             s=>{ s.airCart=true; }],
    [12,  'Pilot: “Seat armed, canopy coming down.”',    s=>{ s.sw.ejectSeat='armed'; s.sw.canopy='closed'; }],
    [17,  'Pilot: “Brake set, air source off, transfer pump shut off.”',
                                                         s=>{ s.sw.parkBrake='set'; s.sw.airSource='off'; s.sw.hydTransfer='shutoff'; }],
    [22,  'Pilot: “Cranking the right.”',                s=>{ s.sw.engCrank='right'; }],
    [34,  'Pilot: “Right throttle to idle.”',            s=>{ s.sw.throttleR='idle'; }],
    [70,  'Pilot: “Right is up and stable.”',            s=>{}],
    [75,  'Pilot: “Cranking the left.”',                 s=>{ s.sw.engCrank='left'; }],
    [87,  'Pilot: “Left throttle to idle.”',             s=>{ s.sw.throttleL='idle'; }],
    [123, 'Pilot: “Left is up. Transfer pump to normal.”',s=>{ s.sw.hydTransfer='norm'; }],
    [129, 'Pilot: “Bleed air to both engines — you are good for the WCS.”',
                                                         s=>{ s.sw.airSource='both'; }],
    [136, 'Pilot: “Ground power and air disconnected.”', s=>{ s.gpu=false; s.airCart=false; }],
];


/* ---------------- initial state ---------------- */
export function initState(S, sw) {
  // as parked: brake on, wings in oversweep, bleed air off, transfer AUTO/LOW
  Object.assign(sw, {
    parkBrake:'set', ejectSeat:'safe', canopy:'open',
    oxygen:'off', ics:'cold', wingSweep:'oversweep',
    airSource:'off', hydTransfer:'norm', emergFltHyd:'autolow',
    throttleL:'off', throttleR:'off', engCrank:'off',
    vdiPower:'off', hudPower:'off', hsdPower:'off', hsdMode:'nav', masterReset:'out',
    uhfFunc:'off', tacanFunc:'off', ara63:'off',
    afcsPitch:'off', afcsRoll:'off', afcsYaw:'off',
    antiSkid:'both', wingExtTrans:'auto', radAltKnob:'off', stbyAdi:'caged',
    swCool:'off', mslPrep:'off', gunRate:'low', masterArm:'off', modeStp:'norm',
  });
  Object.assign(S, {
    gpu:false, airCart:false, power:false,
    eng:{
      L:{ n2:0, egt:18, ff:0, oil:0, noz:0, lit:false, gen:false, hung:false },
      R:{ n2:0, egt:18, ff:0, oil:0, noz:0, lit:false, gen:false, hung:false },
    },
    hydFlt:0, hydComb:0, fuel:15200, sweep:68,          // parked in oversweep
    caution:{ startValve:false, lGen:false, rGen:false, oilPress:false,
              hydPress:false, canopy:false, masterCaution:false },
    jester:{ startupRequested:false, startupT:0, commCheckPending:false,
             commCheckDone:false, canopyT:0, readyCalled:false },
    ins:{ mode:null, t:0, complete:false, handset:false },
    radalt:{ t:0, bitDone:false, value:0 },
    cadcReset:false, insHungWarned:false, dlcActive:false, rioSeat:false, autoT:0, autoI:0,
    rio:{ wcsT:0, wcsUp:false, msg:'ownac', cleared:false,
          capField:null, capSign:null, capDigits:'',
          capLine:'', stbyLight:false, readyLight:false,
          entered:{ lat:false, lon:false, alt:false, mag:false,
                    hdg:false, spd:false } },
    dl:{ mode:false, host:false },
  });
}

/* Which CAP key the checklist should point at next. Walks the keystroke
   sequence — CLEAR, field, N-E, each digit in turn, ENTER — so the cue ring
   advances as you type instead of sitting on one button the whole time. */
const CAP_FIELD_KEY = { lat:'cap1', lon:'cap6', alt:'cap4', mag:'cap8' };

export function capCue(S, field, digits) {
  const R = S.rio;
  if (field === 'mag' && R.msg !== 'magvar') return 'msgMagVar';
  if (field !== 'mag' && !R.cleared) return 'capClear';
  if (R.capField !== field) return CAP_FIELD_KEY[field];
  if (!R.capSign) return 'capNE';
  if (R.capDigits.length < digits.length) return 'cap' + digits[R.capDigits.length];
  return 'capEnter';
}

/* Hands over an aircraft that is already flying: engines up, generators on,
   hydraulics pressurised, INS aligned, gear and flaps away. Landing procedures
   start here rather than cold and dark. */
export function setAirborne(sim, opts = {}) {
  const S = sim.S;
  Object.assign(S.sw, {
    throttleL:'half', throttleR:'half', engCrank:'off',
    parkBrake:'off', ejectSeat:'armed', canopy:'closed',
    oxygen:'on', ics:'hot', rioIcs:'hot',
    airSource:'both', hydTransfer:'norm',
    masterGenL:'norm', masterGenR:'norm',
    gearHandle:'up', flapsLever:'up', hookHandle:'up',
    wingSweep:'detent', sweepThumb:'fwd', speedBrake:'in', dlc:'off',
    vdiPower:'on', hudPower:'on', hsdPower:'on',
    uhfFunc:'both', tacanFunc:'tr', radAltKnob:'on', stbyAdi:'erect',
    afcsPitch:'on', afcsRoll:'on', afcsYaw:'on',
    masterMode:'cruise', liquidCool:'awg9', wcsMode:'stby', navMode:'ins',
    antiSkid:'both', masterArm:'off',
  }, opts.sw || {});
  ['L','R'].forEach(k => Object.assign(S.eng[k], {
    n2:CRUISE_N2, egt:640, ff:4200, oil:32, noz:45, lit:true, gen:true, hung:false,
  }));
  S.gpu = false; S.airCart = false; S.power = true;
  S.hydFlt = 3000; S.hydComb = 3000;
  S.sweep = 20;
  S.fuel = opts.fuel ?? 5200;
  S.ins = { mode:'fine', t:9999, complete:true, handset:false };
  S.radalt = { t:9999, bitDone:true, value:0 };
  S.rio.wcsT = 99; S.rio.wcsUp = true;
  Object.keys(S.caution).forEach(k => { S.caution[k] = false; });
  return S;
}

/* For a step that needs several switches: points at the first one still not
   where it should be, so the cue walks the group as you work it. Give it pairs
   of [id, wanted], where wanted is a value or a predicate. */
export function nextOf(S, pairs) {
  for (const [id, want] of pairs) {
    const ok = typeof want === 'function' ? want(S) : S.sw[id] === want;
    if (!ok) return id;
  }
  return pairs[pairs.length - 1][0];
}

/* ---------------- BVR: radar picture and Phoenix employment ----------------
   Not a radar simulation — a scripted picture that behaves the way the tutorial
   describes, so the switch flow and the decision order can be practised.

   Four contacts closing head-on. They only form tracks in a search or TWS mode
   with enough scan to cover them, and a track that is not being held drops. */

const PITBULL = { small: 6, norm: 10, large: 13 };      // nm the missile goes active

export function bvrSetup(sim) {
  setAirborne(sim, { sw:{ masterArm:'off', wcsMode:'xmt', mslPrep:'off', swCool:'off' } });
  const S = sim.S;
  S.bvr = {
    armed:false, prepT:0, prepped:false, coolT:0, cooled:false, weapon:'none',
    contacts: [
      { id:1, name:'Bandit 1', rng:58, az:-14, alt:31, iff:'unknown', tracked:false, prio:null, noAttack:false },
      { id:2, name:'Bandit 2', rng:61, az: -6, alt:33, iff:'unknown', tracked:false, prio:null, noAttack:false },
      { id:3, name:'Bandit 3', rng:64, az:  5, alt:33, iff:'unknown', tracked:false, prio:null, noAttack:false },
      { id:4, name:'Trailer',  rng:72, az: 17, alt:28, iff:'unknown', tracked:false, prio:null, noAttack:false },
    ],
    hooked:null, shots:[], fired:0, sttLock:null, closure:420, tidBlind:false,
  };
  return S;
}

export function bvrTick(sim, dt) {
  const S = sim.S, B = S.bvr;
  if (!B) return;

  B.armed = S.sw.masterArm !== 'off';
  B.weapon = S.sw.weaponSel;

  /* MSL PREP warms the radar missiles. The guide gives roughly two minutes;
     you can tell it is done because the missile shows white on the display. */
  if (S.sw.mslPrep === 'on' && !B.prepped) {
    B.prepT += dt;
    if (B.prepT >= 120) { B.prepped = true; sim.emit('Missile prep complete — the missiles show white.','good'); }
  } else if (S.sw.mslPrep !== 'on') { B.prepT = 0; B.prepped = false; }

  /* SW COOL chills the Sidewinder seeker. It runs for a limited time, so it is
     switched on when you expect to need it, not at start-up. */
  if (S.sw.swCool === 'on' && !B.cooled) {
    B.coolT += dt;
    if (B.coolT >= 8) { B.cooled = true; sim.emit('Sidewinder seekers cooled.','good'); }
  } else if (S.sw.swCool !== 'on') { B.coolT = 0; B.cooled = false; }

  const mode = S.sw.radarMode;
  const searching = ['pdsrch','pulsesrch','rws','twsman','twsauto'].includes(mode);
  const tws = mode === 'twsman' || mode === 'twsauto';
  const az = +S.sw.azScan, bars = +S.sw.elBars;
  // a narrow, shallow scan will not hold a spread formation
  const coverage = (az >= 20 ? 1 : 0) + (bars >= 4 ? 1 : 0) + (mode === 'twsauto' ? 1 : 0);

  B.contacts.forEach(c => {
    c.rng = Math.max(4, c.rng - (B.closure / 3600) * dt);
    if (!S.rio.wcsUp || !searching) { c.tracked = false; return; }
    const inScan = c.rng < 70 && Math.abs(c.az) <= az;
    c.tracked = inScan && (coverage >= 1 || mode === 'twsauto');
    if (!c.tracked) { if (B.hooked === c.id) B.hooked = null; }
  });

  /* A single target track holds one contact and drops the rest of the picture.
     Locks whatever is hooked, or the nearest one if you just slewed and locked. */
  /* PD Search and Pulse Search put their returns on the DDD, which is a back
     seat display. Tracks exist, the TID simply will not draw them. */
  B.tidBlind = mode === 'pdsrch' || mode === 'pulsesrch';

  if (mode === 'pdstt' || mode === 'pulsestt') {
    if (!B.sttLock) {
      const pick = B.hooked
        ? B.contacts.find(c => c.id === B.hooked)
        : B.contacts.filter(c => c.rng < 70).sort((a, b2) => a.rng - b2.rng)[0];
      if (pick) { B.sttLock = pick.id; sim.emit('Single target track on ' + pick.name + '.','radio'); }
    }
    B.contacts.forEach(c => { c.tracked = c.id === B.sttLock; });
  } else B.sttLock = null;

  // priorities: hostile or unknown, nearest first, skipping anything told not to attack
  /* Anything already being shot at drops out, so pressing launch again steps to
     the next priority — that is what makes the six shooter work. */
  const engaged = new Set(B.shots.map(s => s.target).concat(B.spent || []));
  const eligible = B.contacts
    .filter(c => c.tracked && !c.noAttack && c.iff !== 'friendly' && !engaged.has(c.id))
    .sort((a, b2) => a.rng - b2.rng);
  B.contacts.forEach(c => { c.prio = null; });
  eligible.forEach((c, i) => { c.prio = i + 1; });
  if (B.bump && eligible.length > 1) {
    const h = eligible.find(c => c.id === B.bump);
    if (h) { eligible.forEach(c => { c.prio = null; });
             [h, ...eligible.filter(c => c !== h)].forEach((c, i) => { c.prio = i + 1; }); }
  }

  // missiles in flight
  B.shots.forEach(s => {
    const c = B.contacts.find(x => x.id === s.target);
    s.tti = Math.max(0, s.tti - dt);
    s.rng = c ? c.rng : s.rng;
    s.active = s.rng <= PITBULL[S.sw.tgtSize];
  });
  B.shots = B.shots.filter(s => s.tti > 0);
}

/* fired from the launch button */
export function bvrLaunch(sim, viaTrigger = false) {
  const S = sim.S, B = S.bvr;
  if (!B) return;
  if (!B.armed) return sim.emit('Master arm is off.','bad');

  const w = B.weapon;
  if (w === 'gun') {
    if (S.sw.masterMode !== 'aa') return sim.emit('HUD is not in A/A mode.','bad');
    B.gunFired = true; B.fired++;
    return sim.emit('Guns, guns, guns.','good');
  }
  if (w === 'sw') {
    if (!B.cooled) return sim.emit('Sidewinder seeker is not cooled yet.','bad');
    B.swFired = true; B.fired++;
    return sim.emit('Fox 2.','good');
  }
  if (!B.prepped) return sim.emit('Missiles are still in prep — wait for them to show white.','bad');
  if (w === 'sp') {
    if (!B.sttLock) return sim.emit('Sparrow needs a single target track.','bad');
    B.spFired = true; B.fired++;
    return sim.emit('Fox 1.','good');
  }
  if (w !== 'ph') return sim.emit('Phoenix is not the selected weapon.','bad');
  const tgt = B.sttLock
    ? B.contacts.find(c => c.id === B.sttLock)
    : B.contacts.find(c => c.prio === 1);
  if (!tgt)            return sim.emit('No target — nothing has priority one.','bad');
  if (B.shots.some(s => s.target === tgt.id)) return sim.emit('Already a missile on that one.','radio');
  const max = B.sttLock ? 60 : 50;
  if (tgt.rng > max)   return sim.emit('Outside maximum range — ' + max + ' nm in this mode.','bad');
  B.shots.push({ target: tgt.id, tti: Math.round(tgt.rng * 4.5), rng: tgt.rng, active: false });
  (B.spent ||= []).push(tgt.id);
  B.fired++;
  sim.emit('Fox 3 on ' + tgt.name + ' at ' + tgt.rng.toFixed(0) + ' nm.','good');
}

/* the RIO's actions on a hooked track */
export function bvrHook(sim, id) {
  const B = sim.S.bvr; if (!B) return;
  const c = B.contacts.find(x => x.id === id);
  if (!c || !c.tracked) return;
  B.hooked = B.hooked === id ? null : id;
}

export function bvrDesignate(sim, iff) {
  const B = sim.S.bvr; if (!B) return;
  const c = B.contacts.find(x => x.id === B.hooked);
  if (!c) return sim.emit('Hook a track first.','bad');
  c.iff = iff;
  sim.emit(c.name + ' designated ' + iff + '.','radio');
}

export function bvrNoAttack(sim) {
  const B = sim.S.bvr; if (!B) return;
  const c = B.contacts.find(x => x.id === B.hooked);
  if (!c) return sim.emit('Hook a track first.','bad');
  c.noAttack = !c.noAttack;
  sim.emit(c.name + (c.noAttack ? ' set DO NOT ATTACK — out of the priority list.'
                                : ' back in the priority list.'), 'radio');
}

/* Taxied in with both engines running, everything still on from the flight.
   Where a shutdown starts. */
export function shutdownSetup(sim) {
  setAirborne(sim, { sw:{
    throttleL:'idle', throttleR:'idle',
    parkBrake:'set', gearHandle:'down', flapsLever:'down',
    wingSweep:'detent', antiSkid:'both', speedBrake:'in',
    landingLights:'on', extLights:'brt', masterMode:'ldg',
    irtvPower:'on', alr67Power:'on', decmMode:'stby', ale39Mode:'man',
    dlPower:'on', dlModeSw:'tac', iffMode4:'on', ara63:'on',
    wcsMode:'xmt', hookHandle:'up',
  }});
  const S = sim.S;
  S.shuttingDown = true;
  S.eng.L.n2 = S.eng.R.n2 = 69;
  S.eng.L.egt = S.eng.R.egt = 500;
  S.eng.L.ff  = S.eng.R.ff  = 1130;
  S.eng.L.noz = S.eng.R.noz = 100;
  S.fuel = 2400;
  return S;
}

export function insPct(S) {
  if (!S.ins.mode) return 0;
  return Math.min(1, S.ins.t / INS_TIME[S.ins.mode]);
}

/* Where the caret sits on the TID track. The three markers are evenly spaced
   on screen but not in time, so map each segment separately. */
export function insCaret(S) {
  if (!S.ins.mode) return 0;
  const t = S.ins.t, M = INS_MARK;
  if (S.ins.mode === 'cva') return Math.min(1, t / INS_TIME.cva);
  if (t <= M.coarse)  return (t / M.coarse) / 3;
  if (t <= M.weapons) return 1/3 + ((t - M.coarse) / (M.weapons - M.coarse)) / 3;
  return Math.min(1, 2/3 + ((t - M.weapons) / (M.fine - M.weapons)) / 3);
}

/* Past the second marker the alignment is good enough to shoot with, and the
   caret becomes a diamond. */
export function insWeaponsReady(S) {
  return !!S.ins.mode && S.ins.t >= (S.ins.mode === 'cva' ? INS_TIME.cva * 0.7 : INS_MARK.weapons);
}

/* ---------------- interaction hooks ---------------- */

/* The crank switch does not step through its positions: left-click cranks the
   left engine, right-click the right, and either returns it to OFF. Returning
   false tells the core we have handled the change ourselves. */
export function beforeChange(sim, c, dir) {
  if (c.id !== 'engCrank') return true;
  const S = sim.S;
  setCrank(sim, S.sw.engCrank !== 'off' ? 'off' : (dir > 0 ? 'left' : 'right'));
  return false;
}

export function setCrank(sim, pos) {
    const S = sim.S;
    S.power = S.gpu || (S.eng.L.gen && S.sw.masterGenL==='norm') || (S.eng.R.gen && S.sw.masterGenR==='norm');
    if(pos!=='off'){
      if(!S.power){ sim.fault('Crank attempted with no electrical power'); sim.emit('No electrical power — the crank switch does nothing.','bad'); S.sw.engCrank='off'; return; }
      if(!S.airCart){ sim.fault('Crank attempted with no air cart'); sim.emit('No air source. The F110 starter is pneumatic — call for the air cart.','bad'); S.sw.engCrank='off'; return; }
    }
    S.sw.engCrank=pos;
    if(pos!=='off') sim.emit((pos==='left'?'Left':'Right')+' engine cranking — START VALVE','radio');
  }

export function onChange(sim, id, to) {
    const S = sim.S;
    switch(id){
      case 'ejectSeat':
        if(to==='armed'){
          sim.emit('Seat armed.','good');
          if(S.jester.startupRequested) S.jester.canopyT = 0.01;
        }
        break;
      case 'ics':
        if(to==='hot') sim.emit('ICS hot mic.','good'); break;
      case 'throttleL': case 'throttleR': {
        const e = id==='throttleL' ? S.eng.L : S.eng.R;
        const side = id==='throttleL' ? 'Left' : 'Right';
        if(to==='idle' && !e.lit){
          if(e.n2 >= LIGHT_MIN){ e.lit=true; sim.emit(side+' engine light-off.','good'); }
          else if(e.n2 > 2){ e.hung=true; sim.fault('Throttle opened below 20% N2'); sim.emit(side+' throttle opened below 20% N2 — hot / hung start risk.','bad'); }
          else { sim.fault('Throttle opened before cranking'); sim.emit('No N2. Crank the engine before opening the throttle.','bad'); }
        }
        if(to==='off' && e.lit){
          e.lit=false; e.hung=false;
          if(!S.shuttingDown) sim.fault('Engine shut down mid-procedure');
          sim.emit(side+' engine shut down.', S.shuttingDown ? 'good' : 'bad');
        }
        break;
      }
      case 'radAltKnob':
        if(to==='on'){ S.radalt.t=0; S.radalt.value=0; sim.emit('Radar altimeter BIT — needle sweeps to maximum, then back to zero.','radio'); }
        else { S.radalt.bitDone=false; S.radalt.value=0; }
        break;
      case 'stbyAdi':
        if(to==='erect') sim.emit('Standby ADI erected, cage flag out.','good'); break;
      case 'capClear': case 'capSW': case 'capNE': case 'capEnter': case 'msgMagVar':
      case 'cap0': case 'cap1': case 'cap2': case 'cap3': case 'cap4':
      case 'cap5': case 'cap6': case 'cap7': case 'cap8': case 'cap9':
        if(to==='in'){ S.sw[id]='out'; cap(sim, id); }
        break;

      case 'launchBtn':
        if(to==='in'){ S.sw.launchBtn='out'; bvrLaunch(sim); }
        break;
      case 'designate':
        bvrDesignate(sim, to);
        break;
      case 'noAttack':
        if(to==='set'){ S.sw.noAttack='clear'; bvrNoAttack(sim); }
        break;
      case 'trigger':
        if(to==='fire'){ S.sw.trigger='off'; bvrLaunch(sim, true); }
        break;
      case 'nextLaunch':
        if(to==='in'){
          S.sw.nextLaunch='out';
          if(S.bvr && S.bvr.hooked){ S.bvr.bump = S.bvr.hooked; sim.emit('Priority moved to the hooked track.','radio'); }
        }
        break;
      case 'masterReset':
        if(to==='in'){
          S.sw.masterReset='out'; S.cadcReset=true;
          sim.emit('Master Reset — CADC fault detection reset.','good');
        }
        break;
      case 'wingSweep':
        if(to!=='detent') S.cadcReset=false;
        break;
      case 'parkBrake':
        if(to==='off' && S.ins.mode && !S.ins.complete)
          sim.emit('Parking brake released — INS alignment will hang.','bad');
        break;
      case 'airSource':
        if(to==='both' && S.eng.L.n2>55 && S.eng.R.n2>55)
          sim.emit('Bleed air to ECS — WCS cooling available.','good');
        break;
    }
  }

export function cap(sim, id) {
    const S = sim.S, R=S.rio;
    const FIELD={cap1:'lat', cap6:'lon', cap4:'alt', cap8:'mag'};
    const NEED ={lat:'25014', lon:'55226', alt:'197', mag:'17'};
    const NAME ={lat:'LAT', lon:'LONG', alt:'ALT', mag:'MAG VAR HDG'};

    if(id==='msgMagVar'){ R.msg='magvar'; sim.emit('CAP message — MAG VAR HDG.','radio'); }
    else if(id==='capClear'){ R.capField=null; R.capSign=null; R.capDigits=''; R.cleared=true; }
    else if(id==='capNE'){ R.capSign='NE'; }
    else if(id==='capSW'){ R.capSign='SW'; }
    else if(id==='capEnter'){
      const f=R.capField;
      if(!f){ sim.emit('Nothing selected — press the field button first (1 LAT, 6 LONG, 4 ALT, 8 HDG).','bad'); }
      else if(!R.capSign){ sim.emit('Select N-E or S-W before entering the value.','bad'); }
      else if(R.capDigits!==NEED[f]){
        sim.fault('CAP entry rejected — wrong value for '+NAME[f]);
        sim.emit('CAP rejects '+NAME[f]+' — expected '+NEED[f]+', got '+(R.capDigits||'nothing')+'.','bad');
      } else if(f==='mag' && R.msg!=='magvar'){
        sim.emit('Select the MAG VAR HDG message button first.','bad');
      } else {
        R.entered[f]=true;
        sim.emit(NAME[f]+' entered.','good');
        R.capField=null; R.capSign=null; R.capDigits=''; R.cleared=false;
      }
    }
    else {
      // the number keys are dual purpose: the first press picks the field,
      // everything after it is a digit of the value
      const d=id.replace('cap','');
      if(!R.capField){
        if(FIELD[id]){ R.capField=FIELD[id]; R.capSign=null; R.capDigits=''; }
        else sim.emit('Select a field first — 1 LAT, 6 LONG, 4 ALT or 8 HDG.','bad');
      } else if(R.capDigits.length<7) R.capDigits += d;
    }
    R.capLine = R.capField
      ? (NAME[R.capField]+'  '+(R.capSign||'--')+'  '+(R.capDigits||'_____'))
      : (['lat','lon','alt','mag'].every(k => R.entered[k])
            ? 'PRESENT POSITION ENTERED' : 'CAP READY');   // hdg/spd are handset only
  }

export function radio(sim, act) {
    const S = sim.S;
    switch(act){
      case 'gpuOn':  S.gpu=true;  sim.emit('Ground power connected.','radio'); break;
      case 'gpuOff':
        S.gpu=false;
        if(!S.eng.L.gen && !S.eng.R.gen) sim.emit('Ground power removed — aircraft is dead.','bad');
        else sim.emit('Ground power removed.','radio');
        break;
      case 'airOn':  S.airCart=true;  sim.emit('Air supply unit connected.','radio'); break;
      case 'airOff': S.airCart=false; sim.emit('Air supply unit disconnected.','radio'); break;
      case 'jStartup':
        S.jester.startupRequested=true; S.jester.startupT=0;
        sim.emit('Jester: “Running the checklist.”','radio'); break;
      case 'jLoud':
        if(S.jester.commCheckPending){ S.jester.commCheckDone=true; S.jester.commCheckPending=false;
          sim.emit('Jester: “Loud and clear.”','radio'); }
        else sim.emit('Jester has not called for a comm check yet.','bad');
        break;
      case 'insNow': case 'insCoarse': case 'insMin': case 'insFine': {
        const m = {insNow:'now',insCoarse:'coarse',insMin:'min',insFine:'fine'}[act];
        S.ins.mode=m; S.ins.t=0; S.ins.complete=false;
        sim.emit('Jester: alignment set to '+m.toUpperCase()+'.','radio'); break;
      }
      case 'jLock':
        sim.set('radarMode','pdstt');
        sim.emit('Jester: locked, single target track.','radio');
        break;
      case 'jTws':
        sim.set('radarMode','twsauto');
        sim.emit('Jester: TWS auto, tracking.','radio');
        break;
      case 'jRws':
        sim.set('radarMode','rws');
        sim.emit('Jester: back to search.','radio');
        break;
      case 'jCool':
        sim.set('liquidCool','awg9aim54');
        sim.emit('Jester: liquid cooling forward, AWG-9 and AIM-54.','radio');
        break;
      case 'dlMode': S.dl.mode=true; sim.emit('Datalink mode — Tactical Datalink System.','radio'); break;
      case 'dlHost': S.dl.host=true; sim.emit('Datalink host — CVN-74 Stennis.','radio'); break;
    }
  }

/* ---------------- per-frame physics ---------------- */
export function tick(sim, dt, dtReal = dt) {
    const S = sim.S;

    ['L','R'].forEach(k=>{
      const e = S.eng[k];
      const cranking = (S.sw.engCrank === (k==='L'?'left':'right'));
      const bleedOk  = S.sw.airSource==='off' || e.n2>50;
      const thr = S.sw['throttle'+k];

      // fuel valve already open and N2 has come up -> it lights
      if(!e.lit && thr!=='off' && S.power && e.n2 >= LIGHT_MIN){
        e.lit = true;
        sim.emit((k==='L'?'Left':'Right')+' engine light-off.'+(e.hung?' Watch the TIT — that was an early throttle.':''),
                  e.hung?'bad':'good');
        e.hung=false;
      }

      if(e.lit){
        // N2 chases whatever the throttle is asking for; the extra term is the
        // spool-up assist after light-off and only applies while below target
        const tgt = N2_TARGET[thr] ?? IDLE_N2;
        e.n2 += (tgt - e.n2) * 0.085 * dt + (e.n2 < tgt - 0.2 ? 0.9*dt : 0);
        if(e.n2 > tgt) e.n2 = tgt;
        const startPeak = e.n2 < 52 ? 340 + (52-e.n2)*8.5 : 500;
        const egtT = thr==='mil' ? 760 : thr==='half' ? 640 : startPeak;
        const ffT  = thr==='mil' ? 9500 : thr==='half' ? 4200 : 700 + (e.n2/IDLE_N2)*430;
        const nozT = thr==='mil' ? 10 : thr==='half' ? 45 : 100;
        e.egt += (Math.min(890, egtT) - e.egt) * 1.1 * dt;
        e.ff  += (ffT - e.ff) * 1.4 * dt;
        e.oil += (Math.min(32, 4 + (e.n2/IDLE_N2)*28) - e.oil) * 1.0 * dt;
        e.noz += (nozT - e.noz) * 1.2 * dt;
        e.gen = e.n2 > 55;
      } else if(cranking){
        const ceiling = bleedOk ? MOTOR_N2 : 14;   // ECS stealing bleed air = hung crank
        e.n2 += (ceiling - e.n2) * 0.30 * dt;
        e.egt += (18 - e.egt) * 0.6 * dt;
        e.ff  += (0 - e.ff) * 3*dt;
        e.oil += ((e.n2/MOTOR_N2)*8 - e.oil) * 1.0 * dt;
        e.noz += (0 - e.noz) * 1.5 * dt;
        e.gen = false;
      } else {
        e.n2  += (0 - e.n2)  * 0.55 * dt;
        e.egt += (18 - e.egt) * 0.35 * dt;
        e.ff  += (0 - e.ff)  * 2.5 * dt;
        e.oil += (0 - e.oil) * 1.5 * dt;
        e.noz += (0 - e.noz) * 1.2 * dt;
        if(e.n2 < 0.4) e.n2 = 0;
        e.gen = false;
      }
      // starter cut-out
      if(e.lit && e.egt > 890) sim.fault('TIT exceeded 890 °C during start');
      if(cranking && e.n2 >= STARTER_CUTOUT){
        S.sw.engCrank='off';
        sim.emit((k==='L'?'Left':'Right')+' starter cut out at 50% — START VALVE out.','good');
      }
      if(cranking && !bleedOk && e.n2 > 13.5 && !e._hungWarn){
        e._hungWarn = true;
        sim.fault('N2 hung — AIR SOURCE was not OFF for the start'); sim.emit('N2 hanging at 14% — AIR SOURCE is stealing the bleed air. Set it OFF.','bad');
      }
      if(!cranking) e._hungWarn = false;
    });

    // electrics
    S.power = S.gpu || (S.eng.L.gen && S.sw.masterGenL==='norm') || (S.eng.R.gen && S.sw.masterGenR==='norm');

    // Hydraulics. The two systems are independently driven — the RIGHT engine
    // pumps the FLIGHT system and the LEFT engine pumps the COMBINED system.
    // With the transfer pump in NORM they cross-connect automatically, so a
    // single running engine will carry both.
    const rDriven = S.eng.R.n2 > 55;
    const lDriven = S.eng.L.n2 > 55;
    const linked  = S.sw.hydTransfer === 'norm';
    const fltT = (rDriven || (linked && lDriven)) ? 3000 : 0;
    const cmbT = (lDriven || (linked && rDriven)) ? 3000 : 0;
    S.hydFlt  += (fltT - S.hydFlt) * 1.1 * dt;
    S.hydComb += (cmbT - S.hydComb) * 1.1 * dt;

    // wing sweep
    /* Manual sweep is the thumb switch on the throttle, and it works with the
       emergency handle stowed and the CADC running — that is the normal way to
       do it. The handle itself is for a failure of the system: forward of the
       detent it commands oversweep mechanically, and the thumb switch is then
       out of the loop.

       Stowed and thumb forward, the CADC schedules the wings itself. */
    const cadc = S.power && !S.caution.cadc;
    const swT = S.sw.wingSweep === 'oversweep' ? 68
              : S.sw.wingSweep !== 'detent'    ? 68          // handle pulled: emergency oversweep
              : (cadc && S.sw.sweepThumb === 'aft' ? 68 : 20);
    S.sweep += Math.sign(swT - S.sweep) * Math.min(Math.abs(swT-S.sweep), 7*dt);

    // fuel burn
    S.fuel = Math.max(0, S.fuel - ((S.eng.L.ff + S.eng.R.ff)/3600)*dt);

    // Jester sequencing
    const J = S.jester;
    if(J.startupRequested && !J.commCheckDone && !J.commCheckPending){
      J.startupT += dt;
      if(J.startupT > 5){ J.commCheckPending = true; sim.emit('Jester: “ICS comm check?”','radio'); }
    }
    if(J.canopyT > 0 && S.sw.canopy!=='closed'){
      J.canopyT += dt;
      if(J.canopyT > 2.5){ S.sw.canopy='closed'; J.canopyT=0; sim.emit('Jester closed the canopy.','good'); }
    }

    // INS alignment. The RIO starts a FINE alignment on his own once the jet can
    // support it; the Jester menu is only needed to ask for a degraded one.
    const insReady = S.power && S.eng.L.n2>55 && S.eng.R.n2>55 && S.sw.airSource==='both' &&
                     (!S.rioSeat || ['gnd','align','cva'].includes(S.sw.navMode));
    if(insReady && !S.ins.mode && !S.rioSeat){
      S.ins.mode='fine'; S.ins.t=0;
      sim.emit('Jester: starting INS alignment — FINE.','radio');
    }
    // back seat: the alignment follows whatever the NAV MODE selector is resting on,
    // so turning through GND on the way to CVA does not lock in a shore alignment
    if(S.rioSeat && insReady && ['gnd','align','cva'].includes(S.sw.navMode) && !S.ins.complete){
      const want = S.sw.navMode==='cva' ? 'cva' : 'fine';
      if(S.ins.mode!==want){
        S.ins.mode=want; S.ins.t=0;
        sim.emit((want==='cva'?'CVA':'GND ALIGN')+' — alignment running.','radio');
      }
    }
    // a handset alignment sits there doing nothing until it has been fed data
    const handsetWaiting = S.ins.handset && !S.ins.handsetArmed;
    if(S.ins.mode && !S.ins.complete && !handsetWaiting){
      if(insReady && S.sw.parkBrake==='set'){
        S.ins.t += dt;
        S.insHungWarned=false;
        if(S.ins.t >= INS_TIME[S.ins.mode]){
          S.ins.complete = true;
          sim.emit('Jester: “Ready to taxi!”','good');
        }
      } else if(insReady && S.sw.parkBrake!=='set' && !S.insHungWarned){
        S.insHungWarned=true;
        sim.fault('INS alignment hung — parking brake released while aligning');
        sim.emit('INS alignment hung — the jet must not move. Set the parking brake.','bad');
      }
    }

    if (S.bvr) bvrTick(sim, dt);

    /* The scripted front-seater only belongs to the alignment drills. It was
       running in every RIO procedure, so a combat or shutdown drill had someone
       cold-starting the jet underneath you. */
    if(S.frontSeater){
      S.autoT += dt;
      while(S.autoI < AUTOPILOT.length && S.autoT >= AUTOPILOT[S.autoI][0]){
        const [,say,act]=AUTOPILOT[S.autoI++];
        act(S); sim.emit(say,'radio');
      }
    }

    // WCS / TID / DDD power-up. Needs cooling: both engines, bleed air, liquid cooling.
    const R=S.rio;
    const wcsOk = S.power && S.sw.wcsMode!=='off' &&
                  S.sw.airSource==='both' && S.eng.L.n2>55 && S.eng.R.n2>55;
    if(wcsOk && !R.wcsUp){
      R.wcsT += dt;
      if(R.wcsT >= 30){ R.wcsUp=true; sim.emit('WCS up — TID and DDD online.','good'); }
    } else if(!wcsOk){ R.wcsT=0; R.wcsUp=false; }

    // DLC only engages with the flaps down
    S.dlcActive = S.sw.dlc === 'on' && S.sw.flapsLever === 'down';

    // radar altimeter BIT
    if(S.sw.radAltKnob!=='on'){ S.radalt.value=0; }
    else if(!S.radalt.bitDone){
      S.radalt.t += dtReal;   // a self-test takes as long as it takes
      /* The self-BIT drives the needle up to maximum and straight back down.
         Eased at both ends so it reads like a mechanical pointer rather than a
         number jumping. The 100 +/- 5 ft indication is the pilot-initiated BIT,
         held on the button, which is a different thing. */
      const rt = S.radalt.t;
      const ease = x => x < 0.5 ? 2*x*x : 1 - Math.pow(-2*x + 2, 2) / 2;
      if (rt < 2.4)      S.radalt.value = 5000 * ease(rt / 2.4);
      else if (rt < 3.0) S.radalt.value = 5000;
      else if (rt < 6.0) S.radalt.value = 5000 * (1 - ease((rt - 3.0) / 3.0));
      else               S.radalt.value = 0;
      /* The guide describes a two to three minute warm-up, but the review was
         specific that the self-BIT is just this sweep — so the test completes
         when the needle is back on the peg rather than a couple of minutes later. */
      if(S.radalt.t > 6.3){
        S.radalt.bitDone=true; S.radalt.value=0;
        sim.emit('Radar altimeter BIT complete.','good');
      }
    }

    /* STBY / READY on the TID. Straight from the Heatblur manual table:
       both on for the first 45 s of initialisation, STBY alone while aligning,
       flashing when the parking brake is not set, READY alone once the second
       marker is passed, both out when the system is happy. */
    const A = S.ins, brakeSet = S.sw.parkBrake === 'set', flash = (S.t % 1) < 0.5;
    /* A carrier alignment is fed by the datalink. Turn it off, put it in the
       wrong mode, or change the frequency and CAINS is gone: the alignment falls
       back to handset and starts from the beginning. Flashing HS says so. */
    if (A.mode === 'cva') {
      /* Fed over CAINS/WAYPT on the ship's own frequency. Power off, wrong
         mode, or dialling the wheels somewhere else all lose it. */
      const linkOk = S.sw.dlPower === 'on' && S.sw.dlModeSw === 'cains' &&
                     S.sw.dlFreq === '209';
      /* Only a loss counts. Selecting CVA before the datalink is set up is just
         the normal order of the checklist, not a failure. */
      if (!linkOk && !A.handset && A.t > 5) {
        A.handset = true; A.handsetArmed = false;
        A.t = 0; A.complete = false;
        sim.fault('CAINS lost — alignment fell back to handset and restarted');
        sim.emit('Lost the datalink. Handset alignment — HS flashing.','bad');
      } else if (linkOk && A.handset && A.t < 1) {
        A.handset = false; A.handsetArmed = false;
        sim.emit('Datalink back. CAINS alignment restarted.','radio');
      }

      /* Two ways out of handset. Either get CAINS back, which is the branch
         above, or feed it a present position, heading and speed by hand and let
         it align roughly on its own. Once all three are in, HS stops flashing
         and stays lit while it runs. */
      if (A.handset && !A.handsetArmed) {
        const E = S.rio.entered;
        if (E.lat && E.lon && E.hdg && E.spd) {
          A.handsetArmed = true;
          A.t = 0;
          sim.emit('Handset data in. HS steady, rough alignment running.','radio');
        }
      }
    }

    let stby = false, ready = false;
    if (S.rio.wcsUp && A.mode) {
      const weapons = insWeaponsReady(S);
      if (!brakeSet) {
        if (!weapons) { stby = flash; ready = A.t < 1 ? flash : false; }
        else          { stby = false; ready = flash; }
      } else if (A.t < 48)   { stby = true;  ready = true; }   // 0.8 min
      else if (!weapons)     { stby = true;  ready = false; }
      else if (!A.complete)  { stby = false; ready = true; }
      else                   { stby = false; ready = S.sw.navMode !== 'ins'; }
    }
    S.rio.stbyLight = stby;
    S.rio.readyLight = ready;

    // cautions
    const C=S.caution, P=S.power;
    C.startValve = P && S.sw.engCrank!=='off';
    C.lGen = P && !(S.eng.L.gen && S.sw.masterGenL==='norm');
    C.rGen = P && !(S.eng.R.gen && S.sw.masterGenR==='norm');
    C.oilPress = P && ((S.eng.L.n2>12 && S.eng.L.oil<15) || (S.eng.R.n2>12 && S.eng.R.oil<15));
    C.hydPress = P && (S.hydFlt<2100 || S.hydComb<2100);
    C.canopy = P && S.sw.canopy!=='closed';
    // RIO advisories. Both are expected while the INS is still degraded before
    // alignment and should be ignored until it completes.
    C.navComp  = P && S.rio.wcsUp && S.sw.navMode === 'ins' && !S.ins.complete;
    /* Cooling does not stop the AWG-9 working — it stops it cooking. Wrong
       position and the odds of an overheat casualty climb the longer it runs.
       AWG-9/AIM-54 (forward) is required whenever Phoenix are aboard. */
    const coolWanted = (S.bvr && S.bvr.weapon === 'ph') ? 'awg9aim54' : null;
    const coolBad = S.sw.liquidCool === 'off' ||
                    (coolWanted && S.sw.liquidCool !== coolWanted);
    if (S.rio.wcsUp && coolBad) {
      S.rio.hotT = (S.rio.hotT || 0) + dt;
      if (S.rio.hotT > 120 && !S.rio.cooked) {
        S.rio.cooked = true;
        sim.fault('Overheat casualty — the AWG-9 ran without the right cooling');
        sim.emit('Something in the nose just cooked. Liquid cooling was wrong.','bad');
      }
    } else { S.rio.hotT = 0; }
    C.awg9Cond = P && S.rio.wcsUp && coolBad;
    C.msgOwnAC  = S.rio.wcsUp && S.rio.msg === 'ownac';
    C.msgMagVar = S.rio.wcsUp && S.rio.msg === 'magvar';
    C.masterCaution = C.lGen||C.rGen||C.oilPress||C.hydPress||C.canopy;
  }
