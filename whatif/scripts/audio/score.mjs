// Auto-composed score that follows the episode timeline:
// each escalating scene adds layers (pad → bass pulse → kick → snare/hats → toms),
// every cut gets a riser + impact, the twist drops to a muffled heartbeat, and the
// end card resolves. 120 BPM, so 6-second scenes are exactly 3 bars.
import {
  SR, adEnv, filter, master, midiHz, mix, mono, mulberry32, noise, osc, reverb, shape, stereo,
} from "./dsp.mjs";

const BEAT = 0.5;

const KEYS = {
  // chord tones (MIDI) per step of the progression, minor-key cinematic loop
  "A minor": {
    root: 57,
    prog: [
      [57, 60, 64], // Am
      [53, 57, 60], // F
      [55, 60, 64], // C
      [55, 59, 62], // G
      [57, 60, 64], // Am
      [53, 57, 62], // Dm/F
      [56, 59, 64], // E
      [53, 57, 60], // F
      [55, 59, 62], // G
    ],
    end: [57, 60, 64, 71], // Am(add9)
  },
};

const pluck = (freq, dur, bright) => {
  const a = osc(dur, freq, "tri");
  const b = osc(dur, freq * 2, "sine");
  for (let i = 0; i < a.length; i++) a[i] = a[i] * 0.8 + b[i] * 0.25 * bright;
  return shape(a, adEnv(0.003, 0.11));
};

const kick = () => {
  const k = osc(0.4, (t) => 55 + 120 * Math.exp(-t * 30), "sine");
  shape(k, adEnv(0.002, 0.2));
  const c = noise(0.02, 3);
  filter(c, "highpass", 2500, 0.7);
  mix(k, c, 0, 0.5);
  return k;
};

const snare = (seed) => {
  const n = noise(0.3, seed);
  filter(n, "bandpass", 1900, 0.8);
  shape(n, adEnv(0.002, 0.09));
  const body = osc(0.15, 185, "sine");
  shape(body, adEnv(0.002, 0.05));
  mix(n, body, 0, 0.6);
  return n;
};

const hat = (seed, open = false) => {
  const n = noise(open ? 0.25 : 0.06, seed);
  filter(n, "highpass", 7500, 0.7, 2);
  return shape(n, adEnv(0.001, open ? 0.08 : 0.022));
};

const tom = (freq, seed) => {
  const t = osc(0.5, (x) => freq * (0.7 + 0.5 * Math.exp(-x * 20)), "sine");
  shape(t, adEnv(0.003, 0.18));
  const n = noise(0.08, seed);
  filter(n, "lowpass", 900, 0.7);
  shape(n, adEnv(0.001, 0.03));
  mix(t, n, 0, 0.5);
  return t;
};

const impact = (seed, size = 1) => {
  const d = 2.4 * size;
  const out = mono(d);
  const sub = osc(d, (t) => 48 + 70 * Math.exp(-t * 6), "sine");
  shape(sub, adEnv(0.003, 0.45 * size));
  mix(out, sub, 0, 1);
  const crash = noise(d, seed);
  filter(crash, "lowpass", (t) => 900 + 7000 * Math.exp(-t * 2.5), 0.7);
  shape(crash, adEnv(0.002, 0.55 * size));
  mix(out, crash, 0, 0.55);
  return out;
};

const riser = (dur, seed) => {
  const n = noise(dur, seed);
  filter(n, "bandpass", (t) => 400 * Math.pow(20, t / dur), 1.2);
  shape(n, (t) => Math.pow(t / dur, 2.2));
  const tone = osc(dur, (t) => 220 * Math.pow(3, t / dur), "saw");
  filter(tone, "lowpass", 2500, 0.7);
  shape(tone, (t) => Math.pow(t / dur, 3) * 0.25);
  mix(n, tone, 0, 1);
  return n;
};

const padChord = (notes, dur, cutoff0, cutoff1, seed) => {
  const out = stereo(dur);
  const r = mulberry32(seed);
  notes.forEach((m, k) => {
    [-1, 1].forEach((side) => {
      const f = midiHz(m) * Math.pow(2, (side * (5 + r() * 4)) / 1200);
      const s = osc(dur, f, "saw", r());
      filter(s, "lowpass", (t) => cutoff0 + (cutoff1 - cutoff0) * (t / dur), 0.9, 2);
      shape(s, (t) => Math.min(1, t / 0.08) * Math.min(1, (dur - t) / 0.12));
      mix(out, s, 0, 0.055, side * (0.35 + 0.1 * k));
    });
  });
  return out;
};

/**
 * @param timeline { scenes: [{start, dur, twist}], end: {start, dur}, total }
 */
export const composeScore = (timeline, { key = "A minor", seed = 7, calm = false } = {}) => {
  const K = KEYS[key] ?? KEYS["A minor"];
  const total = timeline.total;
  const dry = stereo(total + 0.5);
  const send = stereo(total + 0.5);
  const both = (buf, at, gain, pan = 0, wet = 0.25) => {
    mix(dry, buf, at, gain, pan);
    if (wet) mix(send, buf, at, gain * wet, pan);
  };

  const escalating = timeline.scenes.filter((s) => !s.twist);
  const n = Math.max(2, escalating.length);
  let step = 0;

  timeline.scenes.forEach((sc, si) => {
    const { start, dur } = sc;
    const end = start + dur;

    // ---------- cut: riser into it, impact on it ----------
    if (si > 0 && !calm) {
      // no riser into the twist: the score falls silent before it instead (see "gaps" below)
      if (!sc.twist) both(riser(1.0, seed + si), start - 1.0, 0.16, 0, 0.3);
      both(impact(seed + si * 3, sc.twist ? 1.4 : 0.7 + 0.5 * (step / n)), start, sc.twist ? 0.9 : 0.55, 0, 0.45);
    }

    if (sc.twist) {
      // ---------- TWIST: everything drops; muffled heartbeat + drone ----------
      const sect = stereo(dur + 1);
      const drone = osc(dur + 1, midiHz(K.root - 12), "tri");
      const fifth = osc(dur + 1, midiHz(K.root - 5), "sine");
      for (let i = 0; i < drone.length; i++) drone[i] = (drone[i] + fifth[i] * 0.5) * (0.8 + 0.2 * Math.sin((i / SR) * 1.3));
      shape(drone, (t) => Math.min(1, t / 0.6) * Math.min(1, (dur + 0.3 - t) / 0.8));
      mix(sect, drone, 0, 0.22);
      for (let t = 0.35; !calm && t < dur - 0.6; t += 1.2) {
        mix(sect, tom(70, seed + t * 10), t, 1.1);
        mix(sect, tom(60, seed + t * 11), t + 0.24, 0.75);
      }
      filter(sect[0], "lowpass", 1100, 0.7);
      filter(sect[1], "lowpass", 1100, 0.7);
      both(sect, start, 1, 0, 0.15);
      // eerie high tones (outside the muffle)
      const eerie = osc(dur, (t) => midiHz(K.root + 24) * (1 + 0.004 * Math.sin(t * 31)), "sine");
      shape(eerie, (t) => Math.min(1, t / 2) * Math.min(1, (dur - t) / 0.5) * (0.6 + 0.4 * Math.sin(t * 2)));
      both(eerie, start, 0.035, 0.3, 0.9);
      const eerie2 = osc(dur, (t) => midiHz(K.root + 31) * (1 + 0.004 * Math.sin(t * 27)), "sine");
      shape(eerie2, (t) => Math.min(1, Math.max(0, t - 1.5) / 2) * Math.min(1, (dur - t) / 0.5));
      both(eerie2, start, 0.022, -0.3, 0.9);
      return;
    }

    // ---------- escalating scene ----------
    const L = step / (n - 1);
    const chord = K.prog[step % K.prog.length];
    step++;

    if (calm) {
      // CALM (time-skip episodes): one soft, slowly opening pad per stage, crossfaded across cuts,
      // plus a sparse music-box pluck. No drums, risers or hits.
      both(padChord(chord, dur + 0.8, 380 + 500 * L, 700 + 900 * L, seed + si), start - 0.4, 1.3, 0, 0.5);
      for (let t = 0.6, k = 0; t < dur - 0.4; t += 1.0, k++) {
        if (k % 2 === 1 && L < 0.6) continue;
        const note = chord[k % chord.length] + 24;
        both(pluck(midiHz(note), 1.6, 0.4), start + t, 0.05 * (1 - 0.6 * L), k % 2 ? 0.3 : -0.3, 0.8);
      }
      return;
    }

    // pad (gets brighter and wider with every scene)
    const notes = L > 0.45 ? [...chord, chord[0] + 12] : chord;
    both(padChord(notes, dur + 0.12, 500 + 1500 * L, 1100 + 3200 * L, seed + si), start, 1.7 + 0.6 * L, 0, 0.35);

    // sub bass, pumping on 8ths once things get going
    const bassF = midiHz(chord[0] - 24);
    const bass = osc(dur, bassF, "sine");
    const bassSaw = osc(dur, bassF, "saw");
    filter(bassSaw, "lowpass", 420 + 500 * L, 0.9);
    for (let i = 0; i < bass.length; i++) {
      const t = i / SR;
      const ph = ((start + t) % (BEAT / 2)) / (BEAT / 2);
      const pump = si === 0 ? 1 : 0.35 + 0.65 * Math.pow(ph, 0.6);
      bass[i] = (bass[i] * 0.55 + bassSaw[i] * 0.7) * pump * Math.min(1, t / 0.05) * Math.min(1, (dur - t) / 0.05);
    }
    both(bass, start, 0.16 + 0.07 * L, 0, 0);

    // arpeggio (16ths), with a dotted-8th echo
    const arpNotes = [0, 1, 2, 3, 4, 5, 4, 3].map((k) => (k < 3 ? chord[k] : chord[k - 3] + 12) + 12);
    const arp = mono(dur + 1);
    const t0 = si === 0 ? 0.6 : 0; // let the opening sneeze breathe
    for (let t = t0, k = 0; t < dur - 0.05; t += BEAT / 4, k++) {
      const accent = k % 4 === 0 ? 1 : 0.65;
      mix(arp, pluck(midiHz(arpNotes[k % arpNotes.length]), 0.4, L), t, accent);
    }
    filter(arp, "lowpass", 1400 + 5500 * L, 0.7);
    const echo = mono(arp.length / SR);
    mix(echo, arp, 0.375, 0.35);
    mix(echo, arp, 0.75, 0.15);
    both(arp, start, 0.2 + 0.08 * L, -0.25, 0.4);
    both(echo, start, 0.2 + 0.08 * L, 0.35, 0.4);

    // drums
    const beats = Math.round(dur / BEAT);
    for (let b = 0; b < beats; b++) {
      const t = start + b * BEAT;
      const bar = b % 4;
      if (L >= 0.15 && (L >= 0.5 || bar === 0 || bar === 2)) both(kick(), t, 0.55, 0, 0);
      if (L >= 0.35 && (bar === 1 || bar === 3)) both(snare(seed + b + si * 50), t, 0.32, 0.05, 0.35);
      if (L >= 0.3) {
        both(hat(seed + b * 7 + si), t + BEAT / 2, 0.12, 0.3, 0.1);
        if (L >= 0.7) {
          both(hat(seed + b * 13 + si), t + BEAT / 4, 0.06, -0.3, 0.1);
          both(hat(seed + b * 17 + si), t + (3 * BEAT) / 4, 0.06, 0.4, 0.1);
        }
      }
    }
    // tom fill over the last bar of bigger scenes (not right before the twist's silence)
    if (L >= 0.55 && !timeline.scenes[si + 1]?.twist) {
      for (let k = 0; k < 8; k++) {
        both(tom(90 + k * 9, seed + k + si * 99), end - 2 + k * 0.25, 0.25 + 0.04 * k, k % 2 ? 0.3 : -0.3, 0.25);
      }
    }
  });

  // ---------- END CARD: resolve ----------
  const { start: es, dur: ed } = timeline.end;
  if (!calm) both(impact(seed + 999, 1.2), es, 0.8, 0, 0.5);
  both(padChord(KEYS[key]?.end ?? K.end, ed + 0.6, 2400, 1200, seed + 77), es, 1.1, 0, 0.6);
  [0, 0.375, 0.75, 1.125].forEach((t, k) => {
    both(pluck(midiHz([81, 88, 83, 84][k] ?? 81), 1.2, 1), es + 0.2 + t, 0.1, k % 2 ? 0.4 : -0.4, 0.8);
  });

  // ---------- master ----------
  const wet = reverb(send, { size: 0.88, damp: 0.35, tail: 3 });
  mix(dry, wet, 0, 1.6);
  // Silence before the twist: fade everything (tails too) out over `gap` seconds, then cut back in on it.
  const gap = 0.9;
  const twistStarts = timeline.scenes.filter((x) => x.twist).map((x) => x.start);
  const gate = (t) => {
    for (const ts of twistStarts) {
      if (t > ts - gap - 0.5 && t < ts) return Math.max(0, Math.min(1, (ts - gap - t) / 0.5));
    }
    return 1;
  };
  [0, 1].forEach((c) => shape(dry[c], gate));
  [0, 1].forEach((c) => {
    filter(dry[c], "highpass", 38, 0.7, 2);
    // fade the very end; dip the first moments so the opening SFX (the sneeze) punches through
    shape(dry[c], (t) => Math.min(1, Math.max(0, (total - t) / 0.5)) * (t < 0.7 ? 0.2 + 0.8 * (t / 0.7) : 1));
  });
  return master([dry[0].subarray(0, Math.round(total * SR)), dry[1].subarray(0, Math.round(total * SR))], -1, 1.1);
};

/**
 * UPBEAT style (bright comedy episodes): C-major I–V–vi–IV loop at 120 BPM — plucky off-beat
 * chords, bouncy bass, kick/clap/shaker and a sparse glockenspiel motif. Scenes with `drop`
 * fall to a low drone (no drums). No risers or hits, so the voiceover sits on top.
 */
export const composeUpbeat = (timeline, { seed = 11 } = {}) => {
  const total = timeline.total;
  const dry = stereo(total + 1);
  const send = stereo(total + 1);
  const both = (buf, at, gain, pan = 0, wet = 0.2) => {
    mix(dry, buf, at, gain, pan);
    if (wet) mix(send, buf, at, gain * wet, pan);
  };
  const prog = [
    [60, 64, 67], // C
    [55, 59, 62], // G
    [57, 60, 64], // Am
    [53, 57, 60], // F
  ];
  const glock = [76, 79, 81, 79, 76, 74, 72, 74];
  const inDrop = (t) => timeline.scenes.some((sc) => sc.drop && t >= sc.start && t < sc.start + sc.dur);
  const bar = BEAT * 4;
  const nBars = Math.ceil(total / bar);
  for (let b = 0; b < nBars; b++) {
    const chord = prog[b % 4];
    for (let q = 0; q < 8; q++) {
      const t = b * bar + q * (BEAT / 2);
      if (t >= total) break;
      if (inDrop(t)) continue;
      const onBeat = q % 2 === 0;
      if (onBeat) {
        // bass: root on 1 and 3, fifth on 2 and 4
        const note = chord[0] - 24 + (q % 4 === 2 ? 7 : 0);
        const bass = osc(0.3, midiHz(note), "tri");
        shape(bass, adEnv(0.004, 0.12));
        both(bass, t, 0.32, 0, 0);
        if (q === 0 || q === 4) both(kick(), t, 0.42, 0, 0);
        if (q === 2 || q === 6) {
          const clap = noise(0.2, seed + b * 9 + q);
          filter(clap, "bandpass", 1500, 0.9);
          shape(clap, adEnv(0.002, 0.05));
          both(clap, t, 0.22, 0.1, 0.4);
        }
      } else {
        // off-beat "ukulele" strum: quick rolled triad
        chord.forEach((n, k) => both(pluck(midiHz(n + 12), 0.35, 0.7), t + k * 0.012, 0.075, -0.2 + 0.2 * k, 0.25));
      }
      both(hat(seed + b * 31 + q), t + BEAT / 4, 0.05, 0.35, 0.1);
    }
    // glockenspiel motif every other bar
    if (b % 2 === 1) {
      for (let k = 0; k < 4; k++) {
        const t = b * bar + k * BEAT;
        if (t >= total || inDrop(t)) continue;
        const g = osc(1.2, midiHz(glock[(b * 4 + k) % glock.length]), "sine");
        const g2 = osc(1.2, midiHz(glock[(b * 4 + k) % glock.length]) * 2.76, "sine");
        for (let i = 0; i < g.length; i++) g[i] = g[i] + g2[i] * 0.25;
        shape(g, adEnv(0.002, 0.35));
        both(g, t, 0.05, 0.3, 0.6);
      }
    }
  }
  // drops: low, dark drone under the moment
  timeline.scenes.filter((sc) => sc.drop).forEach((sc) => {
    const d = osc(sc.dur + 0.5, midiHz(33), "tri");
    const d2 = osc(sc.dur + 0.5, midiHz(40), "sine");
    for (let i = 0; i < d.length; i++) d[i] = d[i] + d2[i] * 0.6;
    filter(d, "lowpass", 300, 0.7);
    shape(d, (t) => Math.min(1, t / 0.4) * Math.min(1, (sc.dur + 0.3 - t) / 0.4));
    both(d, sc.start, 0.16, 0, 0.3);
  });
  const wet = reverb(send, { size: 0.8, damp: 0.4, tail: 1.8 });
  mix(dry, wet, 0, 1.2);
  [0, 1].forEach((c) => {
    filter(dry[c], "highpass", 40, 0.7, 2);
    shape(dry[c], (t) => Math.min(1, t / 0.05) * Math.min(1, Math.max(0, (total - t) / 0.15)));
  });
  return master([dry[0].subarray(0, Math.round(total * SR)), dry[1].subarray(0, Math.round(total * SR))], -1, 1.05);
};
