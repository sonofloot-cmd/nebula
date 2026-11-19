import React, { useMemo } from "react";
import * as THREE from "three";

let glowTex: THREE.Texture | null = null;
/** Soft radial gradient (white centre → transparent edge). */
export const getGlowTexture = () => {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.18, "rgba(255,255,255,0.75)");
  g.addColorStop(0.45, "rgba(255,255,255,0.22)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
};

/** Additive camera-facing glow blob (light sources, fireball heads, bloom fakes). */
export const Glow: React.FC<{
  position?: [number, number, number];
  size: number;
  color: string;
  opacity?: number;
  /** stretch: [sx, sy] multipliers */
  stretch?: [number, number];
  rotation?: number;
  depthTest?: boolean;
}> = ({ position = [0, 0, 0], size, color, opacity = 1, stretch = [1, 1], rotation = 0, depthTest = true }) => {
  const tex = useMemo(() => getGlowTexture(), []);
  if (opacity <= 0.001) return null;
  return (
    <sprite position={position} scale={[size * stretch[0], size * stretch[1], 1]}>
      <spriteMaterial
        map={tex}
        color={color}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        depthTest={depthTest}
        toneMapped={false}
        rotation={rotation}
        fog={false}
      />
    </sprite>
  );
};

/** Big inside-out sphere with a vertical colour gradient (sky / space backdrops). */
export const SkyDome: React.FC<{ radius?: number; stops: Array<[number, string]>; center?: [number, number, number] }> = ({
  radius = 400,
  stops,
  center = [0, 0, 0],
}) => {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(radius, 48, 32);
    const pos = g.getAttribute("position");
    const col = new Float32Array(pos.count * 3);
    const cols = stops.map(([y, c]) => [y, new THREE.Color(c)] as const);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / radius; // -1..1
      let k = 0;
      while (k < cols.length - 2 && y > cols[k + 1][0]) k++;
      const [y0, c0] = cols[k];
      const [y1, c1] = cols[Math.min(cols.length - 1, k + 1)];
      const f = Math.min(1, Math.max(0, (y - y0) / Math.max(1e-6, y1 - y0)));
      tmp.copy(c0).lerp(c1, f);
      col.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [radius, JSON.stringify(stops)]);
  return (
    <mesh geometry={geo} position={center}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} toneMapped={false} />
    </mesh>
  );
};
