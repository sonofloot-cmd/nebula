import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { mergeCamera } from "../../three/camera";
import { Glow } from "../../three/glow";
import { Stars } from "../../three/Globe";
import { useSceneTime } from "../../three/hooks";
import { mulberry32 } from "../../three/random";
import type { SceneComponentProps } from "../../types";
import { BrightCanvas, BrightSky, Building, Ground, HOUSE_COLORS, Phone } from "./kit";

/** Night: a 30 m phone beside a 10-storey building; its screen lights up the whole city. */
const NightTower: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const L = (props.length as number) ?? 30;
  const city = useMemo(() => {
    const r = mulberry32(3);
    return Array.from({ length: 40 }, (_, i) => ({
      x: -120 + (i % 10) * 26 + r() * 6,
      z: -40 - Math.floor(i / 10) * 30 - r() * 8,
      f: 3 + Math.floor(r() * 9),
      c: HOUSE_COLORS[i % HOUSE_COLORS.length],
    }));
  }, []);
  const on = Math.min(1, t / 0.4);
  const cam = mergeCamera({ type: "pushIn", from: [40, 5, 88], to: [34, 7, 76], target: [0, 15, 0], fov: 48, ease: "inOut" }, camera);
  return (
    <AbsoluteFill>
      <BrightCanvas durationInFrames={durationInFrames} camera={cam} night fog={[150, 700]}>
        <BrightSky night={1} />
        <Stars t={t} count={1200} radius={700} />
        <Ground />
        {city.map((b, i) => (
          <Building key={i} p={[b.x, 0, b.z]} w={14} d={14} floors={b.f} color={b.c} lit={0.9} />
        ))}
        {/* the 10-storey building (30 m) right beside the phone */}
        <Building p={[-9, 0, -2]} w={12} d={12} floors={10} color="#a0c4ff" lit={1.1} />
        <group position={[6, 0, 0]} rotation={[0, -0.15, 0]}>
          <Phone length={L} p={[0, L / 2, 0]} mode="bright" glow={1.1} />
        </group>
        {/* screen light flooding the city */}
        <Glow position={[6, 16, 3]} size={62 * on} color="#cfe8ff" opacity={0.4} />
        <pointLight position={[6, 16, 14]} intensity={9 * on} distance={260} decay={0.9} color="#dff1ff" />
      </BrightCanvas>
    </AbsoluteFill>
  );
};

export default NightTower;
