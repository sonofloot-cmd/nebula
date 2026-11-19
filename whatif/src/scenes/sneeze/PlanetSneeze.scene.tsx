import React, { useCallback, useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { mergeCamera } from "../../three/camera";
import { sampleLandPoints } from "../../three/geo";
import { DAY, faceLongitude, Globe, Stars } from "../../three/Globe";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { SceneCanvas } from "../../three/SceneCanvas";
import type { SceneComponentProps } from "../../types";

/**
 * PLANET scale: every inhabited patch of land puffs at the same instant.
 * props: { faceLon?: number, faceLat?: number }
 */

const R = 10;
const SNEEZE_AT = 0.8;

const PlanetSneeze: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const faceLon = (props.faceLon as number) ?? 45;
  const tilt = (props.faceLat as number) ?? 20;
  const land = useMemo(() => sampleLandPoints(7000, 3, 65), []);

  const puffs = useCallback<ParticleFn>(
    (i, time, out, r) => {
      const n = land[i];
      const dt = time - SNEEZE_AT - r[0] * 0.12;
      if (dt < 0) {
        out[4] = 0;
        return;
      }
      const lift = R * 1.004 + 0.9 * (1 - Math.exp(-dt * 1.6)) * (0.4 + r[1]);
      out[0] = n.x * lift + (r[2] - 0.5) * 0.3 * dt;
      out[1] = n.y * lift + (r[3] - 0.5) * 0.3 * dt;
      out[2] = n.z * lift + (r[4] - 0.5) * 0.3 * dt;
      out[3] = 0.6 + dt * 0.5;
      out[4] = Math.min(1, dt * 8) * Math.max(0.25, 1 - dt * 0.25);
    },
    [land],
  );

  const flashes = useCallback<ParticleFn>(
    (i, time, out) => {
      const n = land[i];
      const dt = time - SNEEZE_AT;
      out[0] = n.x * R * 1.003;
      out[1] = n.y * R * 1.003;
      out[2] = n.z * R * 1.003;
      out[3] = 1;
      out[4] = dt < 0 ? 0 : Math.exp(-dt * 2.5);
    },
    [land],
  );

  const cam = mergeCamera({ type: "orbit", from: [0, 7, 46], to: [0, 4, 36], target: [0, 0, 0], orbitDegrees: 30, fov: 45 }, camera);

  return (
    <AbsoluteFill>
      <SceneCanvas durationInFrames={durationInFrames} camera={cam} background="#03050c" sky="#ffffff" ground="#0a0f22" sunPosition={[30, 15, 25]} sunIntensity={2.4}>
        <Stars t={t} />
        <group rotation={[(tilt * Math.PI) / 180, faceLongitude(faceLon) + t * 0.03, 0]}>
          <Globe radius={R} palette={DAY} />
          <Particles count={land.length} t={t} compute={flashes} size={0.35} color="#fff6c4" seed={70} softness={0.9} additive maxPixelSize={30} />
          <Particles count={land.length} t={t} compute={puffs} size={0.4} color="#f2fff6" seed={71} softness={1} opacity={0.2} maxPixelSize={50} />
        </group>
      </SceneCanvas>
    </AbsoluteFill>
  );
};

export default PlanetSneeze;
