/* ============================================================
   CORE · SIM
   Aircraft-agnostic. Owns the switch state machine, the event
   bus and the tick driver; everything physical lives in the
   aircraft module it is handed.
   ============================================================ */

export function createSim(aircraft) {
  const sim = {
    aircraft,
    S: null,
    listeners: [],

    on(fn) { this.listeners.push(fn); },
    emit(msg, kind) { this.listeners.forEach(f => f(msg, kind)); },
    fault(name) {
      const F = this.S.faults;
      if (!F.includes(name)) F.push(name);
    },

    /* ---------- state ---------- */
    reset() {
      const sw = {};
      aircraft.controls.forEach(c => { if (c.states) sw[c.id] = c.init; });
      this.S = {
        t: 0, rate: 1, running: true,
        sw, touched: {}, faults: [],
        kb: { open: false, page: 0 },      // the pilot's kneeboard
      };
      aircraft.initState(this.S, sw);
      return this.S;
    },

    /* ---------- switch interaction ----------
       dir  >0 left-click  (up / forward / clockwise)
       dir  <0 right-click (down / aft / anticlockwise)
       frac      where inside a stacked pushbutton column you clicked
    */
    click(id, dir = 1, frac = null) {
      const S = this.S;
      const c = aircraft.controls.find(c => c.id === id);
      if (!c || !c.states) return;
      S.touched[id] = true;

      if (aircraft.beforeChange && aircraft.beforeChange(this, c, dir, frac) === false) return;

      if (c.reverse) dir = -dir;
      const cur = c.states.indexOf(S.sw[id]);
      let next;

      if (c.stack === 'v' && frac != null) {
        next = clamp(Math.floor(frac * c.states.length), 0, c.states.length - 1);
      } else if (c.states.length === 2) {
        next = 1 - cur;                                   // a two-position switch just flips
      } else {
        next = clamp(cur + (dir > 0 ? 1 : -1), 0, c.states.length - 1);
      }
      if (next === cur) return;

      const to = c.states[next];
      S.sw[id] = to;
      if (aircraft.onChange) aircraft.onChange(this, id, to);
    },

    set(id, value) {
      const S = this.S;
      if (S.sw[id] === value) return;
      S.sw[id] = value;
      if (aircraft.onChange) aircraft.onChange(this, id, value);
    },

    /* ---------- time ---------- */
    tick(dtReal) {
      const S = this.S;
      if (!S || !S.running) return;
      const dt = Math.min(0.25, dtReal) * S.rate;
      S.t += dt;
      aircraft.tick(this, dt);
    },
  };

  sim.reset();
  return sim;
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const approach = (v, target, rate, dt) => v + (target - v) * rate * dt;
