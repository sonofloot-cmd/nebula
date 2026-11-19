import React, { useCallback, useMemo } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { latLonToVec3, slerpUnit } from "../../three/geo";
import { Glow } from "../../three/glow";
import { GlobePalette, Stars } from "../../three/Globe";
import { NightEarth } from "../../three/earth";
import { useSceneTime } from "../../three/hooks";
import { Iss } from "../../three/iss";
import { ParticleFn, Particles } from "../../three/Particles";
import { smoothstep } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import { TextLabel } from "../../three/text";
import type { SceneComponentProps } from "../../types";

/**
 * WHY IT WON'T HAPPEN: pull back to Point Nemo, the ocean point farthest from land and the
 * planned crash zone. Pulsing target rings, dashed lines to the three nearest bits of land,
 * and the station passing overhead (its crew are often the nearest humans).
 * props: { nemo?: [lat, lon], neighbours?: Array<{ name, lat, lon }> }
 */

const R = 10;
const OCEAN: GlobePalette = { ocean: "#0a2550", land: "#3a4e6e", land2: "#44597a", ice: "#8796b4" };

const PointNemo: React.FC<SceneComponentProps> = ({ durationInFrames, props }) => {
  const t = useSceneTime();
  const [nlat, nlon] = (props.nemo as [number, number]) ?? [-48.877, -123.393];
  const neighbours = (props.neighbours as Array<{ name: string; lat: number; lon: number }>) ?? [];
  const nemo = useMemo(() => latLonToVec3(nlat, nlon, 1), [nlat, nlon]);
  const nb = useMemo(() => neighbours.map((n) => ({ ...n, v: latLonToVec3(n.lat, n.lon, 1) })), [neighbours]);

  // globe orientation: Nemo faces the camera, north up
  const quat = useMemo(() => {
    const q = new THREE.Quaternion().setFromUnitVectors(nemo.clone(), new THREE.Vector3(0, 0, 1));
    const north = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const roll = Math.atan2(north.x, north.y);
    return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll).multiply(q);
  }, [nemo]);

  const lineIn = smoothstep(1.1, 2.3, t);
  const lines = useCallback<ParticleFn>(
    (i, time, out) => {
      const k = i % Math.max(1, nb.length);
      const f = Math.floor(i / Math.max(1, nb.length)) / 150;
      if (!nb[k] || f > lineIn) {
        out[4] = 0;
        return;
      }
      const p = slerpUnit(nemo, nb[k].v, f).multiplyScalar(R * 1.006);
      out[0] = p.x;
      out[1] = p.y;
      out[2] = p.z;
      out[3] = 1;
      out[4] = (Math.floor(f * 150) % 3 === 0 ? 0 : 0.9) * (0.8 + 0.2 * Math.sin(time * 5 - f * 30));
    },
    [nb, nemo, lineIn],
  );

  // pulsing rings around Point Nemo
  const rings = useCallback<ParticleFn>(
    (i, time, out) => {
      const ring = i % 3;
      const a = (Math.floor(i / 3) / 200) * Math.PI * 2;
      const ph = ((time * 0.7 + ring / 3) % 1);
      const rad = 0.15 + ph * 1.3;
      const east = new THREE.Vector3(0, 1, 0).cross(nemo).normalize();
      const north = nemo.clone().cross(east).normalize();
      const p = nemo.clone().multiplyScalar(R * 1.006).add(east.multiplyScalar(Math.cos(a) * rad)).add(north.multiplyScalar(Math.sin(a) * rad));
      out[0] = p.x;
      out[1] = p.y;
      out[2] = p.z;
      out[3] = 1;
      out[4] = (1 - ph) * 0.9;
    },
    [nemo],
  );

  // the station passing overhead (altitude exaggerated)
  const orbitA = useMemo(() => latLonToVec3(nlat - 18, nlon - 30, 1), [nlat, nlon]);
  const orbitB = useMemo(() => latLonToVec3(nlat + 14, nlon + 34, 1), [nlat, nlon]);
  const f = -0.1 + (t / 4.5) * 1.15;
  const issPos = slerpUnit(orbitA, orbitB, f).multiplyScalar(R + 1.1);
  const ahead = slerpUnit(orbitA, orbitB, f + 0.01).multiplyScalar(R + 1.1);
  const vel = ahead.clone().sub(issPos).normalize();
  const up = issPos.clone().normalize();
  const side = new THREE.Vector3().crossVectors(up, vel).normalize();
  const issQuat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, vel.clone().negate()));
  const over = Math.max(0, 1 - issPos.clone().normalize().angleTo(nemo) / 0.35);
  const beam = useCallback<ParticleFn>(
    (i, _time, out) => {
      const g = i / 80;
      const p = nemo.clone().multiplyScalar(R * 1.006).lerp(issPos, g);
      out[0] = p.x;
      out[1] = p.y;
      out[2] = p.z;
      out[3] = 1;
      out[4] = i % 3 === 0 ? 0 : over * 0.85;
    },
    [nemo, issPos, over],
  );

  const cameraAt = useCallback(
    (frame: number) => {
      const p = frame / Math.max(1, durationInFrames - 1);
      const e = 1 - Math.pow(1 - p, 2);
      const z = R + 7 + 15 * e;
      return { pos: [0.4 * e, -1.2 + 0.4 * e, z] as [number, number, number], target: [0, -0.2 + 1.4 * e, R * 0.6] as [number, number, number], fov: 42 };
    },
    [durationInFrames],
  );

  const nemoW = nemo.clone().multiplyScalar(R * 1.01);
  return (
    <AbsoluteFill style={{ background: "#010208" }}>
      <SceneCanvas
        durationInFrames={durationInFrames}
        camera={{ type: "pullBack", from: [0, 0, 30], target: [0, 0, 0], fov: 42 }}
        cameraAt={cameraAt}
        background="#010208"
        sky="#dfe9ff"
        ground="#0a0f22"
        sunPosition={[-8, 10, 14]}
        sunIntensity={1.7}
      >
        <Stars t={t} />
        <group quaternion={quat}>
          <NightEarth t={t} radius={R} lightSize={0.03} lights={9000} detail={110} palette={OCEAN} atmosphere="#6fb4ff" />
          <Particles count={nb.length * 151} t={t} compute={lines} size={0.07} color="#ffd27a" seed={81} softness={0.4} additive maxPixelSize={7} />
          <Particles count={600} t={t} compute={rings} size={0.07} color="#ff5a5a" seed={82} softness={0.4} additive maxPixelSize={7} />
          <Glow position={[nemoW.x, nemoW.y, nemoW.z]} size={1.2} color="#ff4d4d" opacity={0.95} />
          <TextLabel card={{ lines: ["POINT NEMO"], width: 640, height: 128, fg: "#ffffff", size: 92, weight: 900, glow: "#000000" }} height={0.5} position={[nemoW.x, nemoW.y - 0.7, nemoW.z + 0.3]} />
          {nb.map((n, i) => {
            const p = n.v.clone().multiplyScalar(R * 1.03);
            return (
              <group key={i}>
                <Glow position={[p.x, p.y, p.z]} size={0.55} color="#ffd27a" opacity={lineIn} />
                <TextLabel card={{ lines: [n.name], width: 640, height: 128, fg: "#ffd27a", size: 80, weight: 800, glow: "#000000" }} height={0.5} opacity={lineIn} position={[p.x + 1.7, p.y - 0.1, p.z + 0.3]} />
              </group>
            );
          })}
          <group position={issPos} quaternion={issQuat} scale={0.018}>
            <Iss selfLight={0.6} />
          </group>
          <Glow position={[issPos.x, issPos.y, issPos.z]} size={1.2} color="#bfefff" opacity={0.55} />
          <Particles count={80} t={t} compute={beam} size={0.06} color="#bfefff" seed={83} softness={0.4} additive maxPixelSize={6} />
        </group>
      </SceneCanvas>
    </AbsoluteFill>
  );
};

export default PointNemo;
