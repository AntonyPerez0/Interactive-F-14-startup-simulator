/* F-14B · PILOT COLD START, ASHORE.
   The steps live in pilot-start-common.js, shared with the carrier variant. */
import { build } from './pilot-start-common.js';

export const meta = { id:'pilot-start', crew:'pilot', phase:'startup', variant:'shore',
                      name:'Cold start · shore', view:'front',
                      ending:{ title:'Ready to Taxi', sub:'Chocks out when you are.' } };

export const steps = build(false);
