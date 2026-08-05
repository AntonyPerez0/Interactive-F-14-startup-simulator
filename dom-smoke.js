/* Boots the actual application against a minimal fake DOM. It will not tell you
   whether anything *looks* right, but it does catch the whole class of bugs a
   browser would throw on load: missing exports, missing element ids, bad
   selectors, top-level exceptions and anything that dies in the first frames. */

const listeners = [];
let rafQueue = [];

function makeEl(tag = 'div') {
  const kids = [];
  const node = {
    tagName: tag.toUpperCase(),
    children: kids, childNodes: kids,
    style: new Proxy({ cssText: '' }, { get:(t,k)=>t[k] ?? '', set:(t,k,v)=>(t[k]=v, true) }),
    dataset: {},
    _classes: new Set(),
    textContent: '', title: '', src: '', alt: '', value: '',
    _virtual: [],
    classList: {
      add: c => node._classes.add(c),
      remove: c => node._classes.delete(c),
      contains: c => node._classes.has(c),
      toggle: (c, force) => {
        if (force === undefined) throw new Error(
          'classList.toggle("' + c + '") called without an explicit boolean — ' +
          'that flips every frame. Pass a real boolean.');
        force ? node._classes.add(c) : node._classes.delete(c);
        return force;
      },
    },
    appendChild(c) { kids.push(c); c.parentNode = node; return c; },
    insertBefore(c) { kids.unshift(c); c.parentNode = node; return c; },
    removeChild(c) { const i = kids.indexOf(c); if (i >= 0) kids.splice(i, 1); return c; },
    remove() { node.parentNode?.removeChild(node); },
    addEventListener(t, f) { listeners.push([node, t, f]); },
    removeEventListener() {},
    setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect: () => ({ left:0, top:0, width:100, height:100 }),
    scrollIntoView() {},
    animate: () => ({ finished: Promise.resolve() }),
    querySelector: sel => node._find(sel)[0] ?? null,
    querySelectorAll: sel => node._find(sel),
    _find(sel) {
      const hit = [];
      const walk = n => {
        for (const c of [...n.children, ...n._virtual]) {
          if (matches(c, sel)) hit.push(c);
          walk(c);
        }
      };
      walk(node);
      return hit;
    },
    closest: () => null,
    get firstChild() { return kids[0]; },
    get clientWidth() { return 1400; },
    get clientHeight() { return 800; },
    focus() {},
    click() { listeners.filter(([n,t]) => n === node && t === 'click').forEach(([,,f]) => f({ preventDefault(){}, stopPropagation(){} })); },
  };
  Object.defineProperty(node, 'className', {
    get: () => [...node._classes].join(' '),
    set: v => { node._classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
  });
  Object.defineProperty(node, 'onclick', { set: f => node.addEventListener('click', f) });
  // innerHTML is parsed just far enough that querySelector can find the elements
  // the app builds as markup strings (the INS page, the checklist rows).
  Object.defineProperty(node, 'innerHTML', {
    get: () => node._html ?? '',
    set: v => {
      node._html = v;
      node._virtual = [];
      // a real browser drops appended children too; without this the shim keeps
      // stale nodes and anything counting elements gets the wrong answer
      node.children.length = 0;
      for (const m of String(v).matchAll(/<(\w+)([^>]*)>/g)) {
        const stub = makeEl(m[1]);
        const attrs = m[2];
        const cls = /class="([^"]*)"/.exec(attrs);
        if (cls) stub.className = cls[1];
        for (const d of attrs.matchAll(/data-([\w-]+)(?:="([^"]*)")?/g)) {
          stub.dataset[d[1].replace(/-(\w)/g, (_, c) => c.toUpperCase())] = d[2] ?? '';
        }
        node._virtual.push(stub);
      }
    },
  });
  return node;
}

function matches(n, sel) {
  return sel.split(',').some(s => {
    s = s.trim();
    if (s.startsWith('.')) return n._classes.has(s.slice(1));
    const attr = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(s);
    if (attr) {
      const key = attr[1].replace(/^data-/, '').replace(/-(\w)/g, (_, c) => c.toUpperCase());
      return attr[2] === undefined ? key in n.dataset : n.dataset[key] === attr[2];
    }
    return n.tagName === s.toUpperCase();
  });
}

import { readFileSync } from 'node:fs';

/* The TID track layer is created in buildOverlay and driven in render — if one
   half is present without the other, tracks silently never appear. */
{
  const views = readFileSync(new URL('../src/core/views.js', import.meta.url), 'utf8');
  const built = /dataset\.tracks\s*=/.test(views);
  const driven = /querySelector\('\[data-tracks\]'\)/.test(views) && /tracksUp/.test(views);
  if (built !== driven) {
    console.log('  FAIL  the TID track layer is ' + (built ? 'built but never rendered' : 'rendered but never built'));
    process.exit(1);
  }
  console.log('  PASS  TID track layer is both built and rendered');
}

/* An inline style always beats a stylesheet rule, so a `display` set inline can
   never be overridden by CSS. That is what stopped the tray collapsing. */
{
  const src = ['views.js', 'app.js', 'menu.js', 'kneecard.js', 'checklist.js']
    .map(f => readFileSync(new URL('../src/core/' + f, import.meta.url), 'utf8')).join('\n');
  const css = readFileSync(new URL('../src/core/style.css', import.meta.url), 'utf8');
  const bad = [];
  for (const m of css.matchAll(/([#.][\w-]+(?:\.[\w-]+)?[^{]*)\{[^}]*display\s*:[^;}]+/g)) {
    const sel = m[1].trim();
    const cls = sel.match(/\.([\w-]+)\s*$/);
    if (!cls) continue;
    // does the JS set display inline on an element carrying that class?
    const re = new RegExp("'" + cls[1] + "'[\\s\\S]{0,400}?cssText\\s*=\\s*'[^']*display:");
    if (re.test(src)) bad.push(sel);
  }
  if (bad.length) { console.log('  FAIL  CSS display rule can never win against an inline style: ' + bad.join(', ')); process.exit(1); }
  console.log('  PASS  no display rule is blocked by an inline style');
}

/* index.html is parsed just far enough to know which ids exist */
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
const dupes = [...new Set(ids.filter(i => ids.filter(j => j === i).length > 1))];
if (dupes.length) {
  console.log('  FAIL  duplicate ids in index.html: ' + dupes.join(', '));
  process.exit(1);
}
const byId = Object.fromEntries(ids.map(id => [id, makeEl()]));
const byAttr = { '[data-brand]': makeEl(), '[data-gate-sub]': makeEl() };
const registry = [];

const doc = {
  body: makeEl('body'),
  createElement: makeEl,
  querySelector(sel) {
    if (sel.startsWith('#')) return byId[sel.slice(1)] ?? null;
    if (byAttr[sel]) return byAttr[sel];
    return makeEl();
  },
  querySelectorAll(sel) {
    return registry.filter(n => sel.split(',').some(s => n._classes.has(s.trim().replace(/^\./, ''))));
  },
  addEventListener(t, f) { listeners.push([doc, t, f]); },
};
const origCreate = doc.createElement;
doc.createElement = tag => { const n = origCreate(tag); registry.push(n); return n; };

globalThis.document = doc;
globalThis.window = {
  addEventListener(t, f) { listeners.push([globalThis.window, t, f]); },
  location: { search: '' },
};
globalThis.location = { search: '' };
Object.defineProperty(globalThis, 'navigator', {
  value: { clipboard: { writeText: async () => {} } }, configurable: true });
globalThis.performance = { now: () => Date.now() };
globalThis.requestAnimationFrame = fn => { rafQueue.push(fn); return rafQueue.length; };
globalThis.URLSearchParams = URLSearchParams;

/* ------------------------------------------------------------------ run */
let failed = 0;
try {
  await import('../src/core/app.js');
} catch (e) {
  console.log('  FAIL  app.js threw on load: ' + e.message);
  failed++;
}

if (!failed) {
  console.log('  PASS  app boots against a fake DOM');

  /* Only the current view's controls get built, so rendering one view exercises
     a fraction of them. Walk every tab and every procedure instead. */
  try {
    const { byId } = await import('../src/aircraft/registry.js');
    const ac = byId('f14b');
    const tabs = doc.querySelectorAll('.tab');
    let drawn = 0;
    for (const p of ac.procedures) {
      for (const v of ac.views) {
        const tab = tabs.find(t => t.dataset.view === v.id);
        if (tab) tab.click();
        const q = rafQueue; rafQueue = [];
        for (const fn of q) fn(performance.now());
        drawn++;
      }
    }
    console.log('  PASS  every view rendered (' + drawn + ' passes)');
  } catch (e) {
    console.log('  FAIL  rendering a view threw: ' + e.message);
    console.log(e.stack.split('\n').slice(1, 4).join('\n'));
    failed++;
  }

  let t = 0;
  for (let i = 0; i < 240 && rafQueue.length; i++) {
    const q = rafQueue; rafQueue = [];
    for (const fn of q) {
      try { fn(t += 16); }
      catch (e) { console.log('  FAIL  frame ' + i + ' threw: ' + e.message);
                  console.log(e.stack.split('\n').slice(1,5).join('\n')); failed++; i = 999; break; }
    }
  }
  if (!failed) console.log('  PASS  240 frames rendered with no exception');
}

console.log(failed ? '\n' + failed + ' FAILURE(S)' : '\nDOM smoke test passed');
process.exit(failed ? 1 : 0);
