import React, { useCallback, useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { mergeCamera } from "../../three/camera";
import { Glow, SkyDome } from "../../three/glow";
import { useSceneTime } from "../../three/hooks";
import { buildIssParts, Iss, partState } from "../../three/iss";
import { ParticleFn, Particles } from "../../three/Particles";
import { smoothstep } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import type { SceneComponentProps, Vec3 } from "../../types";

/**
 * REENTRY: the station ploughs into the air glowing orange; solar wings rip off and burn,
 * then the truss and modules split apart, trailing fire. Black space above, fiery limb below.
 * Station model space is metres (scaled 0.1); it flies towards model −Z, so the flow is +Z.
 * props: { breakAt?: number (s, wings start tearing), heatTime?: number (s to full glow) }
 */

const WIND: Vec3 = [0, 0.12, 1];

const Reentry: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const breakAt = (props.breakAt as number) ?? 0.9;
  const heatTime = (props.heatTime as number) ?? 2.2;
  const glow = 0.35 + 0.65 * smoothstep(0, heatTime, t);
  const breakT = t - breakAt;
  const parts = useMemo(() => buildIssParts(9), []);
  const emitters = useMemo(() => parts.map((p, i) => ({ p, i })), [parts]);

  // Bow-shock cap: a short, hot band hugging the leading edge (model metres; flight is −Z).
  const bow = useCallback<ParticleFn>(
    (_i, time, out, r) => {
      const life = 0.25 + r[0] * 0.25;
      const age = (time + r[1] * life) % life;
      const a = age / life;
      const x = (r[2] - 0.5) * 2;
      out[0] = x * 62;
      out[1] = (r[3] - 0.5) * 10;
      // curved cap: the middle sits further ahead than the wing tips
      out[2] = -40 - 14 * (1 - x * x) + age * 120;
      out[3] = 0.7 + a * 1.4;
      out[4] = glow * (1 - a) * Math.min(1, a * 6);
    },
    [glow],
  );

  // Wake: plasma peeling off the sides and streaming far behind the station.
  const wake = useCallback<ParticleFn>(
    (_i, time, out, r) => {
      const life = 0.6 + r[0] * 0.7;
      const age = (time + r[1] * life) % life;
      const a = age / life;
      const side = r[2] < 0.5 ? -1 : 1;
      const edge = r[3] < 0.55;
      const x0 = edge ? side * (52 + r[4] * 10) : (r[4] - 0.5) * 100;
      const z0 = edge ? -40 + r[5] * 70 : 34 + r[5] * 8;
      out[0] = x0 * (1 + a * 0.5) + (r[6] - 0.5) * a * 60;
      out[1] = (r[7] - 0.5) * 12 * (1 + a);
      out[2] = z0 + age * (330 + r[6] * 200);
      out[3] = 1 + a * 3.5;
      out[4] = Math.min(1, glow * 1.2) * (1 - a) * Math.min(1, a * 5);
    },
    [glow],
  );

  // Embers and flame trailing every piece that has torn loose.
  const embers = useCallback<ParticleFn>(
    (i, time, out, r) => {
      const { p } = emitters[i % emitters.length];
      const life = 0.45 + r[0] * 0.6;
      const age = (time + r[1] * life) % life;
      const emitT = time - breakAt - age;
      const s = partState(p, emitT, WIND);
      if (!s.loose || s.scale <= 0.05) {
        out[4] = 0;
        return;
      }
      const a = age / life;
      const len = p.cyl ? p.size[1] : p.size[2];
      const wid = p.cyl ? p.size[0] * 2 : p.size[0];
      out[0] = p.pos[0] + s.offset[0] + (r[2] - 0.5) * wid + (r[5] - 0.5) * a * 30;
      out[1] = p.pos[1] + s.offset[1] + (r[3] - 0.5) * 3;
      out[2] = p.pos[2] + s.offset[2] + (r[4] - 0.5) * len + age * (160 + r[6] * 140);
      out[3] = 0.8 + a * 2.5;
      out[4] = (1 - a) * Math.min(1, a * 10);
    },
    [emitters, breakAt],
  );

  // Speed streaks rushing upwards past the camera (world units).
  const streaks = useCallback<ParticleFn>((_i, time, out, r) => {
    const life = 0.45;
    const age = (time + r[0] * life) % life;
    out[0] = (r[1] - 0.5) * 30 + age * 18;
    out[1] = -25 + age * 120;
    out[2] = (r[3] - 0.5) * 20 - 4;
    out[3] = 0.4 + r[4];
    out[4] = 0.45 * Math.sin((Math.PI * age) / life);
  }, []);

  const cam = mergeCamera(
    { type: "pushIn", from: [0, -2.5, 25], to: [0, -1.2, 19], target: [0.6, -1.4, 0], fov: 50, ease: "out" },
    camera,
  );

  // Body shake that grows with the heat (2D, so it reads at phone size).
  const amp = 2 + 8 * smoothstep(0.6, 3.5, t);
  const sx = Math.sin(t * 61) * amp + Math.sin(t * 37 + 1) * amp * 0.5;
  const sy = Math.cos(t * 53) * amp * 0.8;

  const tumble = Math.sin(t * 0.7) * 0.06;
  const flicker = 0.85 + 0.15 * Math.sin(t * 40) * Math.sin(t * 23);

  return (
    <AbsoluteFill style={{ background: "#020104", transform: `translate(${sx}px, ${sy}px) scale(1.03)` }}>
      <SceneCanvas
        durationInFrames={durationInFrames}
        camera={cam}
        background="#020104"
        sky="#ffd2a8"
        ground="#2a0a04"
        sunPosition={[-6, -10, 14]}
        sunIntensity={1.4}
      >
        <SkyDome
          radius={600}
          stops={[
            [-1, "#ff8a26"],
            [-0.45, "#d0400e"],
            [-0.2, "#5a1206"],
            [0.05, "#14040a"],
            [1, "#010103"],
          ]}
        />
        <Particles count={420} t={t} compute={streaks} size={0.16} color="#ffc48a" seed={21} softness={0.3} opacity={0.6} additive maxPixelSize={5} />
        {/* Outer: screen-space heading (trail points up-right) + slight tilt. Inner: model Y faces camera, flight −Z points down. */}
        <group rotation={[-0.42, 0.18 + tumble, Math.PI + 0.55]}>
          <group rotation={[Math.PI / 2, 0, 0]} scale={0.1}>
            <Iss glow={glow} breakT={breakT} wind={WIND} />
            <Particles count={2200} t={t} compute={bow} size={1.0} color="#ffe2a0" seed={31} softness={0.85} opacity={0.45} additive maxPixelSize={50} />
            <Particles count={6000} t={t} compute={wake} size={1.0} color="#ff7a24" seed={32} softness={1} opacity={0.22} additive maxPixelSize={60} />
            <Particles count={5000} t={t} compute={embers} size={0.45} color="#ffb04a" seed={33} softness={0.8} opacity={0.7} additive maxPixelSize={30} />
            <Glow position={[0, 0, -52]} size={70} stretch={[2.2, 0.8]} color="#ff9a3c" opacity={0.5 * glow * flicker} />
            <Glow position={[0, 0, -46]} size={34} stretch={[2.6, 0.6]} color="#fff0c8" opacity={0.55 * glow * flicker} />
          </group>
        </group>
      </SceneCanvas>
    </AbsoluteFill>
  );
};

export default Reentry;
