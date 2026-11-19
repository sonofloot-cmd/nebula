import React, { useMemo } from "react";
import * as THREE from "three";
import { mulberry32 } from "./random";

/** Night-time towers with randomly lit windows (emissive window texture, repeated per building). */

let windowTex: THREE.CanvasTexture | null = null;
export const getWindowTexture = () => {
  if (windowTex) return windowTex;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, 256, 512);
  const r = mulberry32(99);
  const cols = 8;
  const rows = 16;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const v = r();
      if (v < 0.42) continue;
      ctx.fillStyle = v > 0.93 ? "#9fd0ff" : v > 0.7 ? "#ffe0a0" : "#c98b3c";
      ctx.globalAlpha = 0.45 + r() * 0.55;
      ctx.fillRect(x * 32 + 7, y * 32 + 8, 18, 18);
    }
  ctx.globalAlpha = 1;
  windowTex = new THREE.CanvasTexture(c);
  windowTex.colorSpace = THREE.SRGBColorSpace;
  windowTex.wrapS = windowTex.wrapT = THREE.RepeatWrapping;
  return windowTex;
};

export interface Tower {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
}

export const FACADE = ["#1a2133", "#202a3d", "#151b2a", "#262f44", "#1c2436"];

export const TowerMesh: React.FC<{ s: Tower; lit: number }> = ({ s, lit }) => {
  const tex = useMemo(() => {
    const t = getWindowTexture().clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(1, Math.round(s.w / 30)), Math.max(1, Math.round(s.h / 60)));
    return t;
  }, [s]);
  return (
    <mesh position={[s.x, s.h / 2, s.z]}>
      <boxGeometry args={[s.w, s.h, s.d]} />
      <meshStandardMaterial color={s.color} roughness={0.85} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={lit} />
    </mesh>
  );
};


/** A strip of towers along X (e.g. a far shoreline). */
export const makeSkylineRow = (opts: { seed: number; z: number; x0: number; x1: number; hMin: number; hMax: number; depth?: number }): Tower[] => {
  const r = mulberry32(opts.seed);
  const out: Tower[] = [];
  for (let x = opts.x0; x < opts.x1; ) {
    const w = 18 + r() * 26;
    const h = opts.hMin + (opts.hMax - opts.hMin) * Math.pow(r(), 1.6);
    out.push({ x: x + w / 2, z: opts.z - r() * 30, w, d: opts.depth ?? 30, h, color: FACADE[Math.floor(r() * FACADE.length)] });
    x += w + 2 + r() * 8;
  }
  return out;
};
