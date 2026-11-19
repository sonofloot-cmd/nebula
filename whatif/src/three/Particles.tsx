import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { mulberry32 } from "./random";

/**
 * Writes particle i's state at time t (seconds) into `out`:
 *   out[0..2] = position, out[3] = size multiplier, out[4] = alpha (0 hides it).
 * `r` holds 8 stable random numbers in [0,1) for this particle.
 */
export type ParticleFn = (i: number, t: number, out: Float32Array, r: Float32Array) => void;

export interface ParticlesProps {
  count: number;
  /** Scene time in seconds (frame / fps) — particles are a pure function of it. */
  t: number;
  compute: ParticleFn;
  seed?: number;
  /** World-space diameter of a particle at size multiplier 1. */
  size?: number;
  color?: string;
  /** Optional per-particle colour picked once from its random numbers. */
  colorFn?: (i: number, r: Float32Array) => [number, number, number];
  opacity?: number;
  additive?: boolean;
  /** 0 = hard dot, 1 = very soft blob (good for haze / clouds). */
  softness?: number;
  /** Cap on on-screen size in pixels (stops particles that fly at the lens from becoming blobs). */
  maxPixelSize?: number;
}

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uScale;
  uniform float uMaxSize;
  varying float vAlpha;
  varying vec3 vColor;
  #include <fog_pars_vertex>
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(aSize * uScale / max(0.001, -mvPosition.z), 1.0, uMaxSize);
    gl_Position = projectionMatrix * mvPosition;
    vAlpha = aAlpha;
    vColor = aColor;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  uniform float uSoftness;
  varying float vAlpha;
  varying vec3 vColor;
  #include <fog_pars_fragment>
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    float edge = mix(0.85, 0.0, uSoftness);
    float a = 1.0 - smoothstep(edge, 1.0, d);
    a *= mix(1.0, 1.0 - d * 0.6, uSoftness);
    gl_FragColor = vec4(vColor, a * vAlpha * uOpacity);
    #include <fog_fragment>
  }
`;

/** GPU point cloud whose every particle is computed from time — deterministic & render-safe. */
export const Particles: React.FC<ParticlesProps> = ({
  count,
  t,
  compute,
  seed = 1,
  size = 0.05,
  color = "#ffffff",
  colorFn,
  opacity = 1,
  additive = false,
  softness = 0.3,
  maxPixelSize = 64,
}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const height = useThree((s) => s.size.height);

  const { geometry, rnd } = useMemo(() => {
    const rand = mulberry32(seed);
    const rnd = new Float32Array(count * 8);
    for (let i = 0; i < rnd.length; i++) rnd[i] = rand();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(count), 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(count), 1));
    const colors = new Float32Array(count * 3);
    const base = new THREE.Color(color);
    const r = new Float32Array(8);
    for (let i = 0; i < count; i++) {
      r.set(rnd.subarray(i * 8, i * 8 + 8));
      const c = colorFn ? colorFn(i, r) : [base.r, base.g, base.b];
      colors.set(c, i * 3);
    }
    g.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    return { geometry: g, rnd };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, seed, color]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        fog: true,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: {
          ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
          uScale: { value: 1 },
          uOpacity: { value: opacity },
          uSoftness: { value: softness },
          uMaxSize: { value: maxPixelSize },
        },
      }),
    [additive, opacity, softness, maxPixelSize],
  );

  useLayoutEffect(() => {
    const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
    const sz = geometry.getAttribute("aSize") as THREE.BufferAttribute;
    const al = geometry.getAttribute("aAlpha") as THREE.BufferAttribute;
    const out = new Float32Array(5);
    const r = new Float32Array(8);
    for (let i = 0; i < count; i++) {
      r.set(rnd.subarray(i * 8, i * 8 + 8));
      out[3] = 1;
      out[4] = 1;
      compute(i, t, out, r);
      pos.setXYZ(i, out[0], out[1], out[2]);
      sz.setX(i, out[3] * size);
      al.setX(i, out[4]);
    }
    pos.needsUpdate = true;
    sz.needsUpdate = true;
    al.needsUpdate = true;
    // pixels per world unit at distance 1
    material.uniforms.uScale.value = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }, [t, compute, count, geometry, rnd, size, material, camera, height]);

  return <points geometry={geometry} material={material} frustumCulled={false} />;
};
