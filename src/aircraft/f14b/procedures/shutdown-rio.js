/* F-14B · RIO SHUTDOWN.

   As with the pilot version, the guide has no shutdown section — this is
   reasoned from reversing the start-up rather than taken from a source.

   The order that matters: the WCS comes down before the liquid cooling, since
   the cooling is what lets it run at all. */
import { shutdownSetup, nextOf } from '../systems.js';

export const setup = sim => shutdownSetup(sim);
export const meta = { id:'shutdown-rio', crew:'rio', phase:'shutdown',
                      name:'Shutdown · RIO', view:'rioR' };

export const steps = [
/* ---------------- sensors and weapons ---------------- */
{ g:'1 · Sensors', t:'WCS — <b>STANDBY</b>, then <b>OFF</b>',
  note:'Down through standby rather than straight off.',
  tgt:'wcsMode', view:'rioR', done:s=>s.sw.wcsMode==='off' },
{ g:'1 · Sensors', t:'IR / TV (TCS) — <b>OFF</b>',
  tgt:'irtvPower', view:'rioR', done:s=>s.sw.irtvPower==='off' },
{ g:'1 · Sensors', t:'AN/ALR-67 RWR — <b>OFF</b>',
  tgt:'alr67Power', view:'rioR', done:s=>s.sw.alr67Power==='off' },
{ g:'1 · Sensors', t:'AN/ALQ-126 DECM — <b>OFF</b>',
  tgt:'decmMode', view:'rioR', done:s=>s.sw.decmMode==='off' },
{ g:'1 · Sensors', t:'AN/ALE-39 — <b>OFF</b>, flare mode back to <b>NORM</b>',
  note:'Leaving the dispenser armed on the ramp is how people have bad days.',
  tgt:s=>nextOf(s,[['ale39Mode','off'],['flareMode','norm']]), ctx:['flareMode'],
  view:'rioR', done:s=>s.sw.ale39Mode==='off'&&s.sw.flareMode==='norm' },

/* ---------------- datalink, IFF, navigation ---------------- */
{ g:'2 · Datalink and IFF', t:'Datalink power — <b>OFF</b>',
  tgt:'dlPower', view:'rioR', done:s=>s.sw.dlPower==='off' },
{ g:'2 · Datalink and IFF', t:'IFF Mode 4 — <b>OFF</b>',
  note:'Crypto off before anyone opens the jet up.',
  tgt:'iffMode4', view:'rioR', done:s=>s.sw.iffMode4==='off' },
{ g:'2 · Datalink and IFF', t:'Navigation Mode Selector — <b>OFF</b>',
  tgt:'navMode', view:'rioC', done:s=>s.sw.navMode==='off' },
{ g:'2 · Datalink and IFF', t:'RIO TACAN — <b>OFF</b>, V/UHF — <b>OFF</b>',
  tgt:s=>nextOf(s,[['rioTacanFunc','off'],['vuhfFunc','off']]), ctx:['vuhfFunc'],
  view:'rioL', done:s=>s.sw.rioTacanFunc==='off'&&s.sw.vuhfFunc==='off' },

/* ---------------- cooling and the cockpit ---------------- */
{ g:'3 · Secure', t:'Liquid Cooling — <b>OFF</b>',
  note:'After the WCS, not before. It is the cooling that lets the AWG-9 run.',
  tgt:'liquidCool', view:'rioL', done:s=>s.sw.liquidCool==='off' },
{ g:'3 · Secure', t:'Confirm the TID and DDD have gone <b>dark</b>',
  tgt:'scTid_rioC', view:'rioC', done:s=>!s.rio.wcsUp },
{ g:'3 · Secure', t:'Ejection seat — <b>SAFE</b>',
  tgt:'ejectSeat', done:s=>s.sw.ejectSeat==='safe' },
{ g:'3 · Secure', t:'RIO Oxygen — <b>OFF</b>',
  tgt:'rioOxygen', view:'rioL', done:s=>s.sw.rioOxygen==='off' },
{ g:'3 · Secure', t:'ICS — <b>COLD MIC</b>',
  tgt:'rioIcs', view:'rioL', done:s=>s.sw.rioIcs==='cold' },
];
