# What If…? video pipeline

Faceless "What if…?" 3D simulation shorts for TikTok / Reels, rendered from one script file.
Built with [Remotion](https://remotion.dev) + `@remotion/three` (React Three Fiber): the 3D scenes,
counters and captions all render in one pass to a **1080×1920, 30 fps, H.264 MP4**.

```bash
cd whatif
npm install
npm run render -- episodes/sneeze.json            # → out/sneeze.mp4
npm run render -- episodes/iss-nyc.json           # → out/iss-nyc.mp4  (episode 2)
npm run render -- episodes/messy-room.json        # → out/messy-room.mp4  (episode 3, time-skip format)
npm run render -- episodes/phone-doubling.json    # → out/phone-doubling.mp4  (episode 4, doubling comedy + voiceover)
npm run test-clip -- episodes/sneeze.json         # → out/sneeze-test.mp4 (first 5 s)
npm run preview -- episodes/sneeze.json           # → out/sneeze-preview.mp4 (whole episode, half resolution)
npm run test-clip -- episodes/sneeze.json --from=30   # 5 s starting at 0:30
npm run render -- episodes/sneeze.json --still=0,12,40   # JPEG stills, quick look checks
npm run render -- episodes/sneeze.json --check    # validate the script only
npm run studio -- episodes/sneeze.json            # live preview in Remotion Studio
npm run audio -- episodes/sneeze.json             # build just the soundtrack files
```

Rendering uses software WebGL (`swangle`), so it works on servers with no GPU. A 40 s episode
takes about 6 minutes on 4 CPU cores (`--preview` takes roughly half that). On first run Remotion downloads a headless Chrome unless
`REMOTION_BROWSER=/path/to/chrome-headless-shell` is set.

## Every episode looks like this

| Part | Time | What's on screen |
|---|---|---|
| Hook | 0–3 s | The question in big serif type over scene 1; something is already moving on frame 1 |
| Scenes | 6–9 × 4–7 s | Top-left stat block (label, a number that keeps counting until the cut, sub-label), a caption at the bottom (≤ 10 words), a camera that keeps moving, and each scene at a bigger scale than the last |
| Twist | near the end | `"twist": true`, a red TWIST tag, and a countdown timer in the stat block that runs until the cut |
| End card | 3 s | The question again, "PART 2: …" and "FOLLOW FOR MORE WHAT IFS" |

Also on every video: a watermark at the bottom right (`"handle"`) and a synthesised soundtrack (score and sound effects; see [Sound](#sound)).

## Making a new episode

1. **Write `episodes/<id>.json`.** Copy `episodes/sneeze.json`. The file is JSON with comments, so put
   the source for each number in a `//` comment next to it.
2. **Reuse or add scenes.** Point `"component"` at any existing scene, such as `sneeze/CityHaze` or
   `sneeze/PlanetSneeze`. Many scenes take `props` (see each file's header comment). If you need
   something new, add `src/scenes/<id>/<Name>.scene.tsx`. Files are picked up automatically,
   so no registry needs editing.
3. **Check, preview, render.**
   `npm run render -- episodes/<id>.json --check`, then `--still=…` or `npm run test-clip`, then the full render.

### Episode file

```jsonc
{
  "id": "volcano",                       // output → out/volcano.mp4
  "question": "What if … ?",             // must start with "What if"
  "handle": "@simfinity",                // watermark
  "accent": "#7fe3ff",                   // label / highlight colour
  "hook": { "durationInSeconds": 3 },
  "scenes": [
    {
      "component": "volcano/LavaCloseUp",  // src/scenes/volcano/LavaCloseUp.scene.tsx
      "durationInSeconds": 6,              // 4–7
      // Source: …
      "stat": {
        "label": "Tonnes",                 // small uppercase label
        "value": 8300000000,               // counts up from "from" (default 0)
        "sublabel": "per second",
        "decimals": 0, "prefix": "", "suffix": "",
        "grouping": true,                   // false for years: 1979, not 1,979
        "startSeconds": 0.15                // optional: when counting starts (it always runs to the cut)
      },
      "caption": "Max ten words, white, soft shadow.",   // aim for ≤ 8; never start with "Twist"
      // or a timed sequence: [{ "text": "It's happened before…", "at": 0 }, { "text": "…just not here.", "at": 1.1 }]
      "camera": { "from": [0, 2, 10], "to": [0, 1, 6] },  // optional override of the scene's move
      "props": { }                          // free-form, passed to the scene
    },
    // … the twist scene:
    { "component": "…", "durationInSeconds": 7, "twist": true,
      "stat": { "label": "Time left", "value": 10, "format": "countdown" }, "caption": "…" }
    // several stats on one shot: pass an array; each stage counts until the next one starts
    // "stat": [ { "label": "Sneezes", "value": 8300000000 },
    //           { "label": "Droplets", "value": 332000000000000, "startSeconds": 2.6 } ]
  ],
  "endCard": { "durationInSeconds": 3, "teaser": "What if …?", "cta": "FOLLOW FOR MORE WHAT IFS" },
  "music": { "file": "music.mp3", "volume": 0.12 }
}
```

`npm run render` checks the format rules before it renders. A caption over 10 words, a caption
starting with "Twist", or a missing component stops the render. Captions over 8 words and
sub-labels over 34 characters produce warnings (sub-labels always stay on one line: the font
shrinks to fit, down to 36 px). Scene count, scene length, total length (35–60 s) and a missing twist
produce warnings only.

### Time-skip format (one set, one camera)

`episodes/messy-room.json` shows the second format: every scene is the SAME component
(`messy/Bedroom`) with a different `props.state`, and `"transition": "none"` so there is no cut.
Scenes receive the previous scene's props as `prevProps`, so the set morphs from the last state to
the new one over `props.morph` seconds while the window light flickers through `props.cycles`
day/night cycles. The stat uses `"format": "elapsed"` (value/from in **days**, shown as
"Day 3" / "Week 2" / "Month 6" / "Year 10", fast-forwarding over `jumpSeconds`), and a counting
number inside the sub-label: `"sublabel": "Dust mites in bed: ~{n} (est.)", "sublabelValue": 500000`.
`"hook": { "text": … }` lets the hook title differ from the end-card question, and
`"score": { "calm": true }` gives soft pads and plucks with no drums or hits.

### Doubling comedy format (voiceover, bright)

`episodes/phone-doubling.json` is narration-driven: each scene has a `"vo"` line, and its length
follows the line (leave out `durationInSeconds`; `voAt`, `tail`, `minSeconds` tune it). Captions
become bold, outlined, word-by-word phrases synced to the voice. Other switches:
`"theme": "bright"` (stat block on a dark card, light flash cuts, no dark grade),
`"hook": { "durationInSeconds": 0 }` (no serif title; the narration is the hook),
`"endCard": { "durationInSeconds": 0 }` (loop ending), `"signs": [{ "text": "DAMAGE: 0%", "at": 1.6, "x": 560, "y": 640 }]`
(cartoon signs that pop up), stat `"format": "mass"` (log-interpolated, "5.97 × 10²⁴ kg") with
`"sublabelFormat": "clock"`, `"musicDrop": true`, and `"score": { "style": "upbeat" }`.
The doubling math lives in `scripts/phone-math.mjs`.

#### Voiceover

Narration is synthesised locally with [Piper](https://github.com/rhasspy/piper) (`pip install piper-tts`).
Voices are not committed; download them into `assets/voices/` (gitignored), e.g. from the Piper
v0.0.2 GitHub release:

```bash
mkdir -p assets/voices && cd assets/voices
curl -L https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-ryan-high.tar.gz | tar -xz
curl -L https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-gb-alan-low.tar.gz | tar -xz
```

Every render writes the script with timings to `out/<id>-script.txt`. To use your own voice,
record each line as `01.wav`, `02.wav` … (16-bit WAV, numbered by scene) into the episode's
`voiceover.own` folder (`assets/vo/<id>/`); those replace the TTS and the scene lengths and caption
timings follow your recordings automatically. A scene can use another voice with `"voModel"`.

### Writing a scene

A scene is a React component that renders a `SceneCanvas`. Everything that moves must be a
**pure function of the scene time** `t`, so every frame renders the same way every time.

```tsx
// src/scenes/volcano/LavaCloseUp.scene.tsx
import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import { mergeCamera } from "../../three/camera";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { SceneCanvas } from "../../three/SceneCanvas";
import type { SceneComponentProps } from "../../types";

const LavaCloseUp: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime(); // seconds since this scene started
  const sparks = useCallback<ParticleFn>((i, time, out, r) => {
    out[0] = (r[0] - 0.5) * 4;                 // x
    out[1] = ((time * (1 + r[1])) % 6);        // y
    out[2] = (r[2] - 0.5) * 4;                 // z
    out[3] = 1;                                // size multiplier
    out[4] = 1;                                // alpha (0 = hidden)
  }, []);
  const cam = mergeCamera({ type: "pushIn", from: [0, 2, 12], to: [0, 1.5, 8], target: [0, 1, 0] }, camera);
  return (
    <AbsoluteFill>
      <SceneCanvas durationInFrames={durationInFrames} camera={cam} background="#1a0b08" fog={["#1a0b08", 8, 30]}>
        <mesh><icosahedronGeometry args={[1.5, 1]} /><meshStandardMaterial color="#c44" flatShading /></mesh>
        <Particles count={3000} t={t} compute={sparks} size={0.05} color="#ffb347" additive />
      </SceneCanvas>
    </AbsoluteFill>
  );
};
export default LavaCloseUp;
```

**Building blocks** (in `src/`):

| | |
|---|---|
| `components/StatCounter` | Stat block: a count-up that is fast at first but still ticking on the last frame, or `countdown` format (`MM:SS.cc`). Supports several stages on one shot. Font size is set from each stage's final value so the number never changes size while counting. |
| `components/Caption` | Bottom caption; the words pop in one at a time. |
| `components/HookTitle` | Serif question, fully readable on frame 0. |
| `components/EndCard`, `Watermark`, `Grade`, `SceneTransition` | End card, handle, legibility gradients, and the zoom + dark-dip cut between scenes (no white flash, so space stays black). |
| `three/SceneCanvas` | `ThreeCanvas` with soft hemisphere + key + rim lights, fog, background, and the camera rig. |
| `three/camera` | `CameraRig` / `mergeCamera` / `evaluateCamera`: `pushIn`, `pullBack`, `dolly`, `crane` (from → to) and `orbit` (`orbitDegrees`), with easing and a subtle handheld drift. |
| `three/Particles` | GPU point cloud for sprays, clouds, haze and water: per-particle size and alpha, soft edges, fog-aware, additive option. |
| `three/props` | `Person` (low-poly), `Crowd` (thousands, instanced), `Buildings` + `makeCity` (procedural box city). |
| `three/vehicles` | `Cockpit` (airliner flight deck), `Pilot`, `Car` (open-glass cabin), `ShutEyeHead`. |
| `SceneCanvas` `width`/`height`/`top` | Split-screen scenes: two 3D canvases in one shot (see `sneeze/EyesShut`). |
| `three/Globe`, `three/geo` | Low-poly Earth from Natural Earth data, `Stars`, `sampleLandPoints`, `latLonToVec3`, country masks (`getCountryPolys("356")`), `destination` (great-circle point from bearing + km), `slerpUnit`. |
| `three/earth` | `NightEarth`: dark globe with warm city-light specks (`DARK_EARTH` palette). |
| `three/iss` | Generic low-poly space station in metres (109 m), with `glow` (re-entry heat), `breakT` (wings tear off, then truss and modules split), `silhouette` (for shadows). |
| `three/text` | `TextPanel` / `TextLabel`: canvas-drawn text for billboards, signs and map labels (waits for the Inter font). |
| `three/city` | `TowerMesh` + `makeSkylineRow`: night towers with randomly lit windows. |
| `three/glow` | `Glow` (additive light blob for fireballs, lamps, bloom) and `SkyDome` (vertical-gradient backdrop). |
| `SceneCanvas` `cameraAt` | Per-frame camera override, e.g. a hard cut inside one scene (see `iss/OutbackTwist`). |

Safe areas: the stat block sits 150 px from the top and the caption 430 px from the bottom. That
keeps both clear of the TikTok/Reels UI (the top tabs, the right-hand button rail and the bottom
description).

## Sound

Every render builds a soundtrack automatically. All of it is synthesised in code
(`scripts/audio/`), so it is original, royalty-free, timed to the frame and deterministic.

- **Score.** Auto-composed from the episode's timeline at 120 BPM, so 6 s scenes are exactly
  3 bars. Each escalating scene adds a layer: pad and arpeggio, then the bass pulse, kick,
  snare and hats, then tom fills. Every cut gets a riser and an impact. The score falls
  silent ~0.9 s before the twist, the twist scene drops to a muffled heartbeat with a drone,
  and the end card resolves. Settings:
  `"score": { "key": "A minor", "volume": 0.55 }`, or `"score": false` to turn it off.
- **Your own music.** Put a track at `assets/music.mp3` (or set `"music": { "file": … }`). It
  replaces the score, loops, and plays low (`music.volume`, default 0.12) with fades. Use music
  you have the rights to.
- **Sound effects.** List them per scene. `at` is seconds into the scene, and the effect's hit
  point (the "CHOO" of a sneeze, the impact of a boom) lands exactly on it:

  ```jsonc
  "sfx": [
    { "synth": "sneeze", "at": 0, "volume": 1, "params": { "pitch": 0.9 } },
    { "file": "my-sounds/splash.mp3", "at": 2.5, "volume": 0.8 }   // or any file in /assets
  ]
  ```

  Synth recipes: `sneeze`, `crowdSneeze` (count, spread, distance, murmur), `babble`, `street`,
  `train`, `boom` (size), `whoosh` (duration, reverse), `wind` (duration, airy), `thump`,
  `horn` (duration, pitch), `alarm` (repeats), `rumble` (duration, build: a deep roar that builds),
  `sonicBoom` (size, gap: double crack + rattling tail), `whistle` (duration, pitch, pan, thud:
  falling debris; the hit is the thud), `creak` (duration, pitch), `splash` (size: big water impact),
  `roomTone` (duration, fan), `fly` (duration, count, pitch: buzzing flies), `steps` (count, gap),
  `rip`, `boing` (pitch), `crunch`, `ding` (pitch, big), `shatter` (panes, spread), `ricochet` (pitch),
  `cannon`, `jingle` (news sting), `pop` (pitch). `sneeze` also takes `big: true` for the opening frame.
  Add `"align": "start"` to a cue to start the sound at `at` instead of lining up its hit.
  Adding a recipe is one function in `scripts/audio/sfx.mjs`.

- **Loudness.** Add `"loudness": { "lufs": -14, "truePeak": -1 }` to an episode and the finished MP4
  is normalised with a two-pass ffmpeg `loudnorm` (video stream-copied, audio re-encoded AAC 256k),
  then re-measured; if AAC overshoots the true-peak ceiling or the level misses by > 0.2 LU it is
  redone with a corrected target. Needs `ffmpeg` on the PATH (or `FFMPEG=/path/to/ffmpeg`).

Generated audio is cached in `assets/generated/<id>/`, and only changed cues are re-synthesised.
`npm run audio -- episodes/<id>.json` builds the audio alone if you want to listen to the files.
To render without sound, add `--mute`.

## Episode 1 sources

Every on-screen number in `episodes/sneeze.json` has its source in a comment beside it, and
estimates are marked **ESTIMATE**. In short:

- 40,000 droplets per sneeze (upper figure): Tang et al., *J. Hosp. Infect.* 2006
- 7–8 m sneeze gas cloud: Bourouiba, *JAMA* 2020
- 2,500 people per Shibuya crossing: estimate (published figures range from 1,000 to 3,000)
- Jakarta ~42 M, the world's largest city: UN *World Urbanization Prospects 2025*
- India ~1.476 B in 2026: UN *WPP 2024* projection
- ~90 dB loud sneeze: estimate, with no peer-reviewed measurement found
- 2.4 M contagious sneezes in Jakarta: estimate from CDC figures (2–3 colds a year, 7–10 days each, so about 6% of people have a cold at any moment)
- 8.3 B world population (mid-2026): Worldometer / UN *WPP 2024* projection
- 332 trillion droplets: derived, 8.3 B × 40,000 (upper bound)
- Eyes closing during a sneeze: involuntary reflex. The ~1 s duration is an estimate.
- Up to 20,000 planes airborne: Flightradar24

## Episode 2 sources

Every on-screen number in `episodes/iss-nyc.json` has its source in a comment beside it, and
estimates are marked **est.** In short:

- ISS mass 420 t (419,725 kg) and 109 m end to end ("one yard shy" of a football field incl. end zones): NASA ISS Facts and Figures
- 28,000 km/h (17,500 mph; NASA: "about five miles per second"), 16 orbits a day: NASA
- LA → New York ≈ 8 min: derived, 3,936 km great-circle ÷ 28,000 km/h = 8.4 min
- Re-entry heat 1,500–1,650 °C: ESA Mir FAQ (>1,500 °C); 1,650 °C upper figure is secondary
- Dense tanks survive: Aerospace Corp. recovered-debris analysis (2005); ESA CleanSat
- ~67 t surviving debris: **est.**, NASA estimates ~16 % of the ISS survives re-entry (NASA OIG IG-18-021) × 420 t
- Impact speed 300 km/h: Aerospace Corp. — "30 km/hr for lightweight debris to 300 km/hr or more for heavier objects"; surviving pieces up to sedan size (NASA's Dana Weigel, July 2024)
- Footprint ~2,000 km: NASA's July 2024 deorbit-vehicle briefing (ISS program manager Dana Weigel: a "very, very tight" footprint, ≤ ~2,000 km / 1,250 mi). The older "6,000 km or less" ceiling (OIG 2018, USDV procurement) was superseded. Along the ISS ground track (55° from New York) 2,000 km crosses Nova Scotia and reaches Newfoundland
- Point Nemo 2,688 km from land: NOAA; ISS ~400 km up (NASA), so the crew are *often* the nearest people
- Skylab, 1979, Esperance / Balladonia WA; $400 littering fine never paid by NASA, paid in 2009 by US radio host Scott Barley: NASA history office, Shire of Esperance, ABC

## Episode 3 sources

`episodes/messy-room.json` (estimates marked **est.**; where the science is vague, no number is shown):

- 2-hour limit for perishable food, bacteria doubling in as little as 20 min: USDA FSIS
- Fruit fly egg → adult ~9 days (8½ d at 25 °C): *Drosophila melanogaster* references (JoVE, ASU Embryo Project)
- ~500,000 dust mites in a 6-month-old bed: **est.**, scaled from the UCL house-dust-mite model (~3 M in a 3-year-old mattress)
- Dust ~3.7 g/m² per year: **est.**, from ~10 mg/m²/day deposition (Canadian House Dust Study; German homes)
- Damp cotton rots in ~6 weeks: soil-bed test, Beltwide Cotton Conferences (2011)
- Plastic bottle ~450 years: **est.**, NOAA / Woods Hole outreach figure, not peer-reviewed (Chamas et al. 2020)

## Episode 4 math

`node scripts/phone-math.mjs` prints the table: m(t) = 0.2 kg × 2^(t/4), L(t) = 14.7 cm × 2^(t/12)
(ρ = 2,500 kg/m³). Pocket (20 cm, shallowest men's front pocket, The Pudding 2018) at 5.4 s;
fridge (~113 kg) / 55-inch TV width at 36.6 s; 10 storeys (30 m, ~3 m each, est.) at 1:32; Earth's
mass at 5:39; black hole (ball of its volume inside its own Schwarzschild radius,
M = √(3c⁶/32πρG³) = 1.71 × 10³⁸ kg ≈ 8.6 × 10⁷ solar masses) at 8:37.

Map data: Natural Earth (public domain) via `world-atlas`. Fonts: Playfair Display and Inter (SIL OFL).
