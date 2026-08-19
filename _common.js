/* Shared helper for the F/A-18C procedure files.

   Stamps each step with the view its target control lives on, so "show me"
   switches to the right tab instead of hunting on whichever one is open. The
   test suite checks this agreement for the F-14B; doing it here keeps the two
   aircraft honest in the same way. */
import { controls } from '../controls.js';

const VIEW = Object.fromEntries(controls.filter(c => !c.tray).map(c => [c.id, c.view]));

export const stamp = steps => steps.map(s => ({
  ...s,
  view: s.view ?? (typeof s.tgt === 'string' ? VIEW[s.tgt] : undefined),
}));
