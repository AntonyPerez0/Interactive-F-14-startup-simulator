/* F-14B · M61 GUN, air to air — Chuck's guide Part 10 sections 3.1 to 3.3. */
import { bvrSetup } from '../systems.js';

export const setup = sim => bvrSetup(sim);
export const meta = { id:'aa-gun', crew:'pilot', phase:'combat',
                      name:'Guns · M61 air to air', view:'front' };

export const steps = [
{ g:'1 · Set Up', t:'Master Arm — <b>ON</b> (up)',
  tgt:'masterArm', view:'consoles', done:s=>s.sw.masterArm==='on' },
{ g:'1 · Set Up', t:'HUD display mode — <b>A/A</b>',
  tgt:'masterMode', view:'front', done:s=>s.sw.masterMode==='aa' },
{ g:'1 · Set Up', t:'Gun rate — <b>HIGH</b> for air to air',
  note:'LOW is for strafing. HIGH gives you the rounds in the air when the pipper is on.',
  tgt:'gunRate', view:'consoles', done:s=>s.sw.gunRate==='high' },
{ g:'1 · Set Up', t:'Confirm AIR SOURCE — <b>BOTH ENG</b>',
  note:'The gun needs bleed air to purge the gun gas. Without it you can flame out an engine on a long burst.',
  tgt:'airSource', view:'consoles', done:s=>s.sw.airSource==='both' },
{ g:'1 · Set Up', t:'Gunsight elevation lead — as required',
  note:'MANUAL puts a fixed depression on the pipper; you supply the lead yourself.',
  tgt:'gunLead', done:s=>!!s.touched.gunLead },
{ g:'2 · Employ', t:'Weapon selector — hold it in and cycle to <b>GUN</b>',
  note:'On the throttle grip, so it lives in the tray at the top left.',
  tgt:'weaponSel', done:s=>s.sw.weaponSel==='gun' },
{ g:'2 · Employ', t:'Put the <b>pipper on the target</b> and pull the lead',
  note:'In manual the sight does not compute lead for you — the pipper is where the rounds go, not where the target is.',
  ack:true, done:()=>false },
{ g:'2 · Employ', t:'<b>Trigger, second stage</b>',
  tgt:'trigger', done:s=>!!s.bvr && s.bvr.gunFired },
];
