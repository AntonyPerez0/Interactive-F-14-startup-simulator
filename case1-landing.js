/* ============================================================
   F/A-18C HORNET · CASE I RECOVERY
   Configuring for the break and the ball

   Chuck's guide, PART 6 — CARRIER LANDING, CASE I RECOVERY

   GENERATED from the procedure tables. done(s) is evaluated every frame, so a
   step ticks itself off when the aircraft actually reaches that state rather
   than when you claim it has.
   ============================================================ */
import { stamp } from './_common.js';

export const meta = { id:'case1-landing', crew:'pilot', phase:'landing', variant:'carrier',
                      name:'CASE I recovery', view:'front',
                      ending:{ title:'In the Wires', sub:'Hook clear, taxi out of the landing area.' } };

export const steps = stamp([
  {g:'1 · Inbound', t:'COMM 1 knob — PULL to select COMM 1, scroll to M (manual)',
   note:'Pull the knob to put COMM 1 on the UFC; the M position lets you type a frequency rather than pick a preset.',
   tgt:'comm1Vol', done:s=>s.sw.comm1Vol==='up'},
  {g:'1 · Inbound', t:'UFC — CLR, type 127500, ENT (carrier on 127.5 FM)',
   note:'Select FM with the option button first — ":FM" appears when it takes. Then check in, and the deck lights come on.',
   tgt:'ufcClr', done:s=>s.sw.ufcClr==='in'},
  {g:'1 · Inbound', t:'ECM selector — STBY',
   tgt:'ecmKnob', done:s=>s.sw.ecmKnob==='stby'},
  {g:'2 · The landing checklist', t:'ANTI SKID — OFF',
   note:'First of the six on the LANDING placard by your right knee. At the boat, off.',
   tgt:'antiSkid', done:s=>s.sw.antiSkid==='off'},
  {g:'2 · The landing checklist', t:'HOOK — DOWN',
   tgt:'hookLever', done:s=>s.sw.hookLever==='down'},
  {g:'2 · The landing checklist', t:'HOOK BYPASS — CARRIER',
   tgt:'hookBypass', done:s=>s.sw.hookBypass==='carrier'},
  {g:'2 · The landing checklist', t:'LANDING / TAXI lights — ON',
   note:'On a Hornet the landing light position is also the LSO’s cue that you are dirty and configured.',
   tgt:'ldgTaxiLight', done:s=>s.sw.ldgTaxiLight==='on'},
  {g:'2 · The landing checklist', t:'ALT switch — RDR',
   tgt:'altSw', done:s=>s.sw.altSw==='rdr'},
  {g:'2 · The landing checklist', t:'Radar altimeter index — SET 370 ft (or 320 ft)',
   note:'370 reminds you to call the ball. 320 is the altitude you should be at three-quarters of a mile out. Pick one and be consistent.',
   tgt:'radarAlt', ack:true},
  {g:'2 · The landing checklist', t:'DISPENSER — ON',
   note:'Sixth item on the placard, and the one everybody forgets.',
   tgt:'dispenser', done:s=>s.sw.dispenser==='on'},
  {g:'2 · The landing checklist', t:'Harness — LOCKED',
   note:'Fifth on the placard. Nothing on this layout to click; it is the lever by your left hip.', ack:true},
  {g:'3 · The pattern', t:'Upwind at 350 kt, 800 ft. Break with G equal to 1% of airspeed.',
   note:'3.5 G at 350 kt. Done properly it puts the downwind 1.2 nm abeam, which is where it needs to be.', ack:true},
  {g:'3 · The pattern', t:'Abeam 250 kt, 600 ft — GEAR DOWN',
   key:'G',
   tgt:'gearHandle', done:s=>s.sw.gearHandle==='down'},
  {g:'3 · The pattern', t:'FLAPS — FULL',
   key:'F',
   tgt:'flapSw', done:s=>s.sw.flapSw==='full'},
  {g:'3 · The pattern', t:'Trim to on-speed AoA 8.1° — velocity vector centred in the E bracket',
   note:'About 140–150 kt. Trim it properly on the downwind or you will fight the flight control system all the way to the ramp.', ack:true},
  {g:'3 · The pattern', t:'At the abeam, wing on the rounddown — start the approach turn',
   note:'27–30° of bank, 600 ft, holding on-speed. The turn is where the pass is won.', ack:true},
  {g:'3 · The pattern', t:'Ball call at 3/4 mile: side number, type, BALL, fuel state', ack:true},
  {g:'3 · The pattern', t:'After the trap — hook clear, taxi out of the landing area',
   tgt:'stbyCaution', ack:true},
]);
