import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mulberry32 } from "./random";

/** Muted low-poly palette for clothes / buildings. */
export const CLOTHES = ["#e4572e", "#29335c", "#f3a712", "#669bbc", "#a8c686", "#8e7dbe", "#d1495b", "#edae49", "#3d5a80", "#ee964b"];
export const SKIN = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac"];

const flat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => (
  <meshStandardMaterial color={color} flatShading roughness={0.85} metalness={0} {...extra} />
);

/** A simple low-poly person (≈1.75 units tall). Seated = true folds them onto a bench. */
export const Person: React.FC<{
  position?: [number, number, number];
  rotationY?: number;
  shirt?: string;
  skin?: string;
  seated?: boolean;
  /** Head tilt in radians (sneeze recoil). */
  headPitch?: number;
}> = ({ position = [0, 0, 0], rotationY = 0, shirt = "#669bbc", skin = "#e0ac69", seated = false, headPitch = 0 }) => {
  const hip = seated ? 0.5 : 0.92;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* legs */}
      {seated ? (
        <mesh position={[0.22, 0.47, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.16, 0.45, 0.34]} />
          {flat("#2b2d42")}
        </mesh>
      ) : null}
      <mesh position={[seated ? 0.42 : 0, seated ? 0.23 : 0.45, 0]}>
        <boxGeometry args={[0.18, seated ? 0.46 : 0.9, 0.34]} />
        {flat("#2b2d42")}
      </mesh>
      {/* torso */}
      <mesh position={[0, hip + 0.33, 0]}>
        <cylinderGeometry args={[0.2, 0.24, 0.66, 6]} />
        {flat(shirt)}
      </mesh>
      {/* head */}
      <group position={[0, hip + 0.72, 0]} rotation={[0, 0, -headPitch]}>
        <mesh position={[0, 0.06, 0]}>
          <icosahedronGeometry args={[0.15, 1]} />
          {flat(skin)}
        </mesh>
      </group>
    </group>
  );
};

/**
 * Instanced crowd of capsule people — cheap enough for thousands.
 * positions: Float32Array [x,z, x,z, ...]; heights are randomised slightly.
 */
export const Crowd: React.FC<{ xz: Float32Array; seed?: number; scale?: number; y?: number }> = ({
  xz,
  seed = 3,
  scale = 1,
  y = 0,
}) => {
  const count = xz.length / 2;
  const body = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const bodyGeo = useMemo(() => new THREE.CylinderGeometry(0.2, 0.24, 1.2, 5), []);
  const headGeo = useMemo(() => new THREE.IcosahedronGeometry(0.16, 0), []);
  useLayoutEffect(() => {
    const rand = mulberry32(seed);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const h = (0.9 + rand() * 0.2) * scale;
      const x = xz[i * 2];
      const z = xz[i * 2 + 1];
      m.makeScale(scale, h, scale).setPosition(x, y + 0.6 * h, z);
      body.current!.setMatrixAt(i, m);
      body.current!.setColorAt(i, c.set(CLOTHES[Math.floor(rand() * CLOTHES.length)]));
      m.makeScale(scale, scale, scale).setPosition(x, y + 1.38 * h, z);
      head.current!.setMatrixAt(i, m);
      head.current!.setColorAt(i, c.set(SKIN[Math.floor(rand() * SKIN.length)]));
    }
    for (const r of [body, head]) {
      r.current!.instanceMatrix.needsUpdate = true;
      if (r.current!.instanceColor) r.current!.instanceColor.needsUpdate = true;
    }
  }, [xz, count, seed, scale, y]);
  return (
    <>
      <instancedMesh ref={body} args={[bodyGeo, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={head} args={[headGeo, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
    </>
  );
};

export interface BuildingSpec {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
}

/** Instanced box buildings with a lit-window emissive tint near the top. */
export const Buildings: React.FC<{ specs: BuildingSpec[]; windows?: boolean }> = ({ specs }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    specs.forEach((s, i) => {
      m.makeScale(s.w, s.h, s.d).setPosition(s.x, 0, s.z);
      ref.current!.setMatrixAt(i, m);
      ref.current!.setColorAt(i, c.set(s.color));
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
  }, [specs]);
  return (
    <instancedMesh ref={ref} args={[geo, undefined, specs.length]} frustumCulled={false}>
      <meshStandardMaterial flatShading roughness={0.8} />
    </instancedMesh>
  );
};

const BUILDING_COLORS = ["#c9d3e3", "#aab7cc", "#8e9bb3", "#d8d2c4", "#b5b0a6", "#9fb1bf", "#e6e1d6"];

/** Procedural city block grid; taller towards the centre. */
export const makeCity = (opts: {
  seed: number;
  radius: number;
  block: number;
  street: number;
  maxHeight: number;
  /** Skip lots whose centre passes this test (e.g. keep a plaza open). */
  skip?: (x: number, z: number) => boolean;
}): BuildingSpec[] => {
  const rand = mulberry32(opts.seed);
  const specs: BuildingSpec[] = [];
  const pitch = opts.block + opts.street;
  const n = Math.ceil(opts.radius / pitch);
  for (let ix = -n; ix <= n; ix++) {
    for (let iz = -n; iz <= n; iz++) {
      const cx = ix * pitch;
      const cz = iz * pitch;
      const r = Math.hypot(cx, cz);
      if (r > opts.radius) continue;
      // split each block into 2x2 lots
      for (let lx = 0; lx < 2; lx++) {
        for (let lz = 0; lz < 2; lz++) {
          const lot = opts.block / 2;
          const x = cx - opts.block / 4 + lx * lot;
          const z = cz - opts.block / 4 + lz * lot;
          if (opts.skip?.(x, z)) continue;
          if (rand() < 0.08) continue;
          const centre = Math.max(0, 1 - r / opts.radius);
          const h = opts.maxHeight * (0.08 + 0.92 * Math.pow(centre, 1.6) * (0.35 + rand() * 0.65)) + rand() * 3;
          specs.push({
            x,
            z,
            w: lot * (0.7 + rand() * 0.2),
            d: lot * (0.7 + rand() * 0.2),
            h,
            color: BUILDING_COLORS[Math.floor(rand() * BUILDING_COLORS.length)],
          });
        }
      }
    }
  }
  return specs;
};
