import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import { mergeCamera } from "../../three/camera";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { smoothstep } from "../../three/random";
import type { SceneComponentProps } from "../../types";
import { BrightCanvas, BrightSky, Dude, Ground, Phone, shake } from "./kit";

/** Hip close-up: the phone grows out of a jeans pocket and rips it apart. props: { ripAt?: number } */
const PocketRip: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const ripAt = (props.ripAt as number) ?? 1.0;
  const L = 0.15 * 2 ** (t / 1.2); // visual growth
  const ripped = t >= ripAt;
  const shreds = useCallback<ParticleFn>(
    (_i, time, out, r) => {
      const dt = time - ripAt - r[0] * 0.15;
      if (dt < 0) {
        out[4] = 0;
        return;
      }
      const a = r[1] * Math.PI * 2;
      const v = 0.6 + r[2] * 1.4;
      out[0] = 0.12 + Math.cos(a) * v * dt;
      out[1] = 0.88 + (1.2 + r[3]) * dt - 4.9 * dt * dt;
      out[2] = 0.14 + Math.abs(Math.sin(a)) * v * dt;
      out[3] = 0.6 + r[4];
      out[4] = out[1] > 0 ? 1 : 0;
    },
    [ripAt],
  );
  const cam = mergeCamera({ type: "pushIn", from: [0.55, 1.05, 1.25], to: [0.5, 1.1, 1.45], target: [0.1, 0.95, 0], fov: 42, ease: "out" }, camera);
  const flap = smoothstep(ripAt, ripAt + 0.3, t);
  return (
    <AbsoluteFill style={{ transform: shake(t, ripAt, 14, 6) }}>
      <BrightCanvas durationInFrames={durationInFrames} camera={cam}>
        <BrightSky t={t} />
        <Ground />
        <Dude p={[0, 0, 0]} shirt="#ff6b6b" pants="#3d6fb5" armR={[0.1, 0.25]} />
        {/* front pocket patch (tears off) */}
        <mesh position={[0.11 + flap * 0.25, 0.92 - flap * 0.5, 0.093 + flap * 0.3]} rotation={[flap * 2, flap * 1.5, 0]}>
          <planeGeometry args={[0.14, 0.15]} />
          <meshStandardMaterial color="#2f5d99" side={2} />
        </mesh>
        {/* the phone, growing out of the pocket */}
        <group position={[0.11, 0.86 + L * 0.42, 0.11 + (ripped ? L * 0.05 : 0)]} rotation={[ripped ? -0.25 : -0.08, 0, ripped ? 0.15 : 0]}>
          <Phone length={L} />
        </group>
        <Particles count={160} t={t} compute={shreds} size={0.035} color="#3d6fb5" seed={4} softness={0.2} maxPixelSize={14} />
      </BrightCanvas>
    </AbsoluteFill>
  );
};

export default PocketRip;
