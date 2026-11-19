import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { mergeCamera } from "../../three/camera";
import { Glow } from "../../three/glow";
import { useSceneTime } from "../../three/hooks";
import { Iss } from "../../three/iss";
import { smoothstep } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import { TextPanel } from "../../three/text";
import type { SceneComponentProps } from "../../types";

/**
 * SCALE: the station sinks down over a floodlit American football field at night, laid
 * end to end along it (109 m vs 109.7 m incl. end zones). World units = metres.
 * Field length runs along Z (screen vertical), so the comparison fills a portrait frame.
 * No team names or logos: plain end zones, generic yard numbers.
 */

const YD = 0.9144;
const LEN = 120 * YD; // 109.7 m incl. end zones
const WID = 53.33 * YD; // 48.8 m

const Field: React.FC = () => {
  const stripes = useMemo(() => Array.from({ length: 10 }, (_, i) => i), []);
  const lines = useMemo(() => Array.from({ length: 21 }, (_, i) => -50 + i * 5), []);
  return (
    <group>
      {/* surround */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[110, 160]} />
        <meshStandardMaterial color="#1d4a24" roughness={1} />
      </mesh>
      {stripes.map((i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (-50 + i * 10 + 5) * YD]}>
          <planeGeometry args={[WID, 10 * YD]} />
          <meshStandardMaterial color={i % 2 ? "#2f7a35" : "#38893d"} roughness={0.95} />
        </mesh>
      ))}
      {/* end zones */}
      {[-1, 1].map((s) => (
        <mesh key={s} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, s * 55 * YD]}>
          <planeGeometry args={[WID, 10 * YD]} />
          <meshStandardMaterial color={s < 0 ? "#7a1f2b" : "#1f3d7a"} roughness={0.95} />
        </mesh>
      ))}
      {/* yard lines + sidelines */}
      {lines.map((y) => (
        <mesh key={y} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, y * YD]}>
          <planeGeometry args={[WID, y % 50 === 0 ? 0.45 : 0.25]} />
          <meshBasicMaterial color="#f4f6f2" />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`s${s}`} rotation={[-Math.PI / 2, 0, 0]} position={[(s * WID) / 2, 0.03, 0]}>
          <planeGeometry args={[0.5, LEN]} />
          <meshBasicMaterial color="#f4f6f2" />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`e${s}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, (s * LEN) / 2]}>
          <planeGeometry args={[WID, 0.5]} />
          <meshBasicMaterial color="#f4f6f2" />
        </mesh>
      ))}
      {/* goalposts */}
      {[-1, 1].map((s) => (
        <group key={`g${s}`} position={[0, 0, s * (LEN / 2 + 1)]}>
          <mesh position={[0, 1.6, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 3.2, 6]} />
            <meshStandardMaterial color="#ffd23a" emissive="#ffd23a" emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[0, 3.1, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.12, 0.12, 5.6, 6]} />
            <meshStandardMaterial color="#ffd23a" emissive="#ffd23a" emissiveIntensity={0.3} />
          </mesh>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[k * 2.8, 6.1, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 6, 6]} />
              <meshStandardMaterial color="#ffd23a" emissive="#ffd23a" emissiveIntensity={0.3} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};

const Stands: React.FC = () => (
  <group>
    {[-1, 1].map((s) => (
      <mesh key={s} position={[s * (WID / 2 + 16), 7, 0]} rotation={[0, 0, s * -0.5]}>
        <boxGeometry args={[26, 3, LEN + 30]} />
        <meshStandardMaterial color="#1a1f2e" roughness={1} />
      </mesh>
    ))}
    {[-1, 1].map((s) => (
      <mesh key={`e${s}`} position={[0, 7, s * (LEN / 2 + 18)]} rotation={[s * 0.5, 0, 0]}>
        <boxGeometry args={[WID + 50, 3, 24]} />
        <meshStandardMaterial color="#161a27" roughness={1} />
      </mesh>
    ))}
  </group>
);

const TOWERS: Array<[number, number]> = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

const IssFootball: React.FC<SceneComponentProps> = ({ durationInFrames, camera }) => {
  const t = useSceneTime();
  const sink = smoothstep(0, 3.8, t);
  const h = 40 - 30 * sink + Math.sin(t * 1.3) * 0.6;

  const cam = mergeCamera(
    { type: "crane", from: [26, 300, 62], to: [16, 262, 48], target: [0, 0, -6], fov: 36, ease: "inOut" },
    camera,
  );

  return (
    <AbsoluteFill style={{ background: "#03050c" }}>
      <SceneCanvas
        durationInFrames={durationInFrames}
        camera={cam}
        background="#03050c"
        fog={["#03050c", 260, 520]}
        sky="#dfe9ff"
        ground="#14231a"
        sunPosition={[40, 120, 60]}
        sunIntensity={1.5}
      >
        <Field />
        <Stands />
        {/* yard numbers (generic) */}
        {[10, 20, 30, 40, 50, 40, 30, 20, 10].map((n, i) => (
          <TextPanel
            key={i}
            card={{ lines: [String(n)], width: 256, height: 160, fg: "#f4f6f2", size: 130, weight: 800 }}
            height={3.2}
            position={[-WID / 2 + 6, 0.05, (-40 + i * 10) * YD]}
            rotation={[-Math.PI / 2, 0, Math.PI / 2]}
          />
        ))}
        {TOWERS.map(([sx, sz], i) => (
          <group key={i} position={[sx * (WID / 2 + 30), 0, sz * (LEN / 2 + 8)]}>
            <mesh position={[0, 22, 0]}>
              <boxGeometry args={[1.2, 44, 1.2]} />
              <meshStandardMaterial color="#2b3142" />
            </mesh>
            <mesh position={[0, 45, 0]}>
              <boxGeometry args={[9, 4, 1]} />
              <meshStandardMaterial color="#fffbe8" emissive="#fffbe8" emissiveIntensity={2} />
            </mesh>
            <Glow position={[0, 45, 0]} size={34} color="#fff3cf" opacity={0.75} />
          </group>
        ))}
        {/* floodlight pools */}
        <pointLight position={[0, 60, 0]} intensity={2.5} distance={260} decay={0.6} color="#fff6e0" />
        {/* the station: truss along the field's length; its shadow sharpens as it sinks */}
        <group position={[0, 0.12, 0]} scale={[1, 0.001, 1]} rotation={[0, Math.PI / 2, 0]}>
          <Iss silhouette={{ color: "#000000", opacity: 0.25 + 0.4 * sink }} />
        </group>
        <group position={[0, h, 0]} rotation={new THREE.Euler(Math.sin(t * 0.8) * 0.03, Math.PI / 2, Math.sin(t * 0.6) * 0.03)}>
          <Iss selfLight={0.35} />
        </group>
        {/* length bracket: field (dim) vs station (bright) along the sideline */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[WID / 2 + 3.2, 0.06, 0]}>
          <planeGeometry args={[0.7, LEN]} />
          <meshBasicMaterial color="#7fe3ff" transparent opacity={0.85 * smoothstep(1.0, 2.0, t)} toneMapped={false} />
        </mesh>
      </SceneCanvas>
    </AbsoluteFill>
  );
};

export default IssFootball;
