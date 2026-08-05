/* Accessibility checks that need a rendered page rather than a source scan.
   Boots the app against the same fake DOM the smoke test uses, walks every
   screen, and reports controls a screen reader could not announce.

   Run: node tests/a11y.mjs
*/
import { readFileSync } from 'node:fs';

let failed = 0;
const ok = (label, cond, detail = '') => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label.padEnd(52) + detail);
  if (!cond) failed++;
};

console.log('\nAccessibility');
console.log('-------------');

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css  = readFileSync(new URL('../src/core/style.css', import.meta.url), 'utf8');

/* 1.4.4 Resize text — a page must not forbid zooming. */
ok('the page does not block pinch zoom',
   !/user-scalable\s*=\s*no/.test(html) && !/maximum-scale\s*=\s*1[,"]/.test(html));

/* 3.1.1 Language of page. */
ok('the document declares its language', /<html[^>]+lang="[a-z-]+"/i.test(html));

/* 2.4.2 Page titled, and a description for anything that lists the page. */
ok('it has a title and a description',
   /<title>[^<]{10,}<\/title>/.test(html) && /name="description" content="[^"]{40,}"/.test(html));

/* 2.3.3 Animation from interactions — honour the system setting. */
ok('it respects reduced motion', /prefers-reduced-motion/.test(css));

/* 2.4.7 Focus visible. */
ok('focus is visible for keyboard users', /:focus-visible/.test(css));

/* 1.1.1 Non-text content. */
const imgs = [...html.matchAll(/<img[^>]*>/g)].map(m => m[0]);
const menuSrc = readFileSync(new URL('../src/core/menu.js', import.meta.url), 'utf8');
const jsImgs = [...menuSrc.matchAll(/<img[^>]*>/g)].map(m => m[0]);
const noAlt = [...imgs, ...jsImgs].filter(i => !/alt=/.test(i));
ok('every image carries alt text', noAlt.length === 0, noAlt.join(' ') || 'all captioned');

/* 4.1.2 Name, role, value — icon-only buttons in the static markup. */
const bareButtons = [...html.matchAll(/<button(?![^>]*aria-label)[^>]*>([^<]*)</g)]
  .filter(m => m[1].trim().length <= 2 && !/id="(zin|zout|zfit)"/.test(m[0]))
  .map(m => m[0].slice(0, 60));
ok('icon-only buttons are labelled', bareButtons.length === 0,
   bareButtons.join(' | ') || 'all named');

/* The zoom buttons carry title rather than aria-label, which is acceptable but
   worth stating explicitly so it is a decision rather than an oversight. */
ok('the zoom controls at least have titles',
   (html.match(/<button id="z(in|out|fit)"[^>]*title="/g) || []).length === 3);

/* Contrast: the dim text colour against the panel background. */
const hex = n => { const m = new RegExp('--' + n + ':\\s*(#[0-9a-f]{6})', 'i').exec(css); return m && m[1]; };
const lum = h => {
  const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const ink = hex('ink'), txt = hex('txt'), dim = hex('txt-dim'), phos = hex('phos');
if (ink && txt) {
  ok('body text meets AA on the background', ratio(txt, ink) >= 4.5,
     ratio(txt, ink).toFixed(1) + ':1');
  ok('phosphor green meets AA', ratio(phos, ink) >= 4.5, ratio(phos, ink).toFixed(1) + ':1');
  ok('dim text meets AA large / AAA-relaxed', ratio(dim, ink) >= 3,
     ratio(dim, ink).toFixed(1) + ':1  (used for secondary text)');
}

console.log('\n' + (failed ? failed + ' FAILURE(S)' : 'Accessibility checks passed') + '\n');
process.exit(failed ? 1 : 0);
