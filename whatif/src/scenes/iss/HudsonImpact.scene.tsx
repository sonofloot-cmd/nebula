import React, { useCallback, useMemo } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { makeSkylineRow, TowerMesh } from "../../three/city";
import { mergeCamera } from "../../three/camera";
import { Glow, SkyDome } from "../../three/glow";
import { Stars } from "../../three/Globe";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { Crowd } from "../../three/props";
import { mulberry32 } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import type { SceneComponentProps } from "../../types";

/**
 * IMPACT: street level on the riverside promenade at night. A glowing chunk streaks down and
 * slams into the river: flash, a towering splash and steam, a shock ring on the water, and
 * the camera shakes. Generic far-shore skyline. World units = metres; river runs along X.
 * props: { hitAt?: number (s) }
 */

const HIT = new THREE.Vector3(30, 0, -230);
const FROM = new THREE.Vector3(260, 520, -620);
const G = 30; // visual gravity for the splash (m/s²), tuned so the column peaks inside 2 s

const HudsonImpact: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const hitAt = (props.hitAt as number) ?? 0.4;
  const dt = t - hitAt;
  const hit = dt >= 0;
  const shore = useMemo(
    () => [
      ...makeSkylineRow({ seed: 21, z: -640, x0: -700, x1: 700, hMin: 30, hMax: 150 }),
      ...makeSkylineRow({ seed: 22, z: -740, x0: -900, x1: 900, hMin: 60, hMax: 260 }),
    ],
    [],
  );
  const people = useMemo(() => {
    const r = mulberry32(31);
    const xz = new Float32Array(18 * 2);
    for (let i = 0; i < 18; i++) {
      xz[i * 2] = -28 + i * 3.2 + (r() - 0.5) * 1.5;
      xz[i * 2 + 1] = 44 + r() * 2.5;
    }
    return xz;
  }, []);

  // incoming chunk
  const f = Math.min(1, Math.max(0, (t + 0.25) / (hitAt + 0.25)));
  const chunk = FROM.clone().lerp(HIT, f);
  const trail = useCallback<ParticleFn>(
    (_i, time, out, r) => {
      const life = 0.5;
      const age = (time + r[0] * life) % life;
      const birth = time - age;
      const g = Math.min(1, Math.max(0, (birth + 0.25) / (hitAt + 0.25)));
      if (birth > hitAt || g <= 0) {
        out[4] = 0;
        return;
      }
      const p = FROM.clone().lerp(HIT, g);
      const a = age / life;
      out[0] = p.x + (r[1] - 0.5) * 10 * a;
      out[1] = p.y + (r[2] - 0.5) * 10 * a + age * 6;
      out[2] = p.z + (r[3] - 0.5) * 10 * a;
      out[3] = 1 + a * 2.5;
      out[4] = (1 - a) * Math.min(1, a * 10);
    },
    [hitAt],
  );

  // splash column + spray (ballistic), steam cloud, shock ring
  const splash = useCallback<ParticleFn>(
    (_i, time, out, r) => {
      const s = time - hitAt - r[0] * 0.08;
      if (s < 0) {
        out[4] = 0;
        return;
      }
      const ang = r[1] * Math.PI * 2;
      const core = r[2] < 0.6;
      const vy = core ? 55 + r[3] * 45 : 20 + r[3] * 35;
      const vr = core ? 2 + r[4] * 6 : 10 + r[4] * 22;
      const y = vy * s - 0.5 * G * s * s;
      if (y < 0) {
        out[4] = 0;
        return;
      }
      out[0] = HIT.x + Math.cos(ang) * vr * s;
      out[1] = y;
      out[2] = HIT.z + Math.sin(ang) * vr * s;
      out[3] = core ? 1.4 + r[5] : 0.7 + r[5] * 0.6;
      out[4] = Math.min(1, s * 12) * (1 - Math.min(1, s / 2.2) * 0.5);
    },
    [hitAt],
  );
  const steam = useCallback<ParticleFn>(
    (_i, time, out, r) => {
      const s = time - hitAt - 0.05 - r[0] * 0.3;
      if (s < 0) {
        out[4] = 0;
        return;
      }
      const ang = r[1] * Math.PI * 2;
      const rad = (8 + r[2] * 40) * (1 - Math.exp(-s * 2.5));
      out[0] = HIT.x + Math.cos(ang) * rad;
      out[1] = 4 + r[3] * 50 * (1 - Math.exp(-s * 1.8)) + s * 6;
      out[2] = HIT.z + Math.sin(ang) * rad * 0.6;
      out[3] = 1 + s * 1.5;
      out[4] = Math.min(1, s * 4) * 0.8;
    },
    [hitAt],
  );
  const ring = useCallback<ParticleFn>(
    (i, time, out, r) => {
      const s = time - hitAt;
      if (s < 0) {
        out[4] = 0;
        return;
      }
      const ang = (i / 900) * Math.PI * 2;
      const rad = 6 + s * 70 + r[0] * 3;
      out[0] = HIT.x + Math.cos(ang) * rad;
      out[1] = 0.4;
      out[2] = HIT.z + Math.sin(ang) * rad;
      out[3] = 1;
      out[4] = Math.max(0, 1 - s / 1.6);
    },
    [hitAt],
  );
  // city-light glints on the water
  const glints = useCallback<ParticleFn>((_i, time, out, r) => {
    out[0] = (r[0] - 0.5) * 900;
    out[1] = 0.2;
    out[2] = -600 + Math.pow(r[1], 0.7) * 620;
    out[3] = 0.6 + r[2];
    out[4] = Math.max(0, Math.sin(time * (2 + r[3] * 3) + r[4] * 20)) * 0.7;
  }, []);

  const flash = hit ? Math.exp(-dt * 5) : 0;
  const shakeEnv = hit ? Math.exp(-dt * 4) : 0;
  const sx = (Math.sin(t * 83) + 0.6 * Math.sin(t * 51 + 1)) * 30 * shakeEnv;
  const sy = (Math.cos(t * 67) + 0.5 * Math.sin(t * 39)) * 24 * shakeEnv;
  const rot = Math.sin(t * 59) * 1.1 * shakeEnv;

  const cam = mergeCamera(
    { type: "pushIn", from: [-6, 2.6, 66], to: [-4, 2.3, 58], target: [22, 34, -230], fov: 55, ease: "out" },
    camera,
  );

  return (
    <AbsoluteFill style={{ background: "#02030a" }}>
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) rotate(${rot}deg) scale(${1 + 0.06 * Math.min(1, shakeEnv * 2)})` }}>
        <SceneCanvas
          durationInFrames={durationInFrames}
          camera={cam}
          background="#02030a"
          fog={["#0b0a1a", 500, 1600]}
          sky="#6a7cb8"
          ground="#120c10"
          sunPosition={[60, 200, 100]}
          sunIntensity={0.45 + 2 * flash}
        >
          <SkyDome radius={1800} stops={[[-1, "#120a14"], [0, "#2a1a3a"], [0.1, "#121230"], [0.4, "#05061a"], [1, "#010208"]]} />
          <Stars t={t} count={1200} radius={1500} />
          {/* river + promenade */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -300]}>
            <planeGeometry args={[3000, 700]} />
            <meshStandardMaterial color="#06091a" roughness={0.2} metalness={0.7} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.5, 120]}>
            <planeGeometry args={[3000, 160]} />
            <meshStandardMaterial color="#2a2830" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.75, 41]}>
            <boxGeometry args={[3000, 1.5, 2]} />
            <meshStandardMaterial color="#1e1c24" />
          </mesh>
          {/* railing */}
          <mesh position={[0, 2.6, 42.5]}>
            <boxGeometry args={[3000, 0.08, 0.08]} />
            <meshStandardMaterial color="#9aa0aa" metalness={0.6} roughness={0.4} />
          </mesh>
          {Array.from({ length: 40 }, (_, i) => (
            <mesh key={i} position={[-60 + i * 3, 2.05, 42.5]}>
              <boxGeometry args={[0.07, 1.1, 0.07]} />
              <meshStandardMaterial color="#9aa0aa" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
          {/* lamp posts */}
          {[-30, 14].map((x) => (
            <group key={x} position={[x, 1.5, 44]}>
              <mesh position={[0, 3, 0]}>
                <cylinderGeometry args={[0.08, 0.1, 6, 6]} />
                <meshStandardMaterial color="#2b2f38" />
              </mesh>
              <Glow position={[0, 6.1, 0]} size={4} color="#ffd9a0" opacity={0.9} />
            </group>
          ))}
          <Crowd xz={people} seed={7} y={1.5} />
          {shore.map((s, i) => (
            <TowerMesh key={i} s={s} lit={0.8 + 0.8 * flash} />
          ))}
          <Particles count={1400} t={t} compute={glints} size={2} color="#ffd9a0" seed={51} softness={0.6} opacity={0.6} additive maxPixelSize={5} />
          {/* the incoming chunk */}
          {!hit ? (
            <>
              <Glow position={[chunk.x, chunk.y, chunk.z]} size={30} color="#fff2cf" opacity={1} depthTest={false} />
              <Glow position={[chunk.x, chunk.y, chunk.z]} size={80} color="#ff8a2a" opacity={0.85} depthTest={false} />
            </>
          ) : null}
          <Particles count={2500} t={t} compute={trail} size={9} color="#ff9a3c" seed={52} softness={0.95} opacity={0.6} additive maxPixelSize={60} />
          {/* impact */}
          <Glow position={[HIT.x, 6, HIT.z]} size={260} color="#ffb070" opacity={0.95 * flash} depthTest={false} />
          <Particles count={11000} t={t} compute={splash} size={1.5} color="#eef8ff" seed={53} softness={0.55} opacity={0.9} maxPixelSize={22} />
          <Particles count={700} t={t} compute={steam} size={12} color="#cfd8e6" seed={54} softness={1} opacity={0.1} maxPixelSize={180} />
          <Particles count={900} t={t} compute={ring} size={2.5} color="#e8f6ff" seed={55} softness={0.5} additive maxPixelSize={8} />
          <pointLight position={[HIT.x, 30, HIT.z + 60]} intensity={hit ? 8 * flash + 0.6 : 0} distance={900} decay={0.6} color="#ffb070" />
        </SceneCanvas>
      </AbsoluteFill>
      {/* street-level flash */}
      <AbsoluteFill style={{ background: "#ffd2a0", opacity: 0.55 * (hit ? Math.exp(-dt * 9) : 0), mixBlendMode: "screen", pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export default HudsonImpact;
