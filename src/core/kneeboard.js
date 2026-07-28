/* ============================================================
   CORE · KNEEBOARD
   Renders whichever procedure is active and ticks its steps off
   by watching aircraft state. Steps are gated in order, so a step
   whose condition happens to hold on a cold jet still waits its
   turn rather than passing for free.
   ============================================================ */
import { $, el, toast } from './dom.js';

export function createKneeboard(sim, ac) {
  const K = {
    sim, ac,
    procedure: ac.procedures[0],
    done: {},                       // keyed by procedure id, so lists can never cross
    curStep: 0,
    completed: false, skips: 0, runStart: 0,

    steps() { return this.procedure.steps; },
    key()   { return this.procedure.meta.id; },

    /* the completion array is always exactly as long as the list on screen */
    sync() {
      const k = this.key(), n = this.steps().length;
      if (!this.done[k] || this.done[k].length !== n) this.done[k] = new Array(n).fill(false);
      return this.done[k];
    },

    setProcedure(p) {
      this.procedure = p;
      this.completed = false;
      this.skips = 0;
      this.runStart = sim.S.t;
      $('#done').classList.add('gone');
      this.build();
      this._lastNow = -1;
    },

    resetProgress() {
      this.done = {};
      this.sync();
      this.curStep = 0;
      this.completed = false;
      this.skips = 0;
      this.runStart = sim.S.t;
      $('#done').classList.add('gone');
    },

    build() {
      this.sync();
      const b = $('#board');
      b.innerHTML = '';
      b.dataset.key = this.key();
      let group = null;
      this.steps().forEach((st, i) => {
        if (st.g !== group) {
          group = st.g;
          const g = el('div', 'grp');
          g.textContent = group;
          b.appendChild(g);
        }
        const d = el('div', 'step');
        d.dataset.i = i;
        d.innerHTML = `<div class="n">${st.n}</div><div class="t">${st.t}` +
          (st.note ? `<span class="note">${st.note}</span>` : '') + `</div>`;
        d.addEventListener('click', () => { this.curStep = i; this.onHint?.(); });
        b.appendChild(d);
      });
    },

    check() {
      const S = sim.S, L = this.steps(), done = this.sync();
      for (let i = 0; i < L.length; i++) {
        if (done[i]) continue;
        let ok = false;
        try { ok = L[i].done(S); } catch (e) {}
        if (ok) { done[i] = true; continue; }
        break;
      }
      const i = done.findIndex(d => !d);
      this.curStep = i < 0 ? L.length - 1 : i;
    },

    current() { return this.steps()[this.curStep]; },

    skip() {
      this.sync()[this.curStep] = true;
      this.skips++;
      toast('Step skipped.', 'bad');
    },

    render() {
      const done = this.sync();
      const board = $('#board');
      let rows = board.querySelectorAll('.step');
      if (board.dataset.key !== this.key() || rows.length !== this.steps().length) {
        this.build();
        rows = board.querySelectorAll('.step');
        this._lastNow = -1;
      }
      rows.forEach(d => {
        const i = +d.dataset.i;
        d.classList.toggle('done', !!done[i]);
        d.classList.toggle('now', i === this.curStep && !done[i]);
      });

      const n = done.filter(Boolean).length, total = this.steps().length;
      $('#prog').style.width = (n / total * 100) + '%';
      const all = n === total;
      const cs = this.current();
      $('#phaseName').textContent = all ? 'Complete' : (cs ? cs.g.replace(/^\d+ · /, '') : '—');

      if (all && !this.completed) { this.completed = true; this.showComplete(); }

      if (this._lastNow !== this.curStep) {
        this._lastNow = this.curStep;
        const now = board.querySelector('.step.now');
        if (now) now.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    },

    showComplete() {
      const S = sim.S;
      const secs = Math.max(0, S.t - this.runStart);
      const mmss = Math.floor(secs / 60) + ':' + String(Math.floor(secs % 60)).padStart(2, '0');
      const clean = this.skips === 0 && S.faults.length === 0;
      $('#doneTitle').firstChild.textContent =
        this.procedure.meta.crew === 'rio' ? 'Aligned' : 'Ready to Taxi';
      $('#doneSub').textContent = this.procedure.meta.name + ' · ' +
        this.steps().length + ' of ' + this.steps().length + ' steps';
      const rows = [
        ['Aircraft time', mmss, false],
        ['Steps skipped', this.skips === 0 ? 'none' : String(this.skips), this.skips > 0],
        ['Faults logged', S.faults.length === 0 ? 'none'
          : S.faults.map(f => '<small>' + f + '</small>').join(''), S.faults.length > 0],
        ['Alignment', S.ins.mode ? S.ins.mode.toUpperCase() : '—', false],
      ];
      $('#doneStats').innerHTML = rows.map(([k, v, w]) =>
        `<div><dt>${k}</dt><dd class="${w ? 'warn' : ''}">${v}</dd></div>`).join('');
      $('#done').classList.remove('gone');
      toast(clean ? 'Complete — clean run.' : 'Complete.', 'good');
    },
  };
  return K;
}
