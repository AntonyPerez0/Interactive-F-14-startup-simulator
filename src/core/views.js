/* ============================================================
   CORE · VIEWS
   Draws the cockpit photos, the clickable hotspots over them and
   the live instruments. Knows nothing about any particular
   aircraft beyond the shape of its control and gauge records.
   ============================================================ */
import { $, el, toast } from './dom.js';

export function createViews(sim, ac) {
  const V = {
    sim, ac,
    view: ac.views[0].id,
    zoom: 1, panX: 0, panY: 0,
    nodes: {}, gnodes: {}, cue: null,
    labels: false, edit: false, guided: true,
    imgs: {},

    /* which views a control belongs to ('pilotBoth' expands to both pilot photos) */
    viewsOf(c) {
      if (c.tray) return [];
      return ac.sharedViews[c.view] || [c.view];
    },
    shows(c) { return this.viewsOf(c).includes(this.view); },

    /* ---------------- build ---------------- */
    mount() {
      const world = $('#world');
      ac.views.forEach((v, i) => {
        const img = el('img');
        img.src = v.src;
        img.alt = ac.name + ' — ' + v.label;
        img.style.display = i === 0 ? 'block' : 'none';
        world.insertBefore(img, $('#overlay'));
        this.imgs[v.id] = img;
      });
      this.buildTray();
      this.buildOverlay();
    },

    buildTray(only) {
      if (this.tray) { this.tray.remove(); this.tray = null; }
      const wanted = ac.controls.filter(c => c.tray && (!only || only.has(c.id)));
      if (!wanted.length) return;
      const tray = el('div');
      tray.id = 'tray';

      const h = el('button', 'trayhead');
      const short = window.innerWidth <= 820;
      h.innerHTML = '<span>' + (short ? 'Not in photos' : 'Not in these photos') +
                    '</span><b>–</b>';
      h.onclick = () => {
        const shut = tray.classList.toggle('shut');
        h.querySelector('b').textContent = shut ? '+' : '–';
      };
      tray.appendChild(h);
      // start collapsed where the screen is small
      if (window.innerWidth <= 820) {
        tray.classList.add('shut');
        h.querySelector('b').textContent = '+';
      }
      wanted.forEach(c => {
        const b = el('button', 'trayitem');
        b.dataset.tray = c.id;
        const label = el('span');
        label.textContent = c.name;
        const value = el('b');
        b.appendChild(label); b.appendChild(value);
        tray.appendChild(b);
        b._value = value;
        this.nodes['tray:' + c.id] = b;
      });
      $('#stage').appendChild(tray);
      this.tray = tray;
    },

    buildOverlay() {
      const ov = $('#overlay');
      ov.innerHTML = '';
      this.gnodes = {};
      this.nodes = Object.fromEntries(
        Object.entries(this.nodes).filter(([k]) => k.startsWith('tray:')));

      ac.gauges.filter(g => g.view === this.view).forEach(g => {
        const n = el('div', 'gauge');
        n.dataset.id = g.id;
        n.style.cssText = `left:${g.x}px;top:${g.y}px;` + (g.w ? `width:${g.w}px;height:${g.h}px;` : '');

        if (g.kind === 'tape') {
          ['l', 'r'].forEach(side => {
            const c = el('div', 'chan');
            c.dataset.side = side;
            c.style.cssText = `left:${ac.TAPE_CH[side]}px;width:${ac.TAPE_CH.w}px;` +
                              `top:0;bottom:-7px;background:${g.empty}`;
            const b = el('b'); b.style.background = g.bar;
            c.appendChild(b); c.appendChild(el('i'));
            n.appendChild(c);
          });
          const chip = el('div', 'gchip');
          chip.style.cssText = 'left:0;right:0;top:1px;height:17px;font-size:11px';
          chip.dataset.chip = '1';
          n.appendChild(chip);

        } else if (g.kind === 'chip') {
          n.className = 'gauge gchip';
          n.dataset.id = g.id;
          n.style.fontSize = (g.w < 90 ? 12 : 13) + 'px';

        } else if (g.kind === 'needle') {
          n.className = 'gauge needle';
          n.dataset.id = g.id;
          n.appendChild(el('i'));
          n.appendChild(el('b'));

        } else if (g.kind === 'screen') {
          n.style.background = g.led
            ? 'linear-gradient(180deg,#160b08,#0b0605 60%,#100807)'
            : 'linear-gradient(160deg,#0d100f,#050707 55%,#080a09)';
          n.style.boxShadow = 'inset 0 0 24px rgba(0,0,0,.92),inset 0 1px 0 rgba(255,255,255,.05)';
          n.style.borderRadius = g.round ? '50%' : '5px';
          n.style.transition = 'opacity .25s';
          n.style.pointerEvents = 'none';
          if (g.ins) {
            n.appendChild(insPanel());
            const tl = el('div', 'tidtracks');
            tl.dataset.tracks = '1';
            n.appendChild(tl);
          }
        }
        ov.appendChild(n);
        this.gnodes[g.id] = n;
      });

      ac.controls.filter(c => this.shows(c)).forEach(c => {
        const n = el('div', 'hs');
        n.dataset.id = c.id;
        n.style.cssText = `left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px`;
        n.title = c.name;
        const v = el('div', 'val');
        v.textContent = c.name;
        n.appendChild(v);
        if (c.kind === 'sw' || c.kind === 'lever') n.appendChild(el('div', 'stick'));
        if (c.kind === 'knob') n.appendChild(el('div', 'knob'));
        if (c.kind === 'lamp') {
          n.appendChild(el('div', 'lamp ' + (c.color || 'amber')));
          n.style.background = 'transparent';
          n.style.border = '1px solid rgba(65,224,124,.25)';
        }
        ov.appendChild(n);
        this.nodes[c.id] = n;
      });
    },

    setView(id) {
      if (id === this.view) return;
      this.view = id;
      Object.entries(this.imgs).forEach(([k, img]) => { img.style.display = k === id ? 'block' : 'none'; });
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.view === id));
      this.buildOverlay();
    },

    /* ---------------- transform ---------------- */
    /* Show the whole frame. Letterboxes on a narrow screen, which is what the
       FIT button is for. */
    fit() {
      const st = $('#stage');
      const z = Math.min(st.clientWidth / 1920, st.clientHeight / 1080);
      this.zoom = z;
      this.panX = (st.clientWidth - 1920 * z) / 2;
      this.panY = (st.clientHeight - 1080 * z) / 2;
      this.apply();
    },

    /* Fill the stage, cropping the sides. A 16:9 cockpit in a portrait phone
       letterboxes to about 40% of the height and nothing is legible, so this is
       the sensible default there — pan and pinch still work. */
    fill() {
      const st = $('#stage');
      const z = Math.max(st.clientWidth / 1920, st.clientHeight / 1080);
      this.zoom = z;
      this.panX = (st.clientWidth - 1920 * z) / 2;
      this.panY = (st.clientHeight - 1080 * z) / 2;
      this.apply();
    },

    /* Whichever suits the shape of the screen. */
    reset() {
      const st = $('#stage');
      const portrait = st.clientHeight / Math.max(1, st.clientWidth) > 1.15;
      portrait ? this.fill() : this.fit();
    },
    setZoom(z, cx, cy) {
      z = Math.max(0.25, Math.min(5, z));
      const wx = (cx - this.panX) / this.zoom, wy = (cy - this.panY) / this.zoom;
      this.zoom = z; this.panX = cx - wx * z; this.panY = cy - wy * z;
      this.apply();
    },
    zoomAt(cx, cy, f) { this.setZoom(this.zoom * f, cx, cy); },
    apply() {
      $('#world').style.transform = `translate(${this.panX}px,${this.panY}px) scale(${this.zoom})`;
    },
    /* Fit everything in `rects` on screen at once, rather than slamming the
       zoom to a fixed level and centring on one control. That keeps a readout
       in view while you work the keys that feed it. */
    frameOn(rects, maxZoom = 1.35) {
      const st = $('#stage'), pad = 70;
      const x0 = Math.min(...rects.map(r => r.x)) - pad;
      const y0 = Math.min(...rects.map(r => r.y)) - pad;
      const x1 = Math.max(...rects.map(r => r.x + (r.w || 40))) + pad;
      const y1 = Math.max(...rects.map(r => r.y + (r.h || 40))) + pad;
      const fit = Math.min(st.clientWidth / 1920, st.clientHeight / 1080);
      const z = Math.min(maxZoom, st.clientWidth / (x1 - x0), st.clientHeight / (y1 - y0));
      this.zoom = Math.max(z, fit);
      this.panX = st.clientWidth / 2 - ((x0 + x1) / 2) * this.zoom;
      this.panY = st.clientHeight / 2 - ((y0 + y1) / 2) * this.zoom;
      this.apply();
    },
    centreOn(c) { this.frameOn([c]); },

    /* ---------------- calibration ---------------- */
    setEdit(on) {
      this.edit = on;
      document.body.classList.toggle('edit', on);
      if (on) toast('Calibrate: drag any ring or gauge onto its real control, then copy the JSON.', 'radio');
    },
    copyLayout() {
      const out = { controls: {}, gauges: {} };
      ac.controls.forEach(c => { if (!c.tray) out.controls[c.id] = { x:c.x, y:c.y, w:c.w, h:c.h }; });
      ac.gauges.forEach(g => { out.gauges[g.id] = { x:g.x, y:g.y, w:g.w, h:g.h }; });
      const txt = JSON.stringify(out, null, 1);
      navigator.clipboard?.writeText(txt).then(
        () => toast('Layout copied to clipboard.', 'good'),
        () => { console.log(txt); toast('Clipboard blocked — layout printed to the console.', 'bad'); });
    },

    /* ---------------- per-frame ---------------- */
    render(cueTarget) {
      const S = sim.S;

      ac.controls.forEach(c => {
        if (c.tray) {
          const b = this.nodes['tray:' + c.id];
          if (!b) return;
          const v = b._value;
          v.textContent = (c.lab && c.lab[S.sw[c.id]]) ?? S.sw[c.id];
          v.style.color = (S.sw[c.id] === c.init) ? '#6b7b7f' : 'var(--phos)';
          return;
        }
        const n = this.nodes[c.id];
        if (!n) return;

        if (c.kind === 'lamp') {
          const on = !!S.caution?.[c.watch];
          n.querySelector('.lamp').classList.toggle('on', on);
          n.classList.toggle('lit', on);
          n.querySelector('.val').textContent = c.name + (on ? ' ▸ LIT' : '');
          return;
        }
        const idx = c.states.indexOf(S.sw[c.id]);
        const f = c.states.length > 1 ? idx / (c.states.length - 1) : 0;
        const lbl = (c.lab && c.lab[S.sw[c.id]]) ?? S.sw[c.id];
        n.querySelector('.val').textContent = c.name + ' \u25b8 ' + lbl;

        const stick = n.querySelector('.stick');
        if (stick) {
          if (c.axis === 'x') {
            const sh = Math.max(14, c.h * 0.55), travel = Math.max(0, c.w - 16);
            stick.style.height = sh + 'px';
            stick.style.top = ((c.h - sh) / 2) + 'px';
            stick.style.transform = `translateX(${(f - 0.5) * travel}px)`;
          } else {
            const dir = (c.updir === false) ? 1 : -1;      // higher state = up / forward
            const sh = Math.max(16, Math.min(58, c.h * 0.45));
            const travel = Math.max(0, c.h - sh - 8);
            stick.style.height = sh + 'px';
            stick.style.top = ((c.h - sh) / 2) + 'px';
            stick.style.transform = `translateY(${dir * (f - 0.5) * travel}px)`;
          }
        }
        const knob = n.querySelector('.knob');
        if (knob) {
          // a knob may name the angle of each printed detent; otherwise sweep a
          // generic arc so the pointer at least moves
          const ang = c.angles ? c.angles[idx] : (-70 + f * 140);
          knob.style.transform = `translate(-50%,-50%) rotate(${ang}deg)`;
        }
        n.classList.toggle('ok', idx > 0);
        if (c.watch) {
          const on = typeof c.watch === 'function' ? c.watch(S) : !!S.caution[c.watch];
          n.classList.toggle('sel', on);
        }
      });

      /* cue ring on whatever the current step wants */
      if (this.cue) { this.cue.classList.remove('cue'); this.cue = null; }
      if (this.guided && cueTarget) {
        const n = this.nodes[cueTarget] || this.gnodes[cueTarget] || this.nodes['tray:' + cueTarget];
        if (n) { n.classList.add('cue'); this.cue = n; }
      }

      ac.gauges.filter(g => g.view === this.view).forEach(g => {
        const n = this.gnodes[g.id];
        if (!n) return;

        if (g.kind === 'tape') {
          const [l, r] = g.read(S);
          const ch = n.querySelectorAll('.chan');
          [l, r].forEach((v, i) => {
            const px = Math.max(0, Math.min(1, g.frac(v))) * g.h;
            const b = ch[i].querySelector('b');
            b.style.bottom = '7px'; b.style.height = px + 'px';
            ch[i].querySelector('i').style.bottom = (7 + px) + 'px';
          });
          const chip = n.querySelector('[data-chip]');
          chip.textContent = g.fmt(l, r);
          chip.className = 'gchip' + (l < 1 && r < 1 ? ' dim'
            : (g.id === 'tapeTit' && (l > 890 || r > 890)) ? ' bad'
            : (g.id === 'tapeTit' && (l > 600 || r > 600)) ? ' hot' : '');

        } else if (g.kind === 'chip') {
          n.textContent = g.read(S);
          n.classList.toggle('dim', !S.power);

        } else if (g.kind === 'needle') {
          const lit = !g.lit || g.lit(S);
          n.style.opacity = lit ? 1 : 0;
          if (lit) {
            const v = Math.max(g.min, Math.min(g.max, g.read(S)));
            const ang = g.a0 + ((v - g.min) / (g.max - g.min)) * (g.a1 - g.a0);
            n.querySelector('i').style.transform = `translateX(-50%) rotate(${ang}deg)`;
          }

        } else if (g.kind === 'screen') {
          const lit = g.lit(S);
          n.style.opacity = lit ? 0 : 0.93;

          /* Radar picture. Only when the WCS is up and the radar is actually
             looking — otherwise the TID falls back to the navigation page. */
          const tidRepeat = g.tid || S.sw.hsdMode === 'tid';   // is this screen the TID?
          const tl = n.querySelector('[data-tracks]');
          let tracksUp = false;
          if (tl) {
            const B = S.bvr;
            /* PD and pulse search put their returns on the DDD only, so the TID
               stays blank in those modes even though the tracks exist. */
            const searching = B && !B.tidBlind &&
              ['rws','twsman','twsauto','pdstt','pulsestt'].includes(S.sw.radarMode);
            tracksUp = !!(lit && tidRepeat && searching);
            tl.style.display = tracksUp ? 'block' : 'none';
            n.style.pointerEvents = tracksUp ? 'auto' : 'none';
            if (tracksUp) {
              n.style.opacity = 0.92;
              const seen = B.contacts.filter(c => c.tracked);
              const key = seen.map(c => c.id).join(',');
              if (tl.dataset.key !== key) {
                tl.dataset.key = key;
                tl.innerHTML = '';
                seen.forEach(c => {
                  const d = el('div', 'trk');
                  d.dataset.trk = c.id;
                  d.innerHTML = '<u></u><b></b><i></i><s></s>';
                  tl.appendChild(d);
                });
              }
              seen.forEach(c => {
                const d = tl.querySelector(`[data-trk="${c.id}"]`);
                if (!d) return;
                d.style.left = (50 + (c.az / 65) * 44) + '%';
                d.style.top  = (92 - (c.rng / 80) * 78) + '%';
                d.classList.toggle('hostile', c.iff === 'hostile');
                d.classList.toggle('friendly', c.iff === 'friendly');
                d.classList.toggle('hooked', B.hooked === c.id);
                d.classList.toggle('noatk', !!c.noAttack);
                d.querySelector('b').textContent = c.prio ?? '';
                d.querySelector('i').textContent = Math.round(c.alt);
                const shot = B.shots.find(s => s.target === c.id);
                const tti = d.querySelector('s');
                tti.textContent = shot ? Math.round(shot.tti) : '';
                tti.classList.toggle('pitbull', !!(shot && shot.active));
              });
            }
          }

          const ip = n.querySelector('[data-ins-panel]');
          if (ip) {
            const show = lit && tidRepeat && !tracksUp;
            ip.style.display = show ? 'block' : 'none';
            if (show) {
              n.style.opacity = 0.92;
              const pct = ac.insCaret(S);
              ip.querySelector('[data-ins="caret"]').style.left = (7 + pct * 86) + '%';
              // the guide: the number is minutes in tenths, 23 = 2.3 min
              ip.querySelector('[data-ins="num"]').textContent =
                String(Math.min(99, Math.floor(S.ins.t / 6))).padStart(2, '0');
              // the caret becomes a diamond once past the second marker,
              // i.e. once the alignment is good enough to shoot with
              const dia = ac.insWeaponsReady(S);
              ip.querySelector('[data-ins="chev"]').style.display = dia ? 'none' : 'block';
              ip.querySelector('[data-ins="dia"]').style.display  = dia ? 'block' : 'none';
              // the dot means fine alignment is done, not merely good enough to shoot
              ip.querySelector('[data-ins="dot"]').style.display  = S.ins.complete ? 'block' : 'none';
              // HS flashes when the alignment has fallen back to handset
              const hs = ip.querySelector('[data-ins="hs"]');
              hs.style.display = S.ins.handset ? 'block' : 'none';
              // flashing while it waits for data, steady once it has some
              hs.style.opacity = (S.ins.handset && !S.ins.handsetArmed &&
                                  Math.floor(S.t * 2) % 2) ? 0.15 : 1;
            }
          }
        }
      });
    },
  };
  return V;
}

/* the INS alignment page: caret walks a track and becomes a diamond at full fine */
function insPanel() {
  const p = el('div');
  p.style.cssText = 'position:absolute;inset:0;font-family:var(--data);color:var(--phos);' +
    'text-shadow:0 0 7px rgba(65,224,124,.65);pointer-events:none';
  p.innerHTML =
    // lat / long being aligned to, across the top of the TID
    '<div class="insrow"><span>LN 25&deg;01\'4</span><span>LE 55&deg;22\'6</span></div>' +
    '<div class="instrack">' +
      '<u style="left:33.3%"></u><u style="left:66.6%"></u><u style="left:100%"></u>' +
    '</div>' +
    // full fine marker at the end of the track

    // the progress caret walks the track; the number is minutes in tenths
    '<div data-ins="caret" style="position:absolute;top:30%;left:7%;transform:translateX(-50%);' +
      'text-align:center;line-height:1;transition:left .35s linear">' +
      '<div data-ins="num" style="font-size:11px">00</div>' +
      '<div data-ins="chev" style="font-size:15px;margin-top:1px">\u2304</div>' +
      // hollow diamond at weapons employment; the dot arrives only at full fine
      '<div data-ins="dia" style="display:none;width:11px;height:11px;margin:4px auto 0;' +
        'border:1.5px solid currentColor;transform:rotate(45deg);position:relative">' +
        '<span data-ins="dot" style="display:none;position:absolute;inset:2.5px;' +
        'background:currentColor"></span></div>' +
      // handset alignment, flashing between the two markers when CAINS is lost
      '<div data-ins="hs" style="display:none;position:absolute;top:30%;left:50%;' +
        'transform:translateX(-50%);font-size:13px;letter-spacing:.1em">HS</div>' +
      '</div>';
  p.dataset.insPanel = '1';
  return p;
}
