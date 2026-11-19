import React from "react";
import { AbsoluteFill } from "remotion";
import { mergeCamera } from "../../three/camera";
import { useSceneTime } from "../../three/hooks";
import type { SceneComponentProps } from "../../types";
import { BrightCanvas, BrightSky, Building, Dude, Ground, HOUSE_COLORS, Phone } from "./kit";

/** TV-sized phone (1.22 m) on the footpath; scrolling takes the whole arm. A fridge for scale. */
const TvScroll: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const L = (props.length as number) ?? 1.22;
  const swipe = Math.sin(t * 4.2);
  const cam = mergeCamera({ type: "pushIn", from: [1.5, 1.45, 6.4], to: [1.2, 1.4, 5.5], target: [-0.15, 1.0, 0], fov: 46, ease: "inOut" }, camera);
  return (
    <AbsoluteFill>
      <BrightCanvas durationInFrames={durationInFrames} camera={cam}>
        <BrightSky t={t} />
        <Ground />
        {Array.from({ length: 6 }, (_, i) => (
          <Building key={i} p={[-18 + i * 7, 0, -13]} w={6} d={6} floors={2 + (i % 2)} color={HOUSE_COLORS[(i + 3) % HOUSE_COLORS.length]} pitched={i % 2 === 1} />
        ))}
        <group position={[0.15, 0, 0]} rotation={[-0.08, -0.25, 0]}>
          <Phone length={L} p={[0, L / 2 + 0.05, 0]} />
        </group>
        {/* fridge for scale (113 kg) */}
        <group position={[-1.15, 0, -0.2]}>
          <mesh position={[0, 0.9, 0]}>
            <boxGeometry args={[0.7, 1.8, 0.7]} />
            <meshStandardMaterial color="#f8f9fa" roughness={0.35} />
          </mesh>
          <mesh position={[0.22, 1.2, 0.36]}>
            <boxGeometry args={[0.04, 0.4, 0.04]} />
            <meshStandardMaterial color="#adb5bd" metalness={0.6} />
          </mesh>
          <mesh position={[0, 1.35, 0.351]}>
            <boxGeometry args={[0.68, 0.01, 0.01]} />
            <meshStandardMaterial color="#ced4da" />
          </mesh>
        </group>
        <Dude p={[0.95, 0, 0.55]} ry={-0.9} shirt="#06d6a0" armR={[-1.5 + swipe * 0.9, 0.3 + swipe * 0.4]} armL={[0.05, -0.12]} headTilt={-0.1} />
      </BrightCanvas>
    </AbsoluteFill>
  );
};

export default TvScroll;
