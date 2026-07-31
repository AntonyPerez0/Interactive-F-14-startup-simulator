/* Checks the reviewer's corrections against the code, so "yes, all of it" is a
   verified claim rather than a remembered one. Run: node tools/audit-review.mjs */
import { readFileSync } from 'node:fs';
import { byId } from '../src/aircraft/registry.js';

const ac = byId('f14b');
const sys  = readFileSync(new URL('../src/aircraft/f14b/systems.js', import.meta.url), 'utf8');
const view = readFileSync(new URL('../src/core/views.js', import.meta.url), 'utf8');
const C = id => ac.controls.find(c => c.id === id);
const steps = id => ac.procedures.find(p => p.meta.id === id).steps;
// match on the title only unless asked otherwise, so a passing mention elsewhere
// cannot make a miss look like a hit
const step = (id, re, inNote = false) =>
  steps(id).find(s => re.test(inNote ? (s.note || '') : s.t));

let bad = [];
const chk = (label, cond, detail = '') => {
  if (!cond) bad.push(label);
  console.log((cond ? '  ok   ' : '  MISS ') + label.padEnd(56) + detail);
};

console.log('RIO startup');
chk('1  AWG-9/AIM-54 forward, AWG-9 aft',
    C('liquidCool').states.at(-1) === 'awg9aim54' && C('liquidCool').states[0] === 'awg9');
chk('2a both lights for the first 0.8 min', /A\.t < 48/.test(sys));
chk('2b READY holds until NAV MODE goes to INS', /ready = S\.sw\.navMode !== 'ins'/.test(sys));
chk('3  dot only once fine alignment completes', /data-ins="dot"[\s\S]{0,240}ins\.complete/.test(view));
chk('4  cooling risks a casualty, does not gate',
    !/wcsOk[^;]*liquidCool/.test(sys) && /Overheat casualty/.test(sys));

console.log('\npilot procedures');
chk('5  manual sweep needs the handle stowed',
    /sweepThumb === 'aft' \? 68/.test(sys) &&
    /wingSweep==='detent'/.test(step('landing-shore', /thumb switch/).done.toString()));
chk('6  landing lights off on the boat',
    /landingLights==='off'/.test(step('landing-carrier', /[Ll]anding lights/).done.toString()));
chk('7a break sweeps to shed lift, not add drag',
    /shed lift, not to add drag/i.test(step('landing-carrier', /thumb switch/).note));
chk('7b wings come back out through the turn',
    /come back out as you slow/i.test(step('landing-carrier', /thumb switch/).note));
chk('8a elevation lead is in the cockpit', !C('gunLead').tray && C('gunLead').view === 'front');
chk('8b no AUTO needed, 1,000 / 2,000 ft lead',
    /1,000 ft/.test(step('aa-gun', /elevation lead/).note));
chk('9a Sidewinder slaves to PLM / PAL / VSL / RIO',
    /PLM, PAL, VSL/.test(step('aa-sidewinder', /seeker onto him/).note));
chk('9b SEAM still acquires the lock', !!step('aa-sidewinder', /^<b>SEAM<\/b>|SEAM<\/b> to acquire/));
chk('10 PD and pulse search stay off the TID', /tidBlind/.test(sys) && /tidBlind/.test(view));
chk('11 Jester never offers PD Search',
    !ac.menus.jester.radar.some(m => /PD ?SRCH|PD Search/i.test(m.t)));

console.log('\nshutdown');
const sd = steps('shutdown-pilot');
const li = sd.findIndex(s => /[Ee]xterior lights/.test(s.t));
const ti = sd.findIndex(s => /Taxi clear/.test(s.t));
chk('12a lights off before taxi', li >= 0 && ti >= 0 && li < ti, `step ${li + 1} before ${ti + 1}`);
chk('12b pinky switch, position and anti-collision',
    /pinky switch/.test(sd[li].note) && /anti-collision/.test(sd[li].note));
chk('13 parking brake stays set', /parkBrake==='set'/.test(sd.at(-1).done.toString()));

console.log('\nRIO carrier alignment');
chk('14a datalink off drops to handset', /dlPower === 'on'/.test(sys));
chk('14b wrong mode drops to handset', /dlModeSw === 'cains'/.test(sys));
chk('14c frequency change drops to handset', /dlFreq === '209'/.test(sys));
chk('14d flashing HS between the two markers', /data-ins="hs"/.test(view) && /left:50%/.test(view));
chk('14e option A, regain the signal', /Datalink back/.test(sys));
chk('14f option B, manual position, heading, speed', /E\.hdg && E\.spd/.test(sys));
chk('14g either way it restarts completely', /A\.t = 0/.test(sys));

console.log('\nthe bug he reported');
chk('15 front-seater only in the alignment drills', /if\(S\.frontSeater\)/.test(sys));

console.log('\n' + (bad.length
  ? bad.length + ' NOT addressed:\n   ' + bad.join('\n   ')
  : 'every point verified against the code'));
process.exit(bad.length ? 1 : 0);
