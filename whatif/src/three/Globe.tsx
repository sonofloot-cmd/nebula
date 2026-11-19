import React, { useMemo } from "react";
import * as THREE from "three";
import { makeGlobeGeometry } from "./geo";
import { mulberry32 } from "./random";
import { Particles } from "./Particles";

export interface GlobePalette {
  ocean: string;
  land: string;
  land2: string;
  ice: string;
}

export const DAY: GlobePalette = { ocean: "#2f6fa8", land: "#6aab5a", land2: "#c2b27e", ice: "#eef4f8" };
export const NIGHT: GlobePalette = { ocean: "#10213d", land: "#2a3b57", land2: "#33465f", ice: "#4a5a74" };

/** Rotation (radians, Y axis) that turns longitude `lon` to face +Z (towards a default camera). */
export const faceLongitude = (lon: number) => THREE.MathUtils.degToRad(-90 - lon);

/** Low-poly Earth: flat-shaded icosphere coloured from Natural Earth land data, plus atmosphere glow. */
export const Globe: React.FC<{
  radius?: number;
  detail?: number;
  palette?: GlobePalette;
  atmosphere?: string;
  atmosphereOpacity?: number;
  emissive?: number;
  banding?: number;
}> = ({ radius = 10, detail = 40, palette = DAY, atmosphere = "#7fc8ff", atmosphereOpacity = 0.22, emissive = 0, banding = 0.015 }) => {
  const geo = useMemo(() => makeGlobeGeometry(radius, detail, palette, banding), [radius, detail, palette, banding]);
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial vertexColors flatShading roughness={0.9} emissive="#ffffff" emissiveIntensity={emissive} />
      </mesh>
      <mesh scale={1.06}>
        <sphereGeometry args={[radius, 64, 32]} />
        <meshBasicMaterial color={atmosphere} transparent opacity={atmosphereOpacity} side={THREE.BackSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh scale={1.015}>
        <sphereGeometry args={[radius, 64, 32]} />
        <meshBasicMaterial color={atmosphere} transparent opacity={atmosphereOpacity * 0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
};

/** Distant star field. */
export const Stars: React.FC<{ t: number; count?: number; radius?: number }> = ({ t, count = 1500, radius = 400 }) => {
  const compute = useMemo(() => {
    return (_i: number, time: number, out: Float32Array, r: Float32Array) => {
      const u = r[0] * 2 - 1;
      const th = r[1] * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      out[0] = radius * s * Math.cos(th);
      out[1] = radius * u;
      out[2] = radius * s * Math.sin(th);
      out[3] = 0.6 + r[2] * 1.4;
      out[4] = 0.5 + 0.5 * Math.sin(time * (1 + r[3] * 3) + r[4] * 10) * 0.5;
    };
  }, [radius]);
  return <Particles count={count} t={t} compute={compute} size={1.4} color="#ffffff" seed={77} softness={0.2} maxPixelSize={4} additive />;
};

export const seededUnitVectors = (n: number, seed: number) => {
  const rand = mulberry32(seed);
  return Array.from({ length: n }, () => {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    return new THREE.Vector3(s * Math.cos(th), u, s * Math.sin(th));
  });
};
