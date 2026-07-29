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
    ins:{ mode:null, t:0, complete:false },
    radalt:{ t:0, bitDone:false, value:0 },
    cadcReset:false, insHungWarned:false, dlcActive:false, rioSeat:false, autoT:0, autoI:0,
    rio:{ wcsT:0, wcsUp:false, msg:'ownac', cleared:false,
          capField:null, capSign:null, capDigits:'',
          capLine:'', stbyLight:false, readyLight:false,
          entered:{ lat:false, lon:false, alt:false, mag:false } },
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
  S.ins = { mode:'fine', t:9999, complete:true };
  S.radalt = { t:9999, bitDone:true, value:0 };
  S.rio.wcsT = 99; S.rio.wcsUp = true;
  Object.keys(S.caution).forEach(k => { S.caution[k] = false; });
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
        if(to==='off' && e.lit){ e.lit=false; e.hung=false; sim.fault('Engine shut down mid-procedure'); sim.emit(side+' engine shut down.','bad'); }
        break;
      }
      case 'radAltKnob':
        if(to==='on'){ S.radalt.t=0; S.radalt.value=5000; sim.emit('Radar altimeter BIT — needle sweeps to maximum, then back to zero.','radio'); }
        else { S.radalt.bitDone=false; S.radalt.value=0; }
        break;
      case 'stbyAdi':
        if(to==='erect') sim.emit('Standby ADI erected, cage flag out.','good'); break;
      case 'capClear': case 'capSW': case 'capNE': case 'capEnter': case 'msgMagVar':
      case 'cap0': case 'cap1': case 'cap2': case 'cap3': case 'cap4':
      case 'cap5': case 'cap6': case 'cap7': case 'cap8': case 'cap9':
        if(to==='in'){ S.sw[id]='out'; cap(sim, id); }
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
      : (Object.values(R.entered).every(Boolean) ? 'PRESENT POSITION ENTERED' : 'CAP READY');
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
      case 'dlMode': S.dl.mode=true; sim.emit('Datalink mode — Tactical Datalink System.','radio'); break;
      case 'dlHost': S.dl.host=true; sim.emit('Datalink host — CVN-74 Stennis.','radio'); break;
    }
  }

/* ---------------- per-frame physics ---------------- */
export function tick(sim, dt) {
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
    // Out of the detent the wing sweep is in MANUAL and follows the thumb switch;
    // in the detent it is AUTO and sits at 20 for the approach.
    const swT = S.sw.wingSweep === 'oversweep' ? 68
              : S.sw.wingSweep === 'detent'    ? 20
              : (S.sw.sweepThumb === 'aft' ? 68 : 20);
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
    if(S.ins.mode && !S.ins.complete){
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

    // the scripted front-seater
    if(S.rioSeat){
      S.autoT += dt;
      while(S.autoI < AUTOPILOT.length && S.autoT >= AUTOPILOT[S.autoI][0]){
        const [,say,act]=AUTOPILOT[S.autoI++];
        act(S); sim.emit(say,'radio');
      }
    }

    // WCS / TID / DDD power-up. Needs cooling: both engines, bleed air, liquid cooling.
    const R=S.rio;
    const wcsOk = S.power && S.sw.wcsMode!=='off' && S.sw.liquidCool!=='off' &&
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
      S.radalt.t += dt;
      // self-BIT sweeps the needle to maximum and straight back to zero.
      // The 100 +/- 5 ft indication is the pilot-initiated BIT, held on the button.
      S.radalt.value = S.radalt.t < 4 ? 5000 : 0;
      // guide: 6000 ft is displayed for about 2 to 3 minutes while it warms up
      if(S.radalt.t > 150){
        S.radalt.bitDone=true; S.radalt.value=0;
        sim.emit('Radar altimeter BIT complete.','good');
      }
    }

    /* STBY / READY on the TID. Straight from the Heatblur manual table:
       both on for the first 45 s of initialisation, STBY alone while aligning,
       flashing when the parking brake is not set, READY alone once the second
       marker is passed, both out when the system is happy. */
    const A = S.ins, brakeSet = S.sw.parkBrake === 'set', flash = (S.t % 1) < 0.5;
    let stby = false, ready = false;
    if (S.rio.wcsUp && A.mode) {
      const weapons = insWeaponsReady(S);
      if (!brakeSet) {
        if (!weapons) { stby = flash; ready = A.t < 1 ? flash : false; }
        else          { stby = false; ready = flash; }
      } else if (A.t < 45)   { stby = true;  ready = true; }
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
    C.awg9Cond = P && S.rio.wcsUp && S.sw.liquidCool === 'off';
    C.msgOwnAC  = S.rio.wcsUp && S.rio.msg === 'ownac';
    C.msgMagVar = S.rio.wcsUp && S.rio.msg === 'magvar';
    C.masterCaution = C.lGen||C.rGen||C.oilPress||C.hydPress||C.canopy;
  }
