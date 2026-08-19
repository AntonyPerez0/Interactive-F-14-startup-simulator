/* ============================================================
   F/A-18C HORNET · COMBAT SYSTEMS
   Arming up, sensors and countermeasures

   Chuck's guide, PARTS 9–11 — sensors, weapons, countermeasures

   GENERATED from the procedure tables. done(s) is evaluated every frame, so a
   step ticks itself off when the aircraft actually reaches that state rather
   than when you claim it has.
   ============================================================ */
import { stamp } from './_common.js';

export const meta = { id:'combat', crew:'pilot', phase:'combat', variant:'shore',
                      name:'Combat systems', view:'front',
                      ending:{ title:'Armed and Safed', sub:'Master arm back to SAFE before the break.' } };

export const steps = stamp([
  {g:'1 · Air to air', t:'MASTER ARM — ARM',
   note:'Nothing leaves the aeroplane without it. It is also the first thing to check when a weapon will not release and everything else looks right.',
   tgt:'masterArm', done:s=>s.sw.masterArm==='arm'},
  {g:'1 · Air to air', t:'A/A master mode — SELECT for air-to-air',
   note:'Sets the stores page, the HUD and the radar to the air-to-air set in one press. With neither A/A nor A/G lit you are in NAV.',
   tgt:'masterModeAA', done:s=>s.sw.masterModeAA==='aa'},
  {g:'1 · Air to air', t:'RADAR — OPERATE',
   tgt:'radarKnob', done:s=>s.sw.radarKnob==='opr'},
  {g:'1 · Air to air', t:'IR COOL — NORM',
   note:'Cools the Sidewinder seeker heads. Without it they will not lock, and the failure looks exactly like a missile fault.',
   tgt:'irCool', done:s=>s.sw.irCool==='norm'},
  {g:'2 · Air to ground', t:'A/G master mode — SELECT for air-to-ground',
   tgt:'masterModeAG', done:s=>s.sw.masterModeAG==='ag'},
  {g:'2 · Air to ground', t:'FLIR — ON (targeting pod)',
   note:'Give it a couple of minutes to cool before you expect a usable picture.',
   tgt:'flirSw', done:s=>s.sw.flirSw==='on'},
  {g:'2 · Air to ground', t:'LTD/R — ARM',
   note:'The laser will not fire in SAFE. Every laser-guided weapon that mysteriously misses starts here.',
   tgt:'ltdr', done:s=>s.sw.ltdr==='arm'},
  {g:'2 · Air to ground', t:'LST/NFLR — ON if using laser spot track',
   tgt:'lstNflr', done:s=>s.sw.lstNflr==='on'},
  {g:'3 · Defensive', t:'ALR-67 — POWERED',
   tgt:'alr67Power', done:s=>s.sw.alr67Power==='on'},
  {g:'3 · Defensive', t:'ECM — XMIT when the threat warrants it',
   note:'STBY until you are in the threat ring; jamming announces you to everyone who is listening.',
   tgt:'ecmKnob', done:s=>s.sw.ecmKnob==='xmit'},
  {g:'3 · Defensive', t:'DISPENSER — ON',
   tgt:'dispenser', done:s=>s.sw.dispenser==='on'},
  {g:'3 · Defensive', t:'DIS TYPE — as briefed',
   tgt:'cmdsDisType', done:s=>s.sw.cmdsDisType==='a'},
  {g:'4 · Safing', t:'Coming off target — MASTER ARM SAFE',
   note:'Before you rejoin, before you go home, and always before the deck.',
   tgt:'masterArm', done:s=>s.sw.masterArm==='safe'},
  {g:'4 · Safing', t:'SELECT JETT — verify SAFE',
   note:'Worth a glance on the way home. The knob has no guard and it is right beside the flap switch.',
   tgt:'selectJett', done:s=>s.sw.selectJett==='safe'},
]);
