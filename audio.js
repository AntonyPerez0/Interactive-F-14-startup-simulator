/* ============================================================
   CORE · AUDIO

   Everything here is synthesised in the browser. Nothing is sampled from the
   game, so there is nothing to redistribute and nothing to download — the whole
   soundscape costs zero bytes.

   SAFETY, which shaped most of the decisions below:

   1. A limiter sits in front of the output. Whatever else goes wrong upstream,
      nothing reaches the ears above the ceiling.
   2. MAX_GAIN caps the master. The volume control moves within that, not past
      it, so there is no setting that is too loud.
   3. Every start and stop is ramped. An abrupt gain change is a click, and a
      click through headphones is the one thing here that could genuinely hurt.
   4. The ambient bed is low-passed hard. Sustained energy in the 2-5 kHz range
      is where ears fatigue fastest, so there is none of it.
   5. It starts muted until asked for, and remembers the answer.

   Browsers will not let audio start before the user interacts with the page,
   which suits a trainer where everything is click-driven.
   ============================================================ */

const KEY_ON  = 'dcs-trainer-sound';
const KEY_VOICE = 'dcs-trainer-voice';
const KEY_VOL = 'dcs-trainer-volume';

const MAX_GAIN = 1.0;     // the slider spans the useful range; the limiter guards the top
const AMBIENT  = 0.14;    // the bed, about -20 dB at default volume

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* private mode */ } },
};

export function createAudio() {
  let ctx = null, master = null, limiter = null, bed = null, bedGain = null;
  let on = store.get(KEY_ON, '0') === '1';
  let vol = Math.min(1, Math.max(0, parseFloat(store.get(KEY_VOL, '0.7')) || 0.7));
  let ambientWanted = 0;

  /* ---------- one-time graph ---------- */
  function boot() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }

    /* The limiter is a safety net, not a tone control. Set too low it squashes
       everything and the whole mix goes quiet, which is exactly what happened
       the first time: a -18 dB threshold meant nothing ever got above a
       whisper. It sits near the top now and only catches genuine peaks. */
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;

    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(limiter).connect(ctx.destination);

    buildNoise();
    buildBed();
    return true;
  }

  /* ---------- mechanical voices ----------
     Real switchgear is a broadband transient with a resonance, not a tone. So
     these are all short bursts of noise through a tight bandpass: the filter
     frequency is what makes one sound like a toggle and another like a detent. */
  let noiseBuf = null;
  function buildNoise() {
    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  /* One transient: noise, a resonant band, and a fast decay. */
  function hit({ freq = 2000, q = 6, dur = 0.03, peak = 0.25, delay = 0, sweep = null }) {
    if (!on || !ctx || !noiseBuf) return;
    const t0 = now() + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;   // never twice the same

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(freq, t0);
    if (sweep) bp.frequency.exponentialRampToValueAtTime(sweep, t0 + dur);
    bp.Q.value = q;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(bp).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  /* An annunciator buzzer: a sawtooth chopped by a square LFO and filtered, which
     is far closer to electromechanical than a clean sine beep. */
  function buzz({ freq = 400, chop = 42, dur = 0.3, peak = 0.26, delay = 0,
                  attack = 0.012, bright = 2.2 }) {
    if (!on || !ctx) return;
    const t0 = now() + delay;
    const o = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const bp = ctx.createBiquadFilter();
    const g = ctx.createGain();

    o.type = 'sawtooth';
    o.frequency.value = freq;
    lfo.type = 'square';
    lfo.frequency.value = chop;
    lfoGain.gain.value = 0.5;
    bp.type = 'bandpass';
    bp.frequency.value = freq * bright;
    bp.Q.value = 2.4;

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.setValueAtTime(peak, t0 + Math.max(attack + 0.02, dur - 0.06));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    lfo.connect(lfoGain).connect(g.gain);
    o.connect(bp).connect(g).connect(master);
    o.start(t0); lfo.start(t0);
    o.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05);
  }

  /* ---------- the cockpit bed ----------
     Brown noise through a steep low-pass, plus two quiet low partials. The
     result is the feeling of sitting inside a running machine rather than any
     particular engine note. Nothing above about 320 Hz survives. */
  function buildBed() {
    const secs = 3;
    const buf = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;    // integrate towards brown
      d[i] = last * 3.2;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    lp.Q.value = 0.6;

    const hp = ctx.createBiquadFilter();   // keep the very bottom out, it only rattles
    hp.type = 'highpass';
    hp.frequency.value = 38;

    bedGain = ctx.createGain();
    bedGain.gain.value = 0;

    src.connect(lp).connect(hp).connect(bedGain).connect(master);
    src.start();

    // two soft partials for a sense of machinery, well below the noise
    [88, 132].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.value = 0.5 * (i ? 0.06 : 0.09);
      o.connect(g).connect(bedGain);
      o.start();
    });

    bed = src;
  }

  const now = () => ctx.currentTime;

  /* Ramp rather than jump: every gain change here is a ramp, which is what
     keeps clicks out of the output. */
  function ramp(param, to, secs = 0.25) {
    const t = now();
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(to, t + secs);
  }

  function applyMaster() {
    if (!ctx) return;
    ramp(master.gain, on ? MAX_GAIN * vol : 0, 0.3);
  }

  /* ---------- one-shot voices ---------- */
  function blip({ freq = 880, type = 'sine', dur = 0.18, peak = 0.5, sweep = null, delay = 0 }) {
    if (!on || !ctx) return;
    const t0 = now() + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (sweep) o.frequency.linearRampToValueAtTime(sweep, t0 + dur);
    // a short attack and a proper tail: no edges anywhere
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  /* The Sidewinder growl is amplitude modulated noise, which is what it
     actually is: a rough tone that tightens as the seeker sees the target. */
  let growl = null;
  function startGrowl(locked) {
    if (!on || !ctx) return;
    stopGrowl();
    const o = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();

    o.type = 'sawtooth';
    o.frequency.value = locked ? 420 : 210;
    lfo.type = 'square';
    lfo.frequency.value = locked ? 92 : 34;   // tightens on lock
    lfoGain.gain.value = 0.5;
    lp.type = 'lowpass';
    lp.frequency.value = 1400;                // keep it out of the harsh band

    g.gain.value = 0;
    lfo.connect(lfoGain).connect(g.gain);
    o.connect(lp).connect(g).connect(master);
    o.start(); lfo.start();
    ramp(g.gain, locked ? 0.30 : 0.19, 0.08);
    growl = { o, lfo, g };
  }
  function stopGrowl() {
    if (!growl) return;
    const { o, lfo, g } = growl;
    growl = null;
    try {
      ramp(g.gain, 0, 0.12);
      o.stop(now() + 0.2); lfo.stop(now() + 0.2);
    } catch (e) { /* already stopped */ }
  }

  const voices = {
    /* A toggle is two events: the lever breaking over, then seating. */
    click:   () => { hit({ freq: 2400, q: 7, dur: 0.020, peak: 0.58 });
                     hit({ freq: 780,  q: 3, dur: 0.045, peak: 0.31, delay: 0.018 }); },
    /* A detent is one sharp, bright tick. */
    detent:  () => hit({ freq: 3200, q: 9, dur: 0.014, peak: 0.51 }),
    /* A button is a duller press with a bit of body. */
    push:    () => { hit({ freq: 1300, q: 4, dur: 0.028, peak: 0.51 });
                     hit({ freq: 420,  q: 2, dur: 0.060, peak: 0.25, delay: 0.014 }); },
    /* A guard has to be lifted before it can be thrown. */
    guard:   () => { hit({ freq: 1700, q: 3, dur: 0.070, peak: 0.31, sweep: 900 });
                     hit({ freq: 2400, q: 7, dur: 0.020, peak: 0.55, delay: 0.085 }); },
    /* A lever is heavier and slower than a switch. */
    lever:   () => { hit({ freq: 900, q: 2, dur: 0.090, peak: 0.39, sweep: 480 });
                     hit({ freq: 600, q: 3, dur: 0.050, peak: 0.31, delay: 0.075 }); },

    /* An advisory, not an alarm. */
    caution: () => { buzz({ freq: 300, chop: 26, dur: 0.30, peak: 0.26,
                            attack: 0.05, bright: 1.7 });
                     buzz({ freq: 300, chop: 26, dur: 0.30, peak: 0.26,
                            attack: 0.05, bright: 1.7, delay: 0.42 }); },

    /* This one is for "that was wrong", which is not an emergency and happens
       often while learning. Three things make a sound startling: a fast attack,
       energy in the 2-4 kHz band where hearing is most sensitive, and
       insistent repetition. This has none of them — a slow swell, kept low and
       dull, said twice and then finished with. */
    warning: () => { buzz({ freq: 230, chop: 19, dur: 0.34, peak: 0.21,
                            attack: 0.075, bright: 1.5 });
                     buzz({ freq: 195, chop: 17, dur: 0.42, peak: 0.19,
                            attack: 0.085, bright: 1.5, delay: 0.30 }); },
    /* Relays closing: the sound of something coming alive. */
    good:    () => { hit({ freq: 1100, q: 4, dur: 0.035, peak: 0.43 });
                     hit({ freq: 1600, q: 5, dur: 0.030, peak: 0.39, delay: 0.070 }); },
    /* A rail launch is a whoosh, not a beep. */
    launch:  () => hit({ freq: 2600, q: 1.2, dur: 0.60, peak: 0.58, sweep: 180 }),
    lock:    () => hit({ freq: 2800, q: 8, dur: 0.030, peak: 0.43 }),
    aoa:     () => hit({ freq: 1500, q: 6, dur: 0.040, peak: 0.35 }),
  };

  /* ---------- crew speech ----------
     The browser's own speech synthesis. It is free, adds nothing to download,
     and there is no one's voice work being redistributed. It is also plainly
     synthetic — so the squelch either side does the heavy lifting: a radio
     click and a tail of noise is most of what makes a line read as a radio
     call rather than a computer talking.

     Speech cannot be routed through Web Audio, so it sits outside the limiter.
     Its volume is therefore held low and tied to the same master setting. */
  let speaking = store.get(KEY_VOICE, '1') === '1';
  let voice = null;

  /* Voice choice matters more than anything else here, and the obvious
     heuristic is backwards: "localService" voices are usually the old robotic
     ones shipped with the OS, while the good neural voices are the network
     ones marked Natural, Neural, Enhanced or Premium. Score rather than guess. */
  function scoreVoice(v) {
    const n = v.name || '';
    let s = 0;
    if (/natural|neural|premium|enhanced|online/i.test(n)) s += 60;   // modern
    if (/google/i.test(n)) s += 30;                                    // decent
    if (/^en-(US|GB)/i.test(v.lang)) s += 12;
    if (/guy|ryan|christopher|eric|tony|davis|alex|daniel|aaron/i.test(n)) s += 10;
    if (/compact|espeak|pico/i.test(n)) s -= 50;                       // the tinny ones
    if (/zira|hazel|susan|female/i.test(n)) s -= 4;                     // crew skew
    if (v.default) s += 3;
    return s;
  }

  function pickVoice() {
    if (voice || typeof speechSynthesis === 'undefined') return voice;
    const all = speechSynthesis.getVoices() || [];
    if (!all.length) return null;
    const en = all.filter(v => /^en(-|_|$)/i.test(v.lang));
    const pool = en.length ? en : all;
    voice = pool.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
    return voice;
  }

  /* How aircrew say things, versus how a synthesiser reads them. Without this,
     "AWG-9" comes out as "awg minus nine" and "AIM-54" as "aim fifty four". */
  const SPOKEN = [
    [/\bAWG-?9\b/gi,        'A W G nine'],
    [/\bAIM-?54\b/gi,       'AIM fifty four'],
    [/\bAIM-?7\b/gi,        'AIM seven'],
    [/\bAIM-?9\b/gi,        'AIM nine'],
    [/\bINS\b/g,            'I N S'],
    [/\bCAINS\b/g,          'canes'],
    [/\bTID\b/g,            'T I D'],
    [/\bDDD\b/g,            'D D D'],
    [/\bHSD\b/g,            'H S D'],
    [/\bWCS\b/g,            'W C S'],
    [/\bRWS\b/g,            'R W S'],
    [/\bTWS\b/g,            'twiz'],
    [/\bSTT\b/g,            'S T T'],
    [/\bPD\b/g,             'P D'],
    [/\bCADC\b/g,           'cadic'],
    [/\bAoA\b/gi,           'angle of attack'],
    [/\bDLC\b/g,            'D L C'],
    [/\bLSO\b/g,            'L S O'],
    [/\bBRC\b/g,            'B R C'],
    [/\bkt\b/g,             'knots'],
    [/\bft\b/g,             'feet'],
    [/\bRIO\b/g,            'rio'],
    [/\bSEAM\b/g,           'seam'],
    [/\bMSL\b/g,            'missile'],
    [/(\d)°/g,               '$1 degrees'],
    [/\bSTBY\b/gi,          'standby'],
  ];

  function forSpeech(s) {
    let out = String(s).replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();
    for (const [re, to] of SPOKEN) out = out.replace(re, to);
    /* Radio calls are clipped into short phrases. A comma before a trailing
       clause gives the synthesiser somewhere to breathe, which is most of what
       separates a read-aloud sentence from a transmission. */
    out = out.replace(/ - /g, ', ').replace(/\s*—\s*/g, ', ');
    return out;
  }

  /* Radio delivery is quicker and flatter than conversation. Pitch differences
     between the seats are small on purpose — one synthesiser doing two obvious
     "characters" sounds worse than two people who merely differ. */
  const CREW = {
    jester: { pitch: 1.02, rate: 1.16 },   // back seat, busier
    pilot:  { pitch: 0.88, rate: 1.06 },   // front seat, steadier
    ground: { pitch: 0.95, rate: 1.10 },
  };

  /* Whether speech will actually make a sound here. Sandboxed frames and some
     mobile web views expose the API but have no voices behind it, which is
     silence with no error — so it is worth reporting rather than guessing. */
  function speechAvailable() {
    if (typeof speechSynthesis === 'undefined') return false;
    try { return (speechSynthesis.getVoices() || []).length > 0; }
    catch (e) { return false; }
  }

  /* A carrier: quiet band-limited hiss that runs for as long as the transmission
     does. This is the single biggest improvement available. The ear blames the
     channel for the artefacts it hears, so a synthetic voice arriving over an
     obviously noisy radio reads as a radio call rather than as a computer. */
  let carrier = null;
  function openCarrier() {
    if (!ctx || !noiseBuf) return;
    closeCarrier();
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;

    // the classic comms band, roughly 300 Hz to 3 kHz
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 320;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2900;

    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(hp).connect(lp).connect(g).connect(master);
    src.start();
    ramp(g.gain, 0.075, 0.05);
    carrier = { src, g };
  }
  function closeCarrier() {
    if (!carrier) return;
    const { src, g } = carrier;
    carrier = null;
    try { ramp(g.gain, 0, 0.12); src.stop(now() + 0.25); } catch (e) {}
  }

  function say(who, text) {
    if (!on || !speaking || typeof speechSynthesis === 'undefined') return;
    const clean = forSpeech(text);
    if (!clean) return;

    // squelch in
    hit({ freq: 1800, q: 5, dur: 0.035, peak: 0.35 });
    openCarrier();
    // pull the cockpit down while someone is talking, as a headset would
    if (bedGain) ramp(bedGain.gain, ambientWanted * AMBIENT * 0.45, 0.12);

    const u = new SpeechSynthesisUtterance(clean);
    const v = pickVoice();
    if (v) u.voice = v;
    const cfg = CREW[who] || CREW.ground;
    u.pitch = cfg.pitch;
    u.rate = cfg.rate;
    u.volume = Math.min(0.75, vol * 0.95);

    const finish = () => {
      closeCarrier();
      hit({ freq: 1200, q: 3, dur: 0.055, peak: 0.20, sweep: 600 });   // squelch out
      if (bedGain) ramp(bedGain.gain, ambientWanted * AMBIENT, 0.5);
    };
    u.onend = finish;
    u.onerror = finish;
    // a floor, in case onend never arrives — some browsers drop it
    setTimeout(finish, Math.min(12000, 900 + clean.length * 75));

    try {
      if (speechSynthesis.speaking || speechSynthesis.pending) {
        speechSynthesis.cancel();
        setTimeout(() => { try { speechSynthesis.speak(u); } catch (e) {} }, 60);
      } else {
        speechSynthesis.speak(u);
      }
    } catch (e) { finish(); }
  }

  /* A remembered "on" cannot start anything by itself: browsers refuse audio
     until the user interacts with the page. So if sound was left on, wait for
     the first gesture and start it there. Without this the chip reads SOUND
     while nothing plays, and only toggling it off and on again wakes it up. */
  const WAKE = ['pointerdown', 'keydown', 'touchstart'];
  function armFirstGesture() {
    const go = () => {
      WAKE.forEach(e => document.removeEventListener(e, go, true));
      if (!on) return;
      if (!boot()) { on = false; return; }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      applyMaster();
      ramp(bedGain.gain, ambientWanted * AMBIENT, 0.6);
    };
    WAKE.forEach(e => document.addEventListener(e, go, true));
  }
  if (on) armFirstGesture();

  /* Mobile suspends the context when the tab goes away and does not always
     bring it back, which sounds exactly like the bug above. */
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && on && ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    });
  }

  return {
    get on() { return on; },
    /* True only when sound is on AND actually running. */
    get live() { return !!(on && ctx && ctx.state === 'running'); },
    get speaking() { return speaking; },
    get voiceReady() { return speechAvailable(); },
    setSpeaking(want) {
      speaking = want;
      store.set(KEY_VOICE, want ? '1' : '0');
      if (typeof speechSynthesis === 'undefined') return;
      if (!want) { try { speechSynthesis.cancel(); } catch (e) {} return; }
      /* Some browsers only populate voices after the first call, so nudge it
         from inside the click that turned this on. */
      try { speechSynthesis.getVoices(); pickVoice(); } catch (e) {}
    },
    say,
    get volume() { return vol; },

    /* Must be called from a click, or the browser will refuse. */
    enable(want) {
      on = want;
      store.set(KEY_ON, want ? '1' : '0');
      if (want && !boot()) { on = false; return false; }
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      applyMaster();
      if (ctx) ramp(bedGain.gain, on ? ambientWanted * AMBIENT : 0, 0.6);
      if (!want) stopGrowl();
      return on;
    },

    setVolume(v) {
      vol = Math.min(1, Math.max(0, v));
      store.set(KEY_VOL, vol.toFixed(2));
      applyMaster();
    },

    /* 0 for a dead cockpit, up to 1 with both engines running. */
    ambient(level) {
      ambientWanted = Math.min(1, Math.max(0, level));
      if (on && ctx) ramp(bedGain.gain, ambientWanted * AMBIENT, 0.8);
    },

    play(name) { if (on && ctx && voices[name]) voices[name](); },
    growl(state) { if (!on || !ctx) return; state ? startGrowl(state === 'lock') : stopGrowl(); },
  };
}
