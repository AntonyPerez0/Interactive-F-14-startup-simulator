/* Emit the IFEI readout gauges from the SAME rect table that blanks the drawing,
   so a window and the number drawn into it cannot drift apart. */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))

const layout = JSON.parse(readFileSync(join(here, 'layout.json'), 'utf8'))
const p = layout.front[0]
const [sx, sy] = p.src, [dx, dy] = p.dst, k = p.scale

const table = readFileSync(join(here, 'blank_readouts.py'), 'utf8')
const rects = {}
for (const m of table.matchAll(/\('(\w+)',\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\)/g)) {
  const [, id, x0, y0, x1, y1] = m
  rects[id] = [+x0, +y0, +x1, +y1]
}
const view = id => {
  const [x0, y0, x1, y1] = rects[id]
  const x = Math.round(dx + (x0 - sx) * k), y = Math.round(dy + (y0 - sy) * k)
  return { x, y, w: Math.round((x1 - x0) * k), h: Math.round((y1 - y0) * k) }
}

const FIELDS = [
  ['dgRpmL',   'ifeiRpmL',   'RPM % L',        "s => on(s) ? n0(s.eng.L.n2) : ''"],
  ['dgRpmR',   'ifeiRpmR',   'RPM % R',        "s => on(s) ? n0(s.eng.R.n2) : ''"],
  ['dgEgtL',   'ifeiTempL',  'EGT °C L',       "s => on(s) ? n0(s.eng.L.egt) : ''"],
  ['dgEgtR',   'ifeiTempR',  'EGT °C R',       "s => on(s) ? n0(s.eng.R.egt) : ''"],
  ['dgFfL',    'ifeiFfL',    'FUEL FLOW L',    "s => on(s) ? n0(s.eng.L.ff / 100) : ''"],
  ['dgFfR',    'ifeiFfR',    'FUEL FLOW R',    "s => on(s) ? n0(s.eng.R.ff / 100) : ''"],
  ['dgOilL',   'ifeiOilL',   'OIL PRESS L',    "s => on(s) ? n0(oil(s.eng.L)) : ''"],
  ['dgOilR',   'ifeiOilR',   'OIL PRESS R',    "s => on(s) ? n0(oil(s.eng.R)) : ''"],
  ['dgFuelT',  'ifeiFuel1',  'FUEL TOTAL',     "s => on(s) ? n0(s.fuel) : ''"],
  ['dgFuelI',  'ifeiFuel2',  'FUEL INTERNAL',  "s => on(s) ? n0(s.fuel) : ''"],
  ['dgBingo',  'ifeiBingo',  'BINGO',          "s => on(s) ? '0' : ''"],
  ['dgClock',  'ifeiTime1',  'CLOCK',          "s => on(s) ? clock(s) : ''"],
  ['dgEt',     'ifeiTime2',  'ELAPSED TIME',   "s => on(s) ? et(s) : ''"],
]

const lines = FIELDS.map(([id, rid, name, read]) => {
  const r = view(rid)
  return `  { id:'${id}', view:'front', kind:'chip', bare:true, ` +
         `x:${r.x}, y:${r.y}, w:${r.w}, h:${r.h},\n    name:'${name}', read: ${read} },`
})
console.log(lines.join('\n'))
