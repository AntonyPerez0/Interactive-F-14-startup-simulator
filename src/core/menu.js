/* ============================================================
   CORE · MENU
   Two screens. The hangar lists every aircraft in the catalogue,
   greying out the ones that are not built yet; picking a built one
   moves to its procedures, grouped by phase.

   Both screens are generated from the registry and the aircraft
   modules, so adding a jet or a procedure needs no change here.
   ============================================================ */
import { $, el } from './dom.js';
import { mmss } from './stats.js';

const PHASES = [
  { id:'startup',  label:'Start-up',  blurb:'Cold and dark to ready to taxi' },
  { id:'landing',  label:'Landing',   blurb:'Configure, break, pattern and groove' },
  { id:'shutdown', label:'Shutdown',  blurb:'Securing the aircraft' },
];

export function createMenu(catalogue, onPick, stats) {
  const M = {
    screen: 'hangar',
    entry: catalogue.find(c => c.module) || catalogue[0],

    mount() {
      const box = el('div');
      box.id = 'menu';
      box.innerHTML = '<div class="menuinner" data-menu="inner"></div>';
      document.body.appendChild(box);
      this.box = box;
      this.inner = box.querySelector('[data-menu="inner"]');
      this.render();
    },

    open(screen) {
      if (screen) this.screen = screen;
      this.box.classList.add('open');
      this.render();
    },
    close() { this.box.classList.remove('open'); },

    render() {
      this.inner.innerHTML = '';
      this[this.screen === 'procs' ? 'renderProcs' : 'renderHangar']();
      this.box.scrollTop = 0;
    },

    /* ---------------- screen 1: the hangar ---------------- */
    renderHangar() {
      const head = el('div', 'menuhead');
      const built = catalogue.filter(c => c.module).length;
      const sum = stats ? stats.summary() : null;
      head.innerHTML =
        '<div class="kick">DCS Cockpit Trainer</div>' +
        '<h1>Choose an aircraft<small>' + built + ' of ' + catalogue.length +
        ' built. Every switch is live, and the checklist ticks itself off when the ' +
        'aircraft actually gets there.</small></h1>';
      this.inner.appendChild(head);

      if (sum && sum.runs) {
        const bar = el('div', 'yourstats');
        bar.innerHTML =
          `<span><b>${sum.runs}</b> runs</span>` +
          `<span><b>${sum.completed}</b> completed</span>` +
          `<span><b>${sum.clean}</b> clean</span>` +
          `<span><b>${sum.attempted}</b> procedures tried</span>`;
        const wipe = el('button', 'wipe');
        wipe.textContent = 'Clear';
        wipe.onclick = () => { if (confirm('Clear your saved times and progress?')) { stats.clear(); this.render(); } };
        bar.appendChild(wipe);
        this.inner.appendChild(bar);
      } else if (stats && !stats.available) {
        const warn = el('div', 'yourstats');
        warn.innerHTML = '<span>This browser is blocking local storage, so times will not be kept.</span>';
        this.inner.appendChild(warn);
      }

      const cats = [...new Set(catalogue.map(c => c.cat))];
      cats.forEach(cat => {
        const sec = el('div', 'phase');
        const h = el('div', 'phasehead');
        const n = catalogue.filter(c => c.cat === cat && c.module).length;
        h.innerHTML = `<b>${cat}</b><span>${n ? n + ' available' : 'none built yet'}</span>`;
        sec.appendChild(h);

        const grid = el('div', 'planegrid');
        catalogue.filter(c => c.cat === cat).forEach(c => {
          const ready = !!c.module;
          const b = el('button', 'planecard' + (ready ? '' : ' soonplane'));
          b.disabled = !ready;
          b.innerHTML =
            `<b>${c.name}</b><span class="maker">${c.maker}</span>` +
            `<span class="tag">${ready ? c.module.procedures.length + ' procedures' : 'Not built yet'}</span>`;
          if (ready) b.onclick = () => { this.entry = c; this.open('procs'); };
          grid.appendChild(b);
        });
        sec.appendChild(grid);
        this.inner.appendChild(sec);
      });
    },

    /* ---------------- screen 2: procedures ---------------- */
    renderProcs() {
      const ac = this.entry.module;

      const back = el('button', 'menuback');
      back.textContent = '\u2190  All aircraft';
      back.onclick = () => this.open('hangar');
      this.inner.appendChild(back);

      const head = el('div', 'menuhead');
      head.innerHTML =
        `<div class="kick">${this.entry.maker}</div>` +
        `<h1>${ac.name}<small>${ac.source}</small></h1>`;
      this.inner.appendChild(head);

      PHASES.forEach(ph => {
        const list = ac.procedures.filter(p => p.meta.phase === ph.id);
        const sec = el('div', 'phase' + (list.length ? '' : ' empty'));
        const h = el('div', 'phasehead');
        h.innerHTML = `<b>${ph.label}</b><span>${ph.blurb}</span>`;
        sec.appendChild(h);

        if (!list.length) {
          const soon = el('div', 'soon');
          soon.textContent = 'Not built yet';
          sec.appendChild(soon);
        } else {
          list.forEach(p => {
            const card = el('button', 'proc');
            card.innerHTML =
              `<span class="crew ${p.meta.crew}">${p.meta.crew === 'rio' ? 'RIO' : 'Pilot'}</span>` +
              `<b>${p.meta.name}</b>` +
              `<span class="n">${p.steps.length} steps</span>`;
            const r = stats && stats.of(p.meta.id);
            const note = el('span', 'stat');
            note.textContent = !r ? 'never run'
              : r.best != null ? 'best ' + mmss(r.best) + '  \u00b7  ' + r.runs + (r.runs === 1 ? ' run' : ' runs')
              : r.completed ? 'finished  \u00b7  ' + r.runs + (r.runs === 1 ? ' run' : ' runs')
              : 'no clean run yet  \u00b7  ' + r.runs + (r.runs === 1 ? ' try' : ' tries');
            if (r) note.classList.add('on');
            card.appendChild(note);
            card.onclick = () => { this.close(); onPick(ac, p); };
            sec.appendChild(card);
          });
        }
        this.inner.appendChild(sec);
      });
    },
  };
  return M;
}
