/* F-14B · PILOT COLD START, ON THE BOAT.

   The same jet and the same engines, but the deck changes what you set before
   you ever move: no anti-skid, hook bypass to CARRIER, the nose strut verified
   extended rather than kneeled, the HUD in takeoff mode, lights off, and the
   wings left swept for the taxi.

   Differences taken from Deepak's F-14 tutorials 1 and 3. */
import { build } from './pilot-start-common.js';

export const meta = { id:'pilot-start-carrier', crew:'pilot', phase:'startup', variant:'carrier',
                      name:'Cold start · carrier', view:'front',
                      ending:{ title:'Ready to Taxi', sub:'Swept, hooked up and set for the cat.' } };

export const steps = build(true);
