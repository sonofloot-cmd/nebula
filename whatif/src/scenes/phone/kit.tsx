import React, { useMemo } from "react";
import * as THREE from "three";
import { Glow, SkyDome } from "../../three/glow";
import { mulberry32 } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import type { CameraMove, Vec3 } from "../../types";

/*
 * Bright daytime cartoon kit for "doubling comedy" episodes: pastel sky, puffy clouds, grass,
 * footpath, pastel houses, trees, a cartoon person with arms, a toy car, a generic tank and a
 * GENERIC smartphone (black rounded slab, glowing screen, made-up app grid — no notch, no
 * logos, no real brands). World units are metres unless noted.
 */

const toon = (c: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => (
  <meshStandardMaterial color={c} flatShading roughness={0.75} {...extra} />
);

export const PASTEL_SKY: Array<[number, string]> = [
  [-1, "#bfe6ff"],
  [0, "#ffe3ef"],
  [0.08, "#cdeeff"],
  [0.45, "#8fd0ff"],
  [1, "#6bbdff"],
];

/** Sky dome + sun + puffy clouds. `scale` lets the same sky sit around huge scenes. */
export const BrightSky: React.FC<{ scale?: number; t?: number; night?: number }> = ({ scale = 1, t = 0, night = 0 }) => {
  const clouds = useMemo(() => {
    const r = mulberry32(5);
    return Array.from({ length: 14 }, () => ({
      a: r() * Math.PI * 2,
      h: 0.12 + r() * 0.25,
      s: 0.7 + r() * 0.8,
      blobs: Array.from({ length: 5 }, () => [r() - 0.5, r() * 0.3, r() - 0.5, 0.5 + r() * 0.5] as const),
    }));
  }, []);
  const R = 900 * scale;
  const stops: Array<[number, string]> = night
    ? [
        [-1, "#0d1030"],
        [0, "#2a2a5a"],
        [0.1, "#151a44"],
        [1, "#06081c"],
      ]
    : PASTEL_SKY;
  return (
    <group>
      <SkyDome radius={R} stops={stops} />
      {!night ? <Glow position={[R * 0.35, R * 0.45, -R * 0.75]} size={R * 0.35} color="#fff6c8" opacity={0.9} depthTest={false} /> : null}
      {!night
        ? clouds.map((c, i) => {
            const a = c.a + t * 0.004;
            return (
              <group key={i} position={[Math.cos(a) * R * 0.7, R * c.h, Math.sin(a) * R * 0.7]} scale={R * 0.06 * c.s}>
                {c.blobs.map((b, k) => (
                  <mesh key={k} position={[b[0] * 2, b[1], b[2]]} scale={b[3]}>
                    <icosahedronGeometry args={[1, 1]} />
                    <meshStandardMaterial color="#ffffff" flatShading roughness={1} emissive="#ffffff" emissiveIntensity={0.35} fog={false} />
                  </mesh>
                ))}
              </group>
            );
          })
        : null}
    </group>
  );
};

/** Grass, a road along X and a footpath beside it. */
export const Ground: React.FC<{ size?: number; road?: boolean }> = ({ size = 600, road = true }) => (
  <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color="#8fd16a" roughness={1} />
    </mesh>
    {road ? (
      <>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -4]}>
          <planeGeometry args={[size, 7]} />
          <meshStandardMaterial color="#6d7080" roughness={0.95} />
        </mesh>
        {Array.from({ length: Math.floor(size / 8) }, (_, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-size / 2 + i * 8, 0.015, -4]}>
            <planeGeometry args={[3, 0.25]} />
            <meshBasicMaterial color="#fff8d6" />
          </mesh>
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.2]}>
          <planeGeometry args={[size, 2.6]} />
          <meshStandardMaterial color="#e9dcc6" roughness={1} />
        </mesh>
      </>
    ) : null}
  </group>
);

export const HOUSE_COLORS = ["#ffb3c1", "#ffd6a5", "#fdffb6", "#caffbf", "#9bf6ff", "#a0c4ff", "#bdb2ff", "#ffc6ff"];

let winTex: THREE.CanvasTexture | null = null;
const windowTex = () => {
  if (winTex) return winTex;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#7cc6ff";
  ctx.fillRect(28, 26, 72, 70);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(62, 26, 4, 70);
  ctx.fillRect(28, 59, 72, 4);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillRect(34, 30, 20, 8);
  winTex = new THREE.CanvasTexture(c);
  winTex.colorSpace = THREE.SRGBColorSpace;
  winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
  return winTex;
};

/** Pastel building: `floors` × ~3 m, windows tiled on every face, flat or pitched roof. */
export const Building: React.FC<{ p: Vec3; w: number; d: number; floors: number; color: string; pitched?: boolean; lit?: number; ry?: number }> = ({
  p,
  w,
  d,
  floors,
  color,
  pitched,
  lit = 0,
  ry = 0,
}) => {
  const h = floors * 3;
  const tex = useMemo(() => {
    const t = windowTex().clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(1, Math.round(w / 3)), floors);
    return t;
  }, [w, floors]);
  return (
    <group position={p} rotation={[0, ry, 0]}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} map={tex} roughness={0.8} emissive={lit ? "#ffd27a" : "#000000"} emissiveMap={lit ? tex : null} emissiveIntensity={lit} />
      </mesh>
      {pitched ? (
        <mesh position={[0, h + w * 0.22, 0]} rotation={[0, Math.PI / 4, 0]} scale={[w * 0.75, w * 0.45, d * 0.75]}>
          <coneGeometry args={[1, 1, 4]} />
          {toon("#e76f51")}
        </mesh>
      ) : (
        <mesh position={[0, h + 0.15, 0]}>
          <boxGeometry args={[w + 0.3, 0.3, d + 0.3]} />
          {toon("#f1f1f1")}
        </mesh>
      )}
    </group>
  );
};

export const Tree: React.FC<{ p: Vec3; s?: number }> = ({ p, s = 1 }) => (
  <group position={p} scale={s}>
    <mesh position={[0, 1.2, 0]}>
      <cylinderGeometry args={[0.18, 0.25, 2.4, 6]} />
      {toon("#9c6b3f")}
    </mesh>
    <mesh position={[0, 3.2, 0]}>
      <icosahedronGeometry args={[1.5, 0]} />
      {toon("#57c26b")}
    </mesh>
    <mesh position={[0.6, 2.6, 0.4]}>
      <icosahedronGeometry args={[0.9, 0]} />
      {toon("#4bb35e")}
    </mesh>
  </group>
);

/** Cartoon person, ~1.75 m. Arms rotate at the shoulder: [forward/back (x), out (z)]. Faces +Z. */
export const Dude: React.FC<{
  p?: Vec3;
  ry?: number;
  shirt?: string;
  pants?: string;
  skin?: string;
  hair?: string;
  armR?: [number, number];
  armL?: [number, number];
  walk?: number;
  headTilt?: number;
  scale?: number;
  mouth?: number;
}> = ({ p = [0, 0, 0], ry = 0, shirt = "#ff6b6b", pants = "#3d5a80", skin = "#f1c27d", hair = "#3b2416", armR = [0, 0.1], armL = [0, -0.1], walk = 0, headTilt = 0, scale = 1, mouth = 0 }) => {
  const legSwing = Math.sin(walk) * 0.5;
  return (
    <group position={p} rotation={[0, ry, 0]} scale={scale}>
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 0.1, 0.85, 0]} rotation={[sd * legSwing, 0, 0]}>
          <mesh position={[0, -0.42, 0]}>
            <boxGeometry args={[0.15, 0.85, 0.17]} />
            {toon(pants)}
          </mesh>
          <mesh position={[0, -0.84, 0.05]}>
            <boxGeometry args={[0.16, 0.08, 0.26]} />
            {toon("#ffffff")}
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[0.42, 0.6, 0.24]} />
        {toon(shirt)}
      </mesh>
      {[
        [1, armR],
        [-1, armL],
      ].map(([sd, a]) => {
        const [fx, out] = a as [number, number];
        return (
          <group key={sd as number} position={[(sd as number) * 0.27, 1.4, 0]} rotation={[fx, 0, (sd as number) * (out + 0.08)]}>
            <mesh position={[0, -0.3, 0]}>
              <boxGeometry args={[0.12, 0.6, 0.13]} />
              {toon(shirt)}
            </mesh>
            <mesh position={[0, -0.64, 0]}>
              <icosahedronGeometry args={[0.07, 0]} />
              {toon(skin)}
            </mesh>
          </group>
        );
      })}
      <group position={[0, 1.65, 0]} rotation={[headTilt, 0, 0]}>
        <mesh position={[0, 0.14, 0]}>
          <icosahedronGeometry args={[0.19, 1]} />
          {toon(skin)}
        </mesh>
        <mesh position={[0, 0.22, -0.03]} scale={[1.05, 0.7, 1.05]}>
          <icosahedronGeometry args={[0.19, 1]} />
          {toon(hair)}
        </mesh>
        {[-1, 1].map((sd) => (
          <mesh key={sd} position={[sd * 0.07, 0.16, 0.17]}>
            <sphereGeometry args={[0.025, 8, 6]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
        ))}
        <mesh position={[0, 0.06, 0.175]} scale={[1, 0.4 + mouth, 1]}>
          <sphereGeometry args={[0.035, 8, 6]} />
          <meshBasicMaterial color="#7a2a2a" />
        </mesh>
      </group>
    </group>
  );
};

/** Small hatchback (~3.6 m). `squash` 0..1 flattens it into a pancake. Faces +X. */
export const ToyCar: React.FC<{ p?: Vec3; ry?: number; color?: string; squash?: number; scale?: number }> = ({ p = [0, 0, 0], ry = 0, color = "#ff8fab", squash = 0, scale = 1 }) => {
  const sy = 1 - 0.82 * squash;
  const sx = 1 + 0.12 * squash;
  return (
    <group position={p} rotation={[0, ry, 0]} scale={[sx * scale, sy * scale, (1 + 0.2 * squash) * scale]}>
      <mesh position={[0, 0.65, 0]}>
        <boxGeometry args={[3.6, 0.7, 1.7]} />
        {toon(color)}
      </mesh>
      <mesh position={[-0.2, 1.25, 0]}>
        <boxGeometry args={[2.0, 0.6, 1.5]} />
        {toon(color)}
      </mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[-0.2, 1.25, sd * 0.76]}>
          <planeGeometry args={[1.7, 0.45]} />
          <meshStandardMaterial color="#bfe9ff" side={THREE.DoubleSide} roughness={0.2} />
        </mesh>
      ))}
      {[
        [1.15, 0.85],
        [-1.15, 0.85],
        [1.15, -0.85],
        [-1.15, -0.85],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.33, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.33, 0.33, 0.25, 12]} />
          {toon("#222222")}
        </mesh>
      ))}
      <mesh position={[1.81, 0.7, 0.55]}>
        <boxGeometry args={[0.02, 0.18, 0.3]} />
        <meshBasicMaterial color="#fff6c8" />
      </mesh>
      <mesh position={[1.81, 0.7, -0.55]}>
        <boxGeometry args={[0.02, 0.18, 0.3]} />
        <meshBasicMaterial color="#fff6c8" />
      </mesh>
    </group>
  );
};

/** Generic tank (no insignia), ~7 m. Turret yaw + barrel pitch. Faces +X. */
export const Tank: React.FC<{ p?: Vec3; ry?: number; yaw?: number; pitch?: number; recoil?: number; scale?: number }> = ({
  p = [0, 0, 0],
  ry = 0,
  yaw = 0,
  pitch = 0.1,
  recoil = 0,
  scale = 1,
}) => (
  <group position={p} rotation={[0, ry, 0]} scale={scale}>
    {[-1, 1].map((sd) => (
      <mesh key={sd} position={[0, 0.5, sd * 1.5]}>
        <boxGeometry args={[7, 1.0, 0.9]} />
        {toon("#4a4f3a")}
      </mesh>
    ))}
    <mesh position={[0, 1.25, 0]}>
      <boxGeometry args={[6.4, 0.9, 2.8]} />
      {toon("#7a8a4e")}
    </mesh>
    <group position={[0.2, 1.95, 0]} rotation={[0, yaw, 0]}>
      <mesh>
        <boxGeometry args={[2.8, 0.8, 2.2]} />
        {toon("#8a9a5a")}
      </mesh>
      <group position={[1.3, 0.05, 0]} rotation={[0, 0, pitch]}>
        <mesh position={[2.0 - recoil * 0.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.13, 0.15, 4, 8]} />
          {toon("#5f6b3c")}
        </mesh>
      </group>
    </group>
  </group>
);

/* ---------------------------------- the phone ---------------------------------- */

export const PHONE_W = 0.476; // width / length
export const PHONE_D = 0.053; // depth / length

const APPS: Array<[string, string, string]> = [
  ["Gloop", "#ff6b6b", "G"],
  ["Wobble", "#ffd93d", "W"],
  ["Zappo", "#6bcB77", "Z"],
  ["Yapper", "#4d96ff", "Y"],
  ["Bloop", "#c77dff", "B"],
  ["Munch", "#ff9f1c", "M"],
  ["Pixl", "#2ec4b6", "P"],
  ["Tunez", "#ff5d8f", "T"],
  ["Snoozr", "#5e60ce", "S"],
  ["Hoot", "#80ed99", "H"],
  ["Plonk", "#f15bb5", "P"],
  ["Squish", "#00bbf9", "S"],
  ["Nibble", "#fee440", "N"],
  ["Grumble", "#9b5de5", "G"],
  ["Kwik", "#f77f00", "K"],
  ["Wheee", "#06d6a0", "W"],
];

export type ScreenMode = "apps" | "notify" | "battery" | "bright" | "scale";

const screenCache = new Map<string, THREE.CanvasTexture>();
const screenTexture = (mode: ScreenMode) => {
  const hit = screenCache.get(mode);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 1080;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 512, 1080);
  g.addColorStop(0, "#7f5af0");
  g.addColorStop(0.5, "#ff7eb6");
  g.addColorStop(1, "#ffd6a5");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 1080);
  // status bar: generic time + battery
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 34px Inter, Arial";
  ctx.fillText("12:00", 34, 56);
  const batt = mode === "battery" ? 0.04 : 0.78;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.strokeRect(410, 30, 64, 30);
  ctx.fillStyle = mode === "battery" ? "#ff3b30" : "#ffffff";
  ctx.fillRect(414, 34, 56 * batt, 22);
  // app grid
  const cols = 4;
  APPS.forEach(([name, col, glyph], i) => {
    const x = 40 + (i % cols) * 112;
    const y = 120 + Math.floor(i / cols) * 150;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(x, y, 88, 88, 24);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 52px Inter, Arial";
    ctx.textAlign = "center";
    ctx.fillText(glyph, x + 44, y + 63);
    ctx.font = "700 21px Inter, Arial";
    ctx.fillText(name, x + 44, y + 118);
    ctx.textAlign = "left";
  });
  // dock
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.roundRect(28, 900, 456, 130, 40);
  ctx.fill();
  ["#34c759", "#ff9500", "#5ac8fa", "#ff2d55"].forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(52 + i * 110, 921, 88, 88, 24);
    ctx.fill();
  });
  if (mode === "notify") {
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.beginPath();
    ctx.roundRect(24, 84, 464, 150, 32);
    ctx.fill();
    ctx.fillStyle = "#4d96ff";
    ctx.beginPath();
    ctx.roundRect(46, 108, 70, 70, 18);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.font = "900 34px Inter, Arial";
    ctx.fillText("Yapper", 134, 136);
    ctx.font = "600 30px Inter, Arial";
    ctx.fillText("u up?", 134, 182);
  }
  if (mode === "battery") {
    ctx.fillStyle = "rgba(20,0,0,0.75)";
    ctx.fillRect(0, 0, 512, 1080);
    ctx.fillStyle = "#ff3b30";
    ctx.textAlign = "center";
    ctx.font = "900 150px Inter, Arial";
    ctx.fillText("1%", 256, 520);
    ctx.font = "900 62px Inter, Arial";
    ctx.fillText("BATTERY", 256, 610);
    ctx.strokeStyle = "#ff3b30";
    ctx.lineWidth = 14;
    ctx.strokeRect(146, 660, 200, 90);
    ctx.fillRect(346, 685, 18, 40);
    ctx.fillRect(160, 674, 14, 62);
    ctx.textAlign = "left";
  }
  if (mode === "bright") {
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillRect(0, 0, 512, 1080);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  screenCache.set(mode, t);
  return t;
};

let crackTex: THREE.CanvasTexture | null = null;
const crackTexture = () => {
  if (crackTex) return crackTex;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 1080;
  const ctx = c.getContext("2d")!;
  const r = mulberry32(19);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 5;
  const ox = 330;
  const oy = 420;
  for (let i = 0; i < 11; i++) {
    let x = ox;
    let y = oy;
    const a = (i / 11) * Math.PI * 2 + r() * 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 7; k++) {
      x += Math.cos(a + (r() - 0.5) * 0.8) * (40 + r() * 70);
      y += Math.sin(a + (r() - 0.5) * 0.8) * (40 + r() * 70);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.lineWidth = 3;
  for (let ring = 1; ring < 4; ring++) {
    ctx.beginPath();
    ctx.arc(ox, oy, ring * 45, 0, Math.PI * 2);
    ctx.stroke();
  }
  crackTex = new THREE.CanvasTexture(c);
  crackTex.colorSpace = THREE.SRGBColorSpace;
  return crackTex;
};

let bodyGeo: THREE.ExtrudeGeometry | null = null;
const phoneBody = () => {
  if (bodyGeo) return bodyGeo;
  // unit phone: length 1 along Y, width PHONE_W along X, depth PHONE_D along Z (screen faces +Z)
  const w = PHONE_W;
  const h = 1;
  const r = w * 0.16;
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  bodyGeo = new THREE.ExtrudeGeometry(s, { depth: PHONE_D * 0.7, bevelEnabled: true, bevelThickness: PHONE_D * 0.15, bevelSize: PHONE_D * 0.15, bevelSegments: 2, curveSegments: 6 });
  bodyGeo.translate(0, 0, -PHONE_D * 0.35);
  return bodyGeo;
};

/**
 * The phone. `length` in metres; stands upright (long axis +Y, screen facing +Z) — rotate the
 * parent to lay it down. `glow` boosts the screen (night scenes), `crack` 0..1 shows the crack.
 */
export const Phone: React.FC<{ length: number; mode?: ScreenMode; glow?: number; crack?: number; p?: Vec3; r?: Vec3 }> = ({
  length,
  mode = "apps",
  glow = 1,
  crack = 0,
  p,
  r,
}) => {
  const geo = useMemo(() => phoneBody(), []);
  const tex = useMemo(() => screenTexture(mode), [mode]);
  const ctex = useMemo(() => crackTexture(), []);
  return (
    <group position={p} rotation={r} scale={length}>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#15151c" roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0, PHONE_D * 0.53]}>
        <planeGeometry args={[PHONE_W * 0.92, 0.95]} />
        <meshBasicMaterial map={tex} toneMapped={false} color={new THREE.Color(glow, glow, glow)} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-16} />
      </mesh>
      {crack > 0.01 ? (
        <mesh position={[0, 0, PHONE_D * 0.55]}>
          <planeGeometry args={[PHONE_W * 0.92, 0.95]} />
          <meshBasicMaterial map={ctex} transparent opacity={crack} depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-6} polygonOffsetUnits={-24} />
        </mesh>
      ) : null}
      {/* side button */}
      <mesh position={[PHONE_W / 2 + 0.004, 0.22, 0]}>
        <boxGeometry args={[0.01, 0.1, PHONE_D * 0.4]} />
        <meshStandardMaterial color="#2a2a33" />
      </mesh>
    </group>
  );
};

/* --------------------------- shared canvas + helpers --------------------------- */


/** Bright daylight canvas (soft sky light, warm sun, pale haze). */
export const BrightCanvas: React.FC<{
  durationInFrames: number;
  camera: CameraMove;
  fog?: [number, number];
  night?: boolean;
  cameraAt?: React.ComponentProps<typeof SceneCanvas>["cameraAt"];
  children: React.ReactNode;
}> = ({ durationInFrames, camera, fog = [120, 900], night, cameraAt, children }) => (
  <SceneCanvas
    durationInFrames={durationInFrames}
    camera={camera}
    cameraAt={cameraAt}
    background={night ? "#0b0e2a" : "#bfe6ff"}
    fog={[night ? "#141a44" : "#d8f0ff", fog[0], fog[1]]}
    sky={night ? "#5a6aa8" : "#ffffff"}
    ground={night ? "#1a1a33" : "#a8d98a"}
    sunPosition={[30, 60, 40]}
    sunIntensity={night ? 0.25 : 2.0}
  >
    {children}
  </SceneCanvas>
);

/** CSS camera shake that decays after `at` (seconds). */
export const shake = (t: number, at: number, amp = 24, decay = 5) => {
  if (t < at) return "none";
  const e = Math.exp(-(t - at) * decay);
  return `translate(${Math.sin(t * 83) * amp * e}px, ${Math.cos(t * 71) * amp * 0.8 * e}px) rotate(${Math.sin(t * 57) * 0.8 * e}deg)`;
};
