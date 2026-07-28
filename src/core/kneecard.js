/* ============================================================
   CORE · KNEECARD
   The pilot's kneeboard — the thing you open with RSHIFT+K in the
   sim and page through with [ and ]. Rendered from the aircraft's
   own data so the figures printed on it are the same ones the
   aircraft will accept, and can never drift out of sync.

   Not to be confused with core/checklist.js, which is the
   procedure list down the right-hand side.
   ============================================================ */
import { $, el } from './dom.js';

export function createKneecard(sim, ac) {
  const pages = (ac.kneeboard && ac.kneeboard.pages) || [];

  const KB = {
    pages,
    get open() { return sim.S.kb.open; },
    get page() { return sim.S.kb.page; },

    toggle(on) {
      sim.S.kb.open = on === undefined ? !sim.S.kb.open : on;
      this.render();
    },
    goto(idOrIndex) {
      const i = typeof idOrIndex === 'number'
        ? idOrIndex
        : pages.findIndex(p => p.id === idOrIndex);
      if (i >= 0) sim.S.kb.page = i;
      sim.S.kb.open = true;
      this.render();
    },
    step(dir) {
      if (!pages.length) return;
      sim.S.kb.page = (sim.S.kb.page + dir + pages.length) % pages.length;
      this.render();
    },

    mount() {
      const box = el('div');
      box.id = 'kneecard';
      box.innerHTML =
        '<div class="kbhead"><span data-kb="title"></span>' +
          '<span class="kbnum" data-kb="num"></span></div>' +
        '<div class="kbbody" data-kb="body"></div>' +
        '<div class="kbfoot" data-kb="foot"></div>' +
        '<div class="kbkeys">' +
          '<button data-kb="prev">[</button>' +
          '<span>page</span>' +
          '<button data-kb="next">]</button>' +
          '<button data-kb="close">RSHIFT+K</button></div>';
      $('#stage').appendChild(box);
      this.box = box;
      box.querySelector('[data-kb="prev"]').onclick  = () => this.step(-1);
      box.querySelector('[data-kb="next"]').onclick  = () => this.step(1);
      box.querySelector('[data-kb="close"]').onclick = () => this.toggle(false);
      this.render();
    },

    render() {
      if (!this.box) return;
      const S = sim.S;
      this.box.classList.toggle('open', S.kb.open);
      if (!S.kb.open || !pages.length) return;
      const p = pages[Math.min(S.kb.page, pages.length - 1)];

      this.box.querySelector('[data-kb="title"]').textContent = p.title;
      this.box.querySelector('[data-kb="num"]').textContent =
        (S.kb.page + 1) + ' / ' + pages.length;

      const body = this.box.querySelector('[data-kb="body"]');
      body.innerHTML = '';

      if (p.rows) {
        const dl = el('div', 'kbrows');
        p.rows.forEach(([k, v]) => {
          const r = el('div', 'kbrow');
          const a = el('span', 'kbk'); a.textContent = k;
          const b = el('span', 'kbv'); b.textContent = v;
          r.appendChild(a); r.appendChild(b);
          dl.appendChild(r);
        });
        body.appendChild(dl);
      }

      if (p.table) {
        const t = el('table', 'kbtable');
        const hr = el('tr');
        p.table.head.forEach(h => { const th = el('th'); th.textContent = h; hr.appendChild(th); });
        t.appendChild(hr);
        p.table.rows.forEach(cells => {
          const tr = el('tr');
          cells.forEach(c => { const td = el('td'); td.textContent = c; tr.appendChild(td); });
          t.appendChild(tr);
        });
        body.appendChild(t);
      }

      this.box.querySelector('[data-kb="foot"]').textContent = p.foot || '';
    },
  };
  return KB;
}
