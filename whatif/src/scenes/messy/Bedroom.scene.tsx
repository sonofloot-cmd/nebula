import React, { useCallback, useMemo } from "react";
import { AbsoluteFill, Easing } from "remotion";
import * as THREE from "three";
import { mergeCamera } from "../../three/camera";
import { Glow } from "../../three/glow";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { Person } from "../../three/props";
import { clamp01, lerp, mulberry32, smoothstep } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import { TextCard, TextPanel } from "../../three/text";
import type { SceneComponentProps, Vec3 } from "../../types";
import { crackTexture, dustTexture, skyTexture, wallpaperTexture, webTexture } from "./textures";

/**
 * THE BEDROOM — one reusable set for time-skip episodes. A low-poly teenager's room seen
 * 3/4 from the doorway, driven entirely by a state (all 0..1):
 *
 *   hoodie food mould flies clutter collapse dust grime plantDead cobwebs peel yellow buried
 *   rot wallpaper crack vine gone power sun bottleGlow
 *
 * Each scene passes `props.state`; the room morphs from the PREVIOUS scene's state over
 * `props.morph` seconds (default 1.4) while the window light flickers through `props.cycles`
 * day/night cycles — a smooth time-lapse, with one fixed camera. Extras:
 *   props.walkOut: true  → hook: someone drops a hoodie and walks out (door opens/closes)
 *   props.doorAt: number → final gag: the door creaks open and a hand pushes it
 * World units are metres. Room: x −2…2, z −2…2, height 2.6. Door on the left wall.
 * All brand names are invented.
 */

export interface RoomState {
  hoodie: number;
  food: number;
  mould: number;
  flies: number;
  clutter: number;
  collapse: number;
  dust: number;
  grime: number;
  plantDead: number;
  cobwebs: number;
  peel: number;
  yellow: number;
  buried: number;
  rot: number;
  wallpaper: number;
  crack: number;
  vine: number;
  gone: number;
  power: number;
  sun: number;
  bottleGlow: number;
}

const ZERO: RoomState = {
  hoodie: 0, food: 0, mould: 0, flies: 0, clutter: 0, collapse: 0, dust: 0, grime: 0, plantDead: 0,
  cobwebs: 0, peel: 0, yellow: 0, buried: 0, rot: 0, wallpaper: 0, crack: 0, vine: 0, gone: 0,
  power: 1, sun: 0.8, bottleGlow: 0,
};

const full = (s?: Partial<RoomState>): RoomState => ({ ...ZERO, ...(s ?? {}) });
const mixState = (a: RoomState, b: RoomState, k: number): RoomState => {
  const out = { ...a };
  (Object.keys(a) as Array<keyof RoomState>).forEach((key) => (out[key] = lerp(a[key], b[key], k)));
  return out;
};

const DUST = new THREE.Color("#9a9283");
const CHAR = new THREE.Color("#2a211b");
/** Colour after dust, grime and rot. */
const aged = (hex: string, dust: number, rot = 0) => {
  const c = new THREE.Color(hex).lerp(DUST, clamp01(dust) * 0.55);
  return c.lerp(CHAR, clamp01(rot) * 0.6);
};

const Box: React.FC<{ p: Vec3; s: Vec3; c: THREE.Color | string; r?: Vec3; e?: string; ei?: number; rough?: number; metal?: number }> = ({
  p,
  s,
  c,
  r,
  e,
  ei = 0,
  rough = 0.85,
  metal = 0,
}) => (
  <mesh position={p} rotation={r}>
    <boxGeometry args={s} />
    <meshStandardMaterial color={c} flatShading roughness={rough} metalness={metal} emissive={e ?? "#000000"} emissiveIntensity={ei} />
  </mesh>
);

/** A thin dust layer lying on a horizontal surface. */
const DustLayer: React.FC<{ p: Vec3; w: number; d: number; amount: number }> = ({ p, w, d, amount }) => {
  const tex = useMemo(() => {
    const t = dustTexture().clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(1, w / 0.8), Math.max(1, d / 0.8));
    return t;
  }, [w, d]);
  if (amount <= 0.01) return null;
  return (
    <mesh position={p} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial map={tex} transparent opacity={Math.min(0.95, amount * 1.1)} depthWrite={false} roughness={1} color="#d8d0c0" />
    </mesh>
  );
};

/** Cobweb sheet anchored at a corner. */
const Web: React.FC<{ p: Vec3; r: Vec3; size: number; amount: number }> = ({ p, r, size, amount }) => {
  const tex = useMemo(() => webTexture(), []);
  if (amount <= 0.01) return null;
  return (
    <mesh position={p} rotation={r} scale={0.3 + 0.7 * amount}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={tex} transparent opacity={Math.min(1, amount * 1.3) * 0.9} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} color="#f2efe6" />
    </mesh>
  );
};

/** Generic floor junk. Items appear as `clutter` passes their threshold. */
interface Junk {
  kind: "can" | "pizza" | "sock" | "paper" | "box" | "bag" | "cup";
  p: Vec3;
  ry: number;
  at: number;
  color: string;
}
const JUNK_COLORS = { can: ["#e0182d", "#1fb35a", "#ffb000"], sock: ["#f4f4f4", "#222222", "#3d5a80"], bag: ["#ff4fa3", "#ffd23a"], box: ["#5b1fd6", "#0b3fd8"] };
const makeJunk = (): Junk[] => {
  const r = mulberry32(17);
  const kinds: Junk["kind"][] = ["can", "pizza", "sock", "paper", "box", "bag", "cup", "can", "paper", "sock", "can", "paper"];
  const out: Junk[] = [];
  for (let i = 0; i < 46; i++) {
    const kind = kinds[i % kinds.length];
    let x = -0.9 + r() * 2.7;
    let z = -1.3 + r() * 2.4;
    if (x < -0.95 && z > -0.75) x = -0.9 + r() * 0.5; // keep off the bed
    if (z < -1.1 && x < -0.9) z = -0.9 + r() * 0.4; // keep the doorway clear
    const pick = (arr: string[]) => arr[Math.floor(r() * arr.length)];
    const color =
      kind === "can" ? pick(JUNK_COLORS.can) : kind === "sock" ? pick(JUNK_COLORS.sock) : kind === "bag" ? pick(JUNK_COLORS.bag) : kind === "box" ? pick(JUNK_COLORS.box) : kind === "pizza" ? "#c9a46a" : kind === "cup" ? "#f2f2f2" : "#efe9dc";
    out.push({ kind, p: [x, 0, z], ry: r() * Math.PI * 2, at: (i + r()) / 48, color });
  }
  return out;
};

const JunkItem: React.FC<{ j: Junk; s: RoomState }> = ({ j, s }) => {
  const show = smoothstep(j.at, j.at + 0.04, s.clutter);
  const organic = j.kind === "pizza" || j.kind === "paper" || j.kind === "sock" || j.kind === "cup";
  const left = organic ? 1 - smoothstep(0.2, 1, s.gone) * 0.85 : 1;
  const sc = show * left;
  if (sc <= 0.01) return null;
  const col = aged(j.kind === "paper" ? (s.yellow > 0.3 ? "#d8c48a" : j.color) : j.color, s.dust, organic ? s.rot : s.rot * 0.3);
  return (
    <group position={j.p} rotation={[0, j.ry, 0]} scale={sc}>
      {j.kind === "can" ? (
        <mesh position={[0, 0.035, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.033, 0.033, 0.12, 8]} />
          <meshStandardMaterial color={col} metalness={0.5} roughness={0.4} flatShading />
        </mesh>
      ) : j.kind === "pizza" ? (
        <Box p={[0, 0.02, 0]} s={[0.4, 0.04, 0.4]} c={col} />
      ) : j.kind === "sock" ? (
        <Box p={[0, 0.02, 0]} s={[0.22, 0.04, 0.08]} c={col} />
      ) : j.kind === "paper" ? (
        <mesh position={[0, 0.05, 0]}>
          <icosahedronGeometry args={[0.06, 0]} />
          <meshStandardMaterial color={col} flatShading roughness={1} />
        </mesh>
      ) : j.kind === "box" ? (
        <Box p={[0, 0.015, 0]} s={[0.17, 0.03, 0.22]} c={col} />
      ) : j.kind === "bag" ? (
        <Box p={[0, 0.03, 0]} s={[0.2, 0.06, 0.26]} c={col} r={[0, 0, 0.2]} />
      ) : (
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.045, 0.035, 0.1, 8]} />
          <meshStandardMaterial color={col} flatShading />
        </mesh>
      )}
    </group>
  );
};

/** Clothes pile: soft lumps stacked on the chair, sliding to the floor as it collapses. */
const CLOTHES = ["#c0392b", "#2c3e50", "#16a085", "#8e44ad", "#f39c12", "#ecf0f1", "#2980b9", "#d35400", "#7f8c8d"];
const ClothesPile: React.FC<{ s: RoomState; seat: Vec3 }> = ({ s, seat }) => {
  const lumps = useMemo(() => {
    const r = mulberry32(23);
    return Array.from({ length: 22 }, (_, i) => ({
      at: i / 24,
      onChair: [seat[0] + (r() - 0.5) * 0.35, seat[1] + 0.06 + i * 0.045, seat[2] + (r() - 0.5) * 0.3] as Vec3,
      onFloor: [seat[0] - 0.3 + (r() - 0.5) * 0.9, 0.05 + r() * 0.08, seat[2] + 0.35 + r() * 0.5] as Vec3,
      scale: [0.2 + r() * 0.12, 0.07 + r() * 0.05, 0.16 + r() * 0.1] as Vec3,
      rot: [(r() - 0.5) * 0.6, r() * 3, (r() - 0.5) * 0.6] as Vec3,
      color: CLOTHES[Math.floor(r() * CLOTHES.length)],
      delay: r() * 0.3,
    }));
  }, [seat]);
  return (
    <group>
      {lumps.map((l, i) => {
        const show = smoothstep(l.at * 0.9, l.at * 0.9 + 0.05, s.clutter);
        const fall = smoothstep(l.delay, l.delay + 0.7, s.collapse);
        const shrink = 1 - 0.75 * smoothstep(0.1, 1, s.gone) - 0.2 * s.rot;
        const sc = show * shrink;
        if (sc <= 0.01) return null;
        const p: Vec3 = [lerp(l.onChair[0], l.onFloor[0], fall), lerp(l.onChair[1], l.onFloor[1], fall), lerp(l.onChair[2], l.onFloor[2], fall)];
        return (
          <mesh key={i} position={p} rotation={l.rot} scale={[l.scale[0] * sc, l.scale[1] * (1 - 0.5 * s.rot) * sc, l.scale[2] * sc]}>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={aged(l.color, s.dust * 0.9, s.rot)} flatShading roughness={1} />
          </mesh>
        );
      })}
    </group>
  );
};

const POSTER_A: TextCard = { lines: ["NEON", "RAIDERS", "III"], width: 512, height: 768, bg: "#120a2a", fg: ["#ff3df2", "#39e6ff", "#ffe14d"], size: [150, 150, 120], glow: "#ff3df2", border: "#39e6ff", borderWidth: 14 };
const POSTER_B: TextCard = { lines: ["SKULL", "CITY", "WORLD TOUR"], width: 512, height: 768, bg: "#1a1a1a", fg: ["#f4f4f4", "#e0182d", "#f4f4f4"], size: [150, 170, 64], border: "#e0182d", borderWidth: 10 };

const Poster: React.FC<{ card: TextCard; p: Vec3; ry: number; s: RoomState; seed: number }> = ({ card, p, ry, s, seed }) => {
  const r = mulberry32(seed);
  const delay = r() * 0.3;
  const peel = smoothstep(delay, delay + 0.6, s.peel);
  const fall = smoothstep(0.75, 1, s.peel);
  const fade = 1 - smoothstep(0.2, 0.9, s.gone);
  if (fade <= 0.01) return null;
  const y = lerp(p[1], 0.05, fall);
  const tint = 1 - 0.45 * s.yellow - 0.3 * s.dust;
  return (
    <group position={[p[0], y, p[2]]} rotation={[0, ry, 0]}>
      <group rotation={[fall * -1.45 + peel * 0.25, 0, peel * 0.22 * (seed % 2 ? 1 : -1)]}>
        <TextPanel card={card} height={0.75} position={[0, 0, 0.01 + peel * 0.08]} brightness={tint} opacity={fade} />
      </group>
    </group>
  );
};

const Bedroom: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props, prevProps }) => {
  const t = useSceneTime();
  const target = full(props.state as Partial<RoomState>);
  const prev = prevProps?.state ? full(prevProps.state as Partial<RoomState>) : target;
  const morph = (props.morph as number) ?? 1.4;
  const cycles = (props.cycles as number) ?? 2;
  const p = clamp01(t / morph);
  const k = Easing.inOut(Easing.cubic)(p);
  const s = mixState(prev, target, k);

  // time-lapse light: day/night flicker during the morph, landing on the stage's light
  const flick = Math.sin(Math.PI * p);
  const osc = 0.5 + 0.5 * Math.cos(Math.PI * 2 * cycles * p);
  const sun = lerp(s.sun, osc, flick * (cycles > 0 ? 0.85 : 0));
  const sunCol = new THREE.Color("#3d5a9a").lerp(new THREE.Color("#ffad5c"), sun);

  // hook: someone drops a hoodie and walks out
  const walkOut = !!props.walkOut;
  const doorAt = props.doorAt as number | undefined;
  const walkP = clamp01((t - 0.2) / 2.6);
  const walker: Vec3 = [lerp(0.9, -1.45, walkP), 0, lerp(-0.45, -1.95, walkP)];
  const dropAt = 0.9;
  const hoodieFall = walkOut ? clamp01((t - dropAt) / 0.35) : 1;
  const hoodieOn = walkOut ? (t >= dropAt ? 1 : 0) : s.hoodie;
  let door = 0;
  if (walkOut) door = t < 2.9 ? smoothstep(0.6, 1.4, t) * 1.25 : 1.25 * (1 - smoothstep(2.9, 3.4, t));
  if (doorAt !== undefined) door = Easing.out(Easing.cubic)(clamp01((t - doorAt) / 1.1)) * 1.05;

  const r = useMemo(() => mulberry32(1), []);
  void r;
  const junk = useMemo(() => makeJunk(), []);
  const wallpaperTex = useMemo(() => wallpaperTexture(), []);
  const skyDay = useMemo(() => skyTexture("day"), []);
  const skyNight = useMemo(() => skyTexture("night"), []);
  const crackTex = useMemo(() => crackTexture(), []);

  // food on the plate: fresh → mouldy → shrivelled → gone
  const foodLeft = s.food * (1 - 0.9 * s.rot);
  const mould = s.mould * (1 - s.rot);

  // fruit flies around the plate
  const PLATE: Vec3 = [0.78, 0.8, -1.62];
  const flies = useCallback<ParticleFn>(
    (i, time, out, rr) => {
      const n = Math.floor(s.flies * 60);
      if (i >= n) {
        out[4] = 0;
        return;
      }
      const a = time * (1.5 + rr[0] * 2.5) + rr[1] * 20;
      const rad = 0.12 + rr[2] * 0.4;
      out[0] = PLATE[0] + Math.cos(a) * rad + Math.sin(time * 7 + rr[3] * 9) * 0.03;
      out[1] = PLATE[1] + 0.05 + rr[4] * 0.45 + Math.sin(time * 5 + rr[5] * 7) * 0.05;
      out[2] = PLATE[2] + Math.sin(a * 1.3) * rad * 0.7;
      out[3] = 1;
      out[4] = 1;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.flies],
  );
  // dust motes in the window beam
  const motes = useCallback<ParticleFn>(
    (_i, time, out, rr) => {
      const f = rr[0];
      out[0] = lerp(-0.2, 0.6, f) + (rr[1] - 0.5) * 0.9 + Math.sin(time * 0.3 + rr[2] * 9) * 0.06;
      out[1] = lerp(1.6, 0.2, f) + (rr[3] - 0.5) * 0.5 + ((time * 0.04 * (rr[4] - 0.5)) % 0.3);
      out[2] = lerp(-1.9, 0.6, f) + (rr[5] - 0.5) * 0.5;
      out[3] = 0.6 + rr[6];
      out[4] = (0.25 + 0.75 * s.dust) * smoothstep(0.25, 0.8, sun) * (0.5 + 0.5 * Math.sin(time * 2 + rr[7] * 30));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.dust, sun],
  );

  // vine through the cracked window: a chain of segments growing down the wall and across the floor
  const vinePts = useMemo(() => {
    const pts: Vec3[] = [];
    for (let i = 0; i <= 40; i++) {
      const f = i / 40;
      if (f < 0.35) pts.push([-0.42 + f * 0.6, 1.2 - f * 2.6, -1.96]);
      else if (f < 0.6) pts.push([-0.21 + (f - 0.35) * 1.2, 0.29 - (f - 0.35) * 1.1, -1.96 + (f - 0.35) * 0.4]);
      else pts.push([0.09 + (f - 0.6) * 1.2, 0.02, -1.86 + (f - 0.6) * 2.6 + Math.sin(f * 12) * 0.08]);
    }
    return pts;
  }, []);
  const vineN = Math.floor(s.vine * 40);

  const cam = mergeCamera({ type: "dolly", from: [1.35, 2.3, 2.5], to: [1.3, 2.26, 2.42], target: [-0.1, 0.72, -0.95], fov: 76, ease: "inOut" }, camera);

  const wallCol = aged("#2d3c4f", 0, s.grime * 0.4);
  const plaster = aged("#5a5248", s.dust * 0.4, s.grime * 0.3);
  const floorCol = aged("#6a4630", s.dust * 0.8, s.grime * 0.25);
  const woodCol = aged("#7a4f32", s.dust, s.rot * 0.5);
  const sheetCol = new THREE.Color("#e8eef6").lerp(new THREE.Color("#8d877a"), clamp01(s.grime * 0.9 + s.dust * 0.3)).lerp(CHAR, s.rot * 0.5);
  const duvetCol = aged("#2f6db5", s.dust, s.rot);
  const plantCol = new THREE.Color("#3f9a3a").lerp(new THREE.Color("#7a5a2a"), s.plantDead).lerp(CHAR, s.rot * 0.7);

  // stack of junk burying the PC
  const heap = useMemo(() => {
    const rr = mulberry32(41);
    return Array.from({ length: 26 }, (_, i) => ({
      at: i / 28,
      p: [1.45 + (rr() - 0.5) * 0.9, 0.08 + rr() * 0.75 * (i / 26), -1.2 + (rr() - 0.5) * 0.7] as Vec3,
      s: [0.22 + rr() * 0.2, 0.1 + rr() * 0.12, 0.2 + rr() * 0.2] as Vec3,
      rot: [rr() - 0.5, rr() * 3, rr() - 0.5] as Vec3,
      color: ["#8a7a62", "#6b5a48", "#a89a7c", "#4a5568", "#7f8c8d"][Math.floor(rr() * 5)],
    }));
  }, []);

  const doorHinge: Vec3 = [-1.9, 0, -1.98];
  const hallLight = clamp01(door / 0.6);
  const lampOn = s.power;
  const bottleShine = s.bottleGlow;

  return (
    <AbsoluteFill style={{ background: "#07060a" }}>
      <SceneCanvas durationInFrames={durationInFrames} camera={cam} background="#07060a" lights={false}>
        {/* ---------- lighting ---------- */}
        <hemisphereLight args={["#7a5a42", "#1a0e0a", 0.85 + 0.4 * sun]} />
        <pointLight position={[0.2, 2.3, 0.2]} intensity={0.9} distance={6} decay={1.2} color="#ffb070" />
        <directionalLight position={[-0.6, 3.2, -4.5]} intensity={0.35 + 2.4 * sun} color={sunCol} />
        <pointLight position={[1.75, 1.25, -1.75]} intensity={3.6 * lampOn} distance={6} decay={1.3} color="#ffb36b" />
        <pointLight position={[1.15, 1.0, -1.6]} intensity={1.2 * lampOn} distance={3} decay={1.6} color="#6ab0ff" />
        <pointLight position={[1.75, 0.35, -0.95]} intensity={0.8 * lampOn * (1 - s.buried)} distance={1.6} decay={2} color="#ff3df2" />
        <pointLight position={[-0.3, 1.1, 0.3]} intensity={0.35 + 0.4 * (1 - lampOn)} distance={7} decay={1.2} color="#ffcf9a" />
        <pointLight position={[-1.45, 1.3, -1.55]} intensity={4 * hallLight} distance={6} decay={1.2} color="#ffe2b0" />

        {/* ---------- shell: floor, walls, ceiling ---------- */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4, 4]} />
          <meshStandardMaterial color={floorCol} roughness={0.9} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.1, 0.004, 0.15]}>
          <planeGeometry args={[1.9, 1.3]} />
          <meshStandardMaterial color={aged("#8a2230", s.dust * 0.9, s.rot * 0.7)} roughness={1} />
        </mesh>
        {/* plaster behind the wallpaper */}
        <mesh position={[0, 1.3, -2]}>
          <planeGeometry args={[4, 2.6]} />
          <meshStandardMaterial color={plaster} roughness={1} />
        </mesh>
        <mesh position={[-2, 1.3, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[4, 2.6]} />
          <meshStandardMaterial color={plaster} roughness={1} />
        </mesh>
        <mesh position={[2, 1.3, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[4, 2.6]} />
          <meshStandardMaterial color={wallCol} roughness={1} />
        </mesh>
        <mesh position={[0, 2.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4, 4]} />
          <meshStandardMaterial color={aged("#2a2622", 0, s.grime * 0.3)} roughness={1} />
        </mesh>
        {/* wallpaper strips (peel from the top and fall as `wallpaper` rises) */}
        {Array.from({ length: 8 }, (_, i) => {
          const back = i < 5;
          const x0 = back ? -2 + i * 0.8 + 0.4 : 0;
          const z0 = back ? -1.995 : -1.6 + (i - 5) * 0.8 + 0.4;
          // skip the window and door openings
          const delay = ((i * 37) % 10) / 10 * 0.5;
          const pe = smoothstep(delay, delay + 0.5, s.wallpaper);
          const fallen = smoothstep(delay + 0.4, delay + 0.6, s.wallpaper);
          const tex = wallpaperTex;
          return (
            <group key={i} position={back ? [x0, 2.6, z0] : [-1.995, 2.6, z0]} rotation={[0, back ? 0 : Math.PI / 2, 0]}>
              <group rotation={[pe * 0.9 + fallen * 0.6, 0, 0]} position={[0, -fallen * 1.6, fallen * 0.3]}>
                <mesh position={[0, -1.3, 0.002]}>
                  <planeGeometry args={[0.8, 2.6]} />
                  <meshStandardMaterial map={tex} color={wallCol} roughness={1} side={THREE.DoubleSide} transparent opacity={1 - smoothstep(0.6, 1, s.gone) * 0.9} />
                </mesh>
              </group>
            </group>
          );
        })}

        {/* ---------- window (back wall) ---------- */}
        <group position={[-0.2, 1.5, -1.985]}>
          <mesh>
            <planeGeometry args={[1.1, 1.0]} />
            <meshBasicMaterial map={skyNight} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.001]}>
            <planeGeometry args={[1.1, 1.0]} />
            <meshBasicMaterial map={skyDay} transparent opacity={sun} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.004]}>
            <planeGeometry args={[1.1, 1.0]} />
            <meshBasicMaterial map={crackTex} transparent opacity={s.crack} depthWrite={false} toneMapped={false} />
          </mesh>
          {/* frame */}
          <Box p={[0, 0.53, 0.03]} s={[1.24, 0.07, 0.08]} c={aged("#e8e2d4", s.dust, s.rot * 0.6)} />
          <Box p={[0, -0.53, 0.06]} s={[1.3, 0.07, 0.2]} c={aged("#e8e2d4", s.dust, s.rot * 0.6)} />
          <Box p={[-0.585, 0, 0.03]} s={[0.07, 1.06, 0.08]} c={aged("#e8e2d4", s.dust, s.rot * 0.6)} />
          <Box p={[0.585, 0, 0.03]} s={[0.07, 1.06, 0.08]} c={aged("#e8e2d4", s.dust, s.rot * 0.6)} />
          <Box p={[0, 0, 0.03]} s={[0.04, 1.0, 0.05]} c={aged("#e8e2d4", s.dust, s.rot * 0.6)} />
          <Glow position={[0, 0, 0.1]} size={2.4} color={sunCol.getStyle()} opacity={0.25 + 0.35 * sun} />
        </group>
        {/* the light shaft */}
        <mesh position={[0.0, 0.95, -1.0]} rotation={[0.72, 0.05, 0]}>
          <boxGeometry args={[1.0, 0.95, 2.6]} />
          <meshBasicMaterial color={sunCol} transparent opacity={0.06 * sun * (0.6 + 1.2 * s.dust)} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0.05]} position={[0.1, 0.006, -0.25]}>
          <planeGeometry args={[1.0, 1.3]} />
          <meshBasicMaterial color={sunCol} transparent opacity={0.22 * sun} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <Particles count={700} t={t} compute={motes} size={0.012} color="#ffe6c0" seed={91} softness={0.5} additive maxPixelSize={4} />

        {/* plant on the sill */}
        {s.gone < 0.98 ? (
          <group position={[0.12, 1.03, -1.9]}>
            <mesh position={[0, 0.06, 0]}>
              <cylinderGeometry args={[0.07, 0.05, 0.12, 8]} />
              <meshStandardMaterial color={aged("#b5552e", s.dust)} flatShading />
            </mesh>
            {Array.from({ length: 7 }, (_, i) => {
              const a = (i / 7) * Math.PI * 2;
              const droop = 0.3 + 1.1 * s.plantDead;
              const sc = 1 - 0.8 * s.gone - 0.3 * s.rot;
              return (
                <mesh key={i} position={[Math.cos(a) * 0.05, 0.16, Math.sin(a) * 0.05]} rotation={[Math.sin(a) * droop, 0, -Math.cos(a) * droop]} scale={[0.04 * sc, 0.16 * sc, 0.025 * sc]}>
                  <icosahedronGeometry args={[1, 0]} />
                  <meshStandardMaterial color={plantCol} flatShading />
                </mesh>
              );
            })}
          </group>
        ) : null}

        {/* ---------- bed (left wall) ---------- */}
        <group position={[-1.5, 0, 0.32]}>
          <Box p={[0, 0.15, 0]} s={[1.0, 0.3, 2.05]} c={woodCol} />
          <Box p={[0, 0.55, -1.0]} s={[1.0, 0.8, 0.07]} c={woodCol} />
          {/* mattress */}
          <Box p={[0, 0.39, 0.02]} s={[0.94, 0.18 * (1 - 0.7 * s.gone), 1.95]} c={sheetCol} />
          {/* exposed springs once the fabric has gone */}
          {s.gone > 0.3
            ? Array.from({ length: 12 }, (_, i) => (
                <mesh key={i} position={[-0.3 + (i % 3) * 0.3, 0.36, -0.75 + Math.floor(i / 3) * 0.5]} rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.09, 0.012, 4, 10]} />
                  <meshStandardMaterial color={aged("#7a6a5a", s.dust * 0.6)} metalness={0.6} roughness={0.5} />
                </mesh>
              ))
            : null}
          {/* duvet + pillow */}
          <group scale={[1, 1 - 0.8 * s.gone, 1 - 0.5 * s.gone]}>
            <Box p={[0, 0.52, 0.25]} s={[0.98, 0.1, 1.4]} c={duvetCol} r={[0, 0, 0.04]} />
            <Box p={[0, 0.53, -0.72]} s={[0.6, 0.12, 0.3]} c={sheetCol} />
          </group>
          <DustLayer p={[0, 0.59, 0.1]} w={0.98} d={1.9} amount={s.dust * (1 - 0.6 * s.gone)} />
        </group>

        {/* ---------- desk + gaming setup (back-right) ---------- */}
        <group>
          <Box p={[1.2, 0.73, -1.68]} s={[1.5, 0.05, 0.62]} c={aged("#1c1c22", s.dust)} />
          {[[0.5, -1.42], [1.9, -1.42], [0.5, -1.95], [1.9, -1.95]].map(([x, z], i) => (
            <Box key={i} p={[x, 0.36, z]} s={[0.05, 0.72, 0.05]} c={aged("#1c1c22", s.dust)} />
          ))}
          {/* monitor */}
          <Box p={[1.2, 1.12, -1.9]} s={[0.66, 0.4, 0.04]} c={aged("#111116", s.dust * 0.8)} />
          <mesh position={[1.2, 1.12, -1.877]}>
            <planeGeometry args={[0.62, 0.36]} />
            <meshBasicMaterial color={new THREE.Color("#1d2b6a").lerp(new THREE.Color("#3cf0ff"), 0.35).multiplyScalar(0.25 + 0.75 * lampOn)} toneMapped={false} />
          </mesh>
          {lampOn > 0.05 ? (
            <TextPanel
              card={{ lines: ["GAME OVER?"], width: 512, height: 256, fg: "#ff3df2", size: 90, weight: 900, glow: "#ff3df2" }}
              height={0.16}
              position={[1.2, 1.13, -1.875]}
              opacity={lampOn}
            />
          ) : null}
          <Box p={[1.2, 0.86, -1.9]} s={[0.06, 0.24, 0.05]} c={aged("#111116", s.dust)} />
          {/* keyboard with RGB edge */}
          <Box p={[1.2, 0.77, -1.6]} s={[0.46, 0.025, 0.15]} c={aged("#15151a", s.dust)} />
          <Box p={[1.2, 0.763, -1.52]} s={[0.47, 0.01, 0.01]} c="#000" e="#39e6ff" ei={1.6 * lampOn} />
          {/* desk lamp */}
          <Box p={[1.78, 0.77, -1.82]} s={[0.12, 0.03, 0.12]} c={aged("#333", s.dust)} />
          <Box p={[1.78, 0.98, -1.85]} s={[0.025, 0.42, 0.025]} c={aged("#333", s.dust)} r={[0.25, 0, 0]} />
          <mesh position={[1.78, 1.2, -1.78]} rotation={[0.9, 0, 0]}>
            <coneGeometry args={[0.09, 0.14, 8, 1, true]} />
            <meshStandardMaterial color={aged("#d9a441", s.dust)} side={THREE.DoubleSide} emissive="#ffcf7a" emissiveIntensity={0.6 * lampOn} />
          </mesh>
          <Glow position={[1.78, 1.13, -1.72]} size={0.9} color="#ffbf73" opacity={0.75 * lampOn} />
          {/* plate + food */}
          <group position={[PLATE[0], 0.765, PLATE[2]]} scale={1.6}>
          <mesh>
            <cylinderGeometry args={[0.15, 0.12, 0.02, 14]} />
            <meshStandardMaterial color={aged("#f4f1ea", s.dust, s.rot * 0.2)} roughness={0.5} />
          </mesh>
          {s.food > 0.01 ? (
            <group position={[0, 0.016, 0]}>
              {/* half-eaten pizza slice + crusts */}
              <mesh rotation={[0, 0.5, 0]} scale={[foodLeft, foodLeft * (1 - 0.5 * s.rot), foodLeft]}>
                <cylinderGeometry args={[0.11, 0.11, 0.025, 3]} />
                <meshStandardMaterial color={new THREE.Color("#e8a23a").lerp(new THREE.Color("#5a4a2a"), Math.min(1, mould * 0.7 + s.rot))} flatShading />
              </mesh>
              <mesh position={[0.06, 0.01, 0.05]} rotation={[0, 0.3, Math.PI / 2]} scale={foodLeft}>
                <cylinderGeometry args={[0.018, 0.018, 0.1, 6]} />
                <meshStandardMaterial color={new THREE.Color("#c9873a").lerp(new THREE.Color("#4a3a22"), Math.min(1, mould * 0.6 + s.rot))} flatShading />
              </mesh>
              {/* mould colonies */}
              {Array.from({ length: 9 }, (_, i) => {
                const a = i * 2.39;
                const m = smoothstep(i / 12, i / 12 + 0.3, mould) * foodLeft;
                if (m <= 0.01) return null;
                return (
                  <mesh key={i} position={[Math.cos(a) * 0.06, 0.02, Math.sin(a) * 0.06]} scale={0.03 * m * (1 + (i % 3) * 0.4)}>
                    <icosahedronGeometry args={[1, 1]} />
                    <meshStandardMaterial color={i % 3 === 0 ? "#e8f0dc" : i % 3 === 1 ? "#6f9a4a" : "#3d6b3a"} flatShading roughness={1} emissive="#9fd07a" emissiveIntensity={0.15} />
                  </mesh>
                );
              })}
            </group>
          ) : null}
          </group>
          {/* energy-drink can (made-up brand) */}
          {s.food > 0.01 || s.clutter > 0.1 ? (
            <group position={[1.02, 0.76, -1.78]} scale={1.5 * (1 - 0.2 * s.rot)}>
              <mesh position={[0, 0.07, 0]}>
                <cylinderGeometry args={[0.033, 0.033, 0.13, 10]} />
                <meshStandardMaterial color={aged("#1fb35a", s.dust * 0.8, s.rot * 0.4)} metalness={0.6} roughness={0.35} />
              </mesh>
            </group>
          ) : null}
          {/* the plastic bottle (the twist): always clean-looking */}
          <group position={[0.6, 0.76, -1.8]} scale={1.7}>
            <mesh position={[0, 0.13, 0]}>
              <cylinderGeometry args={[0.04, 0.042, 0.24, 12]} />
              <meshPhysicalMaterial color="#9fe0ff" roughness={0.08} metalness={0} transmission={0} transparent opacity={0.78} emissive="#3fb8ff" emissiveIntensity={0.15 + 1.2 * bottleShine} clearcoat={1} />
            </mesh>
            <mesh position={[0, 0.28, 0]}>
              <cylinderGeometry args={[0.018, 0.03, 0.06, 10]} />
              <meshPhysicalMaterial color="#9fe0ff" roughness={0.08} transparent opacity={0.8} emissive="#3fb8ff" emissiveIntensity={0.15 + 1.2 * bottleShine} />
            </mesh>
            <mesh position={[0, 0.32, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.025, 10]} />
              <meshStandardMaterial color="#1f6fe0" emissive="#1f6fe0" emissiveIntensity={0.3 + bottleShine} />
            </mesh>
            <mesh position={[0, 0.12, 0]}>
              <cylinderGeometry args={[0.0425, 0.0435, 0.07, 12, 1, true]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.1 + 0.5 * bottleShine} side={THREE.DoubleSide} />
            </mesh>
            <Glow position={[0, 0.15, 0.05]} size={0.9} color="#9fe8ff" opacity={0.8 * bottleShine} />
          </group>
          {/* shelf with made-up game boxes */}
          <Box p={[1.25, 1.62, -1.9]} s={[0.9, 0.03, 0.2]} c={woodCol} />
          {["#e0182d", "#0b3fd8", "#ffb000", "#5b1fd6", "#1fb35a"].map((c, i) => (
            <Box key={i} p={[0.9 + i * 0.08, 1.73, -1.9]} s={[0.05, 0.19, 0.15]} c={aged(c, s.dust, s.rot * 0.5)} r={[0, 0, i === 4 ? 0.3 * s.peel : 0]} />
          ))}
          <DustLayer p={[1.2, 0.757, -1.68]} w={1.5} d={0.62} amount={s.dust} />
          <DustLayer p={[1.25, 1.64, -1.9]} w={0.9} d={0.2} amount={s.dust} />
          <DustLayer p={[-0.2, 1.0, -1.89]} w={1.3} d={0.2} amount={s.dust} />
        </group>

        {/* PC tower on the floor by the desk (RGB until the power goes) */}
        <group position={[1.75, 0, -1.0]}>
          <Box p={[0, 0.25, 0]} s={[0.24, 0.5, 0.48]} c={aged("#15151a", s.dust * 0.9)} metal={0.3} rough={0.5} />
          <mesh position={[-0.121, 0.3, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <ringGeometry args={[0.06, 0.08, 16]} />
            <meshBasicMaterial color={new THREE.Color("#ff3df2").multiplyScalar(0.15 + 0.85 * lampOn)} toneMapped={false} />
          </mesh>
          <mesh position={[-0.121, 0.13, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <ringGeometry args={[0.06, 0.08, 16]} />
            <meshBasicMaterial color={new THREE.Color("#39e6ff").multiplyScalar(0.15 + 0.85 * lampOn)} toneMapped={false} />
          </mesh>
          <DustLayer p={[0, 0.505, 0]} w={0.24} d={0.48} amount={s.dust} />
        </group>
        {/* the heap that buries the PC */}
        {heap.map((h, i) => {
          const sc = smoothstep(h.at, h.at + 0.06, s.buried) * (1 - 0.5 * s.gone);
          if (sc <= 0.01) return null;
          return (
            <mesh key={i} position={h.p} rotation={h.rot} scale={[h.s[0] * sc, h.s[1] * sc, h.s[2] * sc]}>
              <icosahedronGeometry args={[1, 0]} />
              <meshStandardMaterial color={aged(h.color, s.dust, s.rot * 0.6)} flatShading roughness={1} />
            </mesh>
          );
        })}

        {/* gaming chair + clothes pile */}
        <group position={[1.05, 0, -0.95]} rotation={[0, 0.5 + 0.25 * s.collapse, 0]}>
          <Box p={[0, 0.47, 0]} s={[0.5, 0.08, 0.48]} c={aged("#1a1a1a", s.dust, s.rot * 0.4)} />
          <Box p={[0, 0.85, 0.24]} s={[0.48, 0.72, 0.08]} c={aged("#1a1a1a", s.dust, s.rot * 0.4)} r={[-0.15 - 0.25 * s.collapse, 0, 0]} />
          <Box p={[0, 0.85, 0.2]} s={[0.12, 0.64, 0.02]} c={aged("#e0182d", s.dust, s.rot * 0.4)} r={[-0.15 - 0.25 * s.collapse, 0, 0]} />
          <Box p={[0, 0.23, 0]} s={[0.06, 0.4, 0.06]} c="#2a2a2a" metal={0.5} />
          <Box p={[0, 0.03, 0]} s={[0.55, 0.04, 0.08]} c="#2a2a2a" />
          <Box p={[0, 0.03, 0]} s={[0.08, 0.04, 0.55]} c="#2a2a2a" />
        </group>
        <ClothesPile s={s} seat={[1.05, 0.5, -0.95]} />

        {/* bin, overflowing */}
        <group position={[0.25, 0, -1.7]}>
          <mesh position={[0, 0.17, 0]}>
            <cylinderGeometry args={[0.15, 0.12, 0.34, 10, 1, true]} />
            <meshStandardMaterial color={aged("#3a3f4a", s.dust)} side={THREE.DoubleSide} flatShading />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => {
            const sc = smoothstep(i / 9, i / 9 + 0.1, s.clutter) * (1 - 0.85 * s.gone);
            if (sc <= 0.01) return null;
            return (
              <mesh key={i} position={[Math.cos(i * 2.4) * 0.07, 0.3 + (i % 4) * 0.05, Math.sin(i * 2.4) * 0.07]} scale={0.06 * sc}>
                <icosahedronGeometry args={[1, 0]} />
                <meshStandardMaterial color={aged(s.yellow > 0.4 ? "#d8c48a" : "#efe9dc", s.dust, s.rot)} flatShading />
              </mesh>
            );
          })}
        </group>

        {/* posters */}
        <Poster card={POSTER_A} p={[0.55, 1.85, -1.99]} ry={0} s={s} seed={2} />
        <Poster card={POSTER_B} p={[-1.99, 1.6, -0.35]} ry={Math.PI / 2} s={s} seed={5} />
        <Poster card={{ lines: ["ZAP!", "ENERGY"], width: 512, height: 768, bg: "#1fb35a", fg: ["#ffe14d", "#111111"], size: [200, 90] }} p={[1.6, 2.15, -1.99]} ry={0} s={s} seed={7} />

        {/* floor junk */}
        {junk.map((j, i) => (
          <JunkItem key={i} j={j} s={s} />
        ))}
        <DustLayer p={[0.15, 0.008, 0.1]} w={3.6} d={3.6} amount={s.dust * 0.75} />

        {/* hoodie */}
        {hoodieOn > 0.01 && s.gone < 0.95 ? (
          <group position={[lerp(0.3, 0.15, hoodieFall), lerp(1.0, 0.06, Easing.in(Easing.quad)(hoodieFall)), lerp(-0.85, -0.6, hoodieFall)]} rotation={[0, 0.6, hoodieFall * 0.2]}>
            <mesh scale={[0.3 * (1 - 0.6 * s.gone), 0.07 * (1 - 0.5 * s.rot), 0.24 * (1 - 0.6 * s.gone)]}>
              <icosahedronGeometry args={[1, 1]} />
              <meshStandardMaterial color={aged("#c0392b", s.dust, s.rot)} flatShading roughness={1} />
            </mesh>
            <mesh position={[0.18, 0.02, 0.06]} scale={[0.14, 0.04, 0.07]}>
              <icosahedronGeometry args={[1, 0]} />
              <meshStandardMaterial color={aged("#a83226", s.dust, s.rot)} flatShading />
            </mesh>
          </group>
        ) : null}

        {/* cobwebs in the corners and between things */}
        <Web p={[-1.98, 2.58, -1.98]} r={[0, Math.PI / 4, Math.PI]} size={0.9} amount={s.cobwebs} />
        <Web p={[1.98, 2.58, -1.98]} r={[0, -Math.PI / 4, Math.PI / 2]} size={0.9} amount={s.cobwebs} />
        <Web p={[0.5, 0.72, -1.96]} r={[0, 0, -Math.PI / 2]} size={0.6} amount={smoothstep(0.2, 0.8, s.cobwebs)} />
        <Web p={[1.55, 1.32, -1.88]} r={[0, 0, Math.PI]} size={0.55} amount={smoothstep(0.3, 1, s.cobwebs)} />
        <Web p={[-1.98, 0.62, -0.68]} r={[0, Math.PI / 2, 0]} size={0.7} amount={smoothstep(0.1, 0.7, s.cobwebs)} />
        <Web p={[0.36, 1.02, -1.97]} r={[0, 0, Math.PI / 2]} size={0.6} amount={smoothstep(0.4, 1, s.cobwebs)} />

        {/* vine creeping in through the crack */}
        {vinePts.slice(0, vineN).map((v, i) => (
          <group key={i} position={v}>
            <mesh>
              <sphereGeometry args={[0.025, 6, 4]} />
              <meshStandardMaterial color="#3f7a2e" flatShading />
            </mesh>
            {i % 2 === 0 ? (
              <mesh position={[0.05 * (i % 4 ? 1 : -1), 0.02, 0.02]} rotation={[0.4, i, 0.6]} scale={[0.07, 0.015, 0.045]}>
                <icosahedronGeometry args={[1, 0]} />
                <meshStandardMaterial color={i % 3 ? "#4f9a38" : "#3a7d2c"} flatShading />
              </mesh>
            ) : null}
          </group>
        ))}

        {/* door (back wall, left), hinged at the corner; hallway light behind it */}
        <mesh position={[-1.45, 1.0, -2.02]}>
          <planeGeometry args={[0.9, 2.0]} />
          <meshBasicMaterial color={new THREE.Color("#ffd9a0").multiplyScalar(0.2 + 0.9 * hallLight)} toneMapped={false} />
        </mesh>
        <Box p={[-1.45, 2.03, -1.98]} s={[1.0, 0.06, 0.06]} c={aged("#e8e2d4", s.dust, s.rot * 0.6)} />
        <group position={doorHinge} rotation={[0, -door, 0]}>
          <Box p={[0.45, 1.0, 0.02]} s={[0.9, 2.0, 0.04]} c={aged("#c9b79a", s.dust * 0.7, s.rot * 0.5)} />
          <mesh position={[0.8, 1.0, 0.06]}>
            <sphereGeometry args={[0.025, 8, 6]} />
            <meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* a hand pushing the door (final gag) */}
          {doorAt !== undefined && t > doorAt - 0.05 ? (
            <group position={[0.95, 1.05, -0.05]} scale={2.4}>
              <Box p={[0, 0, 0]} s={[0.09, 0.1, 0.03]} c="#e0ac69" />
              {[0, 1, 2, 3].map((f) => (
                <Box key={f} p={[0.07, 0.035 - f * 0.024, 0.0]} s={[0.07, 0.018, 0.025]} c="#e0ac69" />
              ))}
              <Box p={[-0.1, -0.02, -0.02]} s={[0.14, 0.07, 0.04]} c="#3d5a80" />
            </group>
          ) : null}
        </group>
        <Glow position={[-1.45, 1.1, -1.85]} size={1.8 * hallLight} color="#ffe2b0" opacity={0.6 * hallLight} />

        {/* the person leaving (hook) */}
        {walkOut && t < 3.0 ? (
          <Person position={[walker[0], Math.abs(Math.sin(t * 9)) * 0.03, walker[2]]} rotationY={Math.atan2(2.35, -1.5) - Math.PI / 2} shirt="#2c3e50" skin="#e0ac69" />
        ) : null}

        {/* fruit flies */}
        <Particles count={60} t={t} compute={flies} size={0.03} color="#141008" seed={92} softness={0.2} maxPixelSize={9} />
      </SceneCanvas>
    </AbsoluteFill>
  );
};

export default Bedroom;
