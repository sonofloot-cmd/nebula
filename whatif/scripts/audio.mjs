#!/usr/bin/env node
// npm run audio -- episodes/sneeze.json   -> synthesises the score + SFX into assets/generated/<id>/
// (render does this automatically; this is handy for listening / tweaking on its own)
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateAudio, validateAudio } from "./audio/index.mjs";
import { loadEpisode } from "./episode.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!file) {
  console.error("Usage: npm run audio -- episodes/<name>.json");
  process.exit(1);
}
const episode = loadEpisode(path.resolve(file));
const errors = validateAudio(episode);
if (errors.length) {
  errors.forEach((e) => console.error(`✖  ${e}`));
  process.exit(1);
}
const t = Date.now();
const cues = generateAudio(episode, root);
cues.forEach((c) => console.log(`   ${String(c.from).padStart(5)}f  vol ${c.volume}  assets/${c.file}`));
console.log(`✔  ${cues.length} cues in ${((Date.now() - t) / 1000).toFixed(1)}s`);
