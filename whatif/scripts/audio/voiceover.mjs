// Voiceover: one narration line per scene ("vo"), synthesised locally with Piper TTS
// (https://github.com/rhasspy/piper) or replaced by your own recordings.
//
// Episode:  "voiceover": { "model": "assets/voices/en-us-ryan-high.onnx", "lengthScale": 1.05,
//                          "volume": 1, "own": "assets/vo/<id>" }
// Scene:    "vo": "Right now, it weighs about two hundred grams.", "voAt": 0.15,
//           optional "voModel" (a different Piper voice for this line) and "voLengthScale"
//
// Own voice: put 01.wav, 02.wav … (1-based scene numbers, any sample rate, 16-bit PCM WAV) in the
// "own" folder; those replace the TTS for that scene. Scene lengths follow the narration
// (a scene without durationInSeconds lasts voAt + line + tail), so re-timing is automatic.
// Word timings for the captions are estimated from the speech span of each clip.
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const FPS = 30;

/** Minimal 16-bit PCM WAV reader → { sr, ch, data: Float32Array (mono mix) }. */
export const readWav = (file) => {
  const b = fs.readFileSync(file);
  let p = 12;
  let fmt = null;
  let data = null;
  while (p + 8 <= b.length) {
    const id = b.toString("ascii", p, p + 4);
    const size = b.readUInt32LE(p + 4);
    if (id === "fmt ") fmt = { ch: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === "data") data = b.subarray(p + 8, p + 8 + size);
    p += 8 + size + (size % 2);
  }
  if (!fmt || !data || fmt.bits !== 16) throw new Error(`${file}: expected a 16-bit PCM WAV`);
  const n = Math.floor(data.length / 2 / fmt.ch);
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < fmt.ch; c++) s += data.readInt16LE((i * fmt.ch + c) * 2) / 32768;
    mono[i] = s / fmt.ch;
  }
  return { sr: fmt.sr, ch: fmt.ch, data: mono };
};

/** First/last moments of speech (RMS over 10 ms windows above −38 dBFS). */
const speechSpan = ({ sr, data }) => {
  const win = Math.round(sr * 0.01);
  const thr = 10 ** (-38 / 20);
  let first = -1;
  let last = -1;
  for (let i = 0; i + win <= data.length; i += win) {
    let e = 0;
    for (let k = 0; k < win; k++) e += data[i + k] * data[i + k];
    if (Math.sqrt(e / win) > thr) {
      if (first < 0) first = i;
      last = i + win;
    }
  }
  return first < 0 ? [0, data.length / sr] : [first / sr, last / sr];
};

/** Spread the words over the speech span, weighted by length, with extra room after punctuation. */
export const wordTimings = (text, span) => {
  const words = text.split(/\s+/).filter(Boolean);
  const weight = (w) => {
    const core = w.replace(/[^\p{L}\p{N}%]/gu, "").length || 1;
    const pause = /[.!?…]$/.test(w) ? 4 : /[,;:—–]$/.test(w) ? 2.5 : 0;
    return { speak: 1.2 + core, pause };
  };
  const ws = words.map(weight);
  const total = ws.reduce((a, w, i) => a + w.speak + (i < ws.length - 1 ? w.pause : 0), 0);
  const [s0, s1] = span;
  const unit = (s1 - s0) / total;
  let t = s0;
  return words.map((w, i) => {
    const start = t;
    const end = t + ws[i].speak * unit;
    t = end + (i < ws.length - 1 ? ws[i].pause * unit : 0);
    return { w, start, end };
  });
};

/**
 * Synthesise (or load) every scene's narration, fill in scene lengths, and return
 * { cues, words, script } — cues for the soundtrack, words[i] for scene i's captions.
 */
export const buildVoiceover = (ep, root, { log = console.log } = {}) => {
  const vo = ep.voiceover;
  if (!vo) return { cues: [], words: {}, script: "" };
  const assets = path.join(root, "assets");
  const outRel = path.posix.join("generated", ep.id, "vo");
  const outDir = path.join(assets, outRel);
  fs.mkdirSync(outDir, { recursive: true });
  const model = path.resolve(root, vo.model ?? "assets/voices/en-us-ryan-high.onnx");
  const ownDir = vo.own ? path.resolve(root, vo.own) : null;
  const piper = process.env.PIPER ?? "piper";
  const words = {};
  const lines = [];

  ep.scenes.forEach((s, i) => {
    if (!s.vo) return;
    const num = String(i + 1).padStart(2, "0");
    const own = ownDir && fs.existsSync(path.join(ownDir, `${num}.wav`)) ? path.join(ownDir, `${num}.wav`) : null;
    let file;
    if (own) {
      fs.copyFileSync(own, path.join(outDir, `${num}-own.wav`));
      file = `${num}-own.wav`;
    } else {
      if (!fs.existsSync(model))
        throw new Error(`Voice model not found: ${model}\n   Download a Piper voice (see README → Voiceover) or record your own lines into ${vo.own ?? "assets/vo/<id>"}.`);
      const sceneModel = s.voModel ? path.resolve(root, s.voModel) : model;
      if (!fs.existsSync(sceneModel)) throw new Error(`Voice model not found: ${sceneModel}`);
      const ls = s.voLengthScale ?? vo.lengthScale ?? 1;
      const hash = crypto.createHash("sha1").update(JSON.stringify([s.vo, ls, path.basename(sceneModel)])).digest("hex").slice(0, 10);
      file = `${num}-${hash}.wav`;
      if (!fs.existsSync(path.join(outDir, file))) {
        const res = spawnSync(piper, ["-m", sceneModel, "-f", path.join(outDir, file), "--length-scale", String(ls)], {
          input: s.vo,
          encoding: "utf8",
        });
        if (res.status !== 0 || !fs.existsSync(path.join(outDir, file)))
          throw new Error(`Piper failed for scene ${i + 1}: ${res.stderr || res.error}\n   Install with: pip install piper-tts  (or set PIPER=/path/to/piper)`);
        log(`   🎙 synthesised scene ${i + 1}: "${s.vo}"`);
      }
    }
    const wav = readWav(path.join(outDir, file));
    const dur = wav.data.length / wav.sr;
    const at = s.voAt ?? 0.15;
    if (s.durationInSeconds === undefined) {
      const need = at + dur + (s.tail ?? 0.3);
      s.durationInSeconds = Math.max(s.minSeconds ?? 1.5, Math.round(need * FPS) / FPS);
    }
    words[i] = wordTimings(s.vo, speechSpan(wav)).map((w) => ({ ...w, start: w.start + at, end: w.end + at }));
    lines.push({ i, at, dur, text: s.vo, file: path.posix.join(outRel, file), own: !!own });
  });

  // place the cues on the (now complete) timeline
  let cursor = 0;
  const starts = ep.scenes.map((s) => {
    const st = cursor;
    cursor += Math.round(s.durationInSeconds * FPS);
    return st;
  });
  const cues = lines.map((l) => ({ file: l.file, from: starts[l.i] + Math.round(l.at * FPS), volume: vo.volume ?? 1 }));

  const fmt = (f) => `${Math.floor(f / FPS / 60)}:${((f / FPS) % 60).toFixed(2).padStart(5, "0")}`;
  const script =
    `${ep.question}\n` +
    `Narration script — ${lines.length} lines. Record each line as NN.wav (16-bit WAV) into ${vo.own ?? "assets/vo/" + ep.id}/ to replace the TTS.\n\n` +
    lines.map((l) => `${String(l.i + 1).padStart(2, "0")}  [${fmt(starts[l.i] + Math.round(l.at * FPS))}, ${l.dur.toFixed(1)} s${l.own ? ", own voice" : ""}]  ${l.text}`).join("\n") +
    "\n";
  return { cues, words, script };
};
