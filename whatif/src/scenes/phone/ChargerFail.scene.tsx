import React from "react";
import { AbsoluteFill } from "remotion";
import { mergeCamera } from "../../three/camera";
import { useSceneTime } from "../../three/hooks";
import type { SceneComponentProps } from "../../types";
import * as THREE from "three";
import type { Vec3 } from "../../types";
import { BrightCanvas, BrightSky, Dude, Ground, Phone, PHONE_D, Tree } from "./kit";

/** A thin white cable between two points. */
const Cable: React.FC<{ a: Vec3; b: Vec3 }> = ({ a, b }) => {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const mid = A.clone().add(B).multiplyScalar(0.5);
  const dir = B.clone().sub(A);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return (
    <mesh position={mid} quaternion={q}>
      <cylinderGeometry args={[0.007, 0.007, dir.length(), 6]} />
      <meshStandardMaterial color="#ffffff" />
    </mesh>
  );
};

/** The phone (~0.75 m) leans on a garden wall; a tiny charger cable vs a huge port. */
const ChargerFail: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const L = (props.length as number) ?? 0.8;
  const poke = Math.max(0, Math.sin(t * 5)) * 0.04;
  const cam = mergeCamera({ type: "pushIn", from: [2.6, 1.35, 3.4], to: [2.2, 1.15, 2.8], target: [0.35, 0.6, 0], fov: 44, ease: "inOut" }, camera);
  return (
    <AbsoluteFill>
      <BrightCanvas durationInFrames={durationInFrames} camera={cam}>
        <BrightSky t={t} />
        <Ground road={false} />
        <mesh position={[0, 0.45, -0.35]}>
          <boxGeometry args={[4, 0.9, 0.3]} />
          <meshStandardMaterial color="#f4a261" flatShading />
        </mesh>
        <Tree p={[-2.4, 0, -1.4]} />
        {/* the phone leaning back on the wall, screen to camera */}
        <group position={[0, 0.0, -0.1]} rotation={[-0.18, 0.3, 0]}>
          <Phone length={L} p={[0, L / 2, 0]} />
          {/* the (huge) charging port on the bottom edge */}
          <mesh position={[0, 0.006, PHONE_D * L * 0.1]}>
            <boxGeometry args={[L * 0.12, 0.02, L * PHONE_D * 0.55]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
        </group>
        {/* the person and their tiny cable */}
        <Dude p={[0.85, 0, 0.45]} ry={-1.2} shirt="#ffd166" armR={[-0.9, 0.15]} armL={[0.1, -0.1]} headTilt={0.45} />
        <Cable a={[0.62, 0.86, 0.5]} b={[0.12 - poke, 0.08, 0.06]} />
        <mesh position={[0.1 - poke, 0.07, 0.05]} rotation={[0, 0.3, 0.9]}>
          <boxGeometry args={[0.025, 0.06, 0.018]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </BrightCanvas>
    </AbsoluteFill>
  );
};

export default ChargerFail;
