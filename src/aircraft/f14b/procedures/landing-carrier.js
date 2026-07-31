/* F-14B · CARRIER LANDING, CASE I RECOVERY
   Chuck's guide Part 6, restructured around the checkpoint sequence a Case I
   pattern is actually flown to. Treat it as a house of cards: you can only
   pass checkpoint 8 if you passed the first seven on the money. When you
   practise, get one checkpoint right every time before you worry about the next.

   Steps that are flown rather than switched carry ack:true — tap the line to
   confirm them, since there is no flight model here to watch. */

import { setAirborne, nextOf } from '../systems.js';

/* This one starts in the air, not cold and dark. */
export const setup = sim => setAirborne(sim);

export const meta = { id:'landing-carrier', crew:'pilot', phase:'landing',
                      name:'Landing · carrier Case I', view:'front' ,
                      ending:{ title:'Trapped', sub:'Wire caught, hook up, folded and clear.' } };

export const steps = [
/* ============ 1. three miles behind the boat: 800 ft, 350 kt ============ */
{ g:'1 · Three Miles', t:'Contact the carrier — get the <b>BRC</b> and turn the deck lights on',
  note:'Base Recovery Course. You fly the ship\u2019s heading, so the lines on the HSD should point exactly the way you are going.',
  tgt:'comms:ground', ack:true, done:()=>false },
{ g:'1 · Three Miles', t:'Altimeter — set the carrier\u2019s <b>QFE</b>, 29.92 in Hg',
  tgt:'altBaro', view:'front', done:s=>!!s.touched.altBaro },
{ g:'1 · Three Miles', t:'TACAN — <b>T/R</b> on the ship\u2019s channel',
  tgt:'tacanFunc', view:'consoles', done:s=>s.sw.tacanFunc==='tr' },
{ g:'1 · Three Miles', t:'ICLS (ARA-63) — <b>ON</b>, set to the ship\u2019s channel',
  note:'Without this you get no ICLS needles at all.',
  tgt:'ara63', view:'consoles', done:s=>s.sw.ara63==='on' },
{ g:'1 · Three Miles', t:'HUD and VDI AWL mode — both to <b>ILS</b>',
  note:'The needles will not show up otherwise. Two separate switches on the display panel.',
  tgt:s=>nextOf(s,[['hudAwl','ils'],['vdiAwl','ils']]), ctx:['vdiAwl'], view:'front', done:s=>s.sw.hudAwl==='ils'&&s.sw.vdiAwl==='ils' },
{ g:'1 · Three Miles', t:'HUD master mode — <b>LDG</b>',
  tgt:'masterMode', view:'front', done:s=>s.sw.masterMode==='ldg' },
{ g:'1 · Three Miles', t:'All arming switches — <b>SAFE</b>',
  tgt:'masterArm', view:'consoles', done:s=>s.sw.masterArm==='off' },
{ g:'1 · Three Miles', t:'ANTI-SKID / SPOILER BK — <b>OFF</b> (middle)',
  note:'Off for the boat. BOTH is a runway setting.',
  tgt:'antiSkid', view:'front', done:s=>s.sw.antiSkid==='off' },
{ g:'1 · Configure', t:'Landing lights — <b>OFF</b>',
  note:'Lights stay off on the boat. The deck is lit, and the LSO needs to see you rather than be dazzled. Lights showing on deck mean a radio failure.',
  tgt:'landingLights', view:'consoles', done:s=>s.sw.landingLights==='off' },
{ g:'1 · Three Miles', t:'HOOK BYPASS — <b>CARRIER</b> (aft)',
  tgt:'hookBypass', view:'consoles', done:s=>s.sw.hookBypass==='carrier' },
{ g:'1 · Three Miles', t:'Hook — <b>DOWN</b>',
  note:'Unless you are doing touch and goes.',
  tgt:'hookHandle', view:'front', done:s=>s.sw.hookHandle==='down' },
{ g:'1 · Three Miles', t:'Wings back to <b>68°</b> on the <b>thumb switch</b>',
  note:'Sweeping is to shed lift, not to add drag — at 350 kt swept wings actually cut drag and help you accelerate. Less lift means your trim ends up much closer to the landing condition than entering the break wings forward. Once you are in the break let them come back out as you slow through the turn. The thumb switch is on the throttle, handle stowed and CADC working; the emergency handle is only for a failure.',
  tgt:'sweepThumb', ctx:['wingSweep'], view:'consoles',
  done:s=>s.sw.wingSweep==='detent'&&s.sweep>=67.5 },
{ g:'1 · Three Miles', t:'<b>Trim</b> for level flight — it wants to nose down as the wings go back',
  note:'The trim switch is your best friend. If you cannot get all of this done before three miles, do not proceed — go round and set up again.',
  ack:true, done:()=>false },
{ g:'1 · Three Miles', t:'Three miles behind, <b>800 ft</b>, <b>350 kt</b>, on BRC',
  ack:true, done:()=>false },

/* ============ 2. overfly the boat ============ */
{ g:'2 · Overfly', t:'Overfly the boat at <b>800 ft</b> and <b>350 kt</b>',
  note:'Not 750, not 820. Parallel to the ship\u2019s course but slightly right, so you can look down the deck and check it is clear and safe to land.',
  ack:true, done:()=>false },

/* ============ 3. the break ============ */
{ g:'3 · The Break', t:'Break <b>1 nm ahead</b> of the ship',
  note:'Distance is top left on the HSD. Flying wing? Break 15–17 seconds after your lead — that is what gives you the spacing to roll out as he takes the wire.',
  ack:true, done:()=>false },
{ g:'3 · The Break', t:'Throttles <b>IDLE</b>, boards <b>fully open</b>',
  tgt:s=>nextOf(s,[['speedBrake','out'],['throttleL','idle'],['throttleR','idle']]), done:s=>s.sw.speedBrake==='out'&&s.sw.throttleL==='idle'&&s.sw.throttleR==='idle' },
{ g:'3 · The Break', t:'Roll left, stop the roll, <b>then</b> pull',
  note:'It must be a level break — drag the flight path marker along the horizon and watch the VSI. Rule of thumb: G matches airspeed, so 3.5 G at 350 kt. Easier in practice to pull to 13–15 units AoA and ease off as the speed decays, reducing bank to stay level.',
  ack:true, done:()=>false },

/* ============ 4. configure on the downwind ============ */
{ g:'4 · Configure', t:'At <b>300 kt</b> — wings to <b>AUTO</b>, let them come forward',
  note:'Any slower with the wings back and you will fall like a brick.',
  tgt:'wingSweep', view:'consoles', done:s=>s.sw.wingSweep==='detent'&&s.sweep<=20.5 },
{ g:'4 · Configure', t:'At <b>250 kt</b> — <b>gear down</b>',
  tgt:'gearHandle', view:'front', done:s=>s.sw.gearHandle==='down' },
{ g:'4 · Configure', t:'At <b>200 kt</b> — <b>flaps down</b>',
  note:'NATOPS says 220. The fleet used 200 to reduce wear.',
  tgt:'flapsLever', view:'consoles', done:s=>s.sw.flapsLever==='down' },
{ g:'4 · Configure', t:'Gear and flaps down — pop the <b>DLC</b>',
  note:'Inboard spoilers to an intermediate position; the spring-loaded thumbwheel then trims lift instantly. It also adds drag, so the engines sit at a higher and far more responsive power setting. Check the mirrors to confirm they are out.',
  tgt:'dlc', done:s=>s.dlcActive },

/* ============ 5. downwind ============ */
{ g:'5 · Downwind', t:'Descend to <b>600 ft</b> and get <b>ON SPEED</b>',
  note:'On speed means AoA, not airspeed — the right speed changes with weight, the AoA does not. 15 units, yellow donut centred on the indexer, no red arrows.',
  ack:true, done:()=>false },
{ g:'5 · Downwind', t:'<b>Trim</b> until it flies on speed hands off',
  note:'Not holding it there with the stick. If you skip this, nothing after it will work. The HUD E-bracket is the least reliable of the three — its refresh rate is too slow.',
  ack:true, done:()=>false },
{ g:'5 · Downwind', t:'Landing checklist — <b>wings 20 auto, gear down, flaps full, DLC checked, hook down, harness locked, boards, brakes off, fuel</b>',
  ack:true, done:()=>false },

/* ============ 6. abeam ============ */
{ g:'6 · Abeam', t:'Abeam the LSO platform — level <b>600 ft</b>, on speed, <b>1.1 to 1.3 nm</b>',
  note:'On the HSD, abeam is when the arrow points at nine o\u2019clock; the distance is top left.',
  ack:true, done:()=>false },
{ g:'6 · Abeam', t:'Start the turn — <b>27°</b> of bank at 1.1 nm, <b>22°</b> at 1.3 nm',
  note:'At 1.1 start a little past abeam, as the white round-down of the landing area comes into view. At 1.3, or with much wind, start earlier — just past nine o\u2019clock. Add a little power, because bank costs lift. Aim for 100–200 ft/min down.',
  ack:true, done:()=>false },

/* ============ 7. the 90 ============ */
{ g:'7 · The 90', t:'At the 90 — <b>450 ft</b>, increase to <b>400–500 ft/min</b> down',
  note:'You are on instruments from here. If your numbers are right the ICLS needle appears on the HUD about now.',
  ack:true, done:()=>false },
{ g:'7 · The 90', t:'Cross the wake at <b>360 ft</b>', ack:true, done:()=>false },

/* ============ 8. the groove ============ */
{ g:'8 · The Groove', t:'Roll out <b>three quarters of a mile</b> behind — no further',
  note:'No more than 15 seconds in the groove. Rolling the wings level makes more lift, so come back on the power or you will balloon above glide slope.',
  ack:true, done:()=>false },
{ g:'8 · The Groove', t:'<b>Call the ball</b>',
  note:'Side number, type, fuel in thousands — “four-oh-three, Tomcat ball, three point oh.”',
  ack:true, done:()=>false },
{ g:'8 · The Groove', t:'Scan <b>ball — lineup — AoA</b>, and repeat',
  note:'Do not put the flight path marker on the deck. Flown properly you could land with the HUD off. Do not trust the ICLS needles in close either.',
  ack:true, done:()=>false },
{ g:'8 · The Groove', t:'Glide slope on the <b>throttles</b> — three stages per correction',
  note:'Low: add power, take it back off just before you reach the slope, then add a little again. High: reduce, back on to stop the descent, then reduce a little. The Tomcat makes so much lift that power alone sometimes will not do it — dip the nose a fraction in sync with the throttle and bring it straight back.',
  ack:true, done:()=>false },
{ g:'8 · The Groove', t:'Lineup — aim a shade <b>left</b> of centreline',
  note:'The deck is moving right and away, and you are crabbed, so landing on the centreline drifts you right of it. The aiming point is the crotch where the landing area meets the bow. Dipping a wing costs lift, so add a smidge of power as you correct, and expect adverse yaw at high AoA — roll left and the nose goes right.',
  ack:true, done:()=>false },
{ g:'8 · The Groove', t:'Hold <b>15 units</b> — the ball is only honest on speed',
  note:'That is the AoA the eye-to-hook distance and the ball are calibrated for. Fast and the hook rides high with a centred ball; slow and it hangs low.',
  ack:true, done:()=>false },
{ g:'8 · The Groove', t:'The <b>burble</b> — updraft, then a downdraft at the ramp',
  note:'Take a little power out for the updraft. Then get the attitude and power back in before the downdraft, because the engines need time to spool. Stronger and more axial wind means a stronger burble.',
  ack:true, done:()=>false },

/* ============ 9. touchdown ============ */
{ g:'9 · Touchdown', t:'Fly the ball onto the deck — <b>do not cut power, do not aim for the three wire</b>',
  note:'Done right, touchdown takes you by surprise.',
  ack:true, done:()=>false },
{ g:'9 · Touchdown', t:'On deck — <b>MIL power</b>, and only pull it off once you are stopped',
  note:'If you caught a wire you stop anyway. If you did not, you need every bit of thrust, and the engines take time.',
  tgt:s=>nextOf(s,[['throttleL','mil'],['throttleR','mil']]), ctx:['throttleR'], view:'consoles', done:s=>s.sw.throttleL==='mil'&&s.sw.throttleR==='mil' },
{ g:'9 · Touchdown', t:'Stopped — <b>hook up, flaps up, wings back</b>, then follow the taxi director',
  note:'Get clear so the jet behind you can land.',
  tgt:s=>nextOf(s,[['hookHandle','up'],['flapsLever','up'],['wingSweep','oversweep']]), view:'front',
  done:s=>s.sw.hookHandle==='up'&&s.sw.flapsLever==='up'&&s.sw.wingSweep==='oversweep' },
{ g:'9 · Touchdown', t:'Bolter? <b>10° right of BRC</b>, climb to <b>600 ft</b>, turn downwind and go again',
  ack:true, done:()=>false },
];
