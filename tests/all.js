/* npm test — runs the logic suite then boots the app against a fake DOM. */
import { spawnSync } from 'node:child_process';
const here = new URL('.', import.meta.url).pathname;
let bad = 0;
for (const f of ['run.js', 'dom-smoke.js']) {
  const r = spawnSync(process.execPath, [here + f], { stdio: 'inherit' });
  if (r.status !== 0) bad++;
}
process.exit(bad ? 1 : 0);
