/* F-14B · RIO INS ALIGNMENT (SHORE) — guide Part 4 section 4, plus section 6. */
import { RIO_PRE, RIO_POST } from './rio-common.js';

export const meta = { id:'rio-shore', crew:'rio', variant:'shore',
                      name:'INS alignment · shore', view:'rioL' };

export const MID = [
{g:'2 · Present Position', t:'Navigation Mode Selector — <b>GND ALIGN</b>',
 tgt:'navMode', view:'rioC', done:s=>s.sw.navMode==='gnd'},
{g:'2 · Present Position', t:'CAP CATEGORY selector — <b>NAV</b>, and <b>OWN A/C</b> selected',
 note:'The real figures come off the kneeboard GROUND SETTINGS page; they are in the notes below.',
 tgt:'capCategory', view:'rioL', done:s=>s.sw.capCategory==='nav'&&s.rio.msg==='ownac'},
{g:'2 · Present Position', t:'Enter latitude — <b>N 25°01.4′</b>',
 note:'CLEAR → 1 (LAT) → N-E → 2 5 0 1 4 → ENTER. Watch the top of the TID as you type.',
 tgt:'cap1', view:'rioL', done:s=>s.rio.entered.lat},
{g:'2 · Present Position', t:'Enter longitude — <b>E 55°22.6′</b>',
 note:'CLEAR → 6 (LONG) → N-E → 5 5 2 2 6 → ENTER.',
 tgt:'cap6', view:'rioL', done:s=>s.rio.entered.lon},
{g:'2 · Present Position', t:'Enter altitude — <b>197 ft</b>',
 note:'CLEAR → 4 (ALT) → N-E for a positive value → 1 9 7 → ENTER.',
 tgt:'cap4', view:'rioL', done:s=>s.rio.entered.alt},
{g:'2 · Present Position', t:'Message button <b>MAG VAR HDG</b>, then enter <b>+1.7°</b>',
 note:'MAG VAR HDG → 8 (HDG) → N-E → 1 7 → ENTER. Seventeen means +1.7 degrees.',
 tgt:'msgMagVar', view:'rioL', done:s=>s.rio.entered.mag},
{g:'3 · Alignment', t:'Monitor the alignment on the TID',
 note:'The number by the caret is minutes in tenths — 23 means 2.3 minutes. The markers along the track are coarse complete, alert launch, then full fine.',
 tgt:'scTid_rioC', view:'rioC', done:s=>s.ins.mode!==null&&s.ins.t>5},
{g:'3 · Alignment', t:'Wait for <b>FULL FINE</b> — the caret becomes a diamond with a dot',
 note:'About 8 minutes. Use time compression. The jet must not move.',
 tgt:'scTid_rioC', view:'rioC', done:s=>s.ins.complete},
{g:'3 · Alignment', t:'Navigation Mode Selector — <b>INS</b>',
 tgt:'navMode', view:'rioC', done:s=>s.sw.navMode==='ins'},
]

export const steps = [...RIO_PRE, ...MID, ...RIO_POST].map((s,i)=>({ n:i+1, ...s }));
