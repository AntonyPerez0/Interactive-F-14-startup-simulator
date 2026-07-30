/* ============================================================
   CORE · PRESENCE
   The optional "N people here now" counter.

   Written defensively, because a client that can hammer an endpoint will
   eventually hammer an endpoint. Three separate guards, any one of which is
   enough on its own:

     1. only ever one request in flight
     2. a hard floor on the gap between requests, whoever asks
     3. a total budget per page load, after which it stops for good

   With no endpoint configured it does nothing at all, and every failure is
   swallowed so the trainer is never held up by it.
   ============================================================ */
import { $, el } from './dom.js';

const BEAT      = 45000;    // normal interval
const MIN_GAP   = 10000;    // no two requests closer than this, ever
const MAX_CALLS = 200;      // per page load; a 45 s beat uses 80 in a whole hour
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
  if (!url) return { counts:{}, onCounts() {}, refresh() {}, start() {}, stop() {} };

  const id = visitorId();
  const counts = { online: null, month: null, total: null };
  let chip = null, timer = null, onCounts = null;
  let failures = 0, calls = 0, inFlight = false, lastAt = 0, dead = false;

  const show = n => {
    if (!chip) {
      chip = el('button', 'chip presence');
      chip.id = 'presencechip';
      chip.title = 'People using the trainer right now';
      $('#topright').insertBefore(chip, $('#topright').firstChild);
    }
    chip.textContent = n === 1 ? '1 here' : n + ' here';
    chip.style.display = '';
  };

  const stop = reason => {
    dead = true;
    if (timer) clearInterval(timer);
    timer = null;
    if (reason) console.info('[presence] stopped:', reason);
  };

  const beat = async (wantStats = false) => {
    if (dead || inFlight) return;                       // guard 1
    const now = Date.now();
    if (now - lastAt < MIN_GAP) return;                 // guard 2
    if (++calls > MAX_CALLS) return stop('call budget spent');   // guard 3

    inFlight = true;
    lastAt = now;
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, stats: wantStats }),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      if (typeof data.online !== 'number') throw new Error('bad payload');

      show(data.online);
      Object.assign(counts, data);
      if (typeof data.total === 'number' && onCounts) onCounts(counts);
      failures = 0;
    } catch (e) {
      if (++failures >= 3) stop('three failures: ' + e.message);
    } finally {
      inFlight = false;
    }
  };

  return {
    counts,
    onCounts(fn) { onCounts = fn; },
    refresh() { return beat(true); },
    start() {
      if (timer) return;                                // never start twice
      beat(true);
      timer = setInterval(() => beat(false), BEAT);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') beat(false);
      });
    },
    stop: () => stop('asked to stop'),
  };
}
