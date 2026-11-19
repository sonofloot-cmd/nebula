// Builds an episode's soundtrack: an auto-composed score (unless you supply music) and
// the per-scene sound effects listed in the episode file. Output goes to
// assets/generated/<id>/ and the returned cue list is passed to the video as props.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SR, fadeEdges, normalize, writeWav } from "./dsp.mjs";
import { composeScore } from "./score.mjs";
import { RECIPES } from "./sfx.mjs";

const FPS = 30;
// Beds are loudness-matched; one-shots are peak-normalised. Cue "volume" then sets the mix.
const AMBIENT = new Set(["train", "street", "wind", "babble"]);
const here = path.dirname(fileURLToPath(import.meta.url));

/** Same rounding as src/timeline.ts, in seconds. */
export const timelineSeconds = (ep) => {
  let cursor = 0;
  const scenes = ep.scenes.map((s) => {
    const frames = Math.round(s.durationInSeconds * FPS);
    const sc = { start: cursor / FPS, dur: frames / FPS, twist: !!s.twist };
    cursor += frames;
    return sc;
  });
  const endFrames = Math.round((ep.endCard?.durationInSeconds ?? 3) * FPS);
  return { scenes, end: { start: cursor / FPS, dur: endFrames / FPS }, total: (cursor + endFrames) / FPS };
};

// Any change to the synth code invalidates the cache.
const codeVersion = () =>
  crypto
    .createHash("sha1")
    .update(fs.readdirSync(here).sort().map((f) => fs.readFileSync(path.join(here, f), "utf8")).join("\n"))
    .digest("hex")
    .slice(0, 10);

export const validateAudio = (ep) => {
  const errors = [];
  ep.scenes.forEach((s, i) =>
    (s.sfx ?? []).forEach((c, j) => {
      if (!c.synth && !c.file) errors.push(`scene ${i + 1} sfx ${j + 1}: needs "synth" or "file"`);
      if (c.synth && !RECIPES[c.synth]) errors.push(`scene ${i + 1} sfx ${j + 1}: unknown synth "${c.synth}" (have: ${Object.keys(RECIPES).join(", ")})`);
    }),
  );
  return errors;
};

/**
 * @returns cues: [{ file, from (frame), volume, music?, loop? }]
 */
export const generateAudio = (ep, root, { log = console.log } = {}) => {
  const assets = path.join(root, "assets");
  const outRel = path.posix.join("generated", ep.id);
  const outDir = path.join(assets, outRel);
  fs.mkdirSync(outDir, { recursive: true });
  const cachePath = path.join(outDir, "cache.json");
  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(cachePath, "utf8"));
  } catch {
    cache = {};
  }
  const version = codeVersion();
  const tl = timelineSeconds(ep);
  const cues = [];
  const fresh = {};

  /** Re-synthesise only when the inputs or the synth code changed. make() -> { buf, meta } */
  const build = (name, key, make) => {
    const hash = crypto.createHash("sha1").update(version + JSON.stringify(key)).digest("hex");
    const file = path.join(outDir, name);
    let meta = cache[name]?.hash === hash && fs.existsSync(file) ? cache[name].meta : null;
    if (!meta) {
      const res = make();
      writeWav(file, res.buf);
      meta = res.meta ?? {};
      log(`   ♪ synthesised ${name}`);
    }
    fresh[name] = { hash, meta };
    return { file: path.posix.join(outRel, name), meta };
  };

  // ---- music: your own track wins; otherwise the auto score ----
  const musicFile = ep.music?.file ?? "music.mp3";
  if (fs.existsSync(path.join(assets, musicFile))) {
    cues.push({ file: musicFile, from: 0, volume: ep.music?.volume ?? 0.12, music: true, loop: true });
    log(`♪  Music: assets/${musicFile}`);
  } else if (ep.score !== false) {
    const opts = typeof ep.score === "object" ? ep.score : {};
    const { file } = build("score.wav", { tl, opts }, () => ({ buf: composeScore(tl, opts) }));
    cues.push({ file, from: 0, volume: opts.volume ?? 0.55, music: true });
    log("♪  Music: auto-composed score (add assets/music.mp3 to use your own)");
  }

  // ---- per-scene sound effects ----
  ep.scenes.forEach((s, i) => {
    (s.sfx ?? []).forEach((c, j) => {
      const at = tl.scenes[i].start + (c.at ?? 0);
      if (c.file) {
        cues.push({ file: c.file, from: Math.max(0, Math.round(at * FPS)), volume: c.volume ?? 1 });
        return;
      }
      const name = `s${i + 1}-${j + 1}-${c.synth}.wav`;
      // The wav is laid out so it starts on an exact video frame and its "hit"
      // (e.g. the CHOO of a sneeze) lands exactly on scene start + at.
      const { file, meta } = build(name, { c, i, j, at }, () => {
        const res = RECIPES[c.synth]({ seed: 1000 * (i + 1) + j, ...(c.params ?? {}) });
        normalize(res.buf, AMBIENT.has(c.synth) ? { peakDb: -3, rmsDb: -20 } : { peakDb: -1 });
        fadeEdges(res.buf, 0.002, 0.05);
        const place = c.align === "start" ? at : at - res.hit;
        const from = Math.max(0, Math.floor(place * FPS));
        const lead = place - from / FPS; // >0: pad with silence, <0: trim the head
        const n = res.buf[0].length;
        const shift = Math.round(lead * SR);
        const out = [0, 1].map((ch) => {
          const o = new Float32Array(Math.max(1, n + shift));
          for (let k = 0; k < o.length; k++) {
            const src = k - shift;
            o[k] = src >= 0 && src < n ? res.buf[ch][src] : 0;
          }
          return o;
        });
        return { buf: out, meta: { from } };
      });
      cues.push({ file, from: meta.from, volume: c.volume ?? 1 });
    });
  });

  fs.writeFileSync(cachePath, JSON.stringify(fresh, null, 2));
  return cues;
};
