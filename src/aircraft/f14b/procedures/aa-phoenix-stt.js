/* F-14B · AIM-54 PHOENIX, single target — Chuck's guide Part 10 section 3.7.
   The pilot's version: one target, held in STT, longest range of any shot the
   Tomcat has. Roughly 60 nm against a fighter, further against something big
   and slow flying towards you. */
import { bvrSetup } from '../systems.js';

export const setup = sim => bvrSetup(sim);
export const meta = { id:'aa-phoenix-stt', crew:'pilot', phase:'combat',
                      name:'AIM-54 Phoenix · single target', view:'front' };

export const steps = [
{ g:'1 · Set Up', t:'Master Arm — <b>ON</b> (up)',
  tgt:'masterArm', view:'consoles', done:s=>s.sw.masterArm==='on' },
{ g:'1 · Set Up', t:'HUD mode — <b>A/A</b>, HSD mode — <b>TID</b>',
  note:'The TID repeat lets you see what the back seat is looking at.',
  tgt:s=>s.sw.masterMode!=='aa' ? 'masterMode' : 'hsdMode', ctx:['hsdMode'],
  view:'front', done:s=>s.sw.masterMode==='aa'&&s.sw.hsdMode==='tid' },
{ g:'1 · Set Up', t:'Ask the back seat for <b>Liquid Cooling ON</b>',
  note:'A → Radar and weapons → LIQUID COOLING. The AWG-9 will not play without it, and neither will the Phoenix.',
  tgt:'comms:jester', done:s=>s.sw.liquidCool!=='off' },
{ g:'1 · Set Up', t:'MSL PREP — <b>ON</b>, and wait for the missiles',
  note:'About two minutes. They show white when they are ready.',
  tgt:'mslPrep', view:'consoles', done:s=>!!s.bvr && s.bvr.prepped },
{ g:'1 · Set Up', t:'Weapon selector — cycle to <b>SP/PH</b>, then again for <b>PH</b>',
  note:'Sparrow and Phoenix share the position; the second press toggles between them.',
  tgt:'weaponSel', done:s=>s.sw.weaponSel==='ph' },
{ g:'1 · Set Up', t:'Missile mode — <b>NORM</b>',
  tgt:'modeStp', view:'consoles', done:s=>s.sw.modeStp==='norm' },
{ g:'2 · Employ', t:'<b>Hook your target</b> on the HSD — click the symbol',
  note:'The HSD is repeating the TID, so you can work the picture from up front. Whatever is hooked is what the lock will grab.',
  tgt:'scHsd', view:'front', done:s=>!!s.bvr && s.bvr.hooked!==null },
{ g:'2 · Employ', t:'Ask Jester to <b>lock him up</b>',
  note:'A → Radar and weapons → LOCK HIM UP. STT drops the rest of the picture and holds this one. It is also the loudest thing you can do to a radar warning receiver.',
  tgt:'comms:jester', done:s=>s.sw.radarMode==='pdstt'||s.sw.radarMode==='pulsestt' },
{ g:'2 · Employ', t:'Line the target up with the <b>ADL</b>, within 20°', ack:true, done:()=>false },
{ g:'2 · Employ', t:'Fly the <b>steering T</b> into the ASE circle', ack:true, done:()=>false },
{ g:'2 · Employ', t:'<b>Trigger, second stage</b> — hold it 3 to 4 seconds',
  note:'The Phoenix wants a deliberate press, not a stab.',
  tgt:'trigger', done:s=>!!s.bvr && s.bvr.fired>0 },
{ g:'2 · Employ', t:'Watch the <b>TTI</b> count down, and hold the track',
  note:'In STT the missile is fed updates the whole way, which is why this is the longest shot you have.',
  ack:true, done:()=>false },
];
