/* ============================================================
   CORE · STATS
   Keeps a record of what you have run and how it went, in the
   browser's own storage. Nothing leaves the machine, and it works
   on a static host with no backend.

   Every call is wrapped, because storage throws in private windows
   and in some embedded viewers. If it is unavailable the trainer
   still works, it just forgets between reloads.
   ============================================================ */

const KEY = 'dcs-trainer-stats-v1';

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { procs: {} };
  } catch (e) {
    return { procs: {} };
  }
}

function write(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
  catch (e) { return false; }
}

export function createStats() {
  let data = read();
  let live = write(data);          // false when storage is unavailable

  const rec = id => (data.procs[id] ||= {
    runs: 0, completed: 0, clean: 0, best: null, last: null, lastAt: null,
  });

  return {
    get available() { return live; },

    /* a run begins */
    started(id) {
      rec(id).runs++;
      live = write(data);
    },

    /* a run ends, with how it went */
    finished(id, { seconds, skips, faults }) {
      const r = rec(id);
      r.completed++;
      r.last = seconds;
      r.lastAt = Date.now();
      const clean = skips === 0 && faults === 0;
      if (clean) r.clean++;
      // only a clean run counts for a best time — otherwise skipping wins
      const isBest = clean && (r.best === null || seconds < r.best);
      if (isBest) r.best = seconds;
      live = write(data);
      return { isBest, clean, best: r.best };
    },

    of(id) { return data.procs[id] || null; },

    /* totals for the hangar */
    summary() {
      const all = Object.values(data.procs);
      return {
        runs: all.reduce((n, r) => n + r.runs, 0),
        completed: all.reduce((n, r) => n + r.completed, 0),
        clean: all.reduce((n, r) => n + r.clean, 0),
        attempted: all.length,
      };
    },

    clear() {
      data = { procs: {} };
      live = write(data);
    },
  };
}

export const mmss = s =>
  s == null ? '—' : Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
