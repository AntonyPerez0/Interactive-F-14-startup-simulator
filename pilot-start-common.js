import { nextOf } from '../systems.js';
/* F-14B · PILOT START-UP, shared by the shore and carrier variants.

   Chuck's DCS F-14B guide, Part 4 sections 1-3, plus the oversweep exit from
   Part 5 steps 8-9. The carrier differences come from Deepak's F-14 tutorials
   1 and 3 — a boat start is the same jet, but the deck changes what you set
   before you ever move.

   done(s) is evaluated every frame; a step ticks itself off when the aircraft
   actually reaches that state. */

export function build(boat) {
  const steps = [

/* ---------------- 1. PILOT PRE-START ---------------- */
{g:'1 · Pilot Pre-Start', t:'Parking Brake — <b>ENGAGED</b> (pull aft)',
 note:'The black-and-yellow striped pull handle in the bottom left corner of the front panel.',
 tgt:'parkBrake', done:s=>s.sw.parkBrake==='set'},
{g:'1 · Pilot Pre-Start', t:'Ground crew — connect <b>' + (boat ? 'the deck cable' : 'Ground Electric Power') + '</b>',
 note:'\\ → F8 Ground Crew → F2 Electric Power → F1 ON. The Tomcat has no battery and no APU — it is dead until external power or a generator feeds it.',
 tgt:'comms:ground', done:s=>s.gpu},
{g:'1 · Pilot Pre-Start', t:'Ground crew — connect <b>compressed air supply</b>',
 note:'\\ → F8 → F5 Ground Air Supply → F1. The F110 has a pneumatic starter, so no air cart means no start.',
 tgt:'comms:ground', done:s=>s.airCart},
{g:'1 · Pilot Pre-Start', t:'ICS switch — <b>HOT MIC</b>',
 tgt:'ics', done:s=>s.sw.ics==='hot'},
{g:'1 · Pilot Pre-Start', t:'Jester — request <b>STARTUP</b>',
 note:'Press A for the Jester menu, then LCTRL+3.',
 tgt:'comms:jester', done:s=>s.jester.startupRequested},
{g:'1 · Pilot Pre-Start', t:'Jester — answer the comm check <b>LOUD AND CLEAR</b>',
 note:'A → LCTRL+4, once he calls for the check.',
 tgt:'comms:jester', done:s=>s.jester.commCheckDone},
{g:'1 · Pilot Pre-Start', t:'Ejection seat — <b>ARMED</b> (handle down)',
 note:'LSHIFT+E in the sim. Jester closes the canopy as soon as the seat is armed.',
 tgt:'ejectSeat', done:s=>s.sw.ejectSeat==='armed'},
{g:'1 · Pilot Pre-Start', t:'Canopy — <b>CLOSED</b>',
 note:'Jester does this for you. With a human RIO it is LCTRL+C.',
 tgt:'canopy', done:s=>s.sw.canopy==='closed'},
{g:'1 · Pilot Pre-Start', t:'Oxygen switch — <b>ON</b> (forward)',
 tgt:'oxygen', done:s=>s.sw.oxygen==='on'},
{g:'1 · Pilot Pre-Start', t:'Verify Emergency Wing Sweep handle — <b>OVERSWEEP</b> (aft)',
 note:'The jet is parked in oversweep at 68° so it does not clip anyone on a packed deck.',
 tgt:'wingSweep', done:s=>s.sw.wingSweep==='oversweep'},

/* ---------------- 2. ENGINE START ---------------- */
{g:'2 · Engine Start', t:'AIR SOURCE — <b>OFF</b>',
 note:'Bleed air has to go to the starter, not the ECS.',
 tgt:'airSource', done:s=>s.sw.airSource==='off'},
{g:'2 · Engine Start', t:'HYD TRANSFER pump — <b>SHUTOFF</b>',
 tgt:'hydTransfer', done:s=>s.sw.hydTransfer==='shutoff'},
{g:'2 · Engine Start', t:'Emergency Flight Hydraulics — <b>AUTO / LOW</b>',
 note:'Three positions: AUTO/LOW, LOW and HIGH.',
 tgt:'emergFltHyd', done:s=>s.sw.emergFltHyd==='autolow'},
{g:'2 · Engine Start', t:'L and R MASTER GEN — verify <b>NORM</b>',
 tgt:s=>nextOf(s,[['masterGenL','norm'],['masterGenR','norm']]), ctx:['masterGenR'], done:s=>s.sw.masterGenL==='norm'&&s.sw.masterGenR==='norm'},
{g:'2 · Engine Start', t:'Engine Crank — <b>R</b> (right engine first)',
 note:'Right-click the crank switch — the L / OFF / R toggle below the INLET RAMPS switches. START VALVE lights and N2 winds up to about 20%.',
 tgt:'engCrank', done:s=>s.sw.engCrank==='right'||s.eng.R.lit},
{g:'2 · Engine Start', t:'At <b>20% N2</b> — right throttle <b>OFF → IDLE</b>',
 note:'Opens the fuel valves. Igniters fire, EGT should move within 5–15 seconds.',
 tgt:'throttleR', done:s=>s.eng.R.lit},
{g:'2 · Engine Start', t:'Monitor — oil pressure rising, TIT below <b>890 °C</b>',
 note:'A hung or hot start means throttle back to CUTOFF immediately.',
 tgt:'tapeTit', done:s=>s.eng.R.n2>45},
{g:'2 · Engine Start', t:'At ~50% N2 — crank switch springs to <b>OFF</b>, START VALVE out',
 tgt:'clStartValve', done:s=>s.eng.R.n2>52&&s.sw.engCrank==='off'},
{g:'2 · Engine Start', t:'Right engine stable — <b>R GEN</b> caution out',
 note:'62–78% RPM · ~500 °C · 950–1400 pph · nozzle 100% · oil 25–35 psi · flight hyd 3000 psi.',
 tgt:'clRGen', done:s=>s.eng.R.n2>=62&&!s.caution.rGen},
{g:'2 · Engine Start', t:'Engine Crank — <b>L</b> (left engine)',
 note:'Left-click the same crank switch this time.',
 tgt:'engCrank', done:s=>s.sw.engCrank==='left'||s.eng.L.lit},
{g:'2 · Engine Start', t:'At <b>20% N2</b> — left throttle <b>OFF → IDLE</b>',
 tgt:'throttleL', done:s=>s.eng.L.lit},
{g:'2 · Engine Start', t:'Monitor — oil pressure rising, TIT below <b>890 °C</b>',
 tgt:'tapeTit', done:s=>s.eng.L.n2>45},
{g:'2 · Engine Start', t:'At ~50% N2 — crank switch springs to <b>OFF</b>, START VALVE out',
 tgt:'clStartValve', done:s=>s.eng.L.n2>52&&s.sw.engCrank==='off'},
{g:'2 · Engine Start', t:'Left engine stable — <b>L GEN</b> caution out',
 note:'Same numbers as the right: 62–78% RPM, ~500 °C, 950–1400 pph, nozzle 100%, oil 25–35 psi.',
 tgt:'clLGen', done:s=>s.eng.L.n2>=62&&!s.caution.lGen},
{g:'2 · Engine Start', t:'HYD TRANSFER pump — <b>NORM</b>',
 tgt:'hydTransfer', done:s=>s.sw.hydTransfer==='norm'},
{g:'2 · Engine Start', t:'Verify COMBINED and FLIGHT hydraulics both <b>3000 psi</b>, no HYD PRESS caution',
 tgt:'dgHyd', done:s=>s.hydComb>2900&&s.hydFlt>2900&&!s.caution.hydPress},
{g:'2 · Engine Start', t:'AIR SOURCE — <b>BOTH ENG</b>',
 note:'The WCS needs ECS cooling air before the RIO can align the INS.',
 tgt:'airSource', done:s=>s.sw.airSource==='both'},
{g:'2 · Engine Start', t:'Ground crew — <b>disconnect</b> electrical power',
 note:'\\ → F8 → F2 → F2 OFF.',
 tgt:'comms:ground', done:s=>!s.gpu},
{g:'2 · Engine Start', t:'Ground crew — <b>disconnect</b> air supply',
 note:'\\ → F8 → F5 → F2.',
 tgt:'comms:ground', done:s=>!s.airCart},

/* ---------------- 3. POST-START ---------------- */
{g:'3 · Pilot Post-Start', t:'VDI, HUD and HSD power switches — <b>ON</b>',
 tgt:s=>nextOf(s,[['vdiPower','on'],['hudPower','on'],['hsdPower','on']]),
 ctx:['hudPower','hsdPower'], view:'front',
 done:s=>s.sw.vdiPower==='on'&&s.sw.hudPower==='on'&&s.sw.hsdPower==='on'},
{g:'3 · Pilot Post-Start', t:'HSD Mode — <b>TID</b>',
 note:'Repeats the RIO\'s Tactical Information Display so you can watch the INS align.',
 tgt:'hsdMode', view:'front', done:s=>s.sw.hsdMode==='tid'},
{g:'3 · Pilot Post-Start', t:'INS alignment — Jester starts a <b>FINE</b> alignment on his own',
 note:'You only need the Jester menu if you want a degraded alignment. Fine takes about 8 minutes — use time compression up top. Leave the parking brake set or it will hang.',
 tgt:'scHsd', done:s=>s.ins.mode!==null},
{g:'3 · Pilot Post-Start', t:'Wait for alignment — Jester calls <b>“Ready to taxi”</b>',
 tgt:'scHsd', done:s=>s.ins.complete},
{g:'3 · Pilot Post-Start', t:'GUN RATE — as required',
 tgt:'gunRate', done:s=>s.touched.gunRate},
{g:'3 · Pilot Post-Start', t:'SW COOL — <b>OFF</b>',
 tgt:'swCool', done:s=>s.sw.swCool==='off'},
{g:'3 · Pilot Post-Start', t:'MSL PREP — <b>OFF</b>',
 tgt:'mslPrep', done:s=>s.sw.mslPrep==='off'},
{g:'3 · Pilot Post-Start', t:'Missile MODE/STP — <b>NORM</b>',
 tgt:'modeStp', done:s=>s.sw.modeStp==='norm'},
{g:'3 · Pilot Post-Start', t:'ANTI-SKID / SPOILER BK — <b>' + (boat ? 'OFF' : 'SPOILER BK') + '</b> for the taxi',
 note:'BOTH is for takeoff and landing only. Left in BOTH during a slow taxi the brakes can drop out for 2–10 seconds as you accelerate through ~15 kt.'   + (boat ? ' Off the boat neither system is used at all.' : ''),
 tgt:'antiSkid', view:'front', done:s=>boat ? s.sw.antiSkid==='off' : s.sw.antiSkid==='spoiler'},
{g:'3 · Pilot Post-Start', t:'Verify wing sweep <b>68°</b>, handle full aft',
 tgt:'wingSweep', done:s=>s.sweep>=67.5&&s.sw.wingSweep==='oversweep'},
{g:'3 · Pilot Post-Start', t:'AFCS SAS — <b>PITCH, ROLL, YAW ON</b>',
 tgt:s=>nextOf(s,[['afcsPitch','on'],['afcsRoll','on'],['afcsYaw','on']]),
 ctx:['afcsRoll','afcsYaw'], view:'consoles',
 done:s=>s.sw.afcsPitch==='on'&&s.sw.afcsRoll==='on'&&s.sw.afcsYaw==='on'},
{g:'3 · Pilot Post-Start', t:'WING/EXT TRANS — <b>AUTO</b>',
 tgt:'wingExtTrans', view:'front', done:s=>s.sw.wingExtTrans==='auto'},
{g:'3 · Pilot Post-Start', t:'UHF 1 function selector — <b>BOTH</b>',
 tgt:'uhfFunc', view:'consoles', done:s=>s.sw.uhfFunc==='both'},
{g:'3 · Pilot Post-Start', t:'TACAN function selector — <b>T/R</b>',
 tgt:'tacanFunc', view:'consoles', done:s=>s.sw.tacanFunc==='tr'},
{g:'3 · Pilot Post-Start', t:'ARA-63 ICLS receiver power — <b>ON</b>',
 tgt:'ara63', view:'consoles', done:s=>s.sw.ara63==='on'},
{g:'3 · Pilot Post-Start', t:'Radar altimeter — one click <b>clockwise</b> to start BIT',
 note:'Watch the needle on the dial — it winds up to maximum over a second or so, hangs there, then sweeps back to zero. The whole test takes about six seconds, and time compression will not rush it. The 100 ±5 ft reading is the pilot-initiated BIT, held on the button — a different test.',
 tgt:'radAltKnob', view:'front', done:s=>s.radalt.bitDone},
{g:'3 · Pilot Post-Start', t:'Standby ADI — <b>erect the gyro</b>',
 note:'At least two minutes before takeoff. Pull and turn the knob until the ball matches your attitude.',
 tgt:'stbyAdi', view:'front', done:s=>s.sw.stbyAdi==='erect'},
{g:'3 · Pilot Post-Start', t:'Jester — datalink <b>mode and host</b> set',
 note:'A, A → LCTRL+7 DATA LINK RADIO → SET MODE → Tactical Datalink System, then SET HOST.',
 tgt:'comms:jester', done:s=>s.dl.mode&&s.dl.host},
{g:'3 · Pilot Post-Start',
 t:boat ? 'Exterior lights — <b>OFF</b> on the deck'
        : 'Set <b>lights as required</b>, then taxi when ready',
 note:boat
   ? 'The deck is lit and the director can see you. Lights showing on deck mean a radio failure, so leaving them on says something you do not mean.'
   : 'Position and anti-collision on before you move, so anyone near the jet knows it is live.',
 tgt:'extLights', view:'consoles',
 done:s=>boat ? s.sw.extLights==='off'&&s.ins.complete
              : s.touched.extLights&&s.ins.complete},

/* ---------------- 4. BEFORE TAKEOFF (guide Part 5, steps 8-9) ---------------- */
{g:'4 · Out of Oversweep', t:'Emergency Wing Sweep handle — <b>full forward to 20°</b>',
 note:'Scroll the wheel or left-click and drag the handle all the way forward.',
 tgt:'wingSweep', view:'consoles', done:s=>s.sw.wingSweep!=='oversweep'},
{g:'4 · Out of Oversweep', t:'Push the handle <b>down into the detent</b> and flip the cover over it',
 note:'Right-click to seat it. Until it is in the detent the wings stay in emergency mode.',
 tgt:'wingSweep', view:'consoles', done:s=>s.sw.wingSweep==='detent'},
{g:'4 · Out of Oversweep', t:'Press <b>MASTER RESET</b> — resets the CADC',
 note:'Very important. Without it the wing sweep AUTO mode will not work properly, and the thumb switch will not either.',
 tgt:'masterReset', view:'front', done:s=>s.cadcReset&&s.sw.wingSweep==='detent'},
{g:'4 · Out of Oversweep', t:'Wings driving to <b>20°</b> — AUTO mode restored',
 tgt:'wingSweep', view:'consoles', done:s=>s.sweep<=20.5&&s.cadcReset},
  ];

  if (boat) {
    /* On a packed deck the wings go back to 68 for the taxi and only come
       forward at the catapult, so the jet does not clip anyone on the way. */
    steps.push(
{g:'4 · Before Taxi', t:'Wings — <b>leave them in OVERSWEEP</b>',
 note:'You taxi a Tomcat across a deck at 68° and oversweep, because there is no room to do anything else. The emergency handle stays aft, and the whole sweep sequence — handle forward, detent, MASTER RESET, AUTO — happens at the catapult.',
 tgt:'wingSweep', view:'consoles', done:s=>s.sw.wingSweep==='oversweep'},
{g:'4 · Before Taxi', t:'ANTI-SKID / SPOILER BK — <b>OFF</b> (centre)',
 note:'Neither system is used off the boat. Anti-skid and the spoiler brakes both stay off.',
 tgt:'antiSkid', view:'front', done:s=>s.sw.antiSkid==='off'},
{g:'4 · Before Taxi', t:'HOOK BYPASS — <b>CARRIER</b> (aft)',
 note:'Aft is carrier, forward is field. In CARRIER you get a warning on approach if the hook is still up, which is exactly the mistake it exists to catch.',
 tgt:'hookBypass', view:'consoles', done:s=>s.sw.hookBypass==='carrier'},
{g:'4 · Before Taxi', t:'Nose strut — verify <b>OFF</b>, strut extended and the launch bar up',
 note:'Three positions, spring-loaded to OFF: KNEEL retracts the strut and unlocks the launch bar, EXTD raises and locks it again. You kneel at the catapult and nowhere else — a lowered launch bar also drops nosewheel steering out, which is the last thing you want while taxiing across a deck.',
 tgt:'noseStrut', done:s=>s.touched.noseStrut&&s.sw.noseStrut==='off'},
{g:'4 · Before Taxi', t:'HUD master mode — <b>TAKEOFF</b>',
 note:'Confirm it by looking up: vertical speed appears down the left of the HUD, plus and minus a thousand feet a minute with a caret against it.',
 tgt:'masterMode', view:'front', done:s=>s.sw.masterMode==='to'},
    );
  }

  /* The deck is cramped, so a boat start taxis in oversweep and does the whole
     sweep sequence at the catapult instead — emergency handle forward, into the
     detent, MASTER RESET, then AUTO. That belongs to the launch, not here. */
  const out = boat ? steps.filter(s => !/Out of Oversweep/.test(s.g)) : steps;
  return out.map((s, i) => ({ n: i + 1, ...s }));
}
