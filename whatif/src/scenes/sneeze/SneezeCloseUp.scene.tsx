import React, { useCallback } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { mergeCamera } from "../../three/camera";
import { ParticleFn, Particles } from "../../three/Particles";
import { SceneCanvas } from "../../three/SceneCanvas";
import type { SceneComponentProps } from "../../types";

/** BODY scale: one head, one sneeze spray in close-up. Spray is mid-flight on frame 0. */

const MOUTH: [number, number, number] = [0.92, -0.32, 0];
const PRE_ROLL = 0.45; // seconds of sneeze that already happened before frame 0

const Head: React.FC<{ t: number }> = ({ t }) => {
  // Recoil: head snapped forward just before frame 0 and eases back.
  const recoil = 0.32 * Math.exp(-(t + PRE_ROLL) * 2.2) * Math.cos((t + PRE_ROLL) * 3);
  const skin = "#e9b48f";
  const mat = (c: string) => <meshStandardMaterial color={c} flatShading roughness={0.75} />;
  return (
    <group rotation={[0, 0, -recoil]} position={[0.1 * recoil, -0.15 * recoil, 0]}>
      <mesh scale={[0.95, 1.12, 0.88]}>
        <icosahedronGeometry args={[1, 2]} />
        {mat(skin)}
      </mesh>
      {/* hair cap */}
      <mesh position={[-0.18, 0.32, 0]} scale={[0.92, 0.88, 0.92]}>
        <icosahedronGeometry args={[1, 1]} />
        {mat("#3b2a20")}
      </mesh>
      {/* nose */}
      <mesh position={[0.95, -0.02, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.17, 0.42, 5]} />
        {mat("#e2a47e")}
      </mesh>
      {/* squeezed-shut eyes + brows */}
      {[-0.32, 0.32].map((z) => (
        <group key={z}>
          <mesh position={[0.8, 0.24, z]} rotation={[0, z > 0 ? -0.4 : 0.4, 0.15]}>
            <boxGeometry args={[0.06, 0.035, 0.24]} />
            {mat("#2a1a14")}
          </mesh>
          <mesh position={[0.78, 0.42, z]} rotation={[0, z > 0 ? -0.4 : 0.4, -0.2]}>
            <boxGeometry args={[0.07, 0.06, 0.28]} />
            {mat("#3b2a20")}
          </mesh>
        </group>
      ))}
      {/* open mouth */}
      <mesh position={[0.84, -0.4, 0]} scale={[0.12, 0.16, 0.3]}>
        <icosahedronGeometry args={[1, 1]} />
        {mat("#5a1f1f")}
      </mesh>
      {/* ear */}
      <mesh position={[-0.05, 0.02, 0.86]} scale={[0.22, 0.32, 0.1]}>
        <icosahedronGeometry args={[1, 0]} />
        {mat(skin)}
      </mesh>
      {/* neck + shoulders */}
      <mesh position={[-0.12, -1.35, 0]}>
        <cylinderGeometry args={[0.36, 0.42, 0.9, 7]} />
        {mat(skin)}
      </mesh>
      <mesh position={[-0.3, -2.45, 0]}>
        <boxGeometry args={[1.3, 1.5, 2.6]} />
        {mat("#3d5a80")}
      </mesh>
    </group>
  );
};

const SneezeCloseUp: React.FC<SceneComponentProps> = ({ durationInFrames, camera }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const droplets = useCallback<ParticleFn>((_i, time, out, r) => {
    const te = -PRE_ROLL + r[0] * 0.75;
    const dt = time - te;
    if (dt < 0) {
      out[4] = 0;
      return;
    }
    const theta = Math.pow(r[1], 0.7) * 0.5;
    const phi = r[2] * Math.PI * 2;
    const dx = Math.cos(theta);
    const dy = Math.sin(theta) * Math.cos(phi) - 0.1;
    const dz = Math.sin(theta) * Math.sin(phi);
    const v0 = 3.5 + r[3] * 7;
    const k = 1.4 + r[4] * 1.8;
    const d = (v0 * (1 - Math.exp(-k * dt))) / k;
    const big = 0.35 + Math.pow(r[5], 4) * 2.4;
    const fall = 0.12 * big * Math.pow(Math.max(0, dt - 0.3), 2);
    out[0] = MOUTH[0] + dx * d + Math.sin(dt * 2 + r[6] * 6) * 0.12 * dt;
    out[1] = MOUTH[1] + dy * d - fall + Math.cos(dt * 1.7 + r[7] * 6) * 0.08 * dt;
    out[2] = MOUTH[2] + dz * d;
    out[3] = big;
    out[4] = Math.min(1, dt * 12) * (0.55 + 0.45 * Math.exp(-dt * 0.5));
  }, []);

  const cloud = useCallback<ParticleFn>((_i, time, out, r) => {
    const dt = time + PRE_ROLL - r[0] * 0.4;
    if (dt < 0) {
      out[4] = 0;
      return;
    }
    const reach = 5 * (1 - Math.exp(-dt * 0.7));
    const along = reach * (0.15 + 0.85 * r[1]);
    const spread = 0.2 + along * 0.32;
    out[0] = MOUTH[0] + along + Math.sin(time * 0.8 + r[2] * 6) * 0.2;
    out[1] = MOUTH[1] + (r[3] - 0.5) * spread + Math.sin(time + r[4] * 6) * 0.1 + along * 0.04;
    out[2] = MOUTH[2] + (r[5] - 0.5) * spread * 1.4;
    out[3] = 0.6 + spread * (0.8 + r[6]);
    out[4] = 0.5 * Math.min(1, dt * 2);
  }, []);

  const dust = useCallback<ParticleFn>((_i, time, out, r) => {
    out[0] = -3 + r[0] * 12 + Math.sin(time * 0.3 + r[3] * 6) * 0.2;
    out[1] = -3 + r[1] * 6 + time * 0.05 * (r[4] - 0.3);
    out[2] = -5 + r[2] * 10;
    out[3] = 0.5 + r[5];
    out[4] = 0.35;
  }, []);

  const cam = mergeCamera(
    { type: "pushIn", from: [2.6, 1.2, 10.2], to: [2.2, 0.6, 7.8], target: [1.25, -0.45, 0], targetTo: [1.55, -0.5, 0], fov: 46 },
    camera,
  );

  return (
    <AbsoluteFill>
      <SceneCanvas
        durationInFrames={durationInFrames}
        camera={cam}
        background="#0e1a2b"
        fog={["#0e1a2b", 6, 22]}
        sunPosition={[5, 6, 6]}
        sunIntensity={2}
      >
        <pointLight position={[3, 1, -3]} intensity={18} color="#7fe3ff" distance={12} />
        <Head t={t} />
        <Particles count={600} t={t} compute={dust} size={0.03} color="#9fb6d6" seed={9} softness={0.6} />
        <Particles count={70} t={t} compute={cloud} size={1} color="#cfe8ff" seed={4} softness={1} opacity={0.16} maxPixelSize={900} />
        <Particles count={8000} t={t} compute={droplets} size={0.032} color="#e6f6ff" seed={7} softness={0.2} maxPixelSize={22} />
      </SceneCanvas>
    </AbsoluteFill>
  );
};

export default SneezeCloseUp;
