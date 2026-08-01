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
import { countingOff, setCounting } from './presence.js';
import { FEEDBACK_URL } from './config.js';
import { BUILD, BUILT } from './build.js';

const PHASES = [
  { id:'startup',  label:'Start-up',  blurb:'Cold and dark to ready to taxi' },
  { id:'landing',  label:'Landing',   blurb:'Configure, break, pattern and groove' },
  { id:'combat',   label:'Air to air', blurb:'Guns, Sidewinder, Sparrow and Phoenix' },
  { id:'shutdown', label:'Shutdown',  blurb:'Securing the aircraft' },
];

export function createMenu(catalogue, onPick, stats, presence) {
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
      const screens = { procs:'renderProcs', privacy:'renderPrivacy' };
      this[screens[this.screen] || 'renderHangar']();
      this.box.scrollTop = 0;
    },

    /* ---------------- screen 1: the hangar ---------------- */
    renderHangar() {
      const head = el('div', 'menuhead');
      const built = catalogue.filter(c => c.module).length;
      const sum = stats ? stats.summary() : null;
      head.classList.add('withmark');
      head.innerHTML =
        '<div class="headtext">' +
          '<div class="kick">DCS Cockpit Trainer</div>' +
          '<h1>Choose an aircraft<small>' + built + ' of ' + catalogue.length +
          ' built. Every switch is live, and the checklist ticks itself off when the ' +
          'aircraft actually gets there.</small></h1>' +
        '</div>' +
        // the squadron the procedures were reviewed by
        '<a class="marklink" href="https://www.virtualweaponsacademy.org/" ' +
          'target="_blank" rel="noopener noreferrer">' +
          '<img class="mark" alt="Virtual Weapons Academy" title="Virtual Weapons Academy — a good squadron to learn DCS with" src=' +
          JSON.stringify('assets/brand/vwa-144.png') + '></a>';
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

      /* Visitor numbers, if the counter is switched on. Absent until the first
         reply lands, and simply never shown if there is nothing behind it. */
      const p = presence && presence.counts;
      if (p && typeof p.total === 'number' && p.total > 0) {
        const bar = el('div', 'visitors');
        const cell = (n, label) => `<span><b>${n.toLocaleString()}</b>${label}</span>`;
        bar.innerHTML =
          cell(p.total, 'visitors') +
          (typeof p.month === 'number' ? cell(p.month, 'this month') : '') +
          (typeof p.online === 'number' && p.online > 0 ? cell(p.online, 'here now') : '');
        this.inner.appendChild(bar);
      }

      const cats = [...new Set(catalogue.map(c => c.cat))];
      this.wantFooter = true;
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

      const foot = el('div', 'menufoot');
      const note = el('p', 'unofficial');
      note.innerHTML =
        'An unofficial, non-commercial fan project. Not affiliated with or ' +
        'endorsed by <b>Eagle Dynamics</b>, <b>Heatblur Simulations</b> or any ' +
        'other developer. Cockpit imagery belongs to them and is used here to ' +
        'teach switch positions.';
      foot.appendChild(note);

      /* Where the squadron actually stands: they reviewed it, they did not
         build it, and none of this is theirs to answer for. */
      const vwa = el('p', 'unofficial');
      vwa.innerHTML =
        'The insignia above belongs to the <a href="https://www.virtualweaponsacademy.org/" ' +
        'target="_blank" rel="noopener noreferrer">Virtual Weapons Academy</a>. ' +
        'I fly with them and their aircrew corrected a great deal of what is here, ' +
        'but I am not affiliated with the squadron and this site is not theirs. ' +
        'If you want to learn DCS World properly, their Discord is well worth joining.';
      foot.appendChild(vwa);
      const links = el('div', 'footlinks');
      const pl = el('button', 'privlink');
      pl.textContent = 'What this site keeps';
      pl.onclick = () => this.open('privacy');
      links.appendChild(pl);

      if (FEEDBACK_URL) {
        const fb = el('a', 'privlink');
        fb.href = FEEDBACK_URL;
        fb.target = '_blank';
        fb.rel = 'noopener noreferrer';
        fb.textContent = 'Found something wrong?';
        links.appendChild(fb);
      }
      foot.appendChild(links);

      /* A build stamp, so a report can name which deploy it came from. */
      const stamp = el('div', 'buildstamp');
      stamp.textContent = 'build ' + BUILD + ' \u00b7 ' + BUILT;
      stamp.title = 'Quote this if you report a problem';
      foot.appendChild(stamp);

      this.inner.appendChild(foot);
    },

    /* ---------------- screen 2: procedures ---------------- */
    /* What the site keeps, in plain words, with a switch for the one thing that
       is not strictly necessary. */
    renderPrivacy() {
      const head = el('div', 'menuhead');
      head.innerHTML =
        '<div class="kick">Privacy</div>' +
        '<h1>What this site keeps<small>There are no cookies, no analytics, ' +
        'no third parties. Two things are stored, both described below.</small></h1>';
      this.inner.appendChild(head);

      const wrap = el('div', 'privacy');
      wrap.innerHTML =
        '<h4>Your times, kept on your device</h4>' +
        '<p>Runs, completions and best times per procedure, stored in your ' +
        'browser under <code>dcs-trainer-stats-v1</code>. It is never sent ' +
        'anywhere. Clearing your browser data removes it, and so does the ' +
        'Clear button on the aircraft screen.</p>' +

        '<h4>The visitor count</h4>' +
        '<p>Your browser makes up a random string — no name, no address, ' +
        'nothing derived from you — and sends it every 45 seconds so the site ' +
        'can show how many people are here. The server keeps that string and a ' +
        'timestamp, nothing else. Rows older than a year are deleted.</p>' +
        '<p>This is the only thing that leaves your device, and the only part ' +
        'you might reasonably object to, so you can turn it off.</p>' +

        '<h4>What is not here</h4>' +
        '<ul>' +
          '<li>no cookies at all</li>' +
          '<li>no Google Analytics or any other tracker</li>' +
          '<li>no third-party fonts, scripts or embeds</li>' +
          '<li>no IP addresses or request headers recorded</li>' +
          '<li>nothing sold, shared or used for advertising</li>' +
        '</ul>' +
        '<h4>Credit where it is due</h4>' +
        '<p>The cockpit photographs are Eagle Dynamics and Heatblur artwork, used ' +
        'to teach switch positions. The procedures follow Chuck\'s guide, corrected ' +
        'by aircrew from the Virtual Weapons Academy, who I fly with but do not ' +
        'speak for. This is an unofficial, non-commercial community tool with no ' +
        'affiliation to any of them.</p>' +
        '<p class="fine">The site is served by Cloudflare, which may set its own ' +
        'security cookie on requests as part of blocking bots. That is theirs, ' +
        'not something this site asks for or reads.</p>';

      const row = el('div', 'optout');
      const btn = el('button', 'btn');
      const paint = () => {
        const off = countingOff();
        btn.textContent = off ? 'Counting is off — turn it back on' : 'Do not count my visits';
        btn.classList.toggle('on', !off);
        row.querySelector('.state').textContent = off ? 'OFF' : 'ON';
      };
      row.innerHTML = '<span>Visitor counting <b class="state"></b></span>';
      btn.onclick = () => { setCounting(countingOff()); paint(); };
      row.appendChild(btn);
      wrap.appendChild(row);
      paint();

      const back = el('button', 'btn back');
      back.textContent = '\u2190 Back';
      back.onclick = () => this.open('hangar');
      wrap.appendChild(back);
      this.inner.appendChild(wrap);
    },

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
