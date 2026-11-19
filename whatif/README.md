# What If…? video pipeline

Faceless "What if…?" 3D simulation shorts for TikTok / Reels, rendered from one script file.
Built with [Remotion](https://remotion.dev) + `@remotion/three` (React Three Fiber): the 3D scenes,
counters and captions all render in one pass to a **1080×1920, 30 fps, H.264 MP4**.

```bash
cd whatif
npm install
npm run render -- episodes/sneeze.json            # → out/sneeze.mp4
npm run test-clip -- episodes/sneeze.json         # → out/sneeze-test.mp4 (first 5 s)
npm run test-clip -- episodes/sneeze.json --from=30   # 5 s starting at 0:30
npm run render -- episodes/sneeze.json --still=0,12,40   # JPEG stills, quick look checks
npm run render -- episodes/sneeze.json --check    # validate the script only
npm run studio -- episodes/sneeze.json            # live preview in Remotion Studio
```

Rendering uses software WebGL (`swangle`), so it works on servers with no GPU. A 52 s episode
takes about 5 minutes on 4 CPU cores. On first run Remotion downloads a headless Chrome unless
`REMOTION_BROWSER=/path/to/chrome-headless-shell` is set.

## Every episode looks like this

| Part | Time | What's on screen |
|---|---|---|
| Hook | 0–3 s | The question in big serif type over scene 1; something is already moving on frame 1 |
| Scenes | 6–9 × 4–7 s | Top-left stat block (label, count-up number, sub-label), a caption at the bottom (≤ 10 words), a camera that keeps moving, and each scene at a bigger scale than the last |
| Twist | near the end | `"twist": true`, a red TWIST tag, and a countdown timer in the stat block |
| End card | 3 s | The question again, "PART 2: …" and "FOLLOW FOR MORE WHAT IFS" |

Also on every video: a watermark at the bottom right (`"handle"`) and an optional music bed.

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
  "handle": "@myhandle",                 // watermark
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
        "startSeconds": 0.2, "countSeconds": 3   // optional timing
      },
      "caption": "Max ten words, white, soft shadow.",
      "camera": { "from": [0, 2, 10], "to": [0, 1, 6] },  // optional override of the scene's move
      "props": { }                          // free-form, passed to the scene
    },
    // … the twist scene:
    { "component": "…", "durationInSeconds": 7, "twist": true,
      "stat": { "label": "Time left", "value": 10, "format": "countdown" }, "caption": "…" }
  ],
  "endCard": { "durationInSeconds": 3, "teaser": "What if …?", "cta": "FOLLOW FOR MORE WHAT IFS" },
  "music": { "file": "music.mp3", "volume": 0.12 }
}
```

`npm run render` checks the format rules before it renders. A caption over 10 words or a missing
component stops the render. Scene count, scene length, total length (45–60 s) and a missing twist
produce warnings only.

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
| `components/StatCounter` | Stat block: count-up with ease-out, or `countdown` format (`MM:SS.cc`). Font size is set from the final value so the number never changes size while counting. |
| `components/Caption` | Bottom caption; the words pop in one at a time. |
| `components/HookTitle` | Serif question, fully readable on frame 0. |
| `components/EndCard`, `Watermark`, `Grade`, `SceneTransition` | End card, handle, legibility gradients, and the zoom + flash cut between scenes. |
| `three/SceneCanvas` | `ThreeCanvas` with soft hemisphere + key + rim lights, fog, background, and the camera rig. |
| `three/camera` | `CameraRig` / `mergeCamera` / `evaluateCamera`: `pushIn`, `pullBack`, `dolly`, `crane` (from → to) and `orbit` (`orbitDegrees`), with easing and a subtle handheld drift. |
| `three/Particles` | GPU point cloud for sprays, clouds, haze and water: per-particle size and alpha, soft edges, fog-aware, additive option. |
| `three/props` | `Person` (low-poly), `Crowd` (thousands, instanced), `Buildings` + `makeCity` (procedural box city). |
| `three/Globe`, `three/geo` | Low-poly Earth from Natural Earth data, `Stars`, `sampleLandPoints`, `latLonToVec3`, country masks (`getCountryPolys("356")`). |

Safe areas: the stat block sits 150 px from the top and the caption 430 px from the bottom. That
keeps both clear of the TikTok/Reels UI (the top tabs, the right-hand button rail and the bottom
description).

## Music

Drop a track at `assets/music.mp3`. It loops, plays at `music.volume` (0.12 by default) and fades
in and out. If the file is missing, the video renders silent. Use music you have the rights to,
or a track from the platform's library added at upload.

## Episode 1 sources

Every on-screen number in `episodes/sneeze.json` has its source in a comment beside it, and
estimates are marked **ESTIMATE**. In short:

- 40,000 droplets per sneeze (upper figure): Tang et al., *J. Hosp. Infect.* 2006
- 7–8 m sneeze gas cloud: Bourouiba, *JAMA* 2020
- 2,500 people per Shibuya crossing: estimate (published figures range from 1,000 to 3,000)
- Jakarta ~42 M, the world's largest city: UN *World Urbanization Prospects 2025*
- India ~1.476 B in 2026: UN *WPP 2024* projection
- ~90 dB loud sneeze: estimate, with no peer-reviewed measurement found
- 8.3 B world population (mid-2026): Worldometer / UN *WPP 2024* projection
- 332 trillion droplets: derived, 8.3 B × 40,000 (upper bound)
- Eyes closing during a sneeze: involuntary reflex. The ~1 s duration is an estimate.
- Up to 20,000 planes airborne: Flightradar24

Map data: Natural Earth (public domain) via `world-atlas`. Fonts: Playfair Display and Inter (SIL OFL).
