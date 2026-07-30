/* ============================================================
   CORE · CHECKLIST
   Renders whichever procedure is active and ticks its steps off
   by watching aircraft state. Steps are gated in order, so a step
   whose condition happens to hold on a cold jet still waits its
   turn rather than passing for free.
   ============================================================ */
import { $, el, toast } from './dom.js';

export function createChecklist(sim, ac) {
  const K = {
    sim, ac,
    procedure: ac.procedures[0],
    done: {},                       // keyed by procedure id, so lists can never cross
    curStep: 0,
    completed: false, skips: 0, runStart: 0,
    ackT: 0, ackHold: 5,          // a flown step confirms itself after this many seconds

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
        const hold = st.ack ? (st.hold ?? this.ackHold) : 0;
        d.innerHTML = `<div class="n">${st.n ?? i + 1}</div><div class="t">${st.t}` +
          (st.note ? `<span class="note">${st.note}</span>` : '') +
          (st.ack ? `<span class="ackbadge" data-ack>${hold ? 'confirm' : 'tap to confirm'}</span>` : '') +
          `</div>`;
        if (st.ack) d.classList.add('ack');
        d.addEventListener('click', () => {
          // a step that is flown rather than switched is confirmed by tapping it
          if (st.ack && i === this.curStep) { this.sync()[i] = true; return; }
          this.curStep = i;
          this.onHint?.();
        });
        b.appendChild(d);
      });
    },

    check(dtReal = 0) {
      const S = sim.S, L = this.steps(), done = this.sync();
      const was = this.curStep;
      for (let i = 0; i < L.length; i++) {
        if (done[i]) continue;
        if (L[i].ack) break;                 // waits for you to confirm it
        let ok = false;
        try { ok = L[i].done(S); } catch (e) {}
        if (ok) { done[i] = true; continue; }
        break;
      }
      const i = done.findIndex(d => !d);
      this.curStep = i < 0 ? L.length - 1 : i;
      if (this.curStep !== was) this.ackT = 0;

      /* A step that is flown rather than switched can be tapped, or it confirms
         itself after a short dwell so the pattern keeps moving. Real seconds,
         not aircraft seconds, so time compression does not blitz through it. */
      const cur = L[this.curStep];
      if (cur && cur.ack && !done[this.curStep]) {
        const hold = cur.hold ?? this.ackHold;
        if (hold > 0) {
          this.ackT += dtReal;
          if (this.ackT >= hold) { done[this.curStep] = true; this.ackT = 0; }
        }
      } else {
        this.ackT = 0;
      }
    },

    current() { return this.steps()[this.curStep]; },

    /* a step's tgt may be a string or a function of state, so a multi-press
       sequence can walk the cue from one control to the next as you go */
    target() {
      const st = this.current();
      if (!st || !st.tgt) return null;
      const t = typeof st.tgt === 'function' ? st.tgt(sim.S) : st.tgt;
      return t || null;
    },

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
        const badge = d.querySelector('[data-ack]');
        if (badge) {
          const st = this.steps()[i];
          const hold = st.hold ?? this.ackHold;
          badge.textContent = (i === this.curStep && !done[i] && hold > 0)
            ? 'tap, or ' + Math.max(1, Math.ceil(hold - this.ackT)) + 's'
            : (hold > 0 ? 'confirm' : 'tap to confirm');
        }
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
      const res = this.onFinish
        ? this.onFinish({ seconds: secs, skips: this.skips, faults: S.faults.length })
        : null;
      const rows = [
        ['Aircraft time', mmss + (res && res.isBest ? '   NEW BEST' : ''), false],
        ['Steps skipped', this.skips === 0 ? 'none' : String(this.skips), this.skips > 0],
        ['Faults logged', S.faults.length === 0 ? 'none'
          : S.faults.map(f => '<small>' + f + '</small>').join(''), S.faults.length > 0],
        ['Alignment', S.ins.mode ? S.ins.mode.toUpperCase() : '—', false],
      ];
      if (res && res.best != null) {
        const b = Math.floor(res.best / 60) + ':' + String(Math.floor(res.best % 60)).padStart(2, '0');
        rows.splice(1, 0, ['Best clean run', b, false]);
      }
      $('#doneStats').innerHTML = rows.map(([k, v, w]) =>
        `<div><dt>${k}</dt><dd class="${w ? 'warn' : ''}">${v}</dd></div>`).join('');
      $('#done').classList.remove('gone');
      toast(clean ? 'Complete — clean run.' : 'Complete.', 'good');
    },
  };
  return K;
}
