/* ============================================================
   F/A-18C HORNET · SHUTDOWN
   Securing the jet on deck

   Not in the guide — the start-up reversed, in the order the systems tolerate

   GENERATED from the procedure tables. done(s) is evaluated every frame, so a
   step ticks itself off when the aircraft actually reaches that state rather
   than when you claim it has.
   ============================================================ */
import { stamp } from './_common.js';

export const meta = { id:'shutdown', crew:'pilot', phase:'shutdown', variant:'carrier',
                      name:'Shutdown', view:'lower',
                      ending:{ title:'Cold and Dark', sub:'Chocked, chained, battery off.' } };

export const steps = stamp([
  {g:'1 · Secure the jet', t:'Parking brake — ENGAGED',
   note:'First, and before anything is switched off. The brake accumulator is charged now and will not be in a minute.',
   tgt:'parkBrake', done:s=>s.sw.parkBrake==='engaged'},
  {g:'1 · Secure the jet', t:'MASTER ARM — SAFE',
   tgt:'masterArm', done:s=>s.sw.masterArm==='safe'},
  {g:'1 · Secure the jet', t:'WING FOLD — FOLD',
   note:'Pull the lever out, then rotate to FOLD. Deck space is the scarcest thing on the ship.',
   tgt:'wingFold', done:s=>s.sw.wingFold==='fold'},
  {g:'1 · Secure the jet', t:'HOOK — UP',
   tgt:'hookLever', done:s=>s.sw.hookLever==='up'},
  {g:'1 · Secure the jet', t:'LAUNCH BAR — RETRACT',
   tgt:'launchBar', done:s=>s.sw.launchBar==='retract'},
  {g:'1 · Secure the jet', t:'FLAPS — AUTO',
   tgt:'flapSw', done:s=>s.sw.flapSw==='auto'},
  {g:'2 · Systems off', t:'RADAR — OFF',
   tgt:'radarKnob', done:s=>s.sw.radarKnob==='off'},
  {g:'2 · Systems off', t:'INS — OFF',
   tgt:'insKnob', done:s=>s.sw.insKnob==='off'},
  {g:'2 · Systems off', t:'FLIR — OFF',
   tgt:'flirSw', done:s=>s.sw.flirSw==='off'},
  {g:'2 · Systems off', t:'LTD/R — SAFE',
   tgt:'ltdr', done:s=>s.sw.ltdr==='safe'},
  {g:'2 · Systems off', t:'ALR-67 — OFF',
   tgt:'alr67Power', done:s=>s.sw.alr67Power==='off'},
  {g:'2 · Systems off', t:'ECM — OFF',
   tgt:'ecmKnob', done:s=>s.sw.ecmKnob==='off'},
  {g:'2 · Systems off', t:'DISPENSER — OFF',
   tgt:'dispenser', done:s=>s.sw.dispenser==='off'},
  {g:'3 · Lights and engines', t:'STROBE — OFF',
   tgt:'strobeLt', done:s=>s.sw.strobeLt==='off'},
  {g:'3 · Lights and engines', t:'LDG / TAXI light — OFF',
   tgt:'ldgTaxiLight', done:s=>s.sw.ldgTaxiLight==='off'},
  {g:'3 · Lights and engines', t:'POSITION lights — OFF',
   tgt:'positionLt', done:s=>s.sw.positionLt==='off'},
  {g:'3 · Lights and engines', t:'FORMATION lights — OFF',
   tgt:'formationLt', done:s=>s.sw.formationLt==='off'},
  {g:'3 · Lights and engines', t:'Both throttles — OFF (below the IDLE detent)',
   note:'Let them run at idle a moment first if you have just come off a hot cycle.', ack:true},
  {g:'4 · Dark', t:'OBOGS — OFF',
   tgt:'obogs', done:s=>s.sw.obogs==='off'},
  {g:'4 · Dark', t:'Left DDI — OFF',
   tgt:'ddiLBright', done:s=>s.sw.ddiLBright==='off'},
  {g:'4 · Dark', t:'Right DDI — OFF',
   tgt:'ddiRBright', done:s=>s.sw.ddiRBright==='off'},
  {g:'4 · Dark', t:'AMPCD — OFF',
   tgt:'ampcdBright', done:s=>s.sw.ampcdBright==='off'},
  {g:'4 · Dark', t:'HUD brightness — OFF',
   tgt:'hudBright', done:s=>s.sw.hudBright==='off'},
  {g:'4 · Dark', t:'Canopy — OPEN, chocks and chains — IN',
   note:'Chocked before the brake is released, not after. A Hornet on a wet deck with no brake goes over the side.', ack:true},
  {g:'4 · Dark', t:'BATT switch — OFF',
   note:'Last, exactly as it was first. The jet goes dark.',
   tgt:'battSw', done:s=>s.sw.battSw==='off'},
]);
