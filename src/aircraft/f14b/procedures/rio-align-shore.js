/* F-14B · RIO INS ALIGNMENT (SHORE) — guide Part 4 section 4, plus section 6. */
import { RIO_PRE, RIO_POST } from './rio-common.js';
import { capCue } from '../systems.js';

export const meta = { id:'rio-shore', crew:'rio', phase:'startup', variant:'shore',
                      name:'INS alignment · shore', view:'rioL' };

export const MID = [
{g:'2 · Present Position', t:'Open the kneeboard — <b>GROUND SETTINGS</b>',
 note:'RSHIFT+K. It carries the coordinates, elevation and magnetic variation you are about to key in. Page with [ and ].',
 tgt:'kb:ground', done:s=>s.kb.open&&s.kb.page===0},
{g:'2 · Present Position', t:'CAP CATEGORY selector — <b>NAV</b>, and <b>OWN A/C</b> selected',
 note:'The selected message button lights up, so you can see which one the keypad is feeding.',
 tgt:'capCategory', view:'rioL', done:s=>s.sw.capCategory==='nav'&&s.rio.msg==='ownac'},
{g:'2 · Present Position', t:'Enter latitude — <b>N 25°01.4′</b>',
 note:'CLEAR → 1 (LAT) → N-E → 2 5 0 1 4 → ENTER. Watch the top of the TID as you type.',
 tgt:s=>capCue(s,'lat','25014'), view:'rioL', done:s=>s.rio.entered.lat},
{g:'2 · Present Position', t:'Enter longitude — <b>E 55°22.6′</b>',
 note:'CLEAR → 6 (LONG) → N-E → 5 5 2 2 6 → ENTER.',
 tgt:s=>capCue(s,'lon','55226'), view:'rioL', done:s=>s.rio.entered.lon},
{g:'2 · Present Position', t:'Enter altitude — <b>197 ft</b>',
 note:'CLEAR → 4 (ALT) → N-E for a positive value → 1 9 7 → ENTER.',
 tgt:s=>capCue(s,'alt','197'), view:'rioL', done:s=>s.rio.entered.alt},
{g:'2 · Present Position', t:'Message button <b>MAG VAR HDG</b>, then enter <b>+1.7°</b>',
 note:'MAG VAR HDG → 8 (HDG) → N-E → 1 7 → ENTER. Seventeen means +1.7 degrees.',
 tgt:s=>capCue(s,'mag','17'), view:'rioL', done:s=>s.rio.entered.mag},

{g:'3 · Alignment', t:'Only now — Navigation Mode Selector to <b>GND ALIGN</b>',
 note:'Get the position and magnetic variation in first. Start the alignment before you have typed them and a slow entry can leave the INS aligned wrong.',
 tgt:'navMode', view:'rioC', done:s=>s.sw.navMode==='gnd'},
{g:'3 · Alignment', t:'Monitor the alignment on the TID',
 note:'The number by the caret is minutes in tenths — 23 means 2.3 minutes. STBY and READY both lit is normal for the first 45 seconds.',
 tgt:'scTid_rioC', view:'rioC', done:s=>s.ins.mode!==null&&s.ins.t>5},
{g:'3 · Alignment', t:'First marker — <b>coarse align</b> at about 2.0 minutes',
 note:'Good enough to navigate on, not good enough to fight with.',
 tgt:'scTid_rioC', view:'rioC', done:s=>s.ins.t>=120},
{g:'3 · Alignment', t:'Second marker — <b>weapons employment</b> at about 4.9 minutes',
 note:'The caret becomes a diamond and READY comes on. The AWG-9 is now precise enough to guide AIM-7 and AIM-54.',
 tgt:'scTid_rioC', view:'rioC', done:s=>s.ins.t>=294},
{g:'3 · Alignment', t:'Third marker — <b>full fine align</b> at about 7.0 minutes',
 note:'Progression stops here. It keeps refining, but it is considered aligned.',
 tgt:'scTid_rioC', view:'rioC', done:s=>s.ins.complete},
{g:'3 · Alignment', t:'Navigation Mode Selector — <b>INS</b>',
 tgt:'navMode', view:'rioC', done:s=>s.sw.navMode==='ins'},
];

export const steps = [...RIO_PRE, ...MID, ...RIO_POST].map((s,i)=>({ n:i+1, ...s }));
