import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { mergeCamera } from "../../three/camera";
import { NightEarth } from "../../three/earth";
import { Glow } from "../../three/glow";
import { Stars } from "../../three/Globe";
import { useSceneTime } from "../../three/hooks";
import { Iss } from "../../three/iss";
import { ParticleFn, Particles } from "../../three/Particles";
import { smoothstep } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import type { SceneComponentProps } from "../../types";

/**
 * HOOK: the station glides over a dark, city-lit Earth (moving on frame 1), then lurches,
 * tilts nose-down and starts to drop, with the first orange glow on its belly.
 * props: { tiltAt?: number (s) }
 */

const R = 10;

const IssOrbit: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const tiltAt = (props.tiltAt as number) ?? 1.7;
  const k = smoothstep(tiltAt, tiltAt + 1.8, t);
  const drop = Math.pow(Math.max(0, t - tiltAt), 2) * 0.16;
  const lurch = t > tiltAt ? Math.sin((t - tiltAt) * 14) * Math.exp(-(t - tiltAt) * 3) * 0.06 : 0;

  // faint exhaust of glowing specks once it starts to fall
  const sparks = useCallback<ParticleFn>(
    (_i, time, out, r) => {
      const life = 0.6;
      const age = (time + r[0] * life) % life;
      const on = smoothstep(tiltAt + 0.3, tiltAt + 1.6, time - age);
      out[0] = (r[1] - 0.5) * 1.2 + age * 0.4;
      out[1] = 11.4 - drop + age * 0.9 + (r[2] - 0.5) * 0.15;
      out[2] = (r[3] - 0.5) * 0.4 - age * 0.6;
      out[3] = 1 - age;
      out[4] = on * (1 - age / life);
    },
    [tiltAt, drop],
  );

  const cam = mergeCamera(
    { type: "dolly", from: [-1.4, 12.25, 4.6], to: [-0.9, 11.75, 3.9], target: [0.2, 10.35, 0], fov: 45, ease: "inOut" },
    camera,
  );

  return (
    <AbsoluteFill style={{ background: "#010208" }}>
      <SceneCanvas
        durationInFrames={durationInFrames}
        camera={cam}
        background="#010208"
        sky="#cfe0ff"
        ground="#0a0f22"
        sunPosition={[12, 8, 6]}
        sunIntensity={1.6}
      >
        <Stars t={t} count={2200} />
        {/* Earth turns beneath the station: that's the orbit. */}
        <group rotation={[0.55 + t * 0.045, 0.9, 0.2]}>
          <NightEarth t={t} radius={R} lightSize={0.035} />
        </group>
        {/* sunrise glow on the limb */}
        <Glow position={[6, 10.2, -7]} size={9} stretch={[2.4, 0.5]} color="#4f8cff" opacity={0.35} />
        <group
          position={[0.25, 11.4 - drop, -drop * 0.6]}
          rotation={new THREE.Euler(0.35 + k * 0.75 + lurch, -0.5 + t * 0.03, -0.12 - k * 0.45 + lurch * 0.5)}
          scale={0.014}
        >
          <Iss selfLight={0.25} />
        </group>
        {/* first heat on its belly as it starts to fall */}
        <Glow position={[0.25, 11.25 - drop, -drop * 0.6 + 0.2]} size={2.4} stretch={[1.4, 0.6]} color="#ff7a2a" opacity={0.75 * smoothstep(tiltAt + 0.6, tiltAt + 2.2, t)} />
        <Particles count={300} t={t} compute={sparks} size={0.05} color="#ffa64a" seed={12} softness={0.6} additive maxPixelSize={8} />
      </SceneCanvas>
    </AbsoluteFill>
  );
};

export default IssOrbit;
