export const $  = sel => document.querySelector(sel);
export const $$ = sel => Array.from(document.querySelectorAll(sel));

export function el(tag, cls, props) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (props) Object.assign(n, props);
  return n;
}

export function toast(msg, kind) {
  const box = $('#toast');
  if (!box) return;
  const d = el('div', 'tst ' + (kind || ''));
  d.textContent = msg;
  box.appendChild(d);
  setTimeout(() => {
    d.style.transition = 'opacity .4s';
    d.style.opacity = 0;
    setTimeout(() => d.remove(), 400);
  }, 3400);
  while (box.children.length > 4) box.firstChild.remove();
}
