/* ============================================================
   F-14B TOMCAT — aircraft module
   Everything the core needs to run this jet. To add another
   aircraft, copy this shape into src/aircraft/<id>/ and register
   it in src/aircraft/registry.js.
   ============================================================ */

import { controls } from './controls.js';
import { gauges, TAPE_CH } from './gauges.js';
import * as systems from './systems.js';

import * as pilotStart  from './procedures/pilot-start.js';
import * as rioShore    from './procedures/rio-align-shore.js';
import * as rioCarrier  from './procedures/rio-align-carrier.js';

export default {
  id: 'f14b',
  name: 'F-14B Tomcat',
  source: "Chuck's DCS F-14B guide, Part 4",

  /* photos, in tab order. 'crew' drives which seat the tab belongs to. */
  views: [
    { id:'front',    crew:'pilot', label:'Front Panel',   src:'assets/f14b/pilot-front.jpg' },
    { id:'consoles', crew:'pilot', label:'Consoles',      src:'assets/f14b/pilot-consoles.jpg' },
    { id:'rioL',     crew:'rio',   label:'Left Console',  src:'assets/f14b/rio-left.jpg' },
    { id:'rioC',     crew:'rio',   label:'Centre',        src:'assets/f14b/rio-centre.jpg' },
    { id:'rioR',     crew:'rio',   label:'Right Console', src:'assets/f14b/rio-right.jpg' },
  ],
  /* controls tagged with this pseudo-view appear on every view of that crew */
  sharedViews: { pilotBoth: ['front', 'consoles'] },

  controls,
  gauges,
  TAPE_CH,

  /* systems hooks used by core/sim.js */
  initState:    systems.initState,
  beforeChange: systems.beforeChange,
  onChange:  systems.onChange,
  tick:      systems.tick,

  /* aircraft-specific extras the UI can call */
  radio:     systems.radio,
  insPct:    systems.insPct,
  autopilot: systems.AUTOPILOT,

  procedures: [pilotStart, rioShore, rioCarrier],

  /* ground crew and Jester menus */
  menus: {
    ground: {
      title: 'Ground Crew  ( \\ )',
      root: [{ k:'F8', t:'Ground Crew', go:'gc' }],
      gc: [
        { k:'F2', t:'Ground Electric Power', go:'gpu' },
        { k:'F5', t:'Ground Air Supply', go:'air' },
        { k:'F12', t:'Back', go:'root', back:true },
      ],
      gpu: [
        { k:'F1', t:'ON', act:'gpuOn' },
        { k:'F2', t:'OFF', act:'gpuOff' },
        { k:'F12', t:'Back', go:'gc', back:true },
      ],
      air: [
        { k:'F1', t:'Connect air supply unit', act:'airOn' },
        { k:'F2', t:'Disconnect air supply unit', act:'airOff' },
        { k:'F12', t:'Back', go:'gc', back:true },
      ],
    },
    jester: {
      title: 'Jester — RIO  ( A )',
      root: [
        { k:'C+3', t:'STARTUP — run the RIO checklist', act:'jStartup' },
        { k:'C+4', t:'LOUD AND CLEAR — comm check reply', act:'jLoud' },
        { k:'C+7', t:'INS alignment…', go:'ins' },
        { k:'C+7', t:'DATA LINK RADIO…', go:'dl' },
      ],
      ins: [
        { k:'C+4', t:'INS GO NOW', act:'insNow' },
        { k:'C+5', t:'INS GO COARSE', act:'insCoarse' },
        { k:'C+6', t:'INS GO MIN WPN LAUNCH', act:'insMin' },
        { k:'C+7', t:'INS GO FINE  (8 min, most precise)', act:'insFine' },
        { k:'C+12', t:'Back', go:'root', back:true },
      ],
      dl: [
        { k:'C+1', t:'SET MODE → Tactical Datalink System', act:'dlMode' },
        { k:'C+1', t:'SET HOST → CVN-74 Stennis', act:'dlHost' },
        { k:'C+12', t:'Back', go:'root', back:true },
      ],
    },
  },

  /* The pilot's kneeboard. These are the figures the CAP will accept, so the
     page and the checker cannot drift apart. */
  kneeboard: {
    pages: [
      {
        id:'ground', title:'GROUND SETTINGS',
        rows: [
          ['LATITUDE',           "25\u00b001'4  NORTH"],
          ['LONGITUDE',          "55\u00b022'6  EAST"],
          ['ELEVATION',          '197 FT'],
          ['MAGNETIC VARIATION', '+1.7\u00b0'],
        ],
        foot: 'Degrees, minutes and TENTHS of a minute — not seconds. '
            + "So 25\u00b001'4 is keyed as 2 5 0 1 4.",
      },
      {
        id:'datalink', title:'TACTICAL DATALINK SYSTEMS',
        table: {
          head: ['HOST', 'FREQ MHz', 'WHEELS'],
          rows: [
            ['CVN-74  J. C. STENNIS', '320.90', '20.9'],
            ['E-2C  AWACS',           '309.20', '09.2'],
          ],
        },
        foot: 'The leading 3 is preset and cannot be changed — dial the last three digits only. '
            + 'CAINS/WAYPT for a carrier alignment, TAC for everything else.',
      },
    ],
  },

  /* switches a cockpit check should catch, used by the Scramble button */
  scramble: {
    parkBrake:'off', wingSweep:'fwd', airSource:'both', wingExtTrans:'off',
    swCool:'on', mslPrep:'on', emergFltHyd:'high', hydTransfer:'shutoff', masterGenL:'off',
  },

  /* bottom status strip */
  strip: [
    { k:'RPM % L / R',  read: s => f2(s.eng.L.n2, s.eng.R.n2) },
    { k:'TIT °C L / R', read: s => f2(s.eng.L.egt, s.eng.R.egt) },
    { k:'FF pph L / R', read: s => f2(s.eng.L.ff, s.eng.R.ff) },
    { k:'Oil psi L / R',read: s => f2(s.eng.L.oil, s.eng.R.oil) },
    { k:'Nozzle % L/R', read: s => f2(s.eng.L.noz, s.eng.R.noz) },
    { k:'Hyd FLT / CMB',read: s => f2(s.hydFlt, s.hydComb) },
    { k:'Sweep',        read: s => s.sweep.toFixed(0) + '°' },
    { k:'INS align',    read: s => s.ins.complete ? 'ALIGNED'
                                 : (s.ins.mode ? Math.round(systems.insPct(s) * 100) + '%' : '—') },
  ],

  cautions: [
    ['startValve','START VALVE'], ['lGen','L GEN'], ['rGen','R GEN'],
    ['oilPress','OIL PRESS'], ['hydPress','HYD PRESS'], ['canopy','CANOPY'],
  ],
};

const f2 = (a, b) => a.toFixed(0) + ' / ' + b.toFixed(0);
