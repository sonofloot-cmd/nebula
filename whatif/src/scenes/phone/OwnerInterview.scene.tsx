import React from "react";
import { AbsoluteFill, spring, useVideoConfig } from "remotion";
import { SANS } from "../../fonts";
import { mergeCamera } from "../../three/camera";
import { useSceneTime } from "../../three/hooks";
import type { SceneComponentProps } from "../../types";
import { BrightCanvas, Dude } from "./kit";
import { NewsCity } from "./NewsBulletin.scene";

/** TV interview with the owner: close-up, news mic, lower third "THE OWNER". */
const OwnerInterview: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const { fps } = useVideoConfig();
  const talk = t > 0.2 && t < (props.talkUntil as number ?? 2.4) ? Math.abs(Math.sin(t * 17)) * 0.9 : 0;
  const lt = spring({ frame: Math.round((t - 0.15) * fps), fps, config: { damping: 14 } });
  const cam = mergeCamera({ type: "pushIn", from: [0.15, 1.7, 2.9], to: [0.1, 1.7, 2.4], target: [0, 1.55, 0], fov: 40, ease: "out" }, camera);
  return (
    <AbsoluteFill>
      <BrightCanvas durationInFrames={durationInFrames} camera={cam} fog={[600, 4000]}>
        <NewsCity t={t} L={(props.length as number) ?? 1500} />
        <Dude p={[0, 0, 0]} shirt="#ff6b6b" armR={[-0.15, 0.1]} armL={[0, -0.1]} headTilt={0.05 - talk * 0.04} mouth={talk} />
        {/* the reporter's mic */}
        <group position={[0.18, 1.62, 0.32]} rotation={[0.9, 0, 0.3]}>
          <mesh>
            <cylinderGeometry args={[0.02, 0.016, 0.25, 8]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh position={[0, 0.15, 0]}>
            <sphereGeometry args={[0.04, 10, 8]} />
            <meshStandardMaterial color="#555" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.07, 0]}>
            <boxGeometry args={[0.07, 0.05, 0.07]} />
            <meshStandardMaterial color="#e0182d" />
          </mesh>
        </group>
      </BrightCanvas>
      <div style={{ position: "absolute", left: 60, top: 1000, transform: `translateX(${(1 - lt) * -900}px)`, fontFamily: SANS }}>
        <div style={{ background: "#ffe14d", color: "#111", fontWeight: 900, fontSize: 70, padding: "10px 30px", display: "inline-block" }}>THE OWNER</div>
        <div style={{ background: "#0b1d3a", color: "#fff", fontWeight: 700, fontSize: 36, padding: "10px 30px", marginTop: 0, display: "inline-block" }}>Phone bought: last week</div>
      </div>
      <div style={{ position: "absolute", right: 60, top: 470, background: "#e0182d", color: "#fff", fontFamily: SANS, fontWeight: 900, fontSize: 40, padding: "8px 20px", borderRadius: 8 }}>● LIVE</div>
    </AbsoluteFill>
  );
};

export default OwnerInterview;
