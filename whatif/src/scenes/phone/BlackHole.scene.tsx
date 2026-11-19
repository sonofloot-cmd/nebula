import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { mergeCamera } from "../../three/camera";
import { Glow } from "../../three/glow";
import { Stars } from "../../three/Globe";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { clamp01, smoothstep } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import type { SceneComponentProps } from "../../types";
import { Phone } from "./kit";

/** Gravity wins: the phone crushes into a point of light, an accretion disk spins up, a black hole remains. */
const BlackHole: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const collapseAt = (props.collapseAt as number) ?? 0.4;
  const c = smoothstep(collapseAt, collapseAt + 1.0, t);
  const flash = Math.max(0, 1 - Math.abs(t - (collapseAt + 1.0)) / 0.3);
  const hole = smoothstep(collapseAt + 0.9, collapseAt + 1.6, t);
  const disk = useCallback<ParticleFn>(
    (_i, time, out, r) => {
      const rad = 1.4 + r[0] * r[0] * 4.5;
      const a = r[1] * Math.PI * 2 + time * (2.6 / Math.pow(rad, 1.5));
      out[0] = Math.cos(a) * rad;
      out[1] = (r[2] - 0.5) * 0.12 * rad * 0.3;
      out[2] = Math.sin(a) * rad;
      out[3] = 0.6 + r[3];
      out[4] = hole * (0.4 + 0.6 * (1 - (rad - 1.4) / 4.5));
    },
    [hole],
  );
  const cam = mergeCamera({ type: "orbit", from: [0, 2.6, 11], to: [0, 2.2, 9.5], target: [0, 0, 0], orbitDegrees: 25, fov: 45, ease: "inOut" }, camera);
  const L = 7 * (1 - c) + 0.02;
  return (
    <AbsoluteFill style={{ background: "#010208" }}>
      <SceneCanvas durationInFrames={durationInFrames} camera={cam} background="#010208" sky="#ffffff" ground="#0a0f22" sunPosition={[-10, 6, 8]} sunIntensity={1.6}>
        <Stars t={t} count={2200} radius={150} />
        {c < 0.99 ? (
          <group rotation={[0.3, t * 0.6 + c * 4, 0.2 + c * 2]} scale={[1, 1, 1]}>
            <Phone length={L} glow={1 + 3 * c} />
          </group>
        ) : null}
        <Glow position={[0, 0, 0]} size={2 + 10 * c * (1 - hole) + 14 * flash} color="#fff3d6" opacity={Math.min(1, c * 1.5) * (1 - hole * 0.7)} depthTest={false} />
        <group rotation={[0.38, 0, 0.08]}>
          <Particles count={9000} t={t} compute={disk} size={0.06} color="#ffb05a" seed={21} softness={0.6} additive maxPixelSize={6} />
        </group>
        <mesh scale={hole}>
          <sphereGeometry args={[1.2, 32, 24]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
        <Glow position={[0, 0, 0]} size={3.6 * hole} color="#ffcf8a" opacity={0.55 * hole} />
        <mesh scale={hole} rotation={[Math.PI / 2 - 0.25, 0, 0]}>
          <torusGeometry args={[1.32, 0.03, 8, 64]} />
          <meshBasicMaterial color={new THREE.Color("#ffe2b0")} toneMapped={false} />
        </mesh>
      </SceneCanvas>
      <AbsoluteFill style={{ background: "#fff6e0", opacity: clamp01(flash * 0.8), pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export default BlackHole;
