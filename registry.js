/* ============================================================
   AIRCRAFT REGISTRY
   `aircraft` holds the modules that are actually built. `catalogue`
   is what the hangar screen lists — everything else appears greyed
   out so the shape of the project is visible.

   To bring one to life: create src/aircraft/<id>/index.js, import it
   here, and hang it on the matching catalogue entry as `module`.
   Nothing else needs to change.
   ============================================================ */
import f14b from './f14b/index.js';

export const aircraft = [f14b];

export const catalogue = [
  /* ---------------- modern jets ---------------- */
  { id:'f14b',  cat:'Modern jets', name:'F-14A/B Tomcat',       maker:'Heatblur', module:f14b },
  { id:'fa18c', cat:'Modern jets', name:'F/A-18C Hornet',       maker:'Eagle Dynamics' },
  { id:'f16c',  cat:'Modern jets', name:'F-16C Viper',          maker:'Eagle Dynamics' },
  { id:'a10c2', cat:'Modern jets', name:'A-10C II Warthog',     maker:'Eagle Dynamics' },
  { id:'f15e',  cat:'Modern jets', name:'F-15E Strike Eagle',   maker:'RAZBAM' },
  { id:'av8b',  cat:'Modern jets', name:'AV-8B N/A Harrier II', maker:'RAZBAM' },
  { id:'m2000', cat:'Modern jets', name:'Mirage 2000C',         maker:'RAZBAM' },
  { id:'jf17',  cat:'Modern jets', name:'JF-17 Thunder',        maker:'Deka Ironwork' },
  { id:'mirf1', cat:'Cold War jets', name:'Mirage F1',          maker:'Aerges' },
  { id:'f4e',   cat:'Cold War jets', name:'F-4E Phantom II',      maker:'Heatblur' },
  { id:'aj37',  cat:'Modern jets', name:'AJS-37 Viggen',        maker:'Heatblur' },

  /* ---------------- cold war jets ---------------- */
  { id:'mig21', cat:'Cold War jets', name:'MiG-21bis',          maker:'Magnitude 3' },
  { id:'f5e',   cat:'Cold War jets', name:'F-5E Tiger II',      maker:'Eagle Dynamics' },
  { id:'mig19', cat:'Cold War jets', name:'MiG-19P Farmer',     maker:'RAZBAM' },
  { id:'f86f',  cat:'Cold War jets', name:'F-86F Sabre',        maker:'Eagle Dynamics' },
  { id:'mig15', cat:'Cold War jets', name:'MiG-15bis',          maker:'Eagle Dynamics' },
  { id:'l39',   cat:'Cold War jets', name:'L-39 Albatros',      maker:'Eagle Dynamics' },
  { id:'c101',  cat:'Cold War jets', name:'C-101 Aviojet',      maker:'AvioDev' }
];

export const byId = id => aircraft.find(a => a.id === id) || aircraft[0];
