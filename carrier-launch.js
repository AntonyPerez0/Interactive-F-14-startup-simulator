/* ============================================================
   F/A-18C HORNET · CARRIER LAUNCH
   Deck handling to the cat shot

   Chuck's guide, PART 5 — CARRIER TAKEOFF

   GENERATED from the procedure tables. done(s) is evaluated every frame, so a
   step ticks itself off when the aircraft actually reaches that state rather
   than when you claim it has.
   ============================================================ */
import { stamp } from './_common.js';

export const meta = { id:'carrier-launch', crew:'pilot', phase:'takeoff', variant:'carrier',
                      name:'Carrier launch', view:'lower',
                      ending:{ title:'Off the Cat', sub:'Gear up, flaps auto, clearing turn.' } };

export const steps = stamp([
  {g:'1 · Off the chocks', t:'INS knob — confirm IFA (or NAV) after the CV alignment',
   note:'Left in CV, the platform keeps taking its position from a ship you are about to leave.',
   tgt:'insKnob', done:s=>s.sw.insKnob==='ifa'},
  {g:'1 · Off the chocks', t:'Ground crew — REMOVE WHEEL CHOCKS',
   note:'Canopy has to be open for them to hear you.',
   key:'\\ → F8 → F4 → F2', ack:true},
  {g:'1 · Off the chocks', t:'ANTI SKID — OFF',
   tgt:'antiSkid', done:s=>s.sw.antiSkid==='off'},
  {g:'1 · Off the chocks', t:'LAUNCH BAR — RETRACT',
   note:'Extended, it disconnects nosewheel steering, and you cannot taxi a Hornet without nosewheel steering.',
   tgt:'launchBar', done:s=>s.sw.launchBar==='retract'},
  {g:'1 · Off the chocks', t:'HOOK BYPASS — CARRIER',
   tgt:'hookBypass', done:s=>s.sw.hookBypass==='carrier'},
  {g:'1 · Off the chocks', t:'Wings — FOLDED for taxi',
   tgt:'wingFold', done:s=>s.sw.wingFold==='fold'},
  {g:'1 · Off the chocks', t:'Parking brake — RELEASED, taxi',
   tgt:'parkBrake', done:s=>s.sw.parkBrake==='released'},
  {g:'2 · Onto the catapult', t:'Nosewheel steering — HIGH GAIN for the deck',
   note:'Hold the undesignate/NWS button. Low gain gives ±16°, high gain ±75°, and the deck is tight.',
   key:'S', ack:true},
  {g:'2 · Onto the catapult', t:'On the cat, on the director’s signal — WING FOLD to SPREAD',
   note:'Right-click to spread, wait for them to come all the way out, then push the lever in to lock. WING UNLK on the HUD repeater until you do.',
   tgt:'wingFold', done:s=>s.sw.wingFold==='spread'},
  {g:'2 · Onto the catapult', t:'WING FOLD handle — PUSH IN to lock',
   note:'Spread is not locked. The caution stays up until the actuators are pinned.',
   tgt:'wingFold', done:s=>s.sw.wingFold==='spreadlocked'},
  {g:'2 · Onto the catapult', t:'LAUNCH BAR — EXTEND',
   note:'On the director’s signal. Nosewheel steering drops out the moment it goes down, which is why this is late.',
   tgt:'launchBar', done:s=>s.sw.launchBar==='extend'},
  {g:'2 · Onto the catapult', t:'Throttle up to ride into the shuttle; holdback engages, then IDLE',
   note:'Significant power may be needed. Without Supercarrier, U hooks you up.',
   key:'U', ack:true},
  {g:'2 · Onto the catapult', t:'LAUNCH BAR — RETRACT to seat it in the shuttle',
   note:'Counter-intuitive but correct: hydraulic pressure pulls the bar up against the shuttle, which holds it mechanically.',
   tgt:'launchBar', done:s=>s.sw.launchBar==='retract'},
  {g:'3 · Ready for launch', t:'Trim — SET by weight (16° / 17° / 19° nose up)',
   note:'T/O TRIM alone gives about 12°, which is not enough off a catapult. Weight is on the SUPT CHKLST page, stabilator angle on SUPT FCS.', ack:true},
  {g:'3 · Ready for launch', t:'Speed brake — IN. Control wipeout — stick and rudder to all four stops.', ack:true},
  {g:'3 · Ready for launch', t:'MASTER ARM — as briefed',
   note:'Armed on the cat only if the mission calls for it. Deck crew are standing inside the weapons envelope.',
   tgt:'masterArm', done:s=>s.sw.masterArm==='arm'},
  {g:'3 · Ready for launch', t:'Finger lifts — UP, throttle to MAX',
   note:'With the hook or launch bar down there is an afterburner lockout. Raise the finger lifts or the throttles stop at MIL.',
   key:'0 and 9', ack:true},
  {g:'3 · Ready for launch', t:'SALUTE the shooter',
   key:'LCTRL + LSHIFT + S', ack:true},
  {g:'4 · Airborne', t:'Positive rate — GEAR UP before 240 kt',
   key:'G',
   tgt:'gearHandle', done:s=>s.sw.gearHandle==='up'},
  {g:'4 · Airborne', t:'FLAPS — AUTO',
   key:'F',
   tgt:'flapSw', done:s=>s.sw.flapSw==='auto'},
  {g:'4 · Airborne', t:'ALT switch — BARO passing 3,000 ft',
   tgt:'altSw', done:s=>s.sw.altSw==='baro'},
]);
