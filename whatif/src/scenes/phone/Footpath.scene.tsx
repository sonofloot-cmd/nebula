import React from "react";
import { AbsoluteFill } from "remotion";
import { mergeCamera } from "../../three/camera";
import { useSceneTime } from "../../three/hooks";
import type { SceneComponentProps } from "../../types";
import { BrightCanvas, BrightSky, Building, Dude, Ground, HOUSE_COLORS, Phone, Tree } from "./kit";

/**
 * HOOK / LOOP: someone on a sunny footpath, head down, scrolling a normal phone.
 * The same shot opens and closes the video so it loops. props: { pulse?: boolean }
 */
const Footpath: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const pulse = props.pulse ? 1 + 0.06 * Math.max(0, Math.sin(t * Math.PI * 1.2)) ** 6 : 1;
  const thumb = Math.sin(t * 7) * 0.04;
  const cam = mergeCamera({ type: "pushIn", from: [1.4, 1.55, 3.6], to: [1.1, 1.5, 2.9], target: [0.05, 1.25, 0], fov: 42, ease: "inOut" }, camera);
  return (
    <AbsoluteFill>
      <BrightCanvas durationInFrames={durationInFrames} camera={cam}>
        <BrightSky t={t} />
        <Ground />
        {Array.from({ length: 9 }, (_, i) => (
          <Building key={i} p={[-24 + i * 7, 0, -13]} w={6} d={6} floors={2 + (i % 3)} color={HOUSE_COLORS[i % HOUSE_COLORS.length]} pitched={i % 2 === 0} />
        ))}
        <Tree p={[-3.5, 0, 2.5]} s={0.9} />
        <Tree p={[4.5, 0, 2.2]} s={1.1} />
        <Tree p={[9, 0, -8.5]} />
        <Dude p={[0, 0, 0]} ry={0.35} shirt="#ff6b6b" armR={[-1.25 + thumb, 0.35]} armL={[-1.1, -0.25]} headTilt={0.45} />
        <group position={[0.06, 1.13, 0.38]} rotation={[-0.75, 0.35, 0]}>
          <Phone length={0.147 * pulse} />
        </group>
      </BrightCanvas>
    </AbsoluteFill>
  );
};

export default Footpath;
