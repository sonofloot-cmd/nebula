import React, { useCallback, useMemo } from "react";
import { AbsoluteFill, spring, useVideoConfig } from "remotion";
import * as THREE from "three";
import { SANS } from "../../fonts";
import { Glow, SkyDome } from "../../three/glow";
import { Stars } from "../../three/Globe";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { mulberry32, smoothstep } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import { TextCard, TextPanel } from "../../three/text";
import type { SceneComponentProps, Vec3 } from "../../types";

/**
 * TWIST: silence and stars ("it's happened before…"), then a hard cut to a dusty low-poly
 * outback town at night as burning fragments streak overhead (Skylab, 1979). A scorched tank
 * thumps into the main street, and a littering fine slaps onto the screen.
 * All shop signs are generic. World units = metres.
 * props: { cutAt?: number, landAt?: number, ticketAt?: number, fine?: string }
 */

const DIRT = "#5c2a17";
const ROAD = "#7a3b1f";

interface Shop {
  x: number;
  w: number;
  h: number;
  color: string;
  sign: string;
  gable?: boolean;
}

const SHOPS: Shop[] = [
  { x: -40, w: 12, h: 4.6, color: "#c9b48a", sign: "GARAGE" },
  { x: -26, w: 14, h: 6.5, color: "#9c4a36", sign: "HOTEL", gable: true },
  { x: -10.5, w: 13, h: 5, color: "#cfc6a8", sign: "GENERAL STORE" },
  { x: 4, w: 11, h: 4.8, color: "#7f9a7a", sign: "POST" },
  { x: 18, w: 15, h: 5.6, color: "#d8cfb4", sign: "SHIRE OFFICE", gable: true },
  { x: 33, w: 10, h: 4.4, color: "#b77a54", sign: "BAKERY" },
];

const Shopfront: React.FC<{ s: Shop }> = ({ s }) => {
  const sign: TextCard = { lines: [s.sign], width: 1024, height: 192, bg: "#f2ead2", fg: "#3a1d10", size: 120, weight: 900, border: "#3a1d10", borderWidth: 8 };
  return (
    <group position={[s.x, 0, -16]}>
      <mesh position={[0, s.h / 2, 0]}>
        <boxGeometry args={[s.w, s.h, 10]} />
        <meshStandardMaterial color={s.color} flatShading roughness={0.95} />
      </mesh>
      {s.gable ? (
        <mesh position={[0, s.h + 1.2, 0]} rotation={[0, 0, 0]} scale={[s.w / 2 + 0.4, 1.3, 5.4]}>
          <cylinderGeometry args={[1, 1, 2, 3, 1]} />
          <meshStandardMaterial color="#8c929a" flatShading roughness={0.6} metalness={0.4} />
        </mesh>
      ) : (
        <mesh position={[0, s.h + 0.15, 0]}>
          <boxGeometry args={[s.w + 0.6, 0.3, 10.6]} />
          <meshStandardMaterial color="#8c929a" flatShading roughness={0.6} metalness={0.4} />
        </mesh>
      )}
      {/* verandah */}
      <mesh position={[0, 3.3, 7.3]} rotation={[0.12, 0, 0]}>
        <boxGeometry args={[s.w, 0.15, 4.6]} />
        <meshStandardMaterial color="#a3a7ad" flatShading roughness={0.6} metalness={0.35} />
      </mesh>
      {[-1, 1].map((k) => (
        <mesh key={k} position={[k * (s.w / 2 - 0.4), 1.6, 9.4]}>
          <boxGeometry args={[0.2, 3.3, 0.2]} />
          <meshStandardMaterial color="#e8e0cc" />
        </mesh>
      ))}
      {/* warm windows + door */}
      {[-0.28, 0.28].map((k) => (
        <mesh key={k} position={[k * s.w, 1.7, 5.02]}>
          <planeGeometry args={[s.w * 0.22, 1.4]} />
          <meshBasicMaterial color="#ffc46b" toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 1.15, 5.02]}>
        <planeGeometry args={[1.2, 2.3]} />
        <meshBasicMaterial color="#3a2416" />
      </mesh>
      <Glow position={[0, 1.8, 7]} size={s.w * 0.9} color="#ffb04a" opacity={0.28} />
      <TextPanel card={sign} height={0.95} position={[0, 3.95, 9.66]} rotation={[0, 0, 0]} brightness={0.9} />
    </group>
  );
};

const GumTree: React.FC<{ p: Vec3; s?: number; seed: number }> = ({ p, s = 1, seed }) => {
  const r = mulberry32(seed);
  return (
    <group position={p} scale={s}>
      <mesh position={[0, 3, 0]} rotation={[0, 0, (r() - 0.5) * 0.3]}>
        <cylinderGeometry args={[0.25, 0.45, 6, 5]} />
        <meshStandardMaterial color="#d8d2c4" flatShading />
      </mesh>
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[(r() - 0.5) * 3, 6.5 + r() * 1.5, (r() - 0.5) * 2]} scale={[2.4 + r(), 1.4 + r() * 0.6, 2.2 + r()]}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#3d5a3a" flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  );
};

const OutbackTwist: React.FC<SceneComponentProps> = ({ durationInFrames, props }) => {
  const t = useSceneTime();
  const { fps } = useVideoConfig();
  const cutAt = (props.cutAt as number) ?? 2.0;
  const landAt = (props.landAt as number) ?? 3.0;
  const ticketAt = (props.ticketAt as number) ?? 4.0;
  const fine = (props.fine as string) ?? "$400";
  const town = t >= cutAt;
  const tb = t - cutAt;

  // hero fragment: streaks in and lands in the main street
  const LAND = useMemo(() => new THREE.Vector3(-9, 0.9, 3.5), []);
  const FROM = useMemo(() => new THREE.Vector3(-200, 170, -320), []);
  const heroAt = (time: number) => {
    const f = Math.min(1, Math.max(0, (time - cutAt + 0.15) / (landAt - cutAt + 0.15)));
    return FROM.clone().lerp(LAND, f * f * 0.35 + f * 0.65);
  };
  const landed = t >= landAt;
  const hero = heroAt(t);

  // distant fragments raining onto the horizon
  const FR = 7;
  const frag = (k: number, time: number) => {
    const r = mulberry32(500 + k);
    const t0 = cutAt - 0.4 + r() * 1.6;
    const dur = 1.3 + r() * 0.8;
    const f = (time - t0) / dur;
    const a = new THREE.Vector3(-400 + r() * 200, 260 + r() * 80, -500 - r() * 200);
    const b = new THREE.Vector3(100 + r() * 400, 0, -500 - r() * 300);
    return { p: a.lerp(b, Math.min(1, Math.max(0, f))), f };
  };

  const trails = useCallback<ParticleFn>(
    (i, time, out, r) => {
      if (time < cutAt) {
        out[4] = 0;
        return;
      }
      const k = i % (FR + 1);
      const life = 0.6 + r[0] * 0.6;
      const age = (time + r[1] * life) % life;
      const birth = time - age;
      let p: THREE.Vector3;
      let size = 1;
      if (k === 0) {
        if (birth > landAt) {
          out[4] = 0;
          return;
        }
        p = heroAt(birth);
        size = 0.35;
      } else {
        const fr = frag(k - 1, birth);
        if (fr.f < 0 || fr.f > 1) {
          out[4] = 0;
          return;
        }
        p = fr.p;
        size = 7;
      }
      const a = age / life;
      out[0] = p.x + (r[2] - 0.5) * 6 * a * size;
      out[1] = p.y + (r[3] - 0.5) * 6 * a * size + age * 2 * size;
      out[2] = p.z + (r[4] - 0.5) * 6 * a * size;
      out[3] = size * (1 + a * 2);
      out[4] = (1 - a) * Math.min(1, a * 10);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cutAt, landAt],
  );

  // dust + embers kicked up by the landing
  const dust = useCallback<ParticleFn>(
    (_i, time, out, r) => {
      const dt = time - landAt;
      if (dt < 0) {
        out[4] = 0;
        return;
      }
      const a = r[0] * Math.PI * 2;
      const sp = 3 + r[1] * 9;
      const rr = sp * (1 - Math.exp(-dt * 2.2)) / 2.2;
      out[0] = LAND.x + Math.cos(a) * rr;
      out[1] = 0.3 + r[2] * 2.5 * (1 - Math.exp(-dt * 3)) + dt * 0.4;
      out[2] = LAND.z + Math.sin(a) * rr;
      out[3] = 1 + dt * 1.5;
      out[4] = Math.max(0, 0.8 - dt * 0.28);
    },
    [landAt, LAND],
  );
  const embers = useCallback<ParticleFn>(
    (_i, time, out, r) => {
      const life = 0.9;
      const age = (time + r[0] * life) % life;
      const on = time - age >= landAt ? 1 : 0;
      out[0] = LAND.x + (r[1] - 0.5) * 2.4 + (r[3] - 0.5) * age * 2;
      out[1] = 0.8 + age * (1.5 + r[2] * 2);
      out[2] = LAND.z + (r[4] - 0.5) * 1.6;
      out[3] = 1 - age / life;
      out[4] = on * (1 - age / life) * Math.max(0.2, 1 - (time - landAt) * 0.25);
    },
    [landAt, LAND],
  );

  // camera: phase A looks up at the stars over the rooftops; hard cut to the town
  const cameraAt = useCallback(
    (frame: number) => {
      const s = frame / fps;
      if (s < cutAt) {
        const p = s / cutAt;
        return { pos: [0, 1.7, 32] as Vec3, target: [8, 40 - 10 * p, -60] as Vec3, fov: 55 };
      }
      const p = Math.min(1, (s - cutAt) / (durationInFrames / fps - cutAt));
      const e = 1 - Math.pow(1 - p, 2);
      const shake = s > landAt ? Math.exp(-(s - landAt) * 5) * 0.35 : 0;
      return {
        pos: [-26 + 5 * e + Math.sin(s * 70) * shake, 4.2 - 0.8 * e + Math.cos(s * 63) * shake, 24 - 6 * e] as Vec3,
        target: [2, 6 - 1.2 * e, -10] as Vec3,
        fov: 50,
      };
    },
    [fps, cutAt, durationInFrames, landAt],
  );

  const heat = landed ? Math.max(0.25, 1 - (t - landAt) * 0.3) : 1;
  const ticket = spring({ frame: Math.round((t - ticketAt) * fps), fps, config: { damping: 11, stiffness: 170 } });

  return (
    <AbsoluteFill style={{ background: "#03040c" }}>
      <SceneCanvas
        durationInFrames={durationInFrames}
        camera={{ type: "dolly", from: [0, 2, 30], target: [0, 4, 0], fov: 50 }}
        cameraAt={cameraAt}
        background="#03040c"
        fog={["#0c0d1c", 160, 1400]}
        sky="#8aa0d8"
        ground="#2a1208"
        sunPosition={[-40, 60, 30]}
        sunIntensity={0.55}
      >
        <SkyDome
          radius={900}
          stops={[
            [-1, "#1a0d08"],
            [0, "#2a1c2a"],
            [0.06, "#141a36"],
            [0.35, "#070a1e"],
            [1, "#02030a"],
          ]}
        />
        <Stars t={t} count={3200} radius={700} />
        {/* moon */}
        <Glow position={[-160, 210, -500]} size={120} color="#cfe0ff" opacity={0.45} />
        <mesh position={[-160, 210, -500]}>
          <sphereGeometry args={[14, 16, 12]} />
          <meshBasicMaterial color="#eef3ff" fog={false} />
        </mesh>
        {/* ground + main street */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1600, 1600]} />
          <meshStandardMaterial color={DIRT} roughness={1} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 2]}>
          <planeGeometry args={[400, 12]} />
          <meshStandardMaterial color={ROAD} roughness={1} />
        </mesh>
        {SHOPS.map((s, i) => (
          <Shopfront key={i} s={s} />
        ))}
        {/* water tank on a stand + windmill + trees + power poles */}
        <group position={[52, 0, -24]}>
          {[-1, 1].map((a) =>
            [-1, 1].map((b) => (
              <mesh key={`${a}${b}`} position={[a * 1.6, 4, b * 1.6]}>
                <boxGeometry args={[0.3, 8, 0.3]} />
                <meshStandardMaterial color="#6b5a4a" />
              </mesh>
            )),
          )}
          <mesh position={[0, 9.8, 0]}>
            <cylinderGeometry args={[2.6, 2.6, 3.6, 10]} />
            <meshStandardMaterial color="#a9adb3" flatShading metalness={0.4} roughness={0.5} />
          </mesh>
        </group>
        <group position={[-58, 0, -30]}>
          <mesh position={[0, 7, 0]}>
            <cylinderGeometry args={[0.2, 1.4, 14, 4]} />
            <meshStandardMaterial color="#8a8f96" flatShading />
          </mesh>
          <group position={[0, 14, 1]} rotation={[0, 0, t * 1.4]}>
            {Array.from({ length: 12 }, (_, k) => (
              <mesh key={k} rotation={[0, 0, (k / 12) * Math.PI * 2]} position={[0, 0, 0]}>
                <boxGeometry args={[0.35, 4.4, 0.05]} />
                <meshStandardMaterial color="#c9ccd0" />
              </mesh>
            ))}
          </group>
        </group>
        <GumTree p={[-50, 0, -6]} seed={1} />
        <GumTree p={[44, 0, -4]} s={1.2} seed={2} />
        <GumTree p={[-70, 0, -60]} s={1.4} seed={3} />
        <GumTree p={[70, 0, -50]} s={1.1} seed={4} />
        {[14, 40].map((x, i) => (
          <group key={i} position={[x, 0, 9.5]}>
            <mesh position={[0, 4.5, 0]}>
              <cylinderGeometry args={[0.12, 0.15, 9, 5]} />
              <meshStandardMaterial color="#4a3a2c" />
            </mesh>
            <Glow position={[0, 8.6, 0.5]} size={7} color="#ffcf8a" opacity={0.7} />
          </group>
        ))}
        {/* falling fragments */}
        {town ? (
          <>
            <Particles count={12000} t={t} compute={trails} size={1.4} color="#ff9a3c" seed={91} softness={0.95} opacity={0.6} additive maxPixelSize={60} />
            {Array.from({ length: FR }, (_, k) => {
              const fr = frag(k, t);
              if (fr.f < 0 || fr.f > 1) return null;
              return <Glow key={k} position={[fr.p.x, fr.p.y, fr.p.z]} size={70} color="#ffd08a" opacity={0.95} depthTest={false} />;
            })}
            {!landed ? (
              <>
                <Glow position={[hero.x, hero.y, hero.z]} size={6} color="#fff2cf" opacity={1} />
                <Glow position={[hero.x, hero.y, hero.z]} size={16} color="#ff8a2a" opacity={0.8} />
              </>
            ) : null}
            {/* the scorched tank in the street */}
            <group position={landed ? [LAND.x, LAND.y, LAND.z] : [hero.x, hero.y, hero.z]} rotation={[0.3, 0.6 + (landed ? 0 : tb * 3), 1.2]}>
              <mesh>
                <cylinderGeometry args={[0.9, 0.9, 2.2, 10]} />
                <meshStandardMaterial color="#2b2522" flatShading emissive="#ff6a1a" emissiveIntensity={heat * 1.4} roughness={0.8} metalness={0.3} />
              </mesh>
              {[-1, 1].map((k) => (
                <mesh key={k} position={[0, k * 1.1, 0]} scale={[0.9, 0.55, 0.9]}>
                  <sphereGeometry args={[1, 10, 6]} />
                  <meshStandardMaterial color="#2b2522" flatShading emissive="#ff6a1a" emissiveIntensity={heat * 1.4} roughness={0.8} metalness={0.3} />
                </mesh>
              ))}
            </group>
            {landed ? <Glow position={[LAND.x, 1.2, LAND.z]} size={10} color="#ff7a2a" opacity={0.55 * heat} /> : null}
            <Particles count={900} t={t} compute={dust} size={1.6} color="#b8754a" seed={92} softness={1} opacity={0.35} maxPixelSize={120} />
            <Particles count={300} t={t} compute={embers} size={0.18} color="#ffb04a" seed={93} softness={0.5} additive maxPixelSize={8} />
            <pointLight position={[LAND.x, 2.5, LAND.z + 1]} intensity={landed ? 3 * heat : 0} distance={30} decay={1.2} color="#ff8a3c" />
          </>
        ) : null}
      </SceneCanvas>
      {/* hard-cut flash */}
      <AbsoluteFill style={{ background: "#ffd9a8", opacity: Math.max(0, 0.5 - Math.abs(t - cutAt) * 6), pointerEvents: "none" }} />
      {/* the littering fine */}
      {t >= ticketAt ? (
        <div
          style={{
            position: "absolute",
            left: 230,
            top: 640,
            width: 620,
            padding: "30px 40px 34px",
            background: "#fff6c9",
            borderRadius: 10,
            boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
            fontFamily: SANS,
            color: "#2a1a10",
            transform: `rotate(${-7 + 3 * (1 - ticket)}deg) scale(${1.6 - 0.6 * ticket})`,
            opacity: Math.min(1, ticket * 2),
            borderTop: "18px solid #d4302a",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 30, letterSpacing: "0.2em" }}>SHIRE NOTICE</div>
          <div style={{ height: 3, background: "#2a1a10", opacity: 0.3, margin: "14px 0 18px" }} />
          <div style={{ fontWeight: 700, fontSize: 34, lineHeight: 1.35 }}>OFFENCE: LITTERING</div>
          <div style={{ fontWeight: 700, fontSize: 34, lineHeight: 1.35 }}>OFFENDER: NASA</div>
          <div style={{ fontWeight: 900, fontSize: 96, lineHeight: 1.05, marginTop: 14, color: "#d4302a" }}>FINE {fine}</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export default OutbackTwist;
