import React from "react";
import { AbsoluteFill } from "remotion";
import { mergeCamera } from "../../three/camera";
import { useSceneTime } from "../../three/hooks";
import { TextPanel } from "../../three/text";
import type { SceneComponentProps } from "../../types";
import { BrightCanvas, Phone } from "./kit";

/** Close-up: the phone lying on a kitchen scale reading "200 g". props: { reading?: string } */
const ScaleCloseUp: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const reading = (props.reading as string) ?? "200 g";
  const settle = Math.max(0, 1 - t * 3) * Math.sin(t * 40) * 0.004;
  const cam = mergeCamera({ type: "pushIn", from: [0.22, 0.42, 0.42], to: [0.16, 0.34, 0.32], target: [0, 0.03, 0.01], fov: 40, ease: "out" }, camera);
  return (
    <AbsoluteFill>
      <BrightCanvas durationInFrames={durationInFrames} camera={cam} fog={[5, 30]}>
        {/* kitchen: worktop + pastel wall */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[6, 6]} />
          <meshStandardMaterial color="#f7e3c4" roughness={0.6} />
        </mesh>
        <mesh position={[0, 1, -0.6]}>
          <planeGeometry args={[6, 3]} />
          <meshStandardMaterial color="#b8f2e6" roughness={1} />
        </mesh>
        {/* scale */}
        <mesh position={[0, 0.018, 0]}>
          <boxGeometry args={[0.24, 0.036, 0.26]} />
          <meshStandardMaterial color="#ffffff" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.0375, 0]}>
          <boxGeometry args={[0.2, 0.004, 0.2]} />
          <meshStandardMaterial color="#d9dde3" metalness={0.6} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.02, 0.131]}>
          <boxGeometry args={[0.12, 0.026, 0.002]} />
          <meshBasicMaterial color="#1d2b1d" />
        </mesh>
        <TextPanel card={{ lines: [reading], width: 512, height: 128, bg: "#b7ff9a", fg: "#10230f", size: 96, weight: 900 }} height={0.022} position={[0, 0.02, 0.1325]} />
        <group position={[0, 0.045 + settle, 0]} rotation={[-Math.PI / 2, 0, 0.35]}>
          <Phone length={0.147} />
        </group>
      </BrightCanvas>
    </AbsoluteFill>
  );
};

export default ScaleCloseUp;
