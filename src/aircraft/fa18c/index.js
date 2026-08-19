/* ============================================================
   F/A-18C HORNET — aircraft module
   Single seat, so there is no RIO half to this one: every procedure is
   flown from the front and every view belongs to the pilot.

   Views are composed, not photographed. The source is a full cockpit
   layout drawing; tools/compose.py cuts it into the four 1920x1080
   images below and writes down the transform, which is what generated
   the rects in controls.js. See CREDITS.md for where the drawing came
   from and what still needs checking about it.
   ============================================================ */

import { controls } from './controls.js';
import { gauges, TAPE_CH } from './gauges.js';
import * as systems from './systems.js';

import * as coldStart     from './procedures/cold-start.js';
import * as carrierLaunch from './procedures/carrier-launch.js';
import * as case1Landing  from './procedures/case1-landing.js';
import * as combat        from './procedures/combat.js';
import * as shutdown      from './procedures/shutdown.js';

export default {
  id: 'fa18c',
  name: 'F/A-18C Hornet',
  source: "Chuck's DCS F/A-18C guide, Parts 4-6 and 9-11",

  views: [
    { id:'front', crew:'pilot', label:'Front Panel',    src:'assets/fa18c/front.jpg' },
    { id:'lower', crew:'pilot', label:'Gear & Pedestal', src:'assets/fa18c/lower.jpg' },
    { id:'lcon',  crew:'pilot', label:'Left Console',   src:'assets/fa18c/lcon.jpg' },
    { id:'rcon',  crew:'pilot', label:'Right Console',  src:'assets/fa18c/rcon.jpg' },
  ],
  /* Nothing appears on more than one view of this aeroplane — the layout is an
     exploded drawing, so every panel is drawn exactly once. */
  sharedViews: {},

  controls,
  gauges,
  TAPE_CH,

  initState:    systems.initState,
  beforeChange: systems.beforeChange,
  onChange:     systems.onChange,
  tick:         systems.tick,

  insPct: systems.insPct,
  radio:  systems.radio,

  procedures: [coldStart, carrierLaunch, case1Landing, combat, shutdown]
    .map(p => ({ ...p, steps: p.steps.map((s, i) => ({ n: i + 1, ...s })) })),

  menus: {
    ground: {
      title: 'Ground Crew  ( \\ )',
      root: [{ k:'F8', t:'Ground Crew', go:'gc' }],
      gc: [
        { k:'F4', t:'Wheel Chocks', go:'chocks' },
        { k:'F8', t:'Request Launch', act:'reqLaunch' },
        { k:'F12', t:'Back', go:'root', back:true },
      ],
      chocks: [
        { k:'F1', t:'Install Wheel Chocks', act:'chocksIn' },
        { k:'F2', t:'Remove Wheel Chocks', act:'chocksOut' },
        { k:'F12', t:'Back', go:'gc', back:true },
      ],
    },
    pilot: {
      title: 'Cockpit',
      root: [
        { k:'C+1', t:'MASTER ARM — ARM', act:'pArm' },
        { k:'C+2', t:'MASTER ARM — SAFE, safe the jet', act:'pSafe' },
        { k:'C+3', t:'Finger lifts UP — unlock the burners', act:'pLifts' },
      ],
    },
  },

  /* The figures the checklist will accept, so the card and the checker cannot
     drift apart. */
  kneeboard: {
    pages: [
      {
        id:'start', title:'START-UP NUMBERS',
        rows: [
          ['ENGINE CRANK',     'RIGHT FIRST — it drives the brakes'],
          ['THROTTLE TO IDLE', 'at 25% RPM'],
          ['EGT LIMIT',        '750 °C until it stabilises'],
          ['IDLE RPM',         '60–65%'],
          ['BINGO FUEL',       '8,000 LB (typical)'],
        ],
        foot: 'Right throttle is RSHIFT+HOME, left is RALT+HOME. Different '
            + 'modifiers, and getting them the wrong way round is the commonest '
            + 'start-up error there is.',
      },
      {
        id:'boat', title:'AT THE BOAT',
        table: {
          head: ['ITEM', 'ASHORE', 'CARRIER'],
          rows: [
            ['ANTI SKID',   'ON',   'OFF'],
            ['HOOK BYPASS', 'FIELD','CARRIER'],
            ['INS ALIGN',   'GND',  'CV'],
            ['RADAR ALT',   '200 FT','80 FT dep · 370 FT rec'],
          ],
        },
        rows: [
          ['LANDING CHECK', 'WHEELS · FLAPS · HOOK · ANTISKID · HARNESS · DISPENSER'],
          ['CAT TRIM',      '16° to 44k lb · 17° to 48k · 19° above'],
          ['MAX TRAP WT',   '33,000 LB'],
        ],
        foot: 'ANTI SKID is OFF at the boat, which is backwards from what you '
            + 'would guess: you want the wheels locked when the hook grabs, not '
            + 'modulated. The six landing items are printed by your right knee.',
      },
    ],
  },

  /* what a cockpit check should catch */
  scramble: {
    parkBrake:'engaged', masterArm:'safe', hookBypass:'carrier', antiSkid:'off',
    flapSw:'half', dispenser:'on', pitotHeat:'auto', obogs:'on',
  },

  strip: [
    { k:'RPM % L / R',  read: s => f2(s.eng.L.n2, s.eng.R.n2) },
    { k:'EGT °C L / R', read: s => f2(s.eng.L.egt, s.eng.R.egt) },
    { k:'FF pph L / R', read: s => f2(s.eng.L.ff, s.eng.R.ff) },
    { k:'HYD A / B',    read: s => f2(s.hyd.a, s.hyd.b) },
    { k:'Brake psi',    read: s => s.brakePsi.toFixed(0) },
    { k:'APU',          read: s => s.apu.ready ? 'READY' : s.apu.on ? 'SPOOLING' : 'OFF' },
    { k:'INS align',    read: s => s.ins.complete ? 'ALIGNED'
                                 : (s.ins.mode ? Math.round(systems.insPct(s) * 100) + '%' : '—') },
    { k:'Bleed air',    read: s => s.bleedClosed ? 'CLOSED' : 'NORM' },
  ],

  cautions: [
    ['ckSeat','CK SEAT'], ['apuAcc','APU ACC'], ['battSw','BATT SW'],
    ['fcsHot','FCS HOT'], ['genTie','GEN TIE'], ['fuelLo','FUEL LO'],
    ['fces','FCES'], ['lGen','L GEN'], ['rGen','R GEN'],
  ],
};

const f2 = (a, b) => a.toFixed(0) + ' / ' + b.toFixed(0);
