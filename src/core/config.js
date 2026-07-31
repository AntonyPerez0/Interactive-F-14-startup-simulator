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
