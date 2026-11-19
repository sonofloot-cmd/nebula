import React, { useCallback, useMemo } from "react";
import { AbsoluteFill, interpolate, useVideoConfig } from "remotion";
import { mergeCamera } from "../../three/camera";
import { sampleLandPoints } from "../../three/geo";
import { faceLongitude, Globe, NIGHT, seededUnitVectors, Stars } from "../../three/Globe";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { mulberry32 } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import type { SceneComponentProps } from "../../types";

/**
 * TWIST: the night side of Earth — city lights, planes still flying — while
 * eyelids close over the frame. Every eye shuts during a sneeze.
 * props: { planes?: number, closeAt?: number, openAt?: number, faceLon?: number }
 */

const R = 10;
const TRAIL = 6;

/** Eyelids drawn over the 3D scene (the stat block + caption stay above them). */
const Eyelids: React.FC<{ closed: number }> = ({ closed }) => {
  const { height } = useVideoConfig();
  const lid = (closed * height) / 2;
  const common: React.CSSProperties = {
    position: "absolute",
    left: "-20%",
    width: "140%",
    height: height,
    background: "#020203",
    boxShadow: "0 0 120px 60px rgba(2,2,3,0.95)",
  };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ ...common, top: lid - height, borderRadius: "0 0 50% 50% / 0 0 18% 18%" }} />
      <div style={{ ...common, top: height - lid, borderRadius: "50% 50% 0 0 / 18% 18% 0 0" }} />
      <AbsoluteFill style={{ background: "rgba(120,0,0,1)", mixBlendMode: "multiply", opacity: closed * 0.35 }} />
    </AbsoluteFill>
  );
};

const BlindPlanet: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const { fps } = useVideoConfig();
  const dur = durationInFrames / fps;
  const planes = (props.planes as number) ?? 1200;
  const closeAt = (props.closeAt as number) ?? 0.9;
  const openAt = (props.openAt as number) ?? dur - 0.7;
  const faceLon = (props.faceLon as number) ?? 20;

  const cities = useMemo(() => sampleLandPoints(9000, 9, 62), []);
  const routes = useMemo(() => {
    const rand = mulberry32(5);
    return seededUnitVectors(planes, 17).map((axis) => ({ axis, phase: rand() * Math.PI * 2, speed: 0.04 + rand() * 0.03, blink: rand() }));
  }, [planes]);

  const lights = useCallback<ParticleFn>(
    (i, time, out, r) => {
      const n = cities[i];
      out[0] = n.x * R * 1.002;
      out[1] = n.y * R * 1.002;
      out[2] = n.z * R * 1.002;
      out[3] = 0.4 + Math.pow(r[0], 6) * 2.2;
      out[4] = 0.55 + 0.25 * Math.sin(time * 2 + r[1] * 20);
    },
    [cities],
  );

  // Each plane = head + short trail, flying a great circle.
  const flights = useCallback<ParticleFn>(
    (i, time, out) => {
      const p = routes[Math.floor(i / TRAIL)];
      const k = i % TRAIL;
      const a = p.phase + (time - k * 0.25) * p.speed;
      // orthonormal basis around the route axis
      const ax = p.axis;
      const ux = Math.abs(ax.y) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      let bx = ax.y * ux[2] - ax.z * ux[1];
      let by = ax.z * ux[0] - ax.x * ux[2];
      let bz = ax.x * ux[1] - ax.y * ux[0];
      const bl = Math.hypot(bx, by, bz);
      bx /= bl;
      by /= bl;
      bz /= bl;
      const cx = ax.y * bz - ax.z * by;
      const cy = ax.z * bx - ax.x * bz;
      const cz = ax.x * by - ax.y * bx;
      const rr = R * 1.035;
      out[0] = rr * (Math.cos(a) * bx + Math.sin(a) * cx);
      out[1] = rr * (Math.cos(a) * by + Math.sin(a) * cy);
      out[2] = rr * (Math.cos(a) * bz + Math.sin(a) * cz);
      const strobe = k === 0 && Math.sin(time * 9 + p.blink * 20) > 0.6 ? 1.8 : 1;
      out[3] = k === 0 ? 1 * strobe : 0.7 - k * 0.08;
      out[4] = k === 0 ? 1 : 0.5 * (1 - k / TRAIL);
    },
    [routes],
  );

  const closed = interpolate(t, [closeAt, closeAt + 0.25, openAt, openAt + 0.35], [0, 0.66, 0.66, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // A little flutter while shut, like a squeezed blink.
  const flutter = closed > 0.6 ? Math.sin(t * 7) * 0.012 : 0;

  const cam = mergeCamera({ type: "pushIn", from: [0, 6, 34], to: [2, 3, 23], target: [0, 0, 0], targetTo: [0, 1, 0], fov: 45 }, camera);

  return (
    <AbsoluteFill>
      <SceneCanvas
        durationInFrames={durationInFrames}
        camera={cam}
        background="#010207"
        sky="#5d73b8"
        ground="#000000"
        sunPosition={[-25, 12, 20]}
        sunIntensity={0.9}
      >
        <Stars t={t} />
        <group rotation={[0.35, faceLongitude(faceLon) + t * 0.025, 0]}>
          <Globe radius={R} palette={NIGHT} atmosphere="#4a7cf0" atmosphereOpacity={0.35} />
          <Particles count={cities.length} t={t} compute={lights} size={0.16} color="#ffcf7a" seed={91} softness={0.7} additive maxPixelSize={20} />
          <Particles count={routes.length * TRAIL} t={t} compute={flights} size={0.16} color="#ffffff" seed={92} softness={0.4} additive maxPixelSize={22} />
        </group>
      </SceneCanvas>
      <Eyelids closed={closed + flutter} />
    </AbsoluteFill>
  );
};

export default BlindPlanet;
