#!/usr/bin/env node
// Usage:
//   npm run render -- episodes/sneeze.json            -> out/sneeze.mp4
//   npm run render -- episodes/sneeze.json --test     -> out/sneeze-test.mp4 (first 5 s)
//   npm run render -- episodes/sneeze.json --test --from=20   (5 s starting at 0:20)
//   npm run render -- episodes/sneeze.json --still=12.5       -> out/sneeze-12.5s.jpg  (or --still=2,12.5,40)
// Options: --out=path  --concurrency=N  --check (validate only)  --mute (no audio)
//          --preview  (whole episode at half resolution → out/<id>-preview.mp4)
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateAudio, validateAudio } from "./audio/index.mjs";
import { loadEpisode, validateEpisode } from "./episode.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes("=") ? hit.split("=").slice(1).join("=") : true;
};
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("Usage: npm run render -- episodes/<name>.json [--test] [--from=SECONDS] [--still=SECONDS]");
  process.exit(1);
}

const episodePath = path.resolve(process.cwd(), file);
const episode = loadEpisode(episodePath);
const { errors, warnings, total } = validateEpisode(episode, path.join(root, "src/scenes"));
errors.push(...validateAudio(episode));
warnings.forEach((w) => console.warn(`⚠  ${w}`));
if (errors.length) {
  errors.forEach((e) => console.error(`✖  ${e}`));
  process.exit(1);
}
console.log(`Episode "${episode.id}" — ${episode.scenes.length} scenes, ${total}s`);
if (flag("check")) process.exit(0);

// Soundtrack: auto score (or your assets/music.mp3) + synthesised SFX, cached in assets/generated/.
const audio = flag("mute") ? [] : generateAudio(episode, root);
for (const cue of audio) {
  if (!fs.existsSync(path.join(root, "assets", cue.file))) {
    console.error(`✖  Missing audio file assets/${cue.file}`);
    process.exit(1);
  }
}
const inputProps = { episode, audio };

// Browser: REMOTION_BROWSER env, else a pre-installed headless shell if present, else Remotion downloads one.
const candidates = [
  process.env.REMOTION_BROWSER,
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
].filter(Boolean);
const browserExecutable = candidates.find((p) => fs.existsSync(p)) ?? null;
const chromiumOptions = { gl: process.env.REMOTION_GL ?? "swangle" };

console.log("Bundling…");
const serveUrl = await bundle({
  entryPoint: path.join(root, "src/index.ts"),
  publicDir: path.join(root, "assets"),
  onProgress: () => {},
});

const composition = await selectComposition({ serveUrl, id: "Episode", inputProps, browserExecutable, chromiumOptions });
const outDir = path.join(root, "out");
fs.mkdirSync(outDir, { recursive: true });

const still = flag("still");
if (still !== undefined) {
  // --still=12.5 or --still=3,12.5,40 (seconds)
  for (const sec of String(still).split(",")) {
    const frame = Math.min(composition.durationInFrames - 1, Math.round(Number(sec) * composition.fps));
    const output = flag("out") && !String(still).includes(",") ? flag("out") : path.join(outDir, `${episode.id}-${sec}s.jpg`);
    await renderStill({ serveUrl, composition, frame, output, inputProps, browserExecutable, chromiumOptions, imageFormat: "jpeg" });
    console.log(`✔  ${path.relative(process.cwd(), output)}`);
  }
  process.exit(0);
}

const test = flag("test");
let frameRange = null;
if (test) {
  const start = Math.round(Number(flag("from") ?? 0) * composition.fps);
  frameRange = [start, Math.min(composition.durationInFrames - 1, start + 5 * composition.fps - 1)];
}
const preview = flag("preview");
const output = flag("out") ?? path.join(outDir, `${episode.id}${test ? "-test" : preview ? "-preview" : ""}.mp4`);
const concurrency = flag("concurrency") ? Number(flag("concurrency")) : null;

const started = Date.now();
let lastLog = 0;
await renderMedia({
  serveUrl,
  composition,
  codec: "h264",
  crf: 18,
  pixelFormat: "yuv420p",
  colorSpace: "bt709",
  imageFormat: "jpeg",
  jpegQuality: 92,
  audioCodec: "aac",
  outputLocation: output,
  inputProps,
  frameRange,
  concurrency,
  scale: preview ? 0.5 : 1, // --preview: half resolution (540x960), ~2x faster
  browserExecutable,
  chromiumOptions,
  timeoutInMilliseconds: 120000,
  onProgress: ({ progress, renderedFrames }) => {
    const now = Date.now();
    if (now - lastLog > 5000 || progress === 1) {
      lastLog = now;
      process.stdout.write(`  ${(progress * 100).toFixed(0).padStart(3)}%  (${renderedFrames} frames, ${((now - started) / 1000).toFixed(0)}s)\n`);
    }
  },
});
console.log(`✔  ${path.relative(process.cwd(), output)}  (${((Date.now() - started) / 1000).toFixed(0)}s)`);
