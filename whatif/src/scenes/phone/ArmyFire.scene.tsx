import React, { useCallback, useMemo } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { mergeCamera } from "../../three/camera";
import { Glow } from "../../three/glow";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { mulberry32 } from "../../three/random";
import type { SceneComponentProps } from "../../types";
import { BrightCanvas, BrightSky, Ground, Phone, shake, Tank, Tree } from "./kit";

/** A generic army opens fire on a ~150 m phone; shells bounce off the screen protector. */
const ArmyFire: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const L = (props.length as number) ?? 150;
  const PH = useMemo(() => new THREE.Vector3(0, 0, -330), []);
  const tanks = useMemo(
    () => [
      { p: new THREE.Vector3(-14, 0, 6), ry: 1.62, fire: 0.25 },
      { p: new THREE.Vector3(6, 0, 2), ry: 1.5, fire: 0.6 },
      { p: new THREE.Vector3(-30, 0, -14), ry: 1.62, fire: 0.95 },
      { p: new THREE.Vector3(22, 0, -10), ry: 1.48, fire: 1.3 },
      { p: new THREE.Vector3(-4, 0, -22), ry: 1.57, fire: 1.65 },
    ],
    [],
  );
  // each tank fires every ~1.2 s; a shell flies 0.35 s to the screen, then ricochets
  const shot = (k: number, time: number) => {
    const tk = tanks[k];
    const period = 1.2;
    const n = Math.floor((time - tk.fire) / period);
    if (n < 0) return null;
    const ft = tk.fire + n * period;
    return { ft, dt: time - ft, n };
  };
  const hitPoint = (k: number, n: number) => {
    const r = mulberry32(k * 100 + n);
    return new THREE.Vector3(PH.x + (r() - 0.5) * 50, 25 + r() * 90, PH.z + 5);
  };
  const tracers = useCallback<ParticleFn>(
    (i, time, out, r) => {
      const k = i % tanks.length;
      const s = shot(k, time - r[0] * 0.02);
      if (!s) {
        out[4] = 0;
        return;
      }
      const muzzle = tanks[k].p.clone().add(new THREE.Vector3(0, 3, -4.5));
      const hp = hitPoint(k, s.n);
      const fly = 0.35;
      let p: THREE.Vector3;
      if (s.dt < fly) p = muzzle.clone().lerp(hp, s.dt / fly);
      else {
        // ricochet: bounce back and away, falling
        const d = s.dt - fly;
        const rr = mulberry32(k * 31 + s.n);
        p = hp.clone().add(new THREE.Vector3((rr() - 0.5) * 120 * d, 40 * d - 30 * d * d, 90 * d));
        if (d > 0.7) {
          out[4] = 0;
          return;
        }
      }
      out[0] = p.x;
      out[1] = p.y;
      out[2] = p.z;
      out[3] = 1;
      out[4] = 1;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tanks],
  );
  const sparks = useCallback<ParticleFn>(
    (i, time, out, r) => {
      const k = i % tanks.length;
      const s = shot(k, time);
      if (!s || s.dt < 0.35 || s.dt > 0.9) {
        out[4] = 0;
        return;
      }
      const d = s.dt - 0.35;
      const hp = hitPoint(k, s.n);
      const a = r[0] * Math.PI * 2;
      const v = 20 + r[1] * 40;
      out[0] = hp.x + Math.cos(a) * v * d;
      out[1] = hp.y + Math.sin(a) * v * d - 20 * d * d;
      out[2] = hp.z + 2 + r[2] * 20 * d;
      out[3] = 1.4 - d;
      out[4] = 1 - d / 0.55;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tanks],
  );
  const lastFire = Math.max(...tanks.map((tk, k) => (shot(k, t) ? shot(k, t)!.ft : -9)));
  const cam = mergeCamera({ type: "pushIn", from: [9, 3.6, 34], to: [7, 4.4, 26], target: [0, 58, -330], fov: 50, ease: "out" }, camera);
  return (
    <AbsoluteFill style={{ transform: shake(t, lastFire, 10, 9) }}>
      <BrightCanvas durationInFrames={durationInFrames} camera={cam} fog={[300, 1600]}>
        <BrightSky t={t} scale={2} />
        <Ground size={3000} road={false} />
        {Array.from({ length: 14 }, (_, i) => (
          <Tree key={i} p={[-150 + i * 22, 0, -120 - (i % 3) * 30]} s={2.4} />
        ))}
        <group position={PH} rotation={[0, 0, 0]}>
          <Phone length={L} p={[0, L / 2, 0]} />
        </group>
        {tanks.map((tk, k) => {
          const s = shot(k, t);
          const recoil = s ? Math.exp(-s.dt * 10) : 0;
          return (
            <group key={k}>
              <Tank p={[tk.p.x, 0, tk.p.z]} ry={tk.ry} pitch={0.32} recoil={recoil} />
              {s && s.dt < 0.12 ? <Glow position={[tk.p.x, 3.1, tk.p.z - 6]} size={16} color="#ffd27a" opacity={1 - s.dt / 0.12} /> : null}
            </group>
          );
        })}
        <Particles count={tanks.length * 6} t={t} compute={tracers} size={3.2} color="#fff1a8" seed={9} softness={0.4} additive maxPixelSize={22} />
        <Particles count={tanks.length * 60} t={t} compute={sparks} size={4} color="#ffd27a" seed={10} softness={0.4} additive maxPixelSize={16} />
      </BrightCanvas>
    </AbsoluteFill>
  );
};

export default ArmyFire;
