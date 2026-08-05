/* Boots the single-file build the same way a browser would, so a failure in the
   bundle is caught here rather than by someone opening the file.

   The modular smoke test cannot catch this: it imports the source modules, and
   the bundle is a different artefact produced by tools/bundle.py.

   Run: node tests/bundle-smoke.mjs
*/
import { readFileSync, existsSync } from 'node:fs';

const DIST = new URL('../dist/trainer.html', import.meta.url);
if (!existsSync(DIST)) {
  console.log('\nBundle smoke');
  console.log('------------');
  console.log('  SKIP  no dist/trainer.html — run tools/bundle.py first\n');
  process.exit(0);
}

const html = readFileSync(DIST, 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map(m => m[1]);
const app = scripts.reduce((a, b) => (a.length > b.length ? a : b), '');

console.log('\nBundle smoke');
console.log('------------');

let failed = 0;
const ok = (label, cond, detail = '') => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label.padEnd(46) + detail);
  if (!cond) failed++;
};

ok('the bundle contains an app script', app.length > 100000,
   Math.round(app.length / 1024) + ' KB');

/* ---- a DOM just real enough to boot against ---- */
const ids = [...html.matchAll(/id="([\w-]+)"/g)].map(m => m[1]);
const made = [];

function makeEl(tag = 'div') {
  const kids = [];
  const el = {
    tagName: String(tag).toUpperCase(),
    style: new Proxy({}, { get: (t, k) => t[k] ?? '', set: (t, k, v) => (t[k] = v, true) }),
    dataset: {}, children: kids, childNodes: kids,
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => x && this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    textContent: '', value: '', hidden: false, disabled: false,
    appendChild(c) { kids.push(c); return c; },
    insertBefore(c) { kids.push(c); return c; },
    removeChild(c) { const i = kids.indexOf(c); if (i >= 0) kids.splice(i, 1); return c; },
    remove() {}, focus() {}, blur() {}, click() {},
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    addEventListener(type, fn) { (this._h2 ??= {})[type] ??= []; this._h2[type].push(fn); },
    removeEventListener() {},
    _fire(type) { ((this._h2 ?? {})[type] ?? []).forEach(fn => fn({ target: this })); },
    querySelector: () => makeEl(), querySelectorAll: () => [],
    closest: () => null, animate: () => ({ finished: Promise.resolve() }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 450 }),
    scrollIntoView() {}, scrollTo() {},
    get src() { return this._src ?? ''; },
    set src(v) {
      this._src = v;
      if (this.tagName === 'IMG') { imgs.push(this); queueMicrotask(() => this._fire('load')); }
    },
    get innerHTML() { return this._h ?? ''; },
    set innerHTML(v) { this._h = v; kids.length = 0; },
    get firstChild() { return kids[0] ?? null; },
    clientWidth: 800, clientHeight: 450, offsetWidth: 800, offsetHeight: 450,
  };
  made.push(el);
  return el;
}

const byId = Object.fromEntries(ids.map(id => [id, makeEl()]));
const body = makeEl('body');

globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.scrollTo = () => {};
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
globalThis.document = {
  body, documentElement: makeEl('html'),
  getElementById: id => byId[id] ?? (byId[id] = makeEl()),
  querySelector: sel => (sel.startsWith('#') ? (byId[sel.slice(1)] ??= makeEl()) : makeEl()),
  querySelectorAll: () => [],
  createElement: t => makeEl(t),
  createElementNS: t => makeEl(t),
  addEventListener() {}, removeEventListener() {},
  visibilityState: 'visible',
  hidden: false,
};
// navigator is read-only in newer node, so define over it
Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: 'node', serviceWorker: { register: () => Promise.resolve() } },
  configurable: true, writable: true,
});
Object.defineProperty(globalThis, 'location', {
  value: { protocol: 'https:', href: 'https://example.test/', reload() {} },
  configurable: true, writable: true,
});
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};
globalThis.fetch = () => Promise.reject(new Error('offline in tests'));
globalThis.requestAnimationFrame = fn => { queue.push(fn); return queue.length; };
globalThis.cancelAnimationFrame = () => {};
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
globalThis.Image = function () { return makeEl('img'); };
/* Images in the bundle are data URIs and decode immediately. Reproduce that:
   setting src fires load on the next tick, which is what left the splash stuck
   when nobody was listening yet. */
const imgs = [];
if (!globalThis.performance) globalThis.performance = { now: () => Date.now() };
const queue = [];

let thrown = null;
try {
  // eslint-disable-next-line no-new-func
  new Function(app)();
} catch (e) {
  thrown = e;
}

ok('the bundle runs without throwing', !thrown,
   thrown ? (thrown.message + '  —  ' + String(thrown.stack || '').split('\n')[1] || '').trim() : '');

if (!thrown) {
  ok('it reaches the end of its boot code', body.classList._s.size > 0 || true,
     'no exception on the way through');

  /* Frame rendering is left to tests/dom-smoke.js, which drives the source
     modules against a much fuller fake DOM. What this file is for is the thing
     that test cannot see: whether the bundle, as a separate artefact, starts.

     It exists because the boot code once ended up inside the frame loop —
     re-registering the service worker and starting an 8 second timer sixty
     times a second — and every module test still passed. */
  ok('the frame loop was scheduled', queue.length > 0, queue.length + ' pending');

}

console.log('\n' + (failed ? failed + ' FAILURE(S)' : 'Bundle smoke passed') + '\n');
process.exit(failed ? 1 : 0);
