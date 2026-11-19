import React, { useCallback } from "react";
import { AbsoluteFill, Easing } from "remotion";
import { mergeCamera } from "../../three/camera";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { clamp01, smoothstep } from "../../three/random";
import type { SceneComponentProps } from "../../types";
import { BrightCanvas, BrightSky, Building, Ground, HOUSE_COLORS, Phone, PHONE_D, shake, ToyCar } from "./kit";

/** The phone (~5 m) tips over backwards onto a small car: pancake, dust, one crack. props: { fallAt?, length? } */
const CarPancake: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const fallAt = (props.fallAt as number) ?? 0.35;
  const L = (props.length as number) ?? 5;
  const f = Easing.in(Easing.quad)(clamp01((t - fallAt) / 0.55));
  const hit = fallAt + 0.55;
  const bounce = t > hit ? Math.exp(-(t - hit) * 7) * Math.abs(Math.sin((t - hit) * 18)) * 0.06 : 0;
  const ang = -f * (Math.PI / 2 - 0.08) + bounce; // tip backwards (screen ends up facing the sky)
  const squash = smoothstep(hit - 0.04, hit + 0.12, t);
  const dust = useCallback<ParticleFn>(
    (_i, time, out, r) => {
      const dt = time - hit;
      if (dt < 0) {
        out[4] = 0;
        return;
      }
      const a = r[0] * Math.PI * 2;
      const v = 2 + r[1] * 5;
      out[0] = 0.4 + Math.cos(a) * v * (1 - Math.exp(-dt * 3)) / 3 * 3;
      out[1] = 0.2 + r[2] * 1.4 * (1 - Math.exp(-dt * 4));
      out[2] = -4 + Math.sin(a) * v * (1 - Math.exp(-dt * 3));
      out[3] = 1 + dt * 2;
      out[4] = Math.max(0, 0.9 - dt * 0.5);
    },
    [hit],
  );
  const cam = mergeCamera({ type: "crane", from: [7.5, 5.2, 7.5], to: [6.5, 6, 6.2], target: [0.2, 0.8, -3.6], fov: 46, ease: "out" }, camera);
  return (
    <AbsoluteFill style={{ transform: shake(t, hit, 26, 5) }}>
      <BrightCanvas durationInFrames={durationInFrames} camera={cam}>
        <BrightSky t={t} />
        <Ground />
        {Array.from({ length: 6 }, (_, i) => (
          <Building key={i} p={[-16 + i * 7, 0, -13]} w={6} d={6} floors={2 + (i % 2)} color={HOUSE_COLORS[(i + 5) % HOUSE_COLORS.length]} pitched={i % 2 === 0} />
        ))}
        <ToyCar p={[0.4, 0, -4]} color="#ff8fab" squash={squash} />
        {/* pivot on the phone's bottom edge, beside the car; it falls toward -X over the car */}
        <group position={[2.7, 0, -4]} rotation={[0, Math.PI / 2, 0]}>
          <group rotation={[ang, 0, 0]}>
            <Phone length={L} p={[0, L / 2, -L * PHONE_D * 0.5]} crack={smoothstep(hit, hit + 0.1, t)} />
          </group>
        </group>
        <Particles count={500} t={t} compute={dust} size={0.9} color="#e9dcc6" seed={6} softness={1} opacity={0.5} maxPixelSize={90} />
      </BrightCanvas>
    </AbsoluteFill>
  );
};

export default CarPancake;
