/* ============================================================
   CORE · APP
   Wires everything together. Reads its whole layout from the
   aircraft module, so adding a jet needs no changes in here.
   ============================================================ */
import { $, el, toast } from './dom.js';
import { createSim } from './sim.js';
import { createViews } from './views.js';
import { createChecklist } from './checklist.js';
import { createKneecard } from './kneecard.js';
import { createStats, mmss } from './stats.js';
import { createPresence } from './presence.js';
import { createAudio } from './audio.js';
import { PRESENCE_URL } from './config.js';
import { createMenu } from './menu.js';
import { catalogue, byId } from '../aircraft/registry.js';

const ac  = byId(new URLSearchParams(location.search).get('aircraft') || 'f14b');
const sim = createSim(ac);
const V   = createViews(sim, ac);
const K   = createChecklist(sim, ac);
const KB  = createKneecard(sim, ac);
const ST  = createStats();
K.onFinish = r => ST.finished(K.procedure.meta.id, r);

sim.on((m, k) => toast(m, k));

/* ---------------- chrome built from the aircraft ---------------- */
let crew = ac.views[0].crew;

document.querySelector('[data-brand]').textContent = ac.name.split(' ')[0];

const tabs = $('#tabs');
ac.views.forEach((v, i) => {
  const b = el('button', 'tab' + (i === 0 ? ' on' : ''));
  b.dataset.view = v.id;
  b.dataset.crew = v.crew;
  b.textContent = v.label;
  b.style.display = v.crew === crew ? '' : 'none';
  b.addEventListener('click', () => V.setView(v.id));
  tabs.appendChild(b);
});

/* keep references rather than re-querying the DOM every frame */
const strip = $('#strip');
const stripCells = ac.strip.map(c => {
  const cell = el('div', 'cell');
  const k = el('div', 'k'); k.textContent = c.k;
  const v = el('div', 'v');
  cell.appendChild(k); cell.appendChild(v);
  strip.appendChild(cell);
  return { read: c.read, node: v };
});

const cautionCell = el('div', 'cell');
cautionCell.style.cssText = 'flex:1 1 auto;border-right:none';
const cautionLabel = el('div', 'k'); cautionLabel.textContent = 'Caution panel';
const cautionBox = el('div'); cautionBox.id = 'cautions';
cautionCell.appendChild(cautionLabel); cautionCell.appendChild(cautionBox);
strip.appendChild(cautionCell);
const cautionLamps = ac.cautions.map(([id, label]) => {
  const d = el('div', 'cl');
  d.dataset.c = id;
  d.textContent = label;
  cautionBox.appendChild(d);
  return { id, node: d };
});

/* ---------------- procedures, chosen from the home screen ---------------- */
const A = createAudio();
let lastSeeker = null;

/* What a control sounds like depends on what it is. A rotary detent, a covered
   guard and a throttle lever are three different noises in the real cockpit. */
function soundFor(id) {
  const c = ac.controls.find(x => x.id === id);
  if (!c) return 'click';
  if (c.guard) return 'guard';
  if (c.kind === 'knob') return 'detent';
  if (c.kind === 'push') return 'push';
  if (c.kind === 'lever') return 'lever';
  return 'click';
}

/* Sound settings. One chip instead of three, because the top bar is already
   full on a phone. Browsers will not start audio outside a click, so enabling
   has to happen inside these handlers. */
{
  const chip = $('#soundchip');
  const panel = $('#soundpanel');
  const onBtn = $('#sp_on');
  const crewBtn = $('#sp_crew');
  const vol = $('#sp_vol');

  const paint = () => {
    chip.textContent = A.on ? 'SOUND' : 'MUTED';
    chip.classList.toggle('on', A.on);
    $('#sp_onv').textContent = A.on ? 'ON' : 'OFF';
    onBtn.classList.toggle('yes', A.on);

    const ready = A.voiceReady;
    crewBtn.disabled = !ready;
    $('#sp_crewv').textContent = !ready ? 'NONE' : (A.speaking ? 'ON' : 'OFF');
    crewBtn.classList.toggle('yes', ready && A.speaking);
    crewBtn.title = ready ? '' : 'This browser has no speech voices available';

    vol.value = Math.round(A.volume * 100);
    vol.disabled = !A.on;
  };

  const open = want => {
    panel.hidden = !want;
    chip.setAttribute('aria-expanded', want ? 'true' : 'false');
    if (want) paint();
  };

  chip.onclick = e => { e.stopPropagation(); open(panel.hidden); };
  onBtn.onclick = () => { A.enable(!A.on); paint(); };
  crewBtn.onclick = () => { A.setSpeaking(!A.speaking); paint(); };
  vol.oninput = () => {
    A.setVolume(vol.value / 100);
    // a tick to hear what the new level sounds like
    A.play('detent');
  };

  /* Repaint after the first interaction, since that is when a remembered
     "on" actually becomes audible. */
  ['pointerdown', 'keydown'].forEach(e =>
    document.addEventListener(e, () => setTimeout(paint, 0), { once: true, capture: true }));

  panel.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', () => { if (!panel.hidden) open(false); });
  document.addEventListener('keydown', e => {
    if (e.target.matches && e.target.matches('input, textarea')) return;
    if (e.key === 'Escape' && !panel.hidden) open(false);
    if (e.key === 'm' || e.key === 'M') { A.enable(!A.on); paint(); }
  });

  if (typeof speechSynthesis !== 'undefined' && speechSynthesis.addEventListener) {
    speechSynthesis.addEventListener('voiceschanged', paint);
  }
  paint();
}

/* Tones follow the messages the sim already emits, so nothing new is plumbed
   through the aircraft files. */
sim.on((msg, kind) => {
  if (kind === 'bad')  A.play('warning');
  else if (kind === 'good') A.play('good');
  if (/fox|away|launch/i.test(msg)) A.play('launch');

  /* Only crew speech gets voiced. The rest of the messages are narration and
     would be exhausting read aloud. */
  const said = /^(Jester|Pilot|Ground|Deck)\s*:\s*(.+)$/i.exec(msg);
  if (said) A.say(said[1].toLowerCase(), said[2]);
});

const P = createPresence(PRESENCE_URL);
/* Picking an aircraft in the hangar.

   Everything above — the sim, the views, the checklist, the kneeboard, the tab
   strip, the status cells and the caution lamps — is built ONCE at module load
   from `ac`, and `ac` comes from the query string. That was invisible while
   there was one aircraft: whatever you picked, it was the Tomcat anyway. With
   two, picking the Hornet started the Hornet's CHECKLIST against the Tomcat's
   cockpit, which is a convincing and completely wrong screen.

   Switching in place would mean rebuilding all of the above and re-binding
   every handler that closed over the old objects. A reload does the same job
   correctly, cannot half-succeed, and is nearly free because the service worker
   has already cached everything. The procedure travels in the URL so the
   reload lands where the pilot was going. */
const menu = createMenu(catalogue, (picked, procedure) => {
  if (picked && picked.id !== ac.id) { swapAircraft(picked, procedure); return; }
  startProcedure(procedure);
}, ST, P);

/**
 * Change aircraft, without showing the old one on the way out.
 *
 * The hangar closes itself before it calls back — `this.close(); onPick(...)` —
 * which uncovers the cockpit that was built at boot. Then the reload takes
 * anywhere from fifty milliseconds on a warm cache to a couple of seconds on a
 * phone. In that gap you get a clear look at the WRONG AEROPLANE, which is
 * alarming in a trainer whose whole promise is showing you the right one.
 *
 * So a curtain goes up first, and the navigation waits two frames for it to be
 * painted. One frame is not reliably enough: the browser can begin tearing the
 * document down before it has composited, and then the curtain never appears.
 */
function swapAircraft(picked, procedure) {
  const q = new URLSearchParams({ aircraft: picked.id, proc: procedure.meta.id });
  const curtain = document.createElement('div');
  curtain.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:9999',
    'display:flex', 'flex-direction:column', 'gap:10px',
    'align-items:center', 'justify-content:center',
    'background:#0b0f12', 'color:#dfe8ee',
    'font:600 15px/1.4 ui-monospace,Menlo,Consolas,monospace',
    'letter-spacing:.08em', 'text-align:center', 'padding:24px',
  ].join(';');
  const name = document.createElement('div');
  name.textContent = picked.name.toUpperCase();
  name.style.cssText = 'font-size:22px;letter-spacing:.14em';
  const sub = document.createElement('div');
  sub.textContent = procedure.meta.name;
  sub.style.cssText = 'color:#7b8a95;font-size:12px;letter-spacing:.1em';
  curtain.append(name, sub);
  document.body.appendChild(curtain);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    location.search = '?' + q.toString();
  }));
}

let current = null;

function startProcedure(procedure) {
  current = procedure;
  crew = procedure.meta.crew;
  document.querySelectorAll('.tab').forEach(b => {
    b.style.display = b.dataset.crew === crew ? '' : 'none';
  });
  sim.reset();
  sim.S.rioSeat = (crew === 'rio');
  if (procedure.setup) procedure.setup(sim);
  K.resetProgress();
  K.setProcedure(procedure);
  V.buildTray(K.touches());     // only the off-panel controls this one uses
  K.runStart = sim.S.t;
  ST.started(procedure.meta.id);
  $('#timechip').textContent = '1×';
  $('#timechip').classList.remove('warn');
  closeComms();
  KB.render();
  const first = ac.views.find(v => v.id === procedure.meta.view) || ac.views.find(v => v.crew === crew);
  V.view = null;
  V.setView(first.id);
  V.reset();
  setRail(false);
  toast(procedure.meta.name, 'radio');
}

function hardReset() {
  sim.reset();
  sim.S.rioSeat = (crew === 'rio');
  if (current && current.setup) current.setup(sim);   // a landing restarts in the air
  K.resetProgress();
  K.build();
  $('#timechip').textContent = '1×';
  $('#timechip').classList.remove('warn');
  closeComms();
  KB.render();
}

/* ---------------- input ---------------- */
const stage = $('#stage');
stage.addEventListener('contextmenu', e => e.preventDefault());

let tapDir = 1;                       // touch has no right button
$('#dirchip').onclick = () => {
  tapDir = -tapDir;
  $('#dirchip').textContent = tapDir > 0 ? 'Tap ▲' : 'Tap ▼';
  $('#dirchip').classList.toggle('warn', tapDir < 0);
  toast(tapDir > 0 ? 'A tap now moves switches up / forward.'
                   : 'A tap now moves switches down / aft — the right-click direction.', 'radio');
};

const onClick = (e, dir) => {
  const hs = e.target.closest('.hs');
  if (!hs || V.edit) return;
  e.preventDefault();
  const c = ac.controls.find(x => x.id === hs.dataset.id);
  if (!c || !c.states) return;
  let frac = null;
  if (c.stack === 'v') {
    const r = hs.getBoundingClientRect();
    frac = (e.clientY - r.top) / r.height;
  }
  A.play(soundFor(c.id));
  sim.click(c.id, dir, frac);
};
$('#world').addEventListener('click', e => {
  const trk = e.target.closest('[data-trk]');
  if (trk) { e.preventDefault(); ac.hook(sim, +trk.dataset.trk); return; }
  onClick(e, tapDir);
});
$('#world').addEventListener('contextmenu', e => onClick(e, -1));

V.mount();
KB.mount();
/* the tray is rebuilt per procedure, so listen on the stage instead of on it */
$('#stage').addEventListener('click', e => {
  const b = e.target.closest('button[data-tray]');
  if (b) { A.play(soundFor(b.dataset.tray)); sim.click(b.dataset.tray, tapDir); }
});
$('#stage').addEventListener('contextmenu', e => {
  const b = e.target.closest('button[data-tray]');
  if (b) { e.preventDefault(); A.play(soundFor(b.dataset.tray)); sim.click(b.dataset.tray, -1); }
});

/* pan, zoom, drag-to-calibrate */
let drag = null;
stage.addEventListener('pointerdown', e => {
  if (V.edit) {
    const hs = e.target.closest('.hs, .gauge, .digi');
    if (hs) {
      drag = { mode:'edit', node:hs, sx:e.clientX, sy:e.clientY,
               ox:parseFloat(hs.style.left) || 0, oy:parseFloat(hs.style.top) || 0 };
      e.preventDefault();
      return;
    }
  }
  if (e.target.closest('#comms,#zoompad,#tray,#editbar,#gate,#done')) return;
  drag = { mode:'pan', sx:e.clientX, sy:e.clientY, ox:V.panX, oy:V.panY, moved:false };
});
window.addEventListener('pointermove', e => {
  if (!drag) return;
  if (drag.mode === 'pan') {
    V.panX = drag.ox + (e.clientX - drag.sx);
    V.panY = drag.oy + (e.clientY - drag.sy);
    if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 4) drag.moved = true;
    V.apply();
  } else {
    const nx = drag.ox + (e.clientX - drag.sx) / V.zoom;
    const ny = drag.oy + (e.clientY - drag.sy) / V.zoom;
    drag.node.style.left = Math.round(nx) + 'px';
    drag.node.style.top  = Math.round(ny) + 'px';
    const id = drag.node.dataset.id;
    const rec = ac.controls.find(x => x.id === id) || ac.gauges.find(x => x.id === id);
    if (rec) { rec.x = Math.round(nx); rec.y = Math.round(ny); }
  }
});
const endDrag = () => {
  if (drag && drag.mode === 'pan' && drag.moved) {
    window.addEventListener('click', ev => ev.stopPropagation(), { capture:true, once:true });
  }
  drag = null;
};
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);

stage.addEventListener('wheel', e => {
  e.preventDefault();
  const r = stage.getBoundingClientRect();
  V.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
}, { passive:false });

let pinch = null;
stage.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                         e.touches[0].clientY - e.touches[1].clientY);
    pinch = { d, z:V.zoom };
  }
}, { passive:true });
stage.addEventListener('touchmove', e => {
  if (pinch && e.touches.length === 2) {
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                         e.touches[0].clientY - e.touches[1].clientY);
    const r = stage.getBoundingClientRect();
    V.setZoom(pinch.z * (d / pinch.d),
      (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left,
      (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top);
  }
}, { passive:true });
stage.addEventListener('touchend', () => { pinch = null; });

$('#zin').onclick  = () => V.zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 1.25);
$('#zout').onclick = () => V.zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 0.8);
$('#zfit').onclick = () => V.fit();
window.addEventListener('resize', () => V.reset());

/* ---------------- chips and buttons ---------------- */
$('#timechip').onclick = () => {
  const r = sim.S.rate;
  sim.S.rate = r === 1 ? 4 : r === 4 ? 16 : 1;
  $('#timechip').textContent = sim.S.rate + '×';
  $('#timechip').classList.toggle('warn', sim.S.rate > 1);
};
$('#labelchip').onclick = () => {
  V.labels = !V.labels;
  document.body.classList.toggle('labels', V.labels);
  $('#labelchip').classList.toggle('on', V.labels);
};
$('#modechip').onclick = () => {
  V.guided = !V.guided;
  $('#modechip').textContent = V.guided ? 'Guided' : 'Free play';
  $('#modechip').classList.toggle('on', V.guided);
};

const isMenuTarget = t => !!t && (t.startsWith('comms:') || t.startsWith('kb:'));

const hint = () => {
  const tgt = K.target() || '';
  if (tgt.startsWith('comms:')) { openComms(tgt.split(':')[1]); return; }
  if (tgt.startsWith('kb:'))    { KB.goto(tgt.split(':')[1]); return; }
  const c = ac.controls.find(x => x.id === tgt) || ac.gauges.find(x => x.id === tgt);
  if (!c) return;
  if (c.tray) {
    V.nodes['tray:' + c.id]?.animate(
      [{ boxShadow:'0 0 0 0 rgba(255,176,46,.7)' }, { boxShadow:'0 0 0 14px rgba(255,176,46,0)' }],
      { duration:900, iterations:2 });
    return;
  }
  const views = V.viewsOf(c).length ? V.viewsOf(c) : [c.view];
  if (!views.includes(V.view)) V.setView(views[0]);
  if (c.peek) V.setAlt(true);          // show the photo the switch actually lives on

  // keep anything the control reads out on screen too, so you can watch the
  // result while you work it — the CAP keypad and its TID line, for instance
  const step = K.current();
  const extra = [].concat(c.ctx || [], (step && step.ctx) || []);
  const rects = [c];
  extra.forEach(id => {
    const r = ac.controls.find(x => x.id === id) || ac.gauges.find(x => x.id === id);
    if (r && r.x != null && (r.view === V.view || V.viewsOf(r).includes(V.view))) rects.push(r);
  });
  V.frameOn(rects);
};
K.onHint = hint;

$('#btnHint').onclick  = hint;
$('#btnSkip').onclick  = () => K.skip();
$('#btnReset').onclick = () => {
  hardReset();
  toast(current && current.setup ? 'Back to the start of the approach.' : 'Cold and dark.', 'good');
};
$('#btnScramble').onclick = () => {
  hardReset();
  const wrong = ac.scramble || {};
  const picked = Object.keys(wrong).filter(() => Math.random() < 0.6);
  (picked.length ? picked : Object.keys(wrong).slice(0, 2)).forEach(k => { sim.S.sw[k] = wrong[k]; });
  toast('Cockpit scrambled — check before you start.', 'radio');
};
const setRail = open => {
  document.body.classList.toggle('rail-open', open);
  $('#stepbarC').textContent = open ? '▼' : '▲';
};
// three separate targets: the text and the chevron open the sheet, Show me does not
const toggleRail = () => setRail(!document.body.classList.contains('rail-open'));
$('#stepbarOpen').onclick = toggleRail;
$('#stepbarC').onclick    = toggleRail;
$('#stepbarShow').onclick = e => { e.stopPropagation(); hint(); };
$('#railgrab').onclick = () => setRail(false);

// swipe the handle down to dismiss
{
  let y0 = null;
  const grab = $('#railgrab');
  grab.addEventListener('pointerdown', e => { y0 = e.clientY; });
  grab.addEventListener('pointermove', e => {
    if (y0 !== null && e.clientY - y0 > 40) { setRail(false); y0 = null; }
  });
  grab.addEventListener('pointerup', () => { y0 = null; });
  grab.addEventListener('pointercancel', () => { y0 = null; });
}
$('#btnMenu').onclick = () => menu.open('procs');
$('#btnKnee').onclick = () => KB.toggle();
$('#btnEdit').onclick = () => V.setEdit(true);
$('#edDone').onclick  = () => V.setEdit(false);
$('#edCopy').onclick  = () => V.copyLayout();
$('#doneStay').onclick  = () => $('#done').classList.add('gone');
$('#doneAgain').onclick = () => { $('#done').classList.add('gone'); $('#btnReset').click(); };

/* ---------------- radio menus ---------------- */
let commsMenu = null;
function openComms(menu, page = 'root') {
  const m = ac.menus[menu];
  if (!m) return;
  commsMenu = menu;
  $('#commsTitle').textContent = m.title;
  const body = $('#commsBody');
  body.innerHTML = '';
  m[page].forEach((item, i) => {
    const r = el('button', 'row' + (item.back ? ' back' : ''));
    r.innerHTML = `<kbd>${item.k}</kbd>${item.t}`;
    r.onclick = () => {
      if (item.act) { ac.radio(sim, item.act); closeComms(); }
      else if (item.go) openComms(menu, item.go);
    };
    body.appendChild(r);
  });
  $('#comms').classList.add('open');
}
function closeComms() { $('#comms').classList.remove('open'); commsMenu = null; }
function toggleComms(menu) {
  if ($('#comms').classList.contains('open') && commsMenu === menu) closeComms();
  else openComms(menu);
}

window.addEventListener('keydown', e => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === '\\') { e.preventDefault(); toggleComms('ground'); }
  else if (k === 'a') toggleComms('jester');
  else if (k === 'h') hint();
  else if (k === 'escape') { closeComms(); KB.toggle(false); V.setEdit(false); setRail(false); }
  else if (k === 'k' && e.shiftKey) { e.preventDefault(); KB.toggle(); }
  else if (k === '[') KB.step(-1);
  else if (k === ']') KB.step(1);
  else if (k === 'f') V.fit();
  else if (k === 'm') menu.open('procs');
  else if (/^[1-9]$/.test(k)) {
    const v = ac.views.filter(v => v.crew === crew)[+k - 1];
    if (v) V.setView(v.id);
  }
});

/* ---------------- frame loop ---------------- */
K.build();
V.reset();
menu.mount();
/* Arriving with ?proc= means we have just reloaded to change aircraft: go
   straight to the procedure the pilot picked, rather than making them find it
   again in a hangar they have already been through. */
const deepLink = new URLSearchParams(location.search).get('proc');
const wanted = deepLink && ac.procedures.find(p => p.meta.id === deepLink);
if (wanted) startProcedure(wanted);
else menu.open();
let last = performance.now();
function frame(now) {
  const dt = (now - last) / 1000;
  last = now;
  sim.tick(dt);
  K.check(Math.min(0.25, dt));   // real seconds, for the flown-step dwell
  const tgt = K.target();
  V.render(isMenuTarget(tgt) ? null : tgt);
  K.render();

  const S = sim.S;
  stripCells.forEach(c => { c.node.textContent = c.read(S); });
  const cur = K.current();
  $('#stepbarN').textContent = cur && !K.completed ? cur.n : '';
  $('#stepbarT').textContent = K.completed ? 'Complete'
    : (cur ? cur.t.replace(/<[^>]+>/g, '') : '—');
  cautionLamps.forEach(c => { c.node.classList.toggle('on', !!S.caution[c.id]); });

  /* The bed rises with the engines: nothing cold and dark, a little on
     electrical power, more once they are turning. */
  const spool = Math.min(1, (S.eng.L.n2 + S.eng.R.n2) / 180);
  A.ambient(S.power ? 0.25 + spool * 0.75 : 0);

  // the Sidewinder seeker, if one is looking
  const seeker = S.sw.weaponSel === 'sw' && S.sw.masterArm === 'on'
    ? (S.sw.cageSeam === 'seam' ? 'lock' : 'growl') : null;
  if (seeker !== lastSeeker) { A.growl(seeker); lastSeeker = seeker; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

P.onCounts(() => { if ($('#menu').classList.contains('open')) menu.render(); });
P.start();

/* Offline support, so it keeps working with no signal and can be installed to a
   home screen. Only over https or localhost — a file:// open has no worker. */
try {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    // .catch only handles a rejection; in a sandboxed frame this throws outright
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
} catch (e) { /* no worker here, and that is fine */ }
