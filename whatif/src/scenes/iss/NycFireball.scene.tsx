import React, { useCallback, useMemo } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { mergeCamera } from "../../three/camera";
import { Glow, SkyDome } from "../../three/glow";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { mulberry32, smoothstep } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import { TextCard, TextPanel } from "../../three/text";
import type { SceneComponentProps } from "../../types";

/**
 * OVER NEW YORK: a generic low-poly Manhattan-style skyline at night seen from across the river,
 * glowing Times Square-style billboards (all made-up names), and the station streaking overhead
 * as a fireball that splits into fragments. Sonic boom → flash + camera shake. World units = metres.
 * props: { boomAt?: number (s), splitAt?: number (s) }
 */

let windowTex: THREE.CanvasTexture | null = null;
const getWindowTexture = () => {
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

interface Tower {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
}

const FACADE = ["#1a2133", "#202a3d", "#151b2a", "#262f44", "#1c2436"];

const makeTowers = (): Tower[] => {
  const r = mulberry32(5);
  const out: Tower[] = [];
  // a long, narrow island of towers seen from across the river: lower in front, taller behind
  for (let row = 0; row < 7; row++) {
    const z = -row * 46 - r() * 8;
    for (let x = -330; x < 330; ) {
      const w = 22 + r() * 24;
      const mid = 1 - Math.min(1, Math.abs(x) / 340);
      const front = row === 0 && Math.abs(x) < 170 ? 75 : 0;
      const h = front + 35 + row * 18 + r() * (50 + row * 25) * (0.5 + mid) + (r() < 0.08 ? 120 : 0);
      out.push({ x: x + w / 2, z, w, d: 30 + r() * 10, h, color: FACADE[Math.floor(r() * FACADE.length)] });
      x += w + 2 + r() * 6;
    }
  }
  return out;
};

const TowerMesh: React.FC<{ s: Tower; lit: number }> = ({ s, lit }) => {
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

/** Made-up billboard copy. No real brands. */
const BOARDS: Array<{ card: TextCard; x: number; y: number; h: number; z?: number }> = [
  { x: -20, y: 120, h: 30, card: { lines: ["LOOK UP!"], width: 1024, height: 512, bg: "#e0182d", fg: "#ffe14d", size: 300, glow: "#ffe14d", border: "#ffe14d", borderWidth: 18 } },
  { x: 52, y: 132, h: 26, card: { lines: ["ZOOMA", "COLA"], width: 768, height: 768, bg: "#0b3fd8", fg: "#ffffff", size: [240, 200] } },
  { x: -84, y: 92, h: 20, card: { lines: ["SPACE FRIES", "NOW EXTRA CRISPY"], width: 1024, height: 512, bg: "#ffb000", fg: ["#2a1300", "#2a1300"], size: [150, 74] } },
  { x: 38, y: 92, h: 22, card: { lines: ["NOTHING EVER", "HAPPENS HERE"], width: 1024, height: 512, bg: "#101010", fg: ["#39ff88", "#39ff88"], size: [130, 130], glow: "#39ff88", border: "#39ff88", borderWidth: 10 } },
  { x: -62, y: 128, h: 18, card: { lines: ["MOONBURGER"], width: 1024, height: 384, bg: "#ff4fa3", fg: "#ffffff", size: 160 } },
  { x: 108, y: 106, h: 24, card: { lines: ["SALE", "99% OFF"], width: 768, height: 768, bg: "#ffffff", fg: ["#e0182d", "#111111"], size: [230, 170] } },
  { x: -128, y: 116, h: 18, card: { lines: ["NITE OWL", "NOODLES"], width: 1024, height: 512, bg: "#5b1fd6", fg: "#ffe9a8", size: [170, 170] } },
  { x: -10, y: 84, h: 16, card: { lines: ["WHAT IF?", "THE MUSICAL"], width: 1024, height: 512, bg: "#0a0a0a", fg: ["#ffd23a", "#ffffff"], size: [190, 100], border: "#ffd23a" } },
]

const NycFireball: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const boomAt = (props.boomAt as number) ?? 1.5;
  const splitAt = (props.splitAt as number) ?? 0.8;
  const towers = useMemo(() => makeTowers(), []);

  // Fireball path across the sky (upper right → left), metres.
  const S = useMemo(() => new THREE.Vector3(560, 1020, -480), []);
  const E = useMemo(() => new THREE.Vector3(-560, 560, -700), []);
  const along = (time: number) => S.clone().lerp(E, time / 5.8);
  const head = along(t);
  const dir = E.clone().sub(S).normalize();

  // Fragments drift apart after the split.
  const FR = 6;
  const fragPos = (k: number, time: number) => {
    const ds = Math.max(0, time - splitAt);
    const r = mulberry32(300 + k);
    const lag = (0.04 + r() * 0.16) * ds;
    const p = along(time - lag * 3);
    p.y -= (r() * 40 + 10) * ds;
    p.z += (r() - 0.5) * 60 * ds;
    p.x += (r() - 0.5) * 30 * ds;
    return p;
  };

  const trail = useCallback<ParticleFn>(
    (i, time, out, r) => {
      const k = i % (FR + 1);
      const life = 1.1 + r[0] * 1.2;
      const age = (time + r[1] * life) % life;
      const birth = time - age;
      if (birth < 0 || (k > 0 && birth < splitAt)) {
        out[4] = 0;
        return;
      }
      const p = k === 0 ? along(birth) : fragPos(k - 1, birth);
      const a = age / life;
      out[0] = p.x + (r[2] - 0.5) * 50 * a + age * 12;
      out[1] = p.y + (r[3] - 0.5) * 50 * a + age * 8;
      out[2] = p.z + (r[4] - 0.5) * 50 * a;
      out[3] = (k === 0 ? 1.4 : 0.8) * (1 + a * 2.5);
      out[4] = (1 - a) * Math.min(1, a * 12);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [splitAt],
  );

  // Glowing debris specks raining out of the trail after the boom.
  const debris = useCallback<ParticleFn>(
    (_i, time, out, r) => {
      const born = boomAt + r[0] * 3.5;
      const dt = time - born;
      if (dt < 0) {
        out[4] = 0;
        return;
      }
      const p = along(born - 0.6 - r[1] * 1.2);
      out[0] = p.x + (r[2] - 0.5) * 160 + dt * 10;
      out[1] = p.y - dt * dt * 40 - dt * 60;
      out[2] = p.z + (r[3] - 0.5) * 160;
      out[3] = 0.6 + r[4];
      out[4] = Math.max(0, 1 - dt / 3) * (out[1] > 0 ? 1 : 0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boomAt],
  );

  // light glints on the river
  const ripples = useCallback<ParticleFn>((_i, time, out, r) => {
    out[0] = (r[0] - 0.5) * 520;
    out[1] = -0.5;
    out[2] = 30 + r[1] * r[1] * 220;
    out[3] = 0.6 + r[2];
    out[4] = Math.max(0, Math.sin(time * (2 + r[3] * 3) + r[4] * 20)) * 0.8;
  }, []);

  const flash = Math.max(0, 1 - Math.abs(t - boomAt) / 0.18) + 0.5 * Math.exp(-Math.max(0, t - boomAt) * 2) * (t > boomAt ? 1 : 0);
  const shakeEnv = t > boomAt ? Math.exp(-(t - boomAt) * 2.6) : 0;
  const sx = (Math.sin(t * 71) + Math.sin(t * 43 + 1) * 0.6) * 26 * shakeEnv;
  const sy = (Math.cos(t * 59) + Math.sin(t * 31) * 0.5) * 20 * shakeEnv;
  const rot = Math.sin(t * 47) * 0.9 * shakeEnv;
  const lit = 0.75 + 0.7 * flash;

  const cam = mergeCamera(
    { type: "pushIn", from: [10, 18, 360], to: [0, 22, 320], target: [10, 158, 0], targetTo: [-15, 152, 0], fov: 60, ease: "inOut" },
    camera,
  );

  const glowCol = "#ff9a3c";
  return (
    <AbsoluteFill style={{ background: "#02030a" }}>
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) rotate(${rot}deg) scale(${1 + 0.05 * Math.min(1, shakeEnv * 3)})` }}>
        <SceneCanvas
          durationInFrames={durationInFrames}
          camera={cam}
          background="#02030a"
          fog={["#0b0a1a", 600, 1800]}
          sky="#5d6fa8"
          ground="#120c10"
          sunPosition={[60, 200, -100]}
          sunIntensity={0.35 + 1.4 * flash}
        >
          <SkyDome
            radius={1500}
            stops={[
              [-1, "#120a14"],
              [0, "#2a1a3a"],
              [0.12, "#121230"],
              [0.4, "#05061a"],
              [1, "#010208"],
            ]}
          />
          {/* island ground and the river in front */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, -200]}>
            <planeGeometry args={[1400, 460]} />
            <meshStandardMaterial color="#14121a" roughness={0.9} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 300]}>
            <planeGeometry args={[2400, 600]} />
            <meshStandardMaterial color="#05070f" roughness={0.25} metalness={0.6} />
          </mesh>
          <Particles count={1600} t={t} compute={ripples} size={2.2} color="#ffd9a0" seed={63} softness={0.6} opacity={0.6} additive maxPixelSize={5} />
          {towers.map((s, i) => (
            <TowerMesh key={i} s={s} lit={lit} />
          ))}
          {BOARDS.map((b, i) => (
            <group key={i}>
              <TextPanel card={b.card} height={b.h} position={[b.x, b.y, 22 + (b.z ?? 0)]} brightness={1.15} />
              <Glow position={[b.x, b.y, 26]} size={b.h * 3.2} color={typeof b.card.bg === "string" ? b.card.bg : "#ffffff"} opacity={0.3} />
              <Glow position={[b.x, -2, 150]} size={b.h * 2.2} stretch={[0.7, 2.4]} color={typeof b.card.bg === "string" ? b.card.bg : "#ffffff"} opacity={0.22} />
            </group>
          ))}
          {/* fireball: sky glow, trail, head, fragments */}
          <Glow position={[head.x, head.y, head.z]} size={1100} color="#ff6a1a" opacity={0.16 + 0.25 * flash} depthTest={false} />
          <Particles count={9000} t={t} compute={trail} size={24} color="#ff8a2a" seed={61} softness={0.95} opacity={0.5} additive maxPixelSize={70} />
          <Particles count={900} t={t} compute={debris} size={6} color="#ffc070" seed={62} softness={0.5} additive maxPixelSize={10} />
          <Glow position={[head.x, head.y, head.z]} size={260} color={glowCol} opacity={0.9} depthTest={false} stretch={[1.6, 1]} rotation={Math.atan2(dir.y, dir.x)} />
          <Glow position={[head.x, head.y, head.z]} size={110} color="#fff6dc" opacity={1} depthTest={false} />
          {Array.from({ length: FR }, (_, k) => {
            const p = fragPos(k, t);
            const on = smoothstep(splitAt, splitAt + 0.3, t);
            return <Glow key={k} position={[p.x, p.y, p.z]} size={80} color="#ffd08a" opacity={0.9 * on} depthTest={false} />;
          })}
          <pointLight position={[head.x * 0.4, 400, 100]} intensity={0.7 + 3 * flash} distance={1400} decay={0.5} color="#ffb070" />
        </SceneCanvas>
      </AbsoluteFill>
      {/* boom flash */}
      <AbsoluteFill style={{ background: "#ffcf9a", opacity: 0.35 * Math.max(0, 1 - Math.abs(t - boomAt) / 0.12), mixBlendMode: "screen" }} />
    </AbsoluteFill>
  );
};

export default NycFireball;
