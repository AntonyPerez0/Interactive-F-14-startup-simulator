/* F-14B · AIM-9M SIDEWINDER — Chuck's guide Part 10 sections 3.4 and 3.5. */
import { bvrSetup } from '../systems.js';

export const setup = sim => bvrSetup(sim);
export const meta = { id:'aa-sidewinder', crew:'pilot', phase:'combat',
                      name:'AIM-9M Sidewinder', view:'front' };

export const steps = [
{ g:'1 · Set Up', t:'Master Arm — <b>ON</b> (up)',
  tgt:'masterArm', view:'consoles', done:s=>s.sw.masterArm==='on' },
{ g:'1 · Set Up', t:'HUD display mode — <b>A/A</b>',
  tgt:'masterMode', view:'front', done:s=>s.sw.masterMode==='aa' },
{ g:'1 · Set Up', t:'SW COOL — <b>ON</b>, and wait for the seekers',
  note:'Cools the Sidewinder seeker heads. It runs from a limited supply, so it goes on when you expect to need it rather than at start-up.',
  tgt:'swCool', view:'consoles', done:s=>!!s.bvr && s.bvr.cooled },
{ g:'1 · Set Up', t:'Weapon selector — hold it in and cycle to <b>SW</b>',
  tgt:'weaponSel', done:s=>s.sw.weaponSel==='sw' },
{ g:'1 · Set Up', t:'Missile mode — <b>NORM</b>',
  note:'NORM gives you SEAM, so the seeker can be uncaged to track off boresight.',
  tgt:'modeStp', view:'consoles', done:s=>s.sw.modeStp==='norm' },
{ g:'2 · Employ', t:'Line the target up with the <b>ADL</b>, within 20°',
  note:'The seeker has to see the heat before it can lock.',
  ack:true, done:()=>false },
{ g:'2 · Employ', t:'<b>CAGE / SEAM</b> to uncage the seeker as required',
  tgt:'cageSeam', done:s=>!!s.touched.cageSeam },
{ g:'2 · Employ', t:'Listen for the <b>growl</b> and check the seeker is tracking',
  ack:true, done:()=>false },
{ g:'2 · Employ', t:'<b>Trigger, second stage</b> — Fox 2',
  tgt:'trigger', done:s=>!!s.bvr && s.bvr.swFired },
];
