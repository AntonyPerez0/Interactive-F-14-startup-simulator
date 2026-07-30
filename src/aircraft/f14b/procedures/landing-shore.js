/* F-14B · SHORE LANDING (VFR) — Chuck's guide Part 6.
   Steps that are flown rather than switched carry ack:true; you confirm those
   by tapping the line, since the trainer has no flight model to watch. */

import { setAirborne, nextOf } from '../systems.js';

/* This one starts in the air, not cold and dark. */
export const setup = sim => setAirborne(sim);

export const meta = { id:'landing-shore', crew:'pilot', phase:'landing',
                      name:'Landing · shore VFR', view:'front' };

export const steps = [
/* ---------------- 1. before the break ---------------- */
{ g:'1 · Configure', t:'ANTI-SKID / SPOILER BK — <b>BOTH</b> (up)',
  note:'BOTH is the takeoff and landing position. Off the boat you would leave it OFF.',
  tgt:'antiSkid', view:'front', done:s=>s.sw.antiSkid==='both' },
{ g:'1 · Configure', t:'Landing lights — <b>ON</b>',
  tgt:'landingLights', view:'consoles', done:s=>s.sw.landingLights==='on' },
{ g:'1 · Configure', t:'HOOK BYPASS — <b>FIELD</b> (forward)',
  note:'FIELD arms the hook for a runway wire rather than the boat.',
  tgt:'hookBypass', view:'consoles', done:s=>s.sw.hookBypass==='field' },
{ g:'1 · Configure', t:'Enter the initial at <b>300–350 kt</b>, about <b>800 ft</b>',
  ack:true, done:()=>false },
{ g:'1 · Configure', t:'Wing sweep — <b>MANUAL</b>, thumb switch to <b>68°</b>',
  note:'Manual means the handle is out of its detent. The thumb switch is on the stick, so it lives in the tray at the top left.',
  tgt:'wingSweep', ctx:['sweepThumb'], view:'consoles',
  done:s=>s.sw.wingSweep!=='detent'&&s.sweep>=67.5 },
{ g:'1 · Configure', t:'Trim to compensate for the loss of lift', ack:true, done:()=>false },
{ g:'1 · Configure', t:'HUD master mode — <b>LDG</b>',
  tgt:'masterMode', view:'front', done:s=>s.sw.masterMode==='ldg' },

/* ---------------- 2. the break ---------------- */
{ g:'2 · The Break', t:'At the break — <b>speed brake out</b>, throttles <b>IDLE</b>',
  note:'Then a 45–60° bank level turn.',
  tgt:s=>nextOf(s,[['speedBrake','out'],['throttleL','idle'],['throttleR','idle']]), done:s=>s.sw.speedBrake==='out'&&s.sw.throttleL==='idle'&&s.sw.throttleR==='idle' },
{ g:'2 · The Break', t:'At <b>280 kt</b> — wing sweep <b>AUTO</b>, confirm <b>20°</b>',
  note:'Handle down into the detent. The wings drive forward on their own.',
  tgt:'wingSweep', view:'consoles', done:s=>s.sw.wingSweep==='detent'&&s.sweep<=20.5 },
{ g:'2 · The Break', t:'At <b>250 kt</b> — landing gear <b>DOWN</b>',
  tgt:'gearHandle', view:'front', done:s=>s.sw.gearHandle==='down' },
{ g:'2 · The Break', t:'At <b>225 kt</b> — flaps <b>DOWN</b>',
  tgt:'flapsLever', view:'consoles', done:s=>s.sw.flapsLever==='down' },
{ g:'2 · The Break', t:'Flaps down — engage <b>DLC</b>',
  note:'Direct Lift Control. Confirm it by checking the manoeuvring flaps and spoilers are deployed. It will not engage until the flaps are down.',
  tgt:'dlc', done:s=>s.dlcActive },
{ g:'2 · The Break', t:'Expect a nose-down pitch from each of those — <b>trim nose up</b>',
  note:'Speed brake mild, gear moderate, flaps moderate, DLC mild. All of it wants nose-up trim.',
  ack:true, done:()=>false },

/* ---------------- 3. the pattern ---------------- */
{ g:'3 · Pattern', t:'Downwind — <b>150 kt</b> at <b>600 ft</b>', ack:true, done:()=>false },
{ g:'3 · Pattern', t:'Slow to <b>ON SPEED</b> AoA — about 140–150 kt, <b>15 units</b>',
  note:'Fly the indexer, not the airspeed. Forget the E bracket on the HUD — it is not accurate in the Tomcat.',
  ack:true, done:()=>false },
{ g:'3 · Pattern', t:'Abeam at <b>1 to 1.25 nm</b>, on speed', ack:true, done:()=>false },
{ g:'3 · Pattern', t:'Turn to the <b>90</b> — altitude down to <b>450–500 ft</b>', ack:true, done:()=>false },
{ g:'3 · Pattern', t:'Roll into <b>25°</b> of bank on rudder and lateral stick only',
  note:'No longitudinal stick in the turn.', ack:true, done:()=>false },

/* ---------------- 4. the groove ---------------- */
{ g:'4 · Groove', t:'Lined up — glide slope and AoA on the <b>throttles</b>',
  note:'That is flying the ball. Stick for line-up, throttle for everything else.',
  ack:true, done:()=>false },
{ g:'4 · Groove', t:'<b>ON SPEED</b> donut — fly it onto the runway',
  note:'No flare. If the AoA is good you are on speed.', ack:true, done:()=>false },
];
