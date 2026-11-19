import React, { useCallback, useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { mergeCamera } from "../../three/camera";
import { sampleLandPoints } from "../../three/geo";
import { DAY, faceLongitude, Globe, Stars } from "../../three/Globe";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { smoothstep } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import type { SceneComponentProps } from "../../types";

/**
 * PLANET scale, one shot: every inhabited patch of land flashes as everyone sneezes,
 * then a sparkling shell of droplets lifts off the whole planet. Pure black space.
 * props: { faceLon?: number, faceLat?: number, sneezeAt?: number, shellAt?: number }
 */

const R = 10;
const SPACE = "#010208";

const PlanetDroplets: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const faceLon = (props.faceLon as number) ?? 60;
  const tilt = (props.faceLat as number) ?? 18;
  const sneezeAt = (props.sneezeAt as number) ?? 0.5;
  const shellAt = (props.shellAt as number) ?? 2.6;
  const land = useMemo(() => sampleLandPoints(6000, 3, 65), []);

  // 1) a flash on every bit of inhabited land
  const flashes = useCallback<ParticleFn>(
    (i, time, out, r) => {
      const n = land[i];
      const dt = time - sneezeAt - r[0] * 0.15;
      out[0] = n.x * R * 1.004;
      out[1] = n.y * R * 1.004;
      out[2] = n.z * R * 1.004;
      out[3] = 1;
      out[4] = dt < 0 ? 0 : Math.exp(-dt * 2.2);
    },
    [land, sneezeAt],
  );

  // 2) small puffs hugging the surface
  const puffs = useCallback<ParticleFn>(
    (i, time, out, r) => {
      const n = land[i];
      const dt = time - sneezeAt - r[0] * 0.15;
      if (dt < 0) {
        out[4] = 0;
        return;
      }
      const lift = R * (1.006 + 0.03 * (1 - Math.exp(-dt * 2)) * (0.4 + r[1]));
      out[0] = n.x * lift;
      out[1] = n.y * lift;
      out[2] = n.z * lift;
      out[3] = 0.6 + dt * 0.25;
      out[4] = Math.min(1, dt * 6) * Math.max(0.15, 1 - dt * 0.35);
    },
    [land, sneezeAt],
  );

  // 3) the droplet shell: crisp points rising off the planet and swirling in bands
  const shell = useCallback<ParticleFn>(
    (_i, time, out, r) => {
      const dt = time - shellAt + 0.6 - r[5] * 1.2;
      if (dt < 0) {
        out[4] = 0;
        return;
      }
      const lat = Math.asin(r[0] * 2 - 1);
      const band = Math.sin(lat * 6 + r[1] * 2);
      const lon = r[2] * Math.PI * 2 + time * 0.06 * band;
      const rad = R * (1.01 + (0.04 + r[3] * 0.12) * smoothstep(0, 2.5, dt));
      out[0] = rad * Math.cos(lat) * Math.cos(lon);
      out[1] = rad * Math.sin(lat);
      out[2] = rad * Math.cos(lat) * Math.sin(lon);
      out[3] = 0.6 + r[4] * 0.9;
      out[4] = smoothstep(0, 0.8, dt) * (0.55 + 0.45 * Math.sin(time * 3 + r[6] * 20));
    },
    [shellAt],
  );

  const cam = mergeCamera(
    { type: "orbit", from: [0, 7, 40], to: [-3, 9, 47], target: [0, 0, 0], orbitDegrees: 28, fov: 45 },
    camera,
  );

  return (
    <AbsoluteFill style={{ background: SPACE }}>
      <SceneCanvas
        durationInFrames={durationInFrames}
        camera={cam}
        background={SPACE}
        sky="#ffffff"
        ground="#0a0f22"
        sunPosition={[30, 15, 25]}
        sunIntensity={2.3}
      >
        <Stars t={t} />
        <group rotation={[(tilt * Math.PI) / 180, faceLongitude(faceLon) + t * 0.035, 0]}>
          <Globe radius={R} palette={DAY} atmosphereOpacity={0.16} />
          <Particles count={land.length} t={t} compute={flashes} size={0.32} color="#ffe9a0" seed={70} softness={0.9} additive maxPixelSize={22} />
          <Particles count={land.length} t={t} compute={puffs} size={0.28} color="#f2fff6" seed={71} softness={1} opacity={0.22} maxPixelSize={30} />
          <Particles count={16000} t={t} compute={shell} size={0.07} color="#c9f3ff" seed={81} softness={0.5} opacity={0.85} maxPixelSize={5} />
        </group>
      </SceneCanvas>
    </AbsoluteFill>
  );
};

export default PlanetDroplets;
