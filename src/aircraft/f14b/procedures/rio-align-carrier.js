/* F-14B · RIO INS ALIGNMENT (CARRIER) — guide Part 4 section 5, plus section 6. */
import { RIO_PRE, RIO_POST } from './rio-common.js';

export const meta = { id:'rio-carrier', crew:'rio', variant:'carrier',
                      name:'INS alignment · carrier', view:'rioL' };

export const MID = [
{g:'2 · Carrier Datalink', t:'Datalink power — <b>ON</b>',
 note:'Kneeboard TACTICAL DATALINK SYSTEMS gives the host. For CVN-74 the frequency is 320.90 — set the wheels to 20.9, the 3 is fixed. Wheels are not modelled here.',
 tgt:'dlPower', view:'rioR', done:s=>s.sw.dlPower==='on'},
{g:'2 · Carrier Datalink', t:'Datalink mode — <b>CAINS / WAYPT</b>',
 note:'Lets the jet talk to the ship\'s Carrier Aircraft Inertial Navigation System.',
 tgt:'dlModeSw', view:'rioR', done:s=>s.sw.dlModeSw==='cains'},
{g:'3 · Alignment', t:'Navigation Mode Selector — <b>CVA</b>',
 note:'Carrier INS alignment. No present position to type — the ship hands it over.',
 tgt:'navMode', view:'rioC', done:s=>s.sw.navMode==='cva'},
{g:'3 · Alignment', t:'Monitor the alignment on the TID',
 tgt:'scTid_rioC', view:'rioC', done:s=>s.ins.mode!==null&&s.ins.t>5},
{g:'3 · Alignment', t:'Wait for <b>FULL FINE</b> — about <b>9 minutes</b> on the boat',
 note:'Caret becomes a diamond with a dot.',
 tgt:'scTid_rioC', view:'rioC', done:s=>s.ins.complete},
{g:'3 · Alignment', t:'Navigation Mode Selector — <b>INS</b>',
 tgt:'navMode', view:'rioC', done:s=>s.sw.navMode==='ins'},
]

export const steps = [...RIO_PRE, ...MID, ...RIO_POST].map((s,i)=>({ n:i+1, ...s }));
