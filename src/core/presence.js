/* ============================================================
   CORE · PRESENCE
   An optional "N people here now" counter.

   GitHub Pages serves static files and nothing else, so it cannot
   count anybody by itself — that needs something running somewhere.
   This talks to a tiny endpoint you host; see tools/presence-worker.js
   for one you can deploy free in a couple of minutes.

   With no endpoint configured this does nothing at all, and any
   failure is swallowed so the trainer is never held up by it.
   ============================================================ */
import { $, el } from './dom.js';

/* A beat every 45 s against a 150 s window: someone who closes the tab drops off
   within about two minutes, and a twenty minute visit costs roughly 27 writes.
   Cloudflare's free D1 allowance is 100,000 writes a day. */
const BEAT = 45000;
const KEY = 'dcs-trainer-visitor';

function visitorId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(KEY, id); }
    return id;
  } catch (e) {
    return 'anon-' + Math.random().toString(36).slice(2);
  }
}

export function createPresence(url) {
  if (!url) return { start() {}, stop() {} };

  const id = visitorId();
  const counts = { online: null, month: null, total: null };
  let chip = null, timer = null, failures = 0, onCounts = null, shown = false;

  const show = n => {
    if (!chip) {
      chip = el('button', 'chip presence');
      chip.id = 'presencechip';
      chip.title = 'People using the trainer right now';
      $('#topright').insertBefore(chip, $('#topright').firstChild);
    }
    chip.textContent = n === 1 ? '1 here' : n + ' here';
    chip.style.display = '';
    shown = true;
  };

  const beat = async (wantStats = false) => {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, stats: wantStats }),
        keepalive: true,
      });
      if (!r.ok) throw new Error(r.status);
      const data = await r.json();
      if (typeof data.online === 'number') { show(data.online); failures = 0; }
      Object.assign(counts, data);
      if (typeof data.total === 'number' && onCounts) onCounts(counts);
    } catch (e) {
      /* Give up quietly if the endpoint was never there. But once the chip has
         appeared, leave it alone — a transient failure showing a slightly stale
         number is better than it blinking out and back. */
      if (++failures >= 3) {
        stop();
        if (chip && !shown) chip.style.display = 'none';
      }
    }
  };

  const stop = () => { if (timer) clearInterval(timer); timer = null; };

  return {
    counts,
    /* called once when the numbers land, so the hangar can show them */
    onCounts(fn) { onCounts = fn; },
    /* asks for the totals as well as the live count */
    refresh() { return beat(true); },
    start() {
      beat(true);
      timer = setInterval(beat, BEAT);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') beat();
      });
    },
    stop,
  };
}
