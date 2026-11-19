import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { mergeCamera } from "../../three/camera";
import { Glow } from "../../three/glow";
import { useSceneTime } from "../../three/hooks";
import { mulberry32 } from "../../three/random";
import type { SceneComponentProps } from "../../types";
import { BrightCanvas, BrightSky, Building, Ground, HOUSE_COLORS, Phone, ToyCar } from "./kit";

/** Evacuation: a jammed highway leaving town; a phone kilometres tall behind the city shows "1% BATTERY". */
const HighwayJam: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const L = (props.length as number) ?? 15000;
  const cars = useMemo(() => {
    const r = mulberry32(14);
    const out: Array<{ x: number; z: number; c: string }> = [];
    for (let lane = 0; lane < 4; lane++)
      for (let k = 0; k < 22; k++) out.push({ x: -7.5 + lane * 5 + (r() - 0.5) * 0.6, z: 40 - k * 6.2 - r() * 1.5, c: HOUSE_COLORS[Math.floor(r() * HOUSE_COLORS.length)] });
    return out;
  }, []);
  const city = useMemo(() => {
    const r = mulberry32(15);
    return Array.from({ length: 40 }, (_, i) => ({ x: -500 + (i % 20) * 52, z: -900 - Math.floor(i / 20) * 70, f: 6 + Math.floor(r() * 25), c: HOUSE_COLORS[i % HOUSE_COLORS.length] }));
  }, []);
  const crawl = t * 1.2;
  const cam = mergeCamera({ type: "pushIn", from: [12, 42, 92], to: [10, 40, 78], target: [9.6, 142, -1125], fov: 60, ease: "inOut" }, camera);
  const blink = 0.75 + 0.25 * Math.round((Math.sin(t * 7) + 1) / 2);
  return (
    <AbsoluteFill>
      <BrightCanvas durationInFrames={durationInFrames} camera={cam} fog={[25000, 140000]}>
        <BrightSky t={t} scale={50} />
        <Ground size={30000} road={false} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -400]}>
          <planeGeometry args={[22, 1000]} />
          <meshStandardMaterial color="#6d7080" />
        </mesh>
        {cars.map((c, i) => (
          <ToyCar key={i} p={[c.x, 0, c.z + crawl]} ry={Math.PI / 2} color={c.c} scale={1} />
        ))}
        {city.map((b, i) => (
          <Building key={i} p={[b.x, 0, b.z]} w={40} d={40} floors={b.f} color={b.c} />
        ))}
        <group position={[0, 0, -30000]}>
          <Phone length={L} p={[0, L / 2 - 300, 0]} mode="battery" glow={blink} />
        </group>
        <Glow position={[0, 7000, -29800]} size={22000} color="#ff4d4d" opacity={0.22 * blink} />
      </BrightCanvas>
    </AbsoluteFill>
  );
};

export default HighwayJam;
