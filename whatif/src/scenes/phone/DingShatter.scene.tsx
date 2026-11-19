import React, { useCallback, useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { mergeCamera } from "../../three/camera";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { smoothstep } from "../../three/random";
import type { SceneComponentProps } from "../../types";
import { BrightCanvas, BrightSky, Building, Ground, HOUSE_COLORS, Phone, shake } from "./kit";

/** A notification arrives; the "ding" sound-wave shatters windows all the way down the street. */
const DingShatter: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const dingAt = (props.dingAt as number) ?? 0.6;
  const L = (props.length as number) ?? 11;
  const houses = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        side: i % 2 ? 1 : -1,
        z: -6 - Math.floor(i / 2) * 9,
        floors: 2 + (i % 3),
        color: HOUSE_COLORS[i % HOUSE_COLORS.length],
      })),
    [],
  );
  const PH = [0, 0, -12];
  // shards burst from each house when the wave front reaches it
  const glass = useCallback<ParticleFn>(
    (i, time, out, r) => {
      const h = houses[i % houses.length];
      const dist = Math.hypot(h.side * 9, h.z - PH[2]);
      const at = dingAt + dist / 120;
      const dt = time - at - r[0] * 0.05;
      if (dt < 0) {
        out[4] = 0;
        return;
      }
      const y0 = 1.5 + r[1] * h.floors * 3;
      out[0] = h.side * (9 - 3.2) - h.side * (2 + r[2] * 4) * dt;
      out[1] = y0 + (1 + r[3] * 2) * dt - 6 * dt * dt;
      out[2] = h.z + (r[4] - 0.5) * 5 + (r[5] - 0.5) * 2 * dt;
      out[3] = 0.5 + r[6];
      out[4] = out[1] > 0 ? 1 : 0;
    },
    [houses, dingAt],
  );
  const rings = useCallback<ParticleFn>(
    (i, time, out) => {
      const ring = i % 3;
      const a = (Math.floor(i / 3) / 300) * Math.PI * 2;
      const dt = time - dingAt - ring * 0.12;
      if (dt < 0) {
        out[4] = 0;
        return;
      }
      const rad = 3 + dt * 120;
      out[0] = PH[0] + Math.cos(a) * rad;
      out[1] = L * 0.75 + Math.sin(a) * rad * 0.35;
      out[2] = PH[2] + Math.sin(a) * rad;
      out[3] = 1;
      out[4] = Math.max(0, 1 - dt / 0.9);
    },
    [dingAt, L],
  );
  const cam = mergeCamera({ type: "pushIn", from: [4, 3.5, 30], to: [3.5, 4.5, 23], target: [0, 8, -28], fov: 52, ease: "out" }, camera);
  return (
    <AbsoluteFill style={{ transform: shake(t, dingAt, 20, 4) }}>
      <BrightCanvas durationInFrames={durationInFrames} camera={cam}>
        <BrightSky t={t} />
        <Ground road={false} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -40]}>
          <planeGeometry args={[9, 200]} />
          <meshStandardMaterial color="#6d7080" />
        </mesh>
        {houses.map((h, i) => {
          const dist = Math.hypot(h.side * 9, h.z - PH[2]);
          const broken = smoothstep(dingAt + dist / 120, dingAt + dist / 120 + 0.05, t);
          return (
            <group key={i}>
              <Building p={[h.side * 9, 0, h.z]} w={6} d={7} floors={h.floors} color={h.color} pitched={i % 4 < 2} ry={h.side * Math.PI / 2} />
              {broken > 0 ? (
                <mesh position={[h.side * 5.9, 3, h.z]} rotation={[0, -h.side * Math.PI / 2, 0]}>
                  <planeGeometry args={[6.5, 5]} />
                  <meshBasicMaterial color="#3a4458" transparent opacity={0.35 * broken} />
                </mesh>
              ) : null}
            </group>
          );
        })}
        <group position={[PH[0], 0, PH[2]]} rotation={[0, 0.25, 0]}>
          <Phone length={L} p={[0, L / 2, 0]} mode={t > dingAt - 0.1 ? "notify" : "apps"} />
        </group>
        <Particles count={900} t={t} compute={rings} size={0.6} color="#ffffff" seed={7} softness={0.4} opacity={0.8} additive maxPixelSize={10} />
        <Particles count={3200} t={t} compute={glass} size={0.35} color="#d6f1ff" seed={8} softness={0.2} maxPixelSize={10} />
      </BrightCanvas>
    </AbsoluteFill>
  );
};

export default DingShatter;
