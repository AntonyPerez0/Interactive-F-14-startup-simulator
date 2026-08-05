/* Site settings you may want to change.

   PRESENCE_URL — the endpoint that counts who is online.

   On Cloudflare Pages this is already wired: functions/api/presence.js is
   deployed with the site, so leaving it as '/api/presence' is all you need
   once the D1 binding exists. See DEPLOY.md.

   Set it to '' to switch the counter off entirely, which is the right setting
   for a plain GitHub Pages deploy with nothing behind it. */
export const PRESENCE_URL = '/api/presence';

/* Where people should send corrections. A wrong hotspot or a step that cannot be
   completed is worth hearing about; leave this empty to hide the link. */
export const FEEDBACK_URL =
  'https://github.com/AntonyPerez0/Interactive-F-14-startup-simulator/issues';

/* An interactive CASE 1 trainer, hosted as its own app. It is a link out, not
   something embedded: on a phone it needs the whole screen, and it has its own
   scoring, so this side deliberately shows no step count, run count or best
   time. Set to null to remove the row. */
export const SIM_LINK = {
  after: 'landing-carrier',           // the row it sits under
  href:  'https://sim.sortieprep.com/',
  badge: 'TRAINER',
  title: 'CASE 1 pattern \u00b7 interactive trainer',
};
