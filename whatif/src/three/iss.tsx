import React, { useMemo } from "react";
import * as THREE from "three";
import type { Vec3 } from "../types";
import { mulberry32 } from "./random";

/**
 * Generic low-poly space station (built in METRES: 109 m end to end, like the real ISS),
 * with no logos or flags. Long truss along X, solar wings at both ends,
 * pressurised modules along Z under the truss, white radiators.
 *
 * Re-entry controls:
 *   glow   0..1  → orange-hot emissive skin
 *   breakT  seconds since break-up began (< 0 = intact). Wings rip off first,
 *           then radiators, truss segments and finally the modules split apart.
 *   wind   direction the loose pieces trail towards (model space, usually "behind").
 */

export type IssKind = "truss" | "wing" | "mast" | "module" | "radiator" | "node";

export interface IssPart {
  kind: IssKind;
  pos: Vec3;
  size: Vec3; // box: [x,y,z]; cylinder: [radius, length, radius] (length along Z)
  color: string;
  cyl?: boolean;
  /** seconds after breakT 0 when this part tears loose */
  at: number;
  /** trailing acceleration multiplier, lateral drift and tumble */
  drag: number;
  drift: Vec3;
  spin: Vec3;
  /** burns away (shrinks) after tearing loose */
  burns: boolean;
}

const WING = "#22346c";
const WING2 = "#2c4486";
const METAL = "#c9ccd3";
const MODULE = "#dfe2e6";
const RAD = "#f4f6f8";

export const ISS_LENGTH = 109;

export const buildIssParts = (seed = 9): IssPart[] => {
  const r = mulberry32(seed);
  const rnd = (a: number, b: number) => a + (b - a) * r();
  const parts: IssPart[] = [];
  const push = (p: Omit<IssPart, "drift" | "spin" | "drag"> & Partial<Pick<IssPart, "drift" | "spin" | "drag">>) =>
    parts.push({
      drag: rnd(0.7, 1.3),
      drift: [rnd(-1, 1), rnd(-0.6, 0.6), rnd(-1, 1)],
      spin: [rnd(-2, 2), rnd(-2, 2), rnd(-2, 2)],
      ...p,
    });

  // truss in four segments
  [-39, -13, 13, 39].forEach((x, i) =>
    push({ kind: "truss", pos: [x, 0, 0], size: [26, 2.6, 2.6], color: METAL, at: 1.7 + Math.abs(x) * 0.012 + i * 0.05, burns: false }),
  );
  // solar wings: 4 per side, each two blankets either side of a mast
  [-48.5, -36.5, 36.5, 48.5].forEach((x, i) =>
    [-1, 1].forEach((side, j) => {
      const z = side * 19;
      const at = 0.15 + (Math.abs(x) > 40 ? 0 : 0.35) + j * 0.12 + (i % 2) * 0.08;
      push({ kind: "mast", pos: [x, 0, z], size: [0.5, 0.5, 34], color: METAL, at, burns: true });
      push({ kind: "wing", pos: [x - 2.95, 0, z], size: [5.2, 0.18, 34], color: WING, at, burns: true });
      push({ kind: "wing", pos: [x + 2.95, 0, z], size: [5.2, 0.18, 34], color: WING2, at, burns: true });
    }),
  );
  // radiators hanging off the inner truss
  [-21, -16, 16, 21].forEach((x, i) =>
    push({ kind: "radiator", pos: [x, -0.4, -10], size: [3.4, 0.14, 15], color: RAD, at: 0.9 + i * 0.12, burns: true }),
  );
  // pressurised modules along Z, under the truss
  const modules: Array<[number, number, number]> = [
    // [zCentre, length, radius]
    [-24, 13, 2.1],
    [-11, 12, 2.2],
    [0, 7, 2.4],
    [9.5, 11, 2.2],
    [21, 11, 2.0],
    [30, 6, 1.6],
  ];
  modules.forEach(([z, len, rad], i) =>
    push({ kind: i === 2 ? "node" : "module", pos: [0, -4.6, z], size: [rad, len, rad], color: MODULE, cyl: true, at: 2.4 + i * 0.18, burns: false, drag: 0.35 + r() * 0.3 }),
  );
  // two side labs
  [-1, 1].forEach((side, i) =>
    push({ kind: "module", pos: [side * 7.5, -4.6, 9.5], size: [2.1, 8, 2.1], color: MODULE, cyl: true, at: 2.2 + i * 0.2, burns: false, drag: 0.5 }),
  );
  return parts;
};

const easeIn = (d: number) => d * d;

/** Where part `p` is (offset from its rest pose) `breakT` seconds into the break-up. */
export const partState = (p: IssPart, breakT: number, wind: Vec3) => {
  const d = Math.max(0, breakT - p.at);
  const k = easeIn(d) * 7 * p.drag;
  const offset: Vec3 = [
    wind[0] * k + p.drift[0] * d * 3,
    wind[1] * k + p.drift[1] * d * 3,
    wind[2] * k + p.drift[2] * d * 3,
  ];
  const rot: Vec3 = [p.spin[0] * d * 0.6, p.spin[1] * d * 0.6, p.spin[2] * d * 0.6];
  const scale = p.burns ? Math.max(0, 1 - d * 0.55) : Math.max(0.55, 1 - d * 0.1);
  return { offset, rot, scale, loose: d > 0, d };
};

export const Iss: React.FC<{
  glow?: number;
  breakT?: number;
  wind?: Vec3;
  seed?: number;
  /** extra emissive for night scenes so the station reads against black */
  selfLight?: number;
  /** draw as a flat single-colour silhouette (shadows) */
  silhouette?: { color: string; opacity: number };
}> = ({ glow = 0, breakT = -1, wind = [1, 0, 0], seed = 9, selfLight = 0, silhouette }) => {
  const parts = useMemo(() => buildIssParts(seed), [seed]);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const cyl = useMemo(() => {
    const g = new THREE.CylinderGeometry(1, 1, 1, 8);
    g.rotateX(Math.PI / 2); // length along Z
    return g;
  }, []);
  const hot = new THREE.Color("#ff5a12");
  const yellow = new THREE.Color("#ffb347");
  const char = new THREE.Color("#3a2620");
  return (
    <group>
      {parts.map((p, i) => {
        const s = partState(p, breakT, wind);
        if (s.scale <= 0.01) return null;
        // loose pieces glow hotter; wings flare then char
        const heat = Math.min(1, glow * (s.loose ? 1.35 : 1) + (s.loose ? Math.min(0.4, s.d * 0.3) : 0));
        const emissive = heat > 0.7 ? hot.clone().lerp(yellow, ((heat - 0.7) / 0.3) * 0.45) : hot;
        const base = new THREE.Color(p.color).lerp(char, Math.min(0.85, heat * 2.2));
        const scale: Vec3 = p.cyl ? [p.size[0], p.size[0], p.size[1]] : p.size;
        return (
          <mesh
            key={i}
            geometry={p.cyl ? cyl : box}
            position={[p.pos[0] + s.offset[0], p.pos[1] + s.offset[1], p.pos[2] + s.offset[2]]}
            rotation={s.rot}
            scale={[scale[0] * s.scale, scale[1] * (p.burns ? s.scale : 1), scale[2] * s.scale]}
          >
            {silhouette ? (
              <meshBasicMaterial color={silhouette.color} transparent opacity={silhouette.opacity} depthWrite={false} />
            ) : (
            <meshStandardMaterial
              color={base}
              flatShading
              roughness={p.kind === "wing" ? 0.35 : 0.6}
              metalness={p.kind === "wing" ? 0.3 : 0.15}
              emissive={heat > 0.01 ? emissive : new THREE.Color(p.kind === "wing" ? "#3a5cc8" : "#ffffff")}
              emissiveIntensity={heat > 0.01 ? heat * 1.5 : selfLight * (p.kind === "wing" ? 0.6 : 0.25)}
            />
            )}
          </mesh>
        );
      })}
    </group>
  );
};
