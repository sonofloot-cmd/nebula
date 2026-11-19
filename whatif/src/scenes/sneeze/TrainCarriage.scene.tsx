import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import { mergeCamera } from "../../three/camera";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { CLOTHES, Person, SKIN } from "../../three/props";
import { mulberry32 } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import type { SceneComponentProps } from "../../types";

/** ROOM scale: a cut-away metro carriage; one sneeze cloud rolls 8 m down the aisle. */

const LEN = 20; // carriage length in metres (1 unit = 1 m)
const SNEEZER: [number, number, number] = [-7.2, 0, 0];
const MOUTH: [number, number, number] = [SNEEZER[0] + 0.2, 1.62, 0];

const mat = (c: string, extra: Record<string, unknown> = {}) => (
  <meshStandardMaterial color={c} flatShading roughness={0.85} {...extra} />
);

const Carriage: React.FC<{ t: number }> = ({ t }) => {
  const windows = [-8, -4.4, -0.8, 2.8, 6.4];
  const rand = mulberry32(21);
  const seated: Array<{ x: number; z: number; rot: number; shirt: string; skin: string }> = [];
  for (const side of [-1, 1]) {
    for (let x = -9; x <= 8.5; x += 0.75) {
      if (Math.abs(x - -6) < 0.9 || Math.abs(x) < 0.9 || Math.abs(x - 6) < 0.9) continue; // doors
      if (rand() < 0.3) continue;
      seated.push({ x, z: side * 1.12, rot: side > 0 ? 0 : Math.PI, shirt: CLOTHES[Math.floor(rand() * 10)], skin: SKIN[Math.floor(rand() * 5)] });
    }
  }
  const standing = [-5.2, -3.5, -2.2, -1.2, 1.4, 2.6, 4.1, 5.0, 7.3].map((x, i) => ({
    x,
    z: (i % 3) * 0.35 - 0.35,
    rot: rand() * Math.PI * 2,
    shirt: CLOTHES[(i * 3) % 10],
    skin: SKIN[i % 5],
  }));
  return (
    <group>
      {/* floor + walls (near wall cut away to a sill so we can see in) */}
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[LEN, 0.1, 3.1]} />
        {mat("#565b73")}
      </mesh>
      <mesh position={[0, 1.2, -1.6]}>
        <boxGeometry args={[LEN, 2.4, 0.1]} />
        {mat("#dfe3ea")}
      </mesh>
      <mesh position={[0, 0.4, 1.6]}>
        <boxGeometry args={[LEN, 0.8, 0.1]} />
        {mat("#dfe3ea")}
      </mesh>
      {[-LEN / 2, LEN / 2].map((x) => (
        <mesh key={x} position={[x, 1.2, 0]}>
          <boxGeometry args={[0.1, 2.4, 3.3]} />
          {mat("#cfd5de")}
        </mesh>
      ))}
      {/* windows with tunnel lights streaking past */}
      {windows.map((x) => (
        <mesh key={x} position={[x, 1.55, -1.54]}>
          <boxGeometry args={[2.6, 0.75, 0.02]} />
          {mat("#14213d", { emissive: "#0b1a33", emissiveIntensity: 0.6 })}
        </mesh>
      ))}
      {Array.from({ length: 14 }).map((_, i) => {
        const x = ((((i * 3.7 - t * 22) % LEN) + LEN) % LEN) - LEN / 2;
        const inWindow = windows.some((w) => Math.abs(x - w) < 1.25);
        return inWindow ? (
          <mesh key={i} position={[x, 1.55, -1.52]}>
            <boxGeometry args={[0.08, 0.6, 0.01]} />
            <meshBasicMaterial color="#ffe8a3" />
          </mesh>
        ) : null;
      })}
      {/* ceiling light strip hint along the top of the far wall */}
      <mesh position={[0, 2.35, -1.5]}>
        <boxGeometry args={[LEN - 0.4, 0.06, 0.12]} />
        <meshBasicMaterial color="#fff7e0" />
      </mesh>
      {/* benches */}
      {[-1, 1].map((side) =>
        [
          [-8.1, 3.2],
          [-3, 4.6],
          [3, 4.6],
          [8.1, 3.2],
        ].map(([x, w]) => (
          <mesh key={`${side}${x}`} position={[x, 0.25, side * 1.25]}>
            <boxGeometry args={[w, 0.5, 0.55]} />
            {mat("#3d5a80")}
          </mesh>
        )),
      )}
      {/* grab poles */}
      {[-6, -3, 0, 3, 6].map((x) => (
        <mesh key={x} position={[x, 1.2, 0.35]}>
          <cylinderGeometry args={[0.03, 0.03, 2.4, 6]} />
          {mat("#f3a712", { metalness: 0.3 })}
        </mesh>
      ))}
      {seated.map((p, i) => (
        <Person key={`s${i}`} position={[p.x, 0.02, p.z]} rotationY={p.rot + Math.PI / 2} seated shirt={p.shirt} skin={p.skin} />
      ))}
      {standing.map((p, i) => (
        <Person key={`p${i}`} position={[p.x, 0, p.z]} rotationY={p.rot} shirt={p.shirt} skin={p.skin} />
      ))}
    </group>
  );
};

const TrainCarriage: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props, accent }) => {
  const t = useSceneTime();
  const reachMetres = (props.reachMetres as number) ?? 8;
  const front = (time: number) => reachMetres * (1 - Math.exp(-Math.max(0, time + 0.25) / 1.1));
  const recoil = 0.5 * Math.exp(-(t + 0.25) * 2.5);

  const droplets = useCallback<ParticleFn>(
    (_i, time, out, r) => {
      const f = front(time);
      const along = f * Math.pow(r[0], 0.8);
      const rad = 0.12 + (along / reachMetres) * 0.9;
      const ang = r[1] * Math.PI * 2;
      const rr = Math.sqrt(r[2]) * rad;
      const big = Math.pow(r[3], 5);
      out[0] = MOUTH[0] + along + Math.sin(time * 1.3 + r[4] * 8) * 0.08;
      out[1] = Math.max(0.05, MOUTH[1] + Math.sin(ang) * rr * 0.8 - big * along * 0.12 + Math.sin(time + r[5] * 6) * 0.05);
      out[2] = Math.max(-1.4, Math.min(1.4, MOUTH[2] + Math.cos(ang) * rr * 1.3));
      out[3] = 0.6 + big * 2.5;
      out[4] = Math.min(1, (time + 0.3) * 4) * (0.55 + 0.45 * (1 - along / (reachMetres + 0.01)));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reachMetres],
  );

  const cloud = useCallback<ParticleFn>(
    (_i, time, out, r) => {
      const f = front(time);
      const along = f * r[0];
      const rad = 0.2 + (along / reachMetres) * 0.8;
      out[0] = MOUTH[0] + along;
      out[1] = MOUTH[1] + (r[1] - 0.5) * rad + Math.sin(time * 0.7 + r[2] * 6) * 0.1;
      out[2] = (r[3] - 0.5) * rad * 1.8;
      out[3] = 0.8 + rad * 1.6 * (0.6 + r[4]);
      out[4] = 0.55;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reachMetres],
  );

  const f = front(t);
  const cam = mergeCamera(
    { type: "dolly", from: [-14.5, 4.6, 6.2], to: [-11.5, 3.4, 4.4], target: [-4, 0.9, 0], targetTo: [-1.5, 0.9, 0], fov: 50 },
    camera,
  );

  return (
    <AbsoluteFill>
      <SceneCanvas durationInFrames={durationInFrames} camera={cam} background="#0b1220" fog={["#0b1220", 14, 34]} sunPosition={[-4, 10, 6]}>
        <pointLight position={[0, 2.2, 0]} intensity={20} distance={14} color="#fff3d6" />
        <Carriage t={t} />
        {/* the sneezer, still recoiling */}
        <Person position={SNEEZER} rotationY={0} shirt="#d1495b" skin="#e0ac69" headPitch={recoil} />
        {/* measuring tape on the floor grows with the cloud */}
        <mesh position={[MOUTH[0] + f / 2, 0.02, 0.75]}>
          <boxGeometry args={[Math.max(0.001, f), 0.02, 0.07]} />
          <meshBasicMaterial color={accent} />
        </mesh>
        {Array.from({ length: Math.floor(f + 0.001) + 1 }).map((_, m) => (
          <mesh key={m} position={[MOUTH[0] + m, 0.03, 0.75]}>
            <boxGeometry args={[0.05, 0.03, m % 2 === 0 ? 0.4 : 0.25]} />
            <meshBasicMaterial color={accent} />
          </mesh>
        ))}
        <Particles count={120} t={t} compute={cloud} size={1} color="#d8f1e4" seed={12} softness={1} opacity={0.13} maxPixelSize={700} />
        <Particles count={4500} t={t} compute={droplets} size={0.03} color="#eaffff" seed={13} softness={0.25} maxPixelSize={10} />
      </SceneCanvas>
    </AbsoluteFill>
  );
};

export default TrainCarriage;
