#!/usr/bin/env node
// npm run studio -- episodes/sneeze.json   -> opens Remotion Studio with that episode loaded.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadEpisode } from "./episode.mjs";

const file = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "episodes/sneeze.json";
const episode = loadEpisode(path.resolve(file));
const musicAvailable = fs.existsSync(path.resolve("assets", episode.music?.file ?? "music.mp3"));
const propsFile = path.join(os.tmpdir(), `whatif-${episode.id}-props.json`);
fs.writeFileSync(propsFile, JSON.stringify({ episode, musicAvailable }));
spawn("npx", ["remotion", "studio", "src/index.ts", `--props=${propsFile}`], { stdio: "inherit", shell: true });
