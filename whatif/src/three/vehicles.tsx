import React from "react";
import * as THREE from "three";

/* Low-poly vehicles and their occupants. Faces look down -Z for pilots (towards the
   windscreen) and +Z for drivers (towards the front of the car). */

const m = (c: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => (
  <meshStandardMaterial color={c} flatShading roughness={0.8} {...extra} />
);

/** A head with squeezed-shut eyes. Faces +Z. `pitch` nods it forward (sneeze jerk). */
export const ShutEyeHead: React.FC<{
  skin?: string;
  hair?: string;
  pitch?: number;
  roll?: number;
  cap?: boolean;
  scale?: number;
}> = ({ skin = "#e0ac69", hair = "#2b1d14", pitch = 0, roll = 0, cap = false, scale = 1 }) => (
  <group rotation={[pitch, 0, roll]} scale={scale}>
    <mesh scale={[1, 1.12, 1]}>
      <icosahedronGeometry args={[0.13, 1]} />
      {m(skin)}
    </mesh>
    {!cap ? (
      <mesh position={[0, 0.05, -0.02]} scale={[1.02, 0.9, 1]}>
        <icosahedronGeometry args={[0.13, 1]} />
        {m(hair)}
      </mesh>
    ) : null}
    {/* closed eyes: two dark creases + furrowed brows */}
    {[-1, 1].map((s) => (
      <group key={s}>
        <mesh position={[s * 0.048, 0.015, 0.122]} rotation={[0, 0, s * 0.18]}>
          <boxGeometry args={[0.055, 0.011, 0.012]} />
          <meshBasicMaterial color="#1a0f0a" />
        </mesh>
        <mesh position={[s * 0.05, 0.055, 0.118]} rotation={[0, 0, -s * 0.3]}>
          <boxGeometry args={[0.06, 0.016, 0.014]} />
          {m(hair)}
        </mesh>
      </group>
    ))}
    {/* nose + open (sneezing) mouth */}
    <mesh position={[0, -0.015, 0.135]} rotation={[Math.PI / 2, 0, 0]}>
      <coneGeometry args={[0.022, 0.05, 4]} />
      {m(skin)}
    </mesh>
    <mesh position={[0, -0.07, 0.118]} scale={[0.03, 0.022, 0.012]}>
      <icosahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color="#4a1515" />
    </mesh>
    {cap ? (
      <group position={[0, 0.1, 0]}>
        <mesh>
          <cylinderGeometry args={[0.14, 0.135, 0.07, 10]} />
          {m("#1b2440")}
        </mesh>
        <mesh position={[0, -0.025, 0.12]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.2, 0.012, 0.09]} />
          {m("#0b0f1c")}
        </mesh>
        <mesh position={[0, 0.005, 0.138]}>
          <boxGeometry args={[0.04, 0.03, 0.01]} />
          {m("#e5b94a", { metalness: 0.6, roughness: 0.3 })}
        </mesh>
      </group>
    ) : null}
  </group>
);

/** Seated airline pilot facing -Z (towards the windscreen). */
export const Pilot: React.FC<{ position: [number, number, number]; pitch?: number; roll?: number; skin?: string }> = ({
  position,
  pitch = 0,
  roll = 0,
  skin = "#e0ac69",
}) => (
  <group position={position} rotation={[0, Math.PI, 0]}>
    {/* seat */}
    <mesh position={[0, 0.48, -0.05]}>
      <boxGeometry args={[0.56, 0.12, 0.56]} />
      {m("#30353f")}
    </mesh>
    <mesh position={[0, 1.0, -0.32]} rotation={[-0.12, 0, 0]}>
      <boxGeometry args={[0.56, 1.0, 0.12]} />
      {m("#30353f")}
    </mesh>
    {/* torso: white shirt, tie, gold epaulettes */}
    <mesh position={[0, 0.9, -0.08]} rotation={[0.08 + pitch * 0.3, 0, 0]}>
      <boxGeometry args={[0.44, 0.6, 0.26]} />
      {m("#eef1f6")}
    </mesh>
    <mesh position={[0, 0.92, 0.06]} rotation={[0.08, 0, 0]}>
      <boxGeometry args={[0.05, 0.4, 0.01]} />
      {m("#1b2440")}
    </mesh>
    {[-1, 1].map((s) => (
      <mesh key={s} position={[s * 0.18, 1.19, -0.08]}>
        <boxGeometry args={[0.1, 0.02, 0.14]} />
        {m("#e5b94a", { metalness: 0.5 })}
      </mesh>
    ))}
    {/* arms reaching to the yoke */}
    {[-1, 1].map((s) => (
      <mesh key={`a${s}`} position={[s * 0.25, 0.86, 0.14]} rotation={[-1.1, 0, s * 0.1]}>
        <boxGeometry args={[0.1, 0.45, 0.1]} />
        {m("#eef1f6")}
      </mesh>
    ))}
    <group position={[0, 1.36, -0.06]}>
      <ShutEyeHead skin={skin} cap pitch={pitch} roll={roll} />
    </group>
  </group>
);

/** Airliner flight deck around two pilots at x = ±0.55, facing -Z. Screens glow. */
export const Cockpit: React.FC = () => {
  const screen = (x: number, c: string) => (
    <mesh position={[x, 0.98, -0.79]} rotation={[-0.35, 0, 0]}>
      <planeGeometry args={[0.32, 0.26]} />
      <meshBasicMaterial color={c} side={THREE.DoubleSide} />
    </mesh>
  );
  return (
    <group>
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[2.6, 0.1, 3.2]} />
        {m("#262a33")}
      </mesh>
      {/* instrument panel + glare shield */}
      <mesh position={[0, 0.8, -0.98]}>
        <boxGeometry args={[2.3, 0.6, 0.35]} />
        {m("#2c313b")}
      </mesh>
      <mesh position={[0, 1.13, -1.02]}>
        <boxGeometry args={[2.3, 0.08, 0.5]} />
        {m("#1c2027")}
      </mesh>
      {screen(-0.85, "#1f6fd1")}
      {screen(-0.45, "#10243f")}
      {screen(0.45, "#10243f")}
      {screen(0.85, "#1f6fd1")}
      {screen(0, "#0f3b2a")}
      {/* centre pedestal + thrust levers */}
      <mesh position={[0, 0.55, -0.35]}>
        <boxGeometry args={[0.42, 0.5, 0.9]} />
        {m("#2c313b")}
      </mesh>
      {[-0.08, 0.08].map((x) => (
        <mesh key={x} position={[x, 0.88, -0.45]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.04, 0.22, 0.04]} />
          {m("#c8ccd4")}
        </mesh>
      ))}
      {/* yokes */}
      {[-0.55, 0.55].map((x) => (
        <group key={x} position={[x, 0, -0.55]}>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.55, 6]} />
            {m("#2a2e36")}
          </mesh>
          <mesh position={[0, 0.85, 0.02]}>
            <boxGeometry args={[0.34, 0.06, 0.06]} />
            {m("#1a1d23")}
          </mesh>
        </group>
      ))}
      {/* windscreen posts (glass is open so we see the sky) */}
      {[-1.15, -0.4, 0.4, 1.15].map((x) => (
        <mesh key={x} position={[x, 1.5, -1.2]} rotation={[-0.45, 0, 0]}>
          <boxGeometry args={[0.07, 0.8, 0.07]} />
          {m("#3a404b")}
        </mesh>
      ))}
      <mesh position={[0, 1.88, -1.0]} rotation={[-0.45, 0, 0]}>
        <boxGeometry args={[2.4, 0.08, 0.1]} />
        {m("#3a404b")}
      </mesh>
      {/* side walls with window frames */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 1.28, 0.55, 0]}>
            <boxGeometry args={[0.08, 1.1, 3.2]} />
            {m("#3f4552")}
          </mesh>
          <mesh position={[s * 1.28, 1.95, 0]}>
            <boxGeometry args={[0.08, 0.3, 3.2]} />
            {m("#3f4552")}
          </mesh>
          <mesh position={[s * 1.28, 1.45, 0.45]}>
            <boxGeometry args={[0.08, 0.9, 0.12]} />
            {m("#3f4552")}
          </mesh>
          <mesh position={[s * 1.28, 1.45, 1.3]}>
            <boxGeometry args={[0.08, 0.9, 0.6]} />
            {m("#3f4552")}
          </mesh>
        </group>
      ))}
      {/* overhead panel with lit switches */}
      <mesh position={[0, 2.12, -0.2]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[1.2, 0.08, 1.4]} />
        {m("#2c313b")}
      </mesh>
      {Array.from({ length: 24 }).map((_, i) => (
        <mesh key={i} position={[-0.45 + (i % 8) * 0.13, 2.07, -0.7 + Math.floor(i / 8) * 0.35]} rotation={[0.25, 0, 0]}>
          <boxGeometry args={[0.05, 0.02, 0.05]} />
          <meshBasicMaterial color={i % 5 === 0 ? "#ffb347" : i % 3 === 0 ? "#7fe3ff" : "#3e4a5c"} />
        </mesh>
      ))}
      {/* back wall + door */}
      <mesh position={[0, 1.1, 1.6]}>
        <boxGeometry args={[2.6, 2.3, 0.08]} />
        {m("#454c59")}
      </mesh>
      <mesh position={[0, 1.0, 1.55]}>
        <boxGeometry args={[0.7, 1.8, 0.04]} />
        {m("#5a6272")}
      </mesh>
    </group>
  );
};

/** Low-poly car with an open-glass cabin so you can see the (eyes-shut) driver. Front = +Z. */
export const Car: React.FC<{
  position: [number, number, number];
  yaw?: number;
  color?: string;
  skin?: string;
  headRoll?: number;
  headPitch?: number;
}> = ({ position, yaw = 0, color = "#d1495b", skin = "#e0ac69", headRoll = 0, headPitch = 0 }) => (
  <group position={position} rotation={[0, yaw, 0]}>
    <mesh position={[0, 0.55, 0]}>
      <boxGeometry args={[1.8, 0.6, 4.3]} />
      {m(color, { roughness: 0.5, metalness: 0.15 })}
    </mesh>
    {/* bonnet slope */}
    <mesh position={[0, 0.88, 1.35]} rotation={[0.18, 0, 0]}>
      <boxGeometry args={[1.7, 0.08, 1.5]} />
      {m(color, { roughness: 0.5, metalness: 0.15 })}
    </mesh>
    {/* roof + pillars */}
    <mesh position={[0, 1.5, -0.35]}>
      <boxGeometry args={[1.6, 0.07, 1.9]} />
      {m(color, { roughness: 0.5, metalness: 0.15 })}
    </mesh>
    {[-0.76, 0.76].map((x) =>
      [
        [0.62, -0.45],
        [-1.28, 0.2],
      ].map(([z, rx]) => (
        <mesh key={`${x}${z}`} position={[x, 1.18, z]} rotation={[rx, 0, 0]}>
          <boxGeometry args={[0.07, 0.68, 0.07]} />
          {m("#1d1f26")}
        </mesh>
      )),
    )}
    {/* windscreen tint */}
    <mesh position={[0, 1.2, 0.75]} rotation={[-0.45, 0, 0]}>
      <planeGeometry args={[1.5, 0.72]} />
      <meshStandardMaterial color="#9ec9ff" transparent opacity={0.12} roughness={0.1} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
    {/* seats + driver (left) + torso */}
    <mesh position={[-0.4, 0.95, -0.55]}>
      <boxGeometry args={[0.5, 0.75, 0.12]} />
      {m("#22252c")}
    </mesh>
    <mesh position={[-0.4, 1.0, -0.3]}>
      <boxGeometry args={[0.42, 0.45, 0.25]} />
      {m("#3d5a80")}
    </mesh>
    <group position={[-0.4, 1.33, -0.28]}>
      <ShutEyeHead skin={skin} pitch={headPitch} roll={headRoll} scale={1.15} />
    </group>
    {/* steering wheel */}
    <mesh position={[-0.4, 1.02, 0.18]} rotation={[1.1, 0, 0]}>
      <torusGeometry args={[0.17, 0.025, 4, 10]} />
      {m("#111")}
    </mesh>
    {/* headlights, grille, wheels */}
    {[-0.62, 0.62].map((x) => (
      <mesh key={x} position={[x, 0.68, 2.16]}>
        <boxGeometry args={[0.38, 0.14, 0.02]} />
        <meshBasicMaterial color="#fff6d8" />
      </mesh>
    ))}
    <mesh position={[0, 0.5, 2.16]}>
      <boxGeometry args={[0.7, 0.16, 0.02]} />
      {m("#15171c")}
    </mesh>
    {[-0.82, 0.82].map((x) =>
      [1.35, -1.35].map((z) => (
        <mesh key={`${x}${z}`} position={[x, 0.32, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.32, 0.32, 0.22, 8]} />
          {m("#15171c")}
        </mesh>
      )),
    )}
  </group>
);
