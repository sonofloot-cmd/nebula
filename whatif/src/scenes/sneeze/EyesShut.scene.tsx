import React, { useCallback, useMemo } from "react";
import { AbsoluteFill, interpolate, useVideoConfig } from "remotion";
import { mergeCamera } from "../../three/camera";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { CLOTHES, SKIN } from "../../three/props";
import { mulberry32, smoothstep } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import { Car, Cockpit, Pilot } from "../../three/vehicles";
import { SANS } from "../../fonts";
import type { SceneComponentProps } from "../../types";

/**
 * TWIST (split screen): top — an airliner flight deck, both pilots mid-sneeze with
 * eyes shut while the horizon banks away; bottom — a highway at dusk, every driver's
 * eyes shut, cars drifting out of their lanes.
 * props: { shutAt?: number }  — when the sneeze hits and eyes close (s)
 */

const SKY_TOP = "#2c4a86";

/** What the pilots would be looking at: a cloud deck and a horizon that slowly banks. */
const OutsideWorld: React.FC<{ t: number; bank: number }> = ({ t, bank }) => {
  const clouds = useCallback<ParticleFn>((_i, time, out, r) => {
    const speed = 60;
    out[0] = (r[0] - 0.5) * 260;
    out[1] = -14 - r[1] * 10;
    out[2] = -260 + ((r[2] * 300 + time * speed) % 300);
    out[3] = 0.6 + r[3] * 1.4;
    out[4] = 0.9;
  }, []);
  return (
    <group rotation={[0, 0, bank]}>
      <mesh position={[0, -26, -60]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[900, 900]} />
        <meshBasicMaterial color="#c9d6ec" />
      </mesh>
      <Particles count={900} t={t} compute={clouds} size={14} color="#f4f7ff" seed={303} softness={1} opacity={0.75} maxPixelSize={400} />
      {/* low sun on the horizon */}
      <mesh position={[60, 4, -320]}>
        <sphereGeometry args={[14, 16, 8]} />
        <meshBasicMaterial color="#ffd38a" />
      </mesh>
    </group>
  );
};

const Highway: React.FC<{ t: number; shutAt: number }> = ({ t, shutAt }) => {
  const speed = 26; // m/s of scrolling road (the cars and camera move together)
  const cars = useMemo(() => {
    const rand = mulberry32(77);
    const lanes = [-5.4, -1.8, 1.8, 5.4];
    const out: Array<{ x: number; z: number; drift: number; rel: number; color: string; skin: string; roll: number }> = [];
    for (let row = 0; row < 5; row++) {
      lanes.forEach((x, li) => {
        if (rand() < 0.35 && row > 0) return;
        out.push({
          x,
          z: row === 0 && li === 1 ? 1 : 2 - row * 13 - rand() * 5 - (li % 2) * 4,
          drift: (rand() < 0.5 ? -1 : 1) * (0.8 + rand() * 1.8),
          rel: (rand() - 0.5) * 2.5,
          color: CLOTHES[Math.floor(rand() * CLOTHES.length)],
          skin: SKIN[Math.floor(rand() * SKIN.length)],
          roll: (rand() - 0.5) * 0.4,
        });
      });
    }
    return out;
  }, []);
  const k = smoothstep(shutAt, shutAt + 4.5, t);
  const jerk = Math.exp(-Math.max(0, t - shutAt) * 6) * (t > shutAt ? 1 : 0);
  return (
    <group>
      {/* asphalt, shoulders, verges */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -60]}>
        <planeGeometry args={[16, 220]} />
        <meshStandardMaterial color="#2e3240" roughness={1} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} rotation={[-Math.PI / 2, 0, 0]} position={[s * 40, -0.02, -60]}>
          <planeGeometry args={[64, 220]} />
          <meshStandardMaterial color="#25402f" roughness={1} />
        </mesh>
      ))}
      {[-7.6, 7.6].map((x) => (
        <mesh key={x} position={[x, 0.01, -60]}>
          <boxGeometry args={[0.18, 0.02, 220]} />
          <meshBasicMaterial color="#f3d36b" />
        </mesh>
      ))}
      {/* scrolling lane dashes */}
      {[-3.6, 0, 3.6].flatMap((x) =>
        Array.from({ length: 18 }).map((_, i) => {
          const z = (((i * 12 + t * speed) % 216) + 216) % 216 - 200;
          return (
            <mesh key={`${x}${i}`} position={[x, 0.01, z]}>
              <boxGeometry args={[0.16, 0.02, 3]} />
              <meshBasicMaterial color="#e8eaf0" />
            </mesh>
          );
        }),
      )}
      {/* light poles passing */}
      {[-9, 9].flatMap((x) =>
        Array.from({ length: 6 }).map((_, i) => {
          const z = (((i * 36 + t * speed) % 216) + 216) % 216 - 200;
          return (
            <group key={`${x}p${i}`} position={[x, 0, z]}>
              <mesh position={[0, 4, 0]}>
                <cylinderGeometry args={[0.08, 0.1, 8, 6]} />
                <meshStandardMaterial color="#5a6070" />
              </mesh>
              <mesh position={[x > 0 ? -0.8 : 0.8, 8, 0]}>
                <boxGeometry args={[1.6, 0.12, 0.3]} />
                <meshBasicMaterial color="#ffe2a8" />
              </mesh>
            </group>
          );
        }),
      )}
      {cars.map((c, i) => {
        const dx = c.drift * k * (2.2 + Math.sin(t * 0.9 + i) * 0.3);
        const yaw = c.drift * 0.07 * (k > 0 && k < 1 ? 1 : 0.4) * Math.min(1, k * 3);
        return (
          <Car
            key={i}
            position={[c.x + dx, 0, c.z + c.rel * t]}
            yaw={yaw}
            color={c.color}
            skin={c.skin}
            headPitch={0.35 * jerk + 0.12 * k}
            headRoll={c.roll * k}
          />
        );
      })}
    </group>
  );
};

/** Eyelids: a full blink on the sneeze, then a heavy half-closed frame. */
const Lids: React.FC<{ t: number; shutAt: number; dur: number }> = ({ t, shutAt, dur }) => {
  const { height } = useVideoConfig();
  const closed = interpolate(
    t,
    [shutAt - 0.12, shutAt, shutAt + 0.22, shutAt + 0.45, dur - 0.5, dur - 0.1],
    [0, 1, 1, 0.12, 0.12, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const lid = (closed * height) / 2;
  const common: React.CSSProperties = {
    position: "absolute",
    left: "-20%",
    width: "140%",
    height,
    background: "#010103",
    boxShadow: "0 0 140px 70px rgba(1,1,3,0.9)",
  };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ ...common, top: lid - height, borderRadius: "0 0 50% 50% / 0 0 14% 14%" }} />
      <div style={{ ...common, top: height - lid, borderRadius: "50% 50% 0 0 / 14% 14% 0 0" }} />
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, rgba(160,0,0,0) 45%, rgba(160,0,0,0.55) 100%)",
          opacity: t > shutAt ? 0.6 + 0.4 * Math.sin(t * 5) : 0,
        }}
      />
    </AbsoluteFill>
  );
};

const Tag: React.FC<{ top: number; text: string }> = ({ top, text }) => (
  <div
    style={{
      position: "absolute",
      top,
      right: 44,
      fontFamily: SANS,
      fontWeight: 800,
      fontSize: 28,
      letterSpacing: "0.2em",
      color: "white",
      background: "rgba(0,0,0,0.45)",
      padding: "8px 16px",
      borderRadius: 8,
    }}
  >
    {text}
  </div>
);

const EyesShut: React.FC<SceneComponentProps> = ({ durationInFrames, props, camera }) => {
  const t = useSceneTime();
  const { fps, width, height } = useVideoConfig();
  const dur = durationInFrames / fps;
  const shutAt = (props.shutAt as number) ?? 0.45;
  const half = height / 2;

  const jerk = t > shutAt ? Math.exp(-(t - shutAt) * 5) : 0;
  const slump = smoothstep(shutAt, shutAt + 3, t);
  const bank = -0.32 * smoothstep(shutAt + 0.3, dur, t);

  const cockpitCam = mergeCamera(
    { type: "orbit", from: [-0.25, 1.72, -1.75], to: [-0.1, 1.66, -1.3], target: [0, 1.58, 0.1], orbitDegrees: 28, fov: 60, ease: "inOut" },
    camera,
  );
  const roadCam = {
    type: "crane" as const,
    from: [-1.2, 1.38, 5.4] as [number, number, number],
    to: [2.8, 3.6, 11.5] as [number, number, number],
    target: [-2.2, 0.95, 0.8] as [number, number, number],
    targetTo: [-0.5, 0.8, -12] as [number, number, number],
    fov: 40,
  };

  return (
    <AbsoluteFill style={{ background: "#020308" }}>
      <SceneCanvas
        durationInFrames={durationInFrames}
        camera={cockpitCam}
        background={SKY_TOP}
        fog={[SKY_TOP, 80, 420]}
        width={width}
        height={half}
        top={0}
        sky="#b9c8ea"
        ground="#30343d"
        sunPosition={[4, 6, -10]}
        sunIntensity={1.5}
      >
        <pointLight position={[0, 1.2, -0.6]} intensity={3} distance={3} color="#6fa8ff" />
        <pointLight position={[0, 1.9, -1.4]} intensity={4} distance={4} color="#fff1dc" />
        <OutsideWorld t={t} bank={bank} />
        <Cockpit />
        <Pilot position={[-0.55, 0, 0]} pitch={0.45 * jerk + 0.18 * slump} roll={0.12 * slump} skin="#e0ac69" />
        <Pilot position={[0.55, 0, 0]} pitch={0.4 * jerk + 0.22 * slump} roll={-0.15 * slump} skin="#8d5524" />
      </SceneCanvas>
      <SceneCanvas
        durationInFrames={durationInFrames}
        camera={roadCam}
        background="#33467a"
        fog={["#33467a", 35, 150]}
        width={width}
        height={half}
        top={half}
        sky="#c3d0f0"
        ground="#2a3040"
        sunPosition={[6, 10, 14]}
        sunIntensity={1.6}
      >
        <pointLight position={[0, 3, 9]} intensity={30} distance={20} color="#fff1dc" />
        <Highway t={t} shutAt={shutAt} />
      </SceneCanvas>
      <div style={{ position: "absolute", left: 0, right: 0, top: half - 2, height: 4, background: "rgba(255,255,255,0.85)" }} />
      <Tag top={half - 66} text="IN THE AIR" />
      <Tag top={half + 22} text="ON THE ROAD" />
      <Lids t={t} shutAt={shutAt} dur={dur} />
    </AbsoluteFill>
  );
};

export default EyesShut;
