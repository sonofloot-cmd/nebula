import React from "react";
import { AbsoluteFill } from "remotion";
import { mergeCamera } from "../../three/camera";
import { DAY, Globe, Stars } from "../../three/Globe";
import { useSceneTime } from "../../three/hooks";
import { SceneCanvas } from "../../three/SceneCanvas";
import type { SceneComponentProps } from "../../types";
import { Phone } from "./kit";

/**
 * Space: the phone (45,500 km long, 3.6× Earth's diameter) floating beside the Earth.
 * Units: 1 = 6,371 km (Earth radius). props: { length? (in Earth radii) }
 */
const SpaceEarth: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const L = (props.length as number) ?? 45500 / 6371;
  const cam = mergeCamera({ type: "pullBack", from: [-1.5, 0.6, 9], to: [-1.0, 0.8, 13], target: [1.0, 0.2, 0], fov: 45, ease: "out" }, camera);
  return (
    <AbsoluteFill style={{ background: "#020414" }}>
      <SceneCanvas durationInFrames={durationInFrames} camera={cam} background="#020414" sky="#ffffff" ground="#0a0f22" sunPosition={[-20, 10, 15]} sunIntensity={2.4}>
        <Stars t={t} count={2500} radius={200} />
        <group position={[-1.0, -1.1, 2.2]} rotation={[0.3, t * 0.1, 0]}>
          <Globe radius={1} detail={40} palette={DAY} atmosphereOpacity={0.25} />
        </group>
        <group position={[4.2, 0.6, -3]} rotation={[0.15, -0.5 + t * 0.03, 0.12]}>
          <Phone length={L} />
        </group>
      </SceneCanvas>
    </AbsoluteFill>
  );
};

export default SpaceEarth;
