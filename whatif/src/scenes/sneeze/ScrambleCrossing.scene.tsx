import React, { useCallback, useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { mergeCamera } from "../../three/camera";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { Buildings, Crowd, makeCity } from "../../three/props";
import { mulberry32 } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import type { SceneComponentProps } from "../../types";

/** STREET scale: a scramble crossing mid-green-light. Everyone sneezes at t≈1s. */

const PATHS: Array<[number, number, number, number]> = [
  [-11, -10, -11, 10],
  [11, -10, 11, 10],
  [-10, -11, 10, -11],
  [-10, 11, 10, 11],
  [-9, -9, 9, 9],
  [9, -9, -9, 9],
];
const SNEEZE_AT = 1.0;

interface Walker {
  path: number;
  dir: number;
  lat: number;
  p0: number;
  speed: number;
  waitX: number;
  waitZ: number;
  waiting: boolean;
}

const makeWalkers = (n: number): Walker[] => {
  const rand = mulberry32(31);
  return Array.from({ length: n }, (_, i) => {
    const waiting = i % 5 < 2; // 40% wait on the corners
    const cx = rand() < 0.5 ? -1 : 1;
    const cz = rand() < 0.5 ? -1 : 1;
    return {
      path: Math.floor(rand() * PATHS.length),
      dir: rand() < 0.5 ? 1 : -1,
      lat: (rand() - 0.5) * 4,
      p0: rand() * 0.6,
      speed: 1.1 + rand() * 0.6,
      waitX: cx * (14 + rand() * 9),
      waitZ: cz * (14 + rand() * 9),
      waiting,
    };
  });
};

const walkerPos = (w: Walker, t: number): [number, number] => {
  if (w.waiting) return [w.waitX + Math.sin(t + w.lat) * 0.05, w.waitZ];
  const [x0, z0, x1, z1] = PATHS[w.path];
  const len = Math.hypot(x1 - x0, z1 - z0);
  let p = w.p0 + (t * w.speed) / len;
  p = Math.min(1, p);
  if (w.dir < 0) p = 1 - p;
  const nx = -(z1 - z0) / len;
  const nz = (x1 - x0) / len;
  return [x0 + (x1 - x0) * p + nx * w.lat, z0 + (z1 - z0) * p + nz * w.lat];
};

const Stripes: React.FC = () => {
  const bars: Array<{ x: number; z: number; rot: number }> = [];
  PATHS.forEach(([x0, z0, x1, z1]) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const rot = -Math.atan2(z1 - z0, x1 - x0);
    for (let d = 0.6; d < len; d += 1.1) {
      bars.push({ x: x0 + ((x1 - x0) * d) / len, z: z0 + ((z1 - z0) * d) / len, rot });
    }
  });
  return (
    <>
      {bars.map((b, i) => (
        <mesh key={i} position={[b.x, 0.02, b.z]} rotation={[0, b.rot, 0]}>
          <boxGeometry args={[0.55, 0.02, 4.4]} />
          <meshStandardMaterial color="#e9ecf2" roughness={0.9} />
        </mesh>
      ))}
    </>
  );
};

const ScrambleCrossing: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const people = (props.people as number) ?? 2500;
  const walkers = useMemo(() => makeWalkers(people), [people]);
  const xz = useMemo(() => {
    const a = new Float32Array(walkers.length * 2);
    walkers.forEach((w, i) => a.set(walkerPos(w, t), i * 2));
    return a;
  }, [walkers, t]);

  const city = useMemo(
    () => makeCity({ seed: 5, radius: 150, block: 22, street: 8, maxHeight: 70, skip: (x, z) => Math.abs(x) < 30 || Math.abs(z) < 30 }),
    [],
  );
  const cornerTowers = useMemo(
    () =>
      [-1, 1].flatMap((sx) =>
        [-1, 1].map((sz, k) => ({ x: sx * 33, z: sz * 33, w: 10, d: 10, h: 26 + k * 9, color: "#b9c2d3" })),
      ),
    [],
  );

  const puffs = useCallback<ParticleFn>(
    (i, time, out, r) => {
      const w = walkers[i % walkers.length];
      const [x, z] = walkerPos(w, Math.min(time, SNEEZE_AT + 0.2));
      const dt = time - (SNEEZE_AT + r[0] * 0.15);
      if (dt < 0) {
        out[4] = 0;
        return;
      }
      const spread = 1.6 * (1 - Math.exp(-dt * 1.8));
      const ang = r[1] * Math.PI * 2;
      out[0] = x + Math.cos(ang) * spread * (0.4 + r[2]);
      out[1] = 1.6 + dt * 0.35 * (0.5 + r[3]) + Math.sin(time + r[4] * 6) * 0.1;
      out[2] = z + Math.sin(ang) * spread * (0.4 + r[2]);
      out[3] = 0.4 + spread * 1.2;
      out[4] = Math.min(1, dt * 6) * (0.7 - Math.min(0.4, dt * 0.08));
    },
    [walkers],
  );

  const haze = useCallback<ParticleFn>((_i, time, out, r) => {
    const dt = time - SNEEZE_AT - 0.3;
    out[0] = (r[0] - 0.5) * 60;
    out[1] = 1 + r[1] * 5 + dt * 0.3;
    out[2] = (r[2] - 0.5) * 60;
    out[3] = 6 + r[3] * 8;
    out[4] = Math.max(0, Math.min(1, dt * 0.5));
  }, []);

  const cam = mergeCamera(
    { type: "crane", from: [0, 3, 40], to: [10, 40, 34], target: [0, 1.5, 0], targetTo: [0, 0, 2], fov: 50 },
    camera,
  );

  return (
    <AbsoluteFill>
      <SceneCanvas
        durationInFrames={durationInFrames}
        camera={cam}
        background="#26304d"
        fog={["#26304d", 50, 190]}
        sky="#c9d6ff"
        ground="#30344a"
        sunPosition={[30, 60, 20]}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[500, 500]} />
          <meshStandardMaterial color="#33384a" roughness={1} />
        </mesh>
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} position={[sx * 75, 0.1, sz * 75]}>
              <boxGeometry args={[120, 0.2, 120]} />
              <meshStandardMaterial color="#8a8f9e" flatShading roughness={1} />
            </mesh>
          )),
        )}
        <Stripes />
        <Buildings specs={city} />
        <Buildings specs={cornerTowers} />
        {/* giant screens on the corner towers */}
        {[
          [-28, 18, -28, Math.PI / 4, "#ff4fa3"],
          [28, 22, -28, -Math.PI / 4, "#4fd8ff"],
          [-28, 16, 28, (3 * Math.PI) / 4, "#ffd84f"],
        ].map(([x, y, z, ry, c], i) => (
          <mesh key={i} position={[x as number, y as number, z as number]} rotation={[0, ry as number, 0]}>
            <boxGeometry args={[9, 6, 0.3]} />
            <meshBasicMaterial color={c as string} />
          </mesh>
        ))}
        <Crowd xz={xz} seed={41} />
        <Particles count={walkers.length * 2} t={t} compute={puffs} size={1} color="#e8fff4" seed={44} softness={1} opacity={0.22} maxPixelSize={160} />
        <Particles count={160} t={t} compute={haze} size={1} color="#d6eadf" seed={45} softness={1} opacity={0.12} maxPixelSize={1200} />
      </SceneCanvas>
    </AbsoluteFill>
  );
};

export default ScrambleCrossing;
