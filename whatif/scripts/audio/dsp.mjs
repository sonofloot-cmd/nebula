// Tiny deterministic DSP toolkit: oscillators, noise, RBJ biquads, reverb, WAV I/O.
// Everything is plain Float32Array maths so audio renders identically on any machine.
import fs from "node:fs";
import path from "node:path";

export const SR = 44100;
export const TAU = Math.PI * 2;

export const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const samples = (sec) => Math.max(1, Math.ceil(sec * SR));
export const mono = (sec) => new Float32Array(samples(sec));
export const stereo = (sec) => [mono(sec), mono(sec)];

export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const dbGain = (db) => Math.pow(10, db / 20);
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** White noise buffer. */
export const noise = (sec, seed = 1) => {
  const r = mulberry32(seed);
  const b = mono(sec);
  for (let i = 0; i < b.length; i++) b[i] = r() * 2 - 1;
  return b;
};

/** Brown-ish noise (integrated white), good for rumbles and wind. */
export const brown = (sec, seed = 1) => {
  const r = mulberry32(seed);
  const b = mono(sec);
  let v = 0;
  for (let i = 0; i < b.length; i++) {
    v = (v + (r() * 2 - 1) * 0.02) * 0.998;
    b[i] = v * 3.5;
  }
  return b;
};

/** RBJ biquad. type: lowpass | highpass | bandpass | peak. Coefficients can be updated per block. */
export class Biquad {
  constructor(type, freq, q = 0.707, gainDb = 0) {
    this.type = type;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(freq, q, gainDb);
  }
  set(freq, q = this.q, gainDb = this.gainDb ?? 0) {
    this.q = q;
    this.gainDb = gainDb;
    const f = clamp(freq, 10, SR * 0.45);
    const w = (TAU * f) / SR;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    const A = Math.pow(10, gainDb / 40);
    let b0, b1, b2, a0, a1, a2;
    switch (this.type) {
      case "highpass":
        b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
        break;
      case "bandpass":
        b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
        break;
      case "peak":
        b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A;
        break;
      default: // lowpass
        b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/**
 * Filter a buffer in place. freq may be a number or a function of time (s) for sweeps.
 * stages > 1 cascades the filter for a steeper slope.
 */
export const filter = (buf, type, freq, q = 0.707, stages = 1, gainDb = 0) => {
  const fs_ = Array.from({ length: stages }, () => new Biquad(type, typeof freq === "function" ? freq(0) : freq, q, gainDb));
  for (let i = 0; i < buf.length; i++) {
    if (typeof freq === "function" && i % 32 === 0) fs_.forEach((f) => f.set(freq(i / SR), q, gainDb));
    let x = buf[i];
    for (const f of fs_) x = f.process(x);
    buf[i] = x;
  }
  return buf;
};

/** Multiply by an envelope function of time (s). */
export const shape = (buf, env) => {
  for (let i = 0; i < buf.length; i++) buf[i] *= env(i / SR);
  return buf;
};

/** Attack / exponential-decay envelope. */
export const adEnv = (attack, decay) => (t) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

/** Oscillator with frequency as number or function of time. wave: sine|saw|tri|square */
export const osc = (sec, freq, wave = "sine", phase0 = 0) => {
  const b = mono(sec);
  let ph = phase0;
  for (let i = 0; i < b.length; i++) {
    const f = typeof freq === "function" ? freq(i / SR) : freq;
    ph += f / SR;
    ph -= Math.floor(ph);
    switch (wave) {
      case "saw": b[i] = 2 * ph - 1; break;
      case "tri": b[i] = 1 - 4 * Math.abs(ph - 0.5); break;
      case "square": b[i] = ph < 0.5 ? 1 : -1; break;
      default: b[i] = Math.sin(TAU * ph);
    }
  }
  return b;
};

/** Add src into dst at a time offset (s) with gain and pan (-1..1). dst is [L, R] or mono. */
export const mix = (dst, src, at = 0, gain = 1, pan = 0) => {
  const start = Math.round(at * SR);
  const isStereo = Array.isArray(dst);
  const srcStereo = Array.isArray(src);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  const len = srcStereo ? src[0].length : src.length;
  for (let i = 0; i < len; i++) {
    const j = start + i;
    if (j < 0) continue;
    if (isStereo) {
      if (j >= dst[0].length) break;
      dst[0][j] += (srcStereo ? src[0][i] : src[i]) * gl;
      dst[1][j] += (srcStereo ? src[1][i] : src[i]) * gr;
    } else {
      if (j >= dst.length) break;
      dst[j] += (srcStereo ? (src[0][i] + src[1][i]) / 2 : src[i]) * gain;
    }
  }
  return dst;
};

/** Freeverb-style stereo reverb. Returns a NEW stereo buffer containing only the wet signal. */
export const reverb = (input, { size = 0.84, damp = 0.3, tail = 2.5 } = {}) => {
  const inL = Array.isArray(input) ? input[0] : input;
  const inR = Array.isArray(input) ? input[1] : input;
  const len = inL.length + samples(tail);
  const out = [new Float32Array(len), new Float32Array(len)];
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const aps = [556, 441, 341, 225];
  [0, 1].forEach((ch) => {
    const spread = ch * 23;
    const src = ch === 0 ? inL : inR;
    const cb = combs.map((d) => ({ buf: new Float32Array(d + spread), i: 0, store: 0 }));
    const ab = aps.map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
    for (let n = 0; n < len; n++) {
      const x = (n < src.length ? src[n] : 0) * 0.015;
      let y = 0;
      for (const c of cb) {
        const o = c.buf[c.i];
        c.store = o * (1 - damp) + c.store * damp;
        c.buf[c.i] = x + c.store * size;
        c.i = (c.i + 1) % c.buf.length;
        y += o;
      }
      for (const a of ab) {
        const o = a.buf[a.i];
        a.buf[a.i] = y + o * 0.5;
        a.i = (a.i + 1) % a.buf.length;
        y = o - y;
      }
      out[ch][n] = y;
    }
  });
  return out;
};

/** Soft-clip + normalise to a peak level (dBFS). Works on mono or stereo. */
export const master = (buf, peakDb = -1, drive = 1.2) => {
  const chans = Array.isArray(buf) ? buf : [buf];
  for (const c of chans) for (let i = 0; i < c.length; i++) c[i] = Math.tanh(c[i] * drive);
  let peak = 1e-9;
  for (const c of chans) for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i]));
  const g = dbGain(peakDb) / peak;
  for (const c of chans) for (let i = 0; i < c.length; i++) c[i] *= g;
  return buf;
};

/**
 * Linear gain so the buffer hits a peak level, or (for ambiences) an RMS level —
 * whichever is quieter — then a gentle soft-clip on what's left of the peaks.
 */
export const normalize = (buf, { peakDb = -1, rmsDb = null } = {}) => {
  const chans = Array.isArray(buf) ? buf : [buf];
  let peak = 1e-9;
  let sum = 0;
  let n = 0;
  for (const c of chans)
    for (let i = 0; i < c.length; i++) {
      const v = Number.isFinite(c[i]) ? c[i] : (c[i] = 0);
      peak = Math.max(peak, Math.abs(v));
      sum += v * v;
      n++;
    }
  const rms = Math.sqrt(sum / Math.max(1, n)) || 1e-9;
  let g = dbGain(peakDb) / peak;
  if (rmsDb !== null) g = Math.min(dbGain(peakDb + 2) / peak, dbGain(rmsDb) / rms);
  const lim = dbGain(peakDb);
  for (const c of chans)
    for (let i = 0; i < c.length; i++) {
      const v = c[i] * g;
      c[i] = Math.abs(v) <= lim * 0.8 ? v : Math.sign(v) * (lim * 0.8 + lim * 0.2 * Math.tanh((Math.abs(v) - lim * 0.8) / (lim * 0.2)));
    }
  return buf;
};

/** Short fades to avoid clicks. */
export const fadeEdges = (buf, inSec = 0.004, outSec = 0.02) => {
  const chans = Array.isArray(buf) ? buf : [buf];
  for (const c of chans) {
    const a = samples(inSec);
    const b = samples(outSec);
    for (let i = 0; i < a && i < c.length; i++) c[i] *= i / a;
    for (let i = 0; i < b && i < c.length; i++) c[c.length - 1 - i] *= i / b;
  }
  return buf;
};

export const writeWav = (file, buf) => {
  const chans = Array.isArray(buf) ? buf : [buf, buf];
  const n = chans[0].length;
  const data = Buffer.alloc(44 + n * 4);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + n * 4, 4);
  data.write("WAVE", 8);
  data.write("fmt ", 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(2, 22);
  data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 4, 28);
  data.writeUInt16LE(4, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.round(clamp(chans[0][i], -1, 1) * 32767), 44 + i * 4);
    data.writeInt16LE(Math.round(clamp(chans[1][i], -1, 1) * 32767), 46 + i * 4);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
};
