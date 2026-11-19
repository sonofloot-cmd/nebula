import React, { useCallback, useMemo } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { SANS } from "../../fonts";
import { mergeCamera } from "../../three/camera";
import { NightEarth } from "../../three/earth";
import { latLonToVec3, slerpUnit } from "../../three/geo";
import { Glow } from "../../three/glow";
import { Stars } from "../../three/Globe";
import { useSceneTime } from "../../three/hooks";
import { Iss } from "../../three/iss";
import { ParticleFn, Particles } from "../../three/Particles";
import { smoothstep } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import { TextLabel } from "../../three/text";
import type { SceneComponentProps } from "../../types";

/**
 * SPEED: the station streaks across a night-time USA, Los Angeles → New York
 * (eastward, the way the ISS really orbits), leaving a glowing trail.
 * props: { from?: [lat, lon], to?: [lat, lon], arriveAt?: number (s) }
 */

const R = 10;
const ALT = 0.32; // exaggerated so the station reads (real: 400 km ≈ 0.63 units)

const IssStreak: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const [lat0, lon0] = (props.from as [number, number]) ?? [34.05, -118.24];
  const [lat1, lon1] = (props.to as [number, number]) ?? [40.71, -74.01];
  const arriveAt = (props.arriveAt as number) ?? 3.4;
  const A = useMemo(() => latLonToVec3(lat0, lon0, 1), [lat0, lon0]);
  const B = useMemo(() => latLonToVec3(lat1, lon1, 1), [lat1, lon1]);
  const mid = useMemo(() => slerpUnit(A, B, 0.5), [A, B]);

  // Rotate the globe so the route's midpoint faces the camera (+Z) with north up, then roll it diagonal.
  const globeQuat = useMemo(() => {
    const q = new THREE.Quaternion().setFromUnitVectors(mid.clone().normalize(), new THREE.Vector3(0, 0, 1));
    // keep north roughly up
    const north = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const roll = Math.atan2(north.x, north.y);
    const qr = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll + 0.5);
    return qr.multiply(q);
  }, [mid]);

  // progress along the arc: starts a little before LA, runs past NY
  const f = (t - 0.25) / (arriveAt - 0.25);
  const pos = slerpUnit(A, B, f).multiplyScalar(R + ALT);
  const ahead = slerpUnit(A, B, f + 0.01).multiplyScalar(R + ALT);
  const vel = ahead.clone().sub(pos).normalize();
  const up = pos.clone().normalize();
  const side = new THREE.Vector3().crossVectors(up, vel).normalize();
  // model −Z = velocity, model +Y = up
  const issQuat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, vel.clone().negate()));

  // route (dim dashes) and the travelled trail (bright)
  const route = useCallback<ParticleFn>(
    (i, time, out) => {
      const g = -0.15 + (i / 400) * 1.3;
      const p = slerpUnit(A, B, g).multiplyScalar(R + 0.03);
      out[0] = p.x;
      out[1] = p.y;
      out[2] = p.z;
      out[3] = 1;
      out[4] = (i % 4 < 2 ? 0.55 : 0) * smoothstep(0, 0.4, time);
    },
    [A, B],
  );
  const trail = useCallback<ParticleFn>(
    (i, _time, out, r) => {
      const back = (i / 1500) * 0.55;
      const g = f - back;
      const p = slerpUnit(A, B, g).multiplyScalar(R + ALT * (1 - back * 0.4));
      out[0] = p.x + (r[0] - 0.5) * 0.03 * (1 + back * 6);
      out[1] = p.y + (r[1] - 0.5) * 0.03 * (1 + back * 6);
      out[2] = p.z + (r[2] - 0.5) * 0.03 * (1 + back * 6);
      out[3] = 1.4 - back * 1.5;
      out[4] = g < -0.12 ? 0 : Math.pow(1 - back / 0.55, 1.5);
    },
    [A, B, f],
  );

  const la = A.clone().multiplyScalar(R + 0.02);
  const ny = B.clone().multiplyScalar(R + 0.02);
  const arrived = smoothstep(arriveAt - 0.15, arriveAt + 0.25, t);
  const cam = mergeCamera(
    { type: "pushIn", from: [0.3, -0.8, 27.5], to: [0.1, -0.6, 25.6], target: [0, -1.5, 9.6], fov: 40, ease: "inOut" },
    camera,
  );

  return (
    <AbsoluteFill style={{ background: "#010208" }}>
      <SceneCanvas durationInFrames={durationInFrames} camera={cam} background="#010208" sky="#cfe0ff" ground="#0a0f22" sunPosition={[8, 10, 14]} sunIntensity={1.4}>
        <Stars t={t} />
        <group quaternion={globeQuat}>
          <NightEarth t={t} radius={R} lightSize={0.028} lights={14000} detail={110} />
          <Particles count={400} t={t} compute={route} size={0.05} color="#9fdcff" seed={41} softness={0.4} additive maxPixelSize={6} />
          <Particles count={1500} t={t} compute={trail} size={0.07} color="#bfefff" seed={42} softness={0.8} additive maxPixelSize={10} />
          {/* city pins + labels */}
          <Glow position={[la.x, la.y, la.z]} size={0.7} color="#ffd27a" opacity={0.9} />
          <Glow position={[ny.x, ny.y, ny.z]} size={0.7 + 0.8 * arrived} color={arrived > 0.5 ? "#7fe3ff" : "#ffd27a"} opacity={0.9} />
          <TextLabel card={{ lines: ["LOS ANGELES"], width: 640, height: 128, fg: "#ffffff", size: 84, weight: 800, glow: "#000000" }} height={0.42} position={[la.x * 1.0, la.y * 1.0 - 0.45, la.z * 1.0 + 0.2]} />
          <TextLabel card={{ lines: ["NEW YORK"], width: 512, height: 128, fg: "#ffffff", size: 84, weight: 800, glow: "#000000" }} height={0.42} position={[ny.x - 0.35, ny.y - 0.45, ny.z + 0.2]} />
          <group position={pos} quaternion={issQuat} scale={0.0075}>
            <Iss selfLight={0.5} />
          </group>
          <Glow position={[pos.x, pos.y, pos.z]} size={1.1} color="#bfefff" opacity={0.6} />
        </group>
      </SceneCanvas>
      {/* "≈ 8 MIN" stamp as it reaches New York */}
      {arrived > 0.01 ? (
        <div
          style={{
            position: "absolute",
            top: 760,
            right: 90,
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 84,
            color: "#05101a",
            background: "#7fe3ff",
            padding: "10px 34px",
            borderRadius: 26,
            opacity: arrived,
            transform: `scale(${0.6 + 0.4 * arrived}) rotate(-4deg)`,
            boxShadow: "0 10px 40px rgba(127,227,255,0.45)",
          }}
        >
          ≈ 8 MIN
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export default IssStreak;
