import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { mergeCamera } from "../../three/camera";
import { DAY, faceLongitude, Globe, Stars } from "../../three/Globe";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { smoothstep } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import type { SceneComponentProps } from "../../types";

/** ATMOSPHERE scale: a pale droplet shell wraps the whole planet as we pull back. */

const R = 10;

const AtmosphereShell: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const faceLon = (props.faceLon as number) ?? 100;
  const k = smoothstep(0.2, 4, t);

  const shell = useCallback<ParticleFn>((_i, time, out, r) => {
    // Points on a sphere, swirling in bands like weather.
    const lat = Math.asin(r[0] * 2 - 1);
    const band = Math.sin(lat * 6 + r[1] * 2);
    const lon = r[2] * Math.PI * 2 + time * 0.05 * band;
    const rad = R * (1.02 + r[3] * 0.09 * smoothstep(0, 4, time));
    out[0] = rad * Math.cos(lat) * Math.cos(lon);
    out[1] = rad * Math.sin(lat);
    out[2] = rad * Math.cos(lat) * Math.sin(lon);
    out[3] = 0.6 + r[4] * 1.2;
    out[4] = smoothstep(r[5] * 2.5, r[5] * 2.5 + 1.2, time);
  }, []);

  const cam = mergeCamera({ type: "pullBack", from: [0, 5, 30], to: [-7, 10, 52], target: [0, 0, 0], fov: 45 }, camera);

  return (
    <AbsoluteFill>
      <SceneCanvas durationInFrames={durationInFrames} camera={cam} background="#02040a" sky="#ffffff" ground="#0a0f22" sunPosition={[-25, 12, 30]} sunIntensity={2.4}>
        <Stars t={t} />
        <group rotation={[0.3, faceLongitude(faceLon) + t * 0.04, 0]}>
          <Globe radius={R} palette={DAY} atmosphere={new THREE.Color("#7fc8ff").lerp(new THREE.Color("#e2f5c8"), k).getStyle()} atmosphereOpacity={0.22 + 0.25 * k} />
          <Particles count={9000} t={t} compute={shell} size={0.32} color="#effbe8" seed={81} softness={1} opacity={0.3} maxPixelSize={40} />
        </group>
      </SceneCanvas>
    </AbsoluteFill>
  );
};

export default AtmosphereShell;
