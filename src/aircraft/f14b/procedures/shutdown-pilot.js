/* F-14B · PILOT SHUTDOWN.

   Chuck's guide has no shutdown section — it goes from landing straight into
   engine management. This is assembled from the aircraft's own logic and from
   reversing the start-up, so treat the ordering as reasoned rather than
   authoritative, and worth checking against someone who flies it.

   The one part that is not arbitrary: the wings have to go to oversweep while
   the engines are still turning, because that takes hydraulic pressure. */
import { shutdownSetup, nextOf } from '../systems.js';

export const setup = sim => shutdownSetup(sim);
export const meta = { id:'shutdown-pilot', crew:'pilot', phase:'shutdown',
                      name:'Shutdown · pilot', view:'front' };

export const steps = [
/* ---------------- clear of the runway ---------------- */
{ g:'1 · Clear The Runway', t:'ANTI-SKID / SPOILER BK — <b>SPOILER BK</b> for taxi',
  note:'BOTH is for takeoff and landing only. Spoiler brakes to taxi, off for the boat.',
  tgt:'antiSkid', view:'front', done:s=>s.sw.antiSkid==='spoiler' },
{ g:'1 · Clear The Runway', t:'Flaps — <b>UP</b>',
  tgt:'flapsLever', view:'consoles', done:s=>s.sw.flapsLever==='up' },
{ g:'1 · Clear The Runway', t:'Hook — <b>UP</b>, speed brake — <b>IN</b>',
  tgt:s=>nextOf(s,[['hookHandle','up'],['speedBrake','in']]), ctx:['speedBrake'],
  view:'front', done:s=>s.sw.hookHandle==='up'&&s.sw.speedBrake==='in' },
{ g:'1 · Clear The Runway', t:'Master Arm — <b>OFF</b>',
  tgt:'masterArm', view:'consoles', done:s=>s.sw.masterArm==='off' },
{ g:'1 · Clear The Runway', t:'Taxi clear and follow the director to the line',
  ack:true, done:()=>false },

/* ---------------- on the line ---------------- */
{ g:'2 · On The Line', t:'Parking brake — <b>SET</b>',
  tgt:'parkBrake', view:'front', done:s=>s.sw.parkBrake==='set' },
{ g:'2 · On The Line', t:'Wings — <b>OVERSWEEP</b>, while you still have hydraulics',
  note:'68° so it does not clip anyone on a packed deck. Do this before the engines go, because the sweep runs off the hydraulic system.',
  tgt:'wingSweep', view:'consoles', done:s=>s.sw.wingSweep==='oversweep'&&s.sweep>=67.5 },
{ g:'2 · On The Line', t:'Chocks in, and the ground crew clear',
  tgt:'comms:ground', ack:true, done:()=>false },

/* ---------------- secure the cockpit ---------------- */
{ g:'3 · Secure', t:'Exterior lights — <b>OFF</b>, landing lights — <b>OFF</b>',
  tgt:s=>nextOf(s,[['extLights','off'],['landingLights','off']]), ctx:['landingLights'],
  view:'consoles', done:s=>s.sw.extLights==='off'&&s.sw.landingLights==='off' },
{ g:'3 · Secure', t:'VDI, HUD and HSD power — <b>OFF</b>',
  tgt:s=>nextOf(s,[['vdiPower','off'],['hudPower','off'],['hsdPower','off']]),
  ctx:['hudPower','hsdPower'], view:'front',
  done:s=>s.sw.vdiPower==='off'&&s.sw.hudPower==='off'&&s.sw.hsdPower==='off' },
{ g:'3 · Secure', t:'TACAN — <b>OFF</b>, ICLS — <b>OFF</b>, UHF — <b>OFF</b>',
  tgt:s=>nextOf(s,[['tacanFunc','off'],['ara63','off'],['uhfFunc','off']]),
  ctx:['ara63','uhfFunc'], view:'consoles',
  done:s=>s.sw.tacanFunc==='off'&&s.sw.ara63==='off'&&s.sw.uhfFunc==='off' },
{ g:'3 · Secure', t:'SAS — <b>PITCH, ROLL, YAW OFF</b>',
  tgt:s=>nextOf(s,[['afcsPitch','off'],['afcsRoll','off'],['afcsYaw','off']]),
  ctx:['afcsRoll','afcsYaw'], view:'consoles',
  done:s=>s.sw.afcsPitch==='off'&&s.sw.afcsRoll==='off'&&s.sw.afcsYaw==='off' },
{ g:'3 · Secure', t:'Anti-skid — <b>OFF</b>',
  tgt:'antiSkid', view:'front', done:s=>s.sw.antiSkid==='off' },
{ g:'3 · Secure', t:'Radar altimeter — <b>OFF</b>',
  tgt:'radAltKnob', view:'front', done:s=>s.sw.radAltKnob==='off' },

/* ---------------- shut down ---------------- */
{ g:'4 · Shut Down', t:'Ejection seat — <b>SAFE</b>',
  note:'Before the canopy comes up, not after.',
  tgt:'ejectSeat', done:s=>s.sw.ejectSeat==='safe' },
{ g:'4 · Shut Down', t:'Canopy — <b>OPEN</b>',
  tgt:'canopy', done:s=>s.sw.canopy==='open' },
{ g:'4 · Shut Down', t:'Throttles — <b>CUTOFF</b>, both',
  tgt:s=>nextOf(s,[['throttleL','off'],['throttleR','off']]), ctx:['throttleR'],
  view:'consoles', done:s=>s.sw.throttleL==='off'&&s.sw.throttleR==='off' },
{ g:'4 · Shut Down', t:'Wait for both engines to <b>run down</b>',
  note:'Watch the RPM tapes go to zero and the generators drop off line.',
  tgt:'tapeRpm', view:'front', done:s=>s.eng.L.n2<1&&s.eng.R.n2<1 },
{ g:'4 · Shut Down', t:'Master generators — <b>OFF</b>',
  tgt:s=>nextOf(s,[['masterGenL','off'],['masterGenR','off']]), ctx:['masterGenR'],
  view:'consoles', done:s=>s.sw.masterGenL==='off'&&s.sw.masterGenR==='off' },
{ g:'4 · Shut Down', t:'Oxygen — <b>OFF</b>',
  tgt:'oxygen', view:'consoles', done:s=>s.sw.oxygen==='off' },
{ g:'4 · Shut Down', t:'Parking brake — <b>RELEASED</b> once the chocks are in',
  note:'Brakes cool better off. The chocks are holding it now.',
  tgt:'parkBrake', view:'front', done:s=>s.sw.parkBrake==='off' },
];
