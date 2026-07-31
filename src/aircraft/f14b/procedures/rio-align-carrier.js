/* F-14B · RIO INS ALIGNMENT (CARRIER) — guide Part 4 section 5, plus section 6. */
import { RIO_PRE, RIO_POST } from './rio-common.js';

/* The front-seater runs his own start-up alongside you, on a script. */
export const setup = sim => { sim.S.frontSeater = true; };

export const meta = { id:'rio-carrier', crew:'rio', phase:'startup', variant:'carrier',
                      name:'INS alignment · carrier', view:'rioL' ,
                      ending:{ title:'Aligned', sub:'CAINS complete, ready for the cat.' } };

export const MID = [
{g:'2 · Carrier Datalink', t:'Open the kneeboard, page to <b>TACTICAL DATALINK SYSTEMS</b>',
 note:'RSHIFT+K, then ] to page across. It lists the available hosts and their frequencies.',
 tgt:'kb:datalink', done:s=>s.kb.open&&s.kb.page===1},
{g:'2 · Carrier Datalink', t:'Datalink power — <b>ON</b> (Link 4A)',
 note:'Forward for Link 4A, the AWACS and carrier link. AUX is the fighter-to-fighter Link 4C.',
 tgt:'dlPower', view:'rioR', done:s=>s.sw.dlPower==='on'},
{g:'2 · Carrier Datalink', t:'Frequency wheels — <b>20.9</b> for CVN-74 (320.90)',
 note:'The leading 3 is preset and cannot be changed.',
 tgt:'dlFreq', view:'rioR', done:s=>s.sw.dlFreq==='209'},
{g:'2 · Carrier Datalink', t:'Close the kneeboard',
 tgt:'kb:datalink', done:s=>!s.kb.open},
{g:'2 · Carrier Datalink', t:'Datalink mode — <b>CAINS / WAYPT</b>',
 note:'Lets the jet talk to the ship\'s Carrier Aircraft Inertial Navigation System.',
 tgt:'dlModeSw', view:'rioR', done:s=>s.sw.dlModeSw==='cains'},
{g:'3 · Alignment', t:'Navigation Mode Selector — <b>CVA</b>',
 note:'Carrier INS alignment. No present position to type — the ship hands it over.',
 tgt:'navMode', view:'rioC', done:s=>s.sw.navMode==='cva'},
{g:'3 · Alignment', t:'Monitor the alignment on the TID',
 tgt:'scTid_rioC', view:'rioC', done:s=>s.ins.mode!==null&&s.ins.t>5},
{g:'3 · Alignment', t:'Second marker — <b>weapons employment</b>, the caret becomes a diamond',
 tgt:'scTid_rioC', view:'rioC', done:s=>s.ins.t>=378},
{g:'3 · Alignment', t:'Wait for <b>FULL FINE</b> — about <b>9 minutes</b> on the boat',
 tgt:'scTid_rioC', view:'rioC', done:s=>s.ins.complete},
{g:'3 · Alignment', t:'Navigation Mode Selector — <b>INS</b>',
 tgt:'navMode', view:'rioC', done:s=>s.sw.navMode==='ins'},
]

export const steps = [...RIO_PRE, ...MID, ...RIO_POST].map((s,i)=>({ n:i+1, ...s }));
