/* F-14B · AIM-54 PHOENIX, six shooter — Chuck's guide Part 10 section 3.8.
   The RIO's version: TWS AUTO, no lock needed, up to six in the air at once.
   Around 50 nm on a multi-target shot against fighters. */
import { bvrSetup, nextOf } from '../systems.js';

export const setup = sim => bvrSetup(sim);
export const meta = { id:'aa-phoenix-tws', crew:'rio', phase:'combat',
                      name:'AIM-54 Phoenix · six shooter', view:'rioL' ,
                      ending:{ title:'Fox Three', sub:'Multiple engaged from one picture.' } };

export const steps = [
{ g:'1 · Set Up', t:'Liquid Cooling — <b>AWG-9 / AIM-54</b> (forward)',
  note:'Forward covers the missiles as well as the radar. Wrong position will not stop anything working, it just makes an overheat casualty a matter of time.',
  tgt:'liquidCool', view:'rioL', done:s=>s.sw.liquidCool==='awg9aim54' },
{ g:'1 · Set Up', t:'Call the front seat — <b>Master Arm ON, MSL PREP ON, PH selected, NORM</b>',
  note:'All four are pilot switches. You can tell master arm went on from the back, because the radar symbology jumps to bright video.',
  tgt:'comms:ground',
  done:s=>s.sw.masterArm==='on' && s.sw.weaponSel==='ph' && s.sw.modeStp==='norm' && !!s.bvr && s.bvr.prepped },
{ g:'1 · Set Up', t:'Missile speed gate — <b>NOSE QTR</b>',
  tgt:'mslGate', view:'rioR', done:s=>s.sw.mslGate==='nose' },
{ g:'1 · Set Up', t:'Missile options — <b>NORM</b>',
  note:'NORM launches semi-active and goes active near the target. PH ACT sends it active off the rail, which is a knife-fight setting — about 10 nm.',
  tgt:'mslOptions', view:'rioR', done:s=>s.sw.mslOptions==='norm' },
{ g:'1 · Set Up', t:'Target size — set the <b>pitbull range</b>',
  note:'SMALL goes active at 6 nm, NORM at 10, LARGE at 13. Pick it for what you are shooting at — bombers want LARGE.',
  tgt:'tgtSize', view:'rioR', done:s=>!!s.touched.tgtSize },

{ g:'2 · Build The Picture', t:'Start in <b>TWS MANUAL</b> and set the scan',
  note:'Manual first, so you pick up the tracks you meant to pick up rather than whatever the computer likes.',
  tgt:'rm_twsman', view:'rioL', done:s=>s.sw.radarMode==='twsman' },
{ g:'2 · Build The Picture', t:'Scan — a wider bar count holds a spread formation better',
  note:'Two bars over 40° will lose people. Four bars over 20° holds them. Targets at your own speed sit in the notch and never show — ask for more speed to open the closure.',
  tgt:s=>nextOf(s,[['elBars',v=>+v.sw.elBars>=4],['azScan',v=>+v.sw.azScan>=20]]), ctx:['azScan'],
  view:'rioL', done:s=>+s.sw.elBars>=4 && +s.sw.azScan>=20 },
{ g:'2 · Build The Picture', t:'Once the tracks are steady — <b>TWS AUTO</b>',
  note:'The WCS then keeps the radar where it needs to be to hold them.',
  tgt:'rm_twsauto', view:'rioL', done:s=>s.sw.radarMode==='twsauto' },
{ g:'2 · Build The Picture', t:'CAP category — <b>TGT DATA</b>',
  note:'That is the page you work the tracks from.',
  tgt:'capCategory', view:'rioL', done:s=>s.sw.capCategory==='tgtdata' },

{ g:'3 · Sort', t:'<b>Hook a track</b> on the TID — click the symbol',
  note:'The hooked track gets a box round it. Priority number sits to its right, altitude in thousands to its left.',
  tgt:'scTid_rioC', view:'rioC', done:s=>!!s.bvr && s.bvr.hooked!==null },
{ g:'3 · Sort', t:'Designate it <b>HOSTILE</b>',
  note:'The system prioritises hostile and unknown automatically, nearest first. A hostile diamond replaces the unknown circle.',
  tgt:'designate', done:s=>!!s.bvr && s.bvr.contacts.some(c=>c.iff==='hostile') },
{ g:'3 · Sort', t:'Hook another and set <b>DO NOT ATTACK</b>',
  note:'Tells the computer you know what it is but leave it alone. It drops out of the priority list, and the numbers behind it move up.',
  tgt:'noAttack', done:s=>!!s.bvr && s.bvr.contacts.some(c=>c.noAttack) },
{ g:'3 · Sort', t:'Reorder with <b>NEXT LAUNCH</b> if you want a different one first',
  tgt:'nextLaunch', view:'rioR', done:s=>!!s.touched.nextLaunch },

{ g:'4 · Shoot', t:'<b>A/A launch button</b> — press and hold three seconds',
  note:'No lock needed in TWS. Priority one gets the missile.',
  tgt:'launchBtn', view:'rioR', done:s=>!!s.bvr && s.bvr.fired>0 },
{ g:'4 · Shoot', t:'Press it again for the <b>next priority</b>',
  note:'Repeat and you have the six shooter — six targets engaged almost at once.',
  tgt:'launchBtn', view:'rioR', done:s=>!!s.bvr && s.bvr.fired>1 },
{ g:'4 · Shoot', t:'Watch the <b>TTI</b>. When it flashes, that missile has gone active',
  note:'Pitbull. From there it is on its own and you can think about the next one.',
  ack:true, done:()=>false },
];
