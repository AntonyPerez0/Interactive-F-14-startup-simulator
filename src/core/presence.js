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

const BEAT = 20000;      // heartbeat interval
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
  let chip = null, timer = null, failures = 0;

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

  const beat = async () => {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        keepalive: true,
      });
      if (!r.ok) throw new Error(r.status);
      const { online } = await r.json();
      if (typeof online === 'number') { show(online); failures = 0; }
    } catch (e) {
      // give up quietly rather than hammer an endpoint that is not there
      if (++failures >= 3) { stop(); if (chip) chip.style.display = 'none'; }
    }
  };

  const stop = () => { if (timer) clearInterval(timer); timer = null; };

  return {
    start() {
      beat();
      timer = setInterval(beat, BEAT);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') beat();
      });
    },
    stop,
  };
}
