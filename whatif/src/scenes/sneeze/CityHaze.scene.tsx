import React, { useCallback, useMemo } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { mergeCamera } from "../../three/camera";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { Buildings, makeCity } from "../../three/props";
import { smoothstep } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import type { SceneComponentProps } from "../../types";

/** CITY scale: a megacity skyline swallowed by a sneeze haze rising from the streets. */

const RADIUS = 260;
const SNEEZE_AT = 0.6;

const CityHaze: React.FC<SceneComponentProps> = ({ durationInFrames, camera }) => {
  const t = useSceneTime();
  const city = useMemo(() => makeCity({ seed: 11, radius: RADIUS, block: 16, street: 7, maxHeight: 120, skip: (x, z) => Math.abs(-0.825 * x + 0.565 * z) < 18 }), []);
  const k = smoothstep(SNEEZE_AT, SNEEZE_AT + 3.5, t);

  // Fog thickens and shifts from clear evening blue to a sickly haze.
  const clear = new THREE.Color("#8fb3d9");
  const hazy = new THREE.Color("#c9cf9f");
  const bg = clear.clone().lerp(hazy, k * 0.85);
  const bgHex = `#${bg.getHexString()}`;

  // Bursts: thousands of street-level puffs at once.
  const bursts = useCallback<ParticleFn>((_i, time, out, r) => {
    const dt = time - SNEEZE_AT - r[0] * 0.2;
    if (dt < 0) {
      out[4] = 0;
      return;
    }
    const a = r[1] * Math.PI * 2;
    const rr = Math.sqrt(r[2]) * RADIUS;
    out[0] = Math.cos(a) * rr;
    out[1] = 1 + dt * (3 + r[3] * 9);
    out[2] = Math.sin(a) * rr;
    out[3] = 3 + dt * 4;
    out[4] = Math.min(1, dt * 4) * Math.max(0, 1 - dt * 0.15);
  }, []);

  // Slow, rolling haze layer that ends up above the rooftops.
  const haze = useCallback<ParticleFn>((_i, time, out, r) => {
    const dt = time - SNEEZE_AT - 0.4 - r[0] * 0.8;
    if (dt < 0) {
      out[4] = 0;
      return;
    }
    const a = r[1] * Math.PI * 2 + time * 0.02;
    const rr = Math.sqrt(r[2]) * RADIUS * 1.1;
    out[0] = Math.cos(a) * rr;
    out[1] = 4 + r[3] * 30 * Math.min(1, dt / 3) + r[4] * 40 * Math.min(1, dt / 4);
    out[2] = Math.sin(a) * rr;
    out[3] = 30 + r[5] * 40;
    out[4] = Math.min(1, dt / 2.5);
  }, []);

  const cam = mergeCamera(
    { type: "orbit", from: [250, 290, 390], to: [200, 220, 310], target: [0, 0, 0], orbitDegrees: 35, fov: 50 },
    camera,
  );

  return (
    <AbsoluteFill>
      <SceneCanvas
        durationInFrames={durationInFrames}
        camera={cam}
        background={bgHex}
        fog={[bgHex, 260 - 120 * k, 1300 - 650 * k]}
        sky="#e8f0ff"
        ground="#4a5060"
        sunPosition={[120, 200, 80]}
        sunIntensity={1.8}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[900, 64]} />
          <meshStandardMaterial color="#6d7686" roughness={1} />
        </mesh>
        {/* river */}
        <mesh rotation={[-Math.PI / 2, 0, 0.6]} position={[0, 0.2, 0]}>
          <planeGeometry args={[24, 1200]} />
          <meshStandardMaterial color="#3e6e98" roughness={0.4} />
        </mesh>
        <Buildings specs={city} />
        <Particles count={3000} t={t} compute={bursts} size={1} color="#eef7dc" seed={51} softness={1} opacity={0.3} maxPixelSize={120} />
        <Particles count={700} t={t} compute={haze} size={1} color="#dfe4b8" seed={52} softness={1} opacity={0.1} maxPixelSize={1400} />
      </SceneCanvas>
    </AbsoluteFill>
  );
};

export default CityHaze;
