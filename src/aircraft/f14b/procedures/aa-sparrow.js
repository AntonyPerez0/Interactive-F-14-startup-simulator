/* F-14B · AIM-7M SPARROW — Chuck's guide Part 10 section 3.6.
   Semi-active, so the radar has to hold the lock all the way to impact. */
import { bvrSetup } from '../systems.js';

export const setup = sim => bvrSetup(sim);
export const meta = { id:'aa-sparrow', crew:'pilot', phase:'combat',
                      name:'AIM-7M Sparrow', view:'front' };

export const steps = [
{ g:'1 · Set Up', t:'Master Arm — <b>ON</b> (up)',
  tgt:'masterArm', view:'consoles', done:s=>s.sw.masterArm==='on' },
{ g:'1 · Set Up', t:'HUD display mode — <b>A/A</b>',
  tgt:'masterMode', view:'front', done:s=>s.sw.masterMode==='aa' },
{ g:'1 · Set Up', t:'MSL PREP — <b>ON</b>, and wait for the missiles',
  note:'The WCS spins the missiles up. Around two minutes; they show white when they are ready.',
  tgt:'mslPrep', view:'consoles', done:s=>!!s.bvr && s.bvr.prepped },
{ g:'1 · Set Up', t:'Weapon selector — hold it in and cycle to <b>SP</b>',
  note:'SP and PH share a position — press the selector again to toggle between Sparrow and Phoenix.',
  tgt:'weaponSel', done:s=>s.sw.weaponSel==='sp' },
{ g:'1 · Set Up', t:'Missile mode — <b>NORM</b>',
  tgt:'modeStp', view:'consoles', done:s=>s.sw.modeStp==='norm' },
{ g:'2 · Employ', t:'HSD mode — <b>TID</b>, to repeat the back-seat picture',
  note:'That is how you see the tracks from up front.',
  tgt:'hsdMode', view:'front', done:s=>s.sw.hsdMode==='tid' },
{ g:'2 · Employ', t:'<b>Hook the target</b> on the HSD — click the symbol',
  tgt:'scHsd', view:'front', done:s=>!!s.bvr && s.bvr.hooked!==null },
{ g:'2 · Employ', t:'Ask Jester to <b>lock him up</b>',
  note:'A → Radar and weapons → LOCK HIM UP. The Sparrow is semi-active: no lock, no guidance.',
  tgt:'comms:jester', done:s=>s.sw.radarMode==='pdstt'||s.sw.radarMode==='pulsestt' },
{ g:'2 · Employ', t:'Line the target up with the <b>ADL</b>, within 20°', ack:true, done:()=>false },
{ g:'2 · Employ', t:'Fly the <b>steering T</b> into the middle of the ASE circle',
  note:'That is the allowable steering error. Inside it, the missile has the energy to get there.',
  ack:true, done:()=>false },
{ g:'2 · Employ', t:'<b>Trigger, second stage</b> — Fox 1',
  tgt:'trigger', done:s=>!!s.bvr && s.bvr.spFired },
{ g:'2 · Employ', t:'<b>Hold the lock</b> all the way to impact',
  note:'Break the lock and the missile goes stupid. This is the price of semi-active.',
  ack:true, done:()=>false },
];
