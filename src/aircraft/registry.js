/* Every aircraft the trainer knows about. Add a folder under
   src/aircraft/<id>/ with an index.js of the same shape and list it here. */
import f14b from './f14b/index.js';

export const aircraft = [f14b];
export const byId = id => aircraft.find(a => a.id === id) || aircraft[0];
