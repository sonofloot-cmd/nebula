// Synthesised sound-effect recipes. Each returns { buf: [L, R], hit } where `hit` is the
// moment (seconds into the buffer) that should line up with the cue's "at" time —
// e.g. the "CHOO" of a sneeze, the impact of a boom.
import { adEnv, brown, filter, mix, mono, mulberry32, noise, osc, reverb, shape, stereo } from "./dsp.mjs";

const toStereo = (m) => [Float32Array.from(m), Float32Array.from(m)];
const addReverb = (st, wet, opts) => {
  const r = reverb(st, opts);
  const out = [new Float32Array(r[0].length), new Float32Array(r[1].length)];
  mix(out, st, 0, 1);
  mix(out, r, 0, wet);
  return out;
};

/** Voiced sound through formant filters (very small vowel synth). */
const vowel = (sec, f0, formants, breath = 0.15, seed = 1) => {
  const src = osc(sec, f0, "saw");
  const n = noise(sec, seed);
  for (let i = 0; i < src.length; i++) src[i] = src[i] * (1 - breath) + n[i] * breath;
  const out = mono(sec);
  for (const [f, q, g] of formants) {
    const b = filter(Float32Array.from(src), "bandpass", f, q);
    for (let i = 0; i < out.length; i++) out[i] += b[i] * g;
  }
  return out;
};

/** One human sneeze: "ah… CHOO" + spray. big = longer, chestier, louder CHOO (for the opening frame). */
export const sneeze = ({ pitch = 1, seed = 1, roomWet = 0.12, big = false } = {}) => {
  const B = big ? 1 : 0;
  const r = mulberry32(seed);
  const hit = 0.55;
  const out = mono(1.7);
  // "ah" — rising inhale-voice
  const ah = vowel(0.45, (t) => (165 + 110 * (t / 0.45)) * pitch, [[750, 5, 1], [1250, 7, 0.6], [2600, 9, 0.25]], 0.35, seed);
  shape(ah, (t) => Math.pow(t / 0.45, 1.6) * (t > 0.42 ? (0.45 - t) / 0.03 : 1) * 0.55);
  mix(out, ah, 0.06);
  // "CH" fricative burst
  const ch = noise(0.25, seed + 1);
  filter(ch, "highpass", 1700, 0.7, 2);
  filter(ch, "peak", 3200 * (0.9 + r() * 0.2), 1.6, 1, 9);
  shape(ch, adEnv(0.003, 0.06 + 0.08 * B));
  mix(out, ch, hit, 1.1 + 0.3 * B);
  // "OO" voiced tail
  const oo = vowel(0.4, (t) => (330 - 140 * Math.min(1, t / 0.3)) * pitch, [[360, 5, 1], [880, 6, 0.5], [2400, 8, 0.15]], 0.3, seed + 2);
  shape(oo, adEnv(0.012, 0.13 + 0.15 * B));
  mix(out, oo, hit + 0.025, 0.75 + 0.35 * B);
  // spray of air
  const spray = noise(0.8, seed + 3);
  filter(spray, "lowpass", 5000, 0.7);
  filter(spray, "highpass", 350, 0.7);
  shape(spray, adEnv(0.002, 0.22 + 0.25 * B));
  mix(out, spray, hit, 0.55);
  // chest punch
  const punch = osc(0.15, (t) => 95 - 300 * t, "sine");
  shape(punch, adEnv(0.002, 0.05 + 0.05 * B));
  mix(out, punch, hit, 0.45 + 0.4 * B);
  return { buf: addReverb(toStereo(out), roomWet + 0.12 * B, { size: 0.7 + 0.1 * B, damp: 0.5, tail: 0.8 + 0.6 * B }), hit };
};

/** Crowd babble: many little formant "voices" talking. */
export const babble = ({ duration = 6, voices = 14, seed = 5, level = 1 } = {}) => {
  const r = mulberry32(seed);
  const out = stereo(duration);
  const vowels = [[[700, 1150]], [[400, 2000]], [[300, 850]], [[550, 1750]], [[450, 1000]]];
  for (let v = 0; v < voices; v++) {
    const f0 = 100 + r() * 150;
    const voice = mono(duration);
    let t = r() * 0.4;
    while (t < duration) {
      const syl = 0.12 + r() * 0.18;
      const [[f1, f2]] = vowels[Math.floor(r() * vowels.length)];
      const s = vowel(syl, f0 * (0.9 + r() * 0.25), [[f1, 4, 1], [f2, 6, 0.5]], 0.2, seed + v * 100 + Math.floor(t * 10));
      shape(s, (x) => Math.sin((Math.PI * x) / syl));
      mix(voice, s, t, 0.5 + r() * 0.5);
      t += syl + (r() < 0.2 ? 0.3 + r() * 0.5 : 0.02 + r() * 0.08);
    }
    filter(voice, "lowpass", 2500, 0.7);
    mix(out, voice, 0, (0.25 * level) / Math.sqrt(voices / 8), r() * 1.6 - 0.8);
  }
  return { buf: addReverb(out, 0.3, { size: 0.8, damp: 0.4, tail: 1 }), hit: 0 };
};

/** Hundreds of people sneezing at (almost) the same instant. */
export const crowdSneeze = ({ count = 60, spread = 0.25, distance = 0, seed = 11, murmur = true } = {}) => {
  const r = mulberry32(seed);
  const hit = 0.8;
  const dur = 4.5;
  const out = stereo(dur);
  for (let k = 0; k < count; k++) {
    const s = sneeze({ pitch: 0.72 + r() * 0.75, seed: seed * 1000 + k, roomWet: 0 });
    const offset = hit - s.hit + (r() - 0.5) * spread * (r() < 0.8 ? 0.5 : 1);
    mix(out, s.buf, offset, (0.25 + r() * 0.75) / Math.sqrt(count / 6), r() * 1.8 - 0.9);
  }
  if (murmur) {
    const m = babble({ duration: dur - hit - 0.4, voices: 12, seed: seed + 7, level: 0.8 });
    // surprised murmur swells in after the sneeze
    shape(m.buf[0], (t) => Math.min(1, t / 0.8));
    shape(m.buf[1], (t) => Math.min(1, t / 0.8));
    mix(out, m.buf, hit + 0.45, 0.9);
  }
  if (distance > 0) {
    filter(out[0], "lowpass", 9000 * (1 - distance * 0.75), 0.7);
    filter(out[1], "lowpass", 9000 * (1 - distance * 0.75), 0.7);
  }
  return { buf: addReverb(out, 0.25 + distance * 0.9, { size: 0.86, damp: 0.35, tail: 2.5 }), hit };
};

/** Busy street ambience: babble + footsteps + traffic bed. */
export const street = ({ duration = 6, seed = 21 } = {}) => {
  const r = mulberry32(seed);
  const out = stereo(duration);
  mix(out, babble({ duration, voices: 16, seed }).buf, 0, 0.8);
  const traffic = brown(duration, seed + 1);
  filter(traffic, "lowpass", 220, 0.7);
  mix(out, traffic, 0, 0.5);
  for (let t = 0; t < duration; t += 0.06 + r() * 0.1) {
    const step = noise(0.05, seed + Math.floor(t * 1000));
    filter(step, "bandpass", 1200 + r() * 1500, 2);
    shape(step, adEnv(0.001, 0.012));
    mix(out, step, t, 0.12 + r() * 0.12, r() * 1.6 - 0.8);
  }
  return { buf: out, hit: 0 };
};

/** Metro carriage: wheel rumble, rail clacks, motor whine. */
export const train = ({ duration = 6, seed = 31 } = {}) => {
  const out = stereo(duration);
  const rumble = brown(duration, seed);
  filter(rumble, "lowpass", 140, 0.9);
  mix(out, rumble, 0, 1);
  const hum = noise(duration, seed + 1);
  filter(hum, "bandpass", (t) => 520 + 40 * Math.sin(t * 0.7), 6);
  mix(out, hum, 0, 0.18);
  for (let t = 0.3; t < duration; t += 0.82) {
    for (const d of [0, 0.11]) {
      const c = noise(0.12, seed + Math.floor((t + d) * 100));
      filter(c, "bandpass", 850, 2.5);
      shape(c, adEnv(0.001, 0.025));
      mix(out, c, t + d, 0.5);
      const th = osc(0.12, 75, "sine");
      shape(th, adEnv(0.002, 0.04));
      mix(out, th, t + d, 0.35);
    }
  }
  return { buf: addReverb(out, 0.15, { size: 0.6, damp: 0.6, tail: 0.6 }), hit: 0 };
};

/** Deep cinematic boom / shockwave. */
export const boom = ({ size = 1, seed = 41 } = {}) => {
  const dur = 1.5 + 2.5 * size;
  const out = mono(dur);
  const sub = osc(dur, (t) => 42 + 55 * Math.exp(-t * 3.2 / size), "sine");
  shape(sub, adEnv(0.004, 0.85 * size));
  mix(out, sub, 0, 1.1);
  const n = noise(dur, seed);
  filter(n, "lowpass", (t) => 120 + 4500 * Math.exp(-t * 4 / size), 0.8, 2);
  shape(n, adEnv(0.002, 0.5 * size));
  mix(out, n, 0, 1.2);
  const crack = noise(0.2, seed + 1);
  filter(crack, "highpass", 1500, 0.7);
  shape(crack, adEnv(0.001, 0.03));
  mix(out, crack, 0, 0.35);
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * 1.6);
  return { buf: addReverb(toStereo(out), 0.5 * size, { size: 0.9, damp: 0.5, tail: 2.5 * size }), hit: 0 };
};

/** Airy whoosh. reverse = swells INTO the hit (good before a cut or as an "eyes open" sweep). */
export const whoosh = ({ duration = 0.7, reverse = false, seed = 51 } = {}) => {
  const out = stereo(duration);
  const n = noise(duration, seed);
  filter(n, "bandpass", (t) => {
    const p = t / duration;
    return 250 * Math.pow(16, reverse ? p : 1 - Math.abs(p - 0.5) * 2);
  }, 1.1);
  shape(n, (t) => {
    const p = t / duration;
    return reverse ? Math.pow(p, 2.5) * (p > 0.97 ? (1 - p) / 0.03 : 1) : Math.sin(Math.PI * p) ** 2;
  });
  for (let i = 0; i < n.length; i++) {
    const p = i / n.length;
    const pan = -0.7 + 1.4 * p;
    out[0][i] = n[i] * Math.cos(((pan + 1) * Math.PI) / 4) * 1.4;
    out[1][i] = n[i] * Math.sin(((pan + 1) * Math.PI) / 4) * 1.4;
  }
  return { buf: addReverb(out, 0.3, { size: 0.8, damp: 0.3, tail: 1 }), hit: reverse ? duration : duration * 0.5 };
};

/** Wind / atmosphere swell. airy adds high hiss. */
export const wind = ({ duration = 6, airy = false, seed = 61 } = {}) => {
  const r = mulberry32(seed);
  const out = stereo(duration);
  [0, 1].forEach((ch) => {
    const n = noise(duration, seed + ch);
    const ph = r() * 10;
    filter(n, "bandpass", (t) => 500 + 380 * Math.sin(t * 0.9 + ph) + 200 * Math.sin(t * 2.3 + ph * 2), 0.9);
    shape(n, (t) => Math.min(1, t / 1.2) * Math.min(1, (duration - t) / 1.2) * (0.7 + 0.3 * Math.sin(t * 1.3 + ph)));
    mix(out[ch], n, 0, 1);
    if (airy) {
      const h = noise(duration, seed + 10 + ch);
      filter(h, "highpass", 4500, 0.7);
      shape(h, (t) => Math.min(1, t / 2.5) * Math.min(1, (duration - t) / 1) * 0.35);
      mix(out[ch], h, 0, 1);
    }
  });
  return { buf: out, hit: 0 };
};

/** Muffled body thump (eyelids slamming shut, heard from inside your head). */
export const thump = ({ seed = 71 } = {}) => {
  const out = mono(1.2);
  const s = osc(1.2, (t) => 38 + 50 * Math.exp(-t * 18), "sine");
  shape(s, adEnv(0.003, 0.18));
  mix(out, s, 0, 1);
  const n = noise(0.3, seed);
  filter(n, "lowpass", 260, 0.8, 2);
  shape(n, adEnv(0.002, 0.07));
  mix(out, n, 0, 1.4);
  return { buf: addReverb(toStereo(out), 0.2, { size: 0.5, damp: 0.7, tail: 0.6 }), hit: 0 };
};

/** Car horn (two-tone), optionally fading as if passing. */
export const horn = ({ duration = 0.9, pitch = 1, seed = 81 } = {}) => {
  const out = mono(duration + 0.1);
  [349, 440].forEach((f, k) => {
    const s = osc(duration, f * pitch * (1 + (k ? 0.003 : -0.002)), "square");
    filter(s, "lowpass", 2600, 0.8);
    filter(s, "peak", 900, 1.2, 1, 6);
    shape(s, (t) => Math.min(1, t / 0.015) * Math.min(1, (duration - t) / 0.06));
    mix(out, s, 0, 0.5);
  });
  void seed;
  return { buf: addReverb(toStereo(out), 0.35, { size: 0.8, damp: 0.4, tail: 1.2 }), hit: 0 };
};

/** Cockpit warning: repeated triple beep. */
export const alarm = ({ repeats = 2, freq = 980, seed = 91 } = {}) => {
  const per = 0.75;
  const out = mono(repeats * per + 0.4);
  for (let r = 0; r < repeats; r++)
    for (let k = 0; k < 3; k++) {
      const b = osc(0.12, freq, "square");
      const s = osc(0.12, freq * 2, "sine");
      for (let i = 0; i < b.length; i++) b[i] = b[i] * 0.4 + s[i] * 0.3;
      filter(b, "lowpass", 4000, 0.7);
      shape(b, (t) => Math.min(1, t / 0.005) * Math.min(1, (0.12 - t) / 0.01));
      mix(out, b, r * per + k * 0.16, 1);
    }
  void seed;
  return { buf: addReverb(toStereo(out), 0.15, { size: 0.5, damp: 0.6, tail: 0.5 }), hit: 0 };
};

export const RECIPES = { sneeze, crowdSneeze, babble, street, train, boom, whoosh, wind, thump, horn, alarm };
