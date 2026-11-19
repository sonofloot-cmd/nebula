import React, { useCallback, useMemo } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { NightEarth } from "../../three/earth";
import { destination, latLonToVec3 } from "../../three/geo";
import { Glow } from "../../three/glow";
import { Stars } from "../../three/Globe";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { smoothstep } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import { TextLabel } from "../../three/text";
import type { SceneComponentProps } from "../../types";

/**
 * IMPACT ZONE: the debris footprint as a long, narrow glowing strip that starts just west of
 * Manhattan and runs out over the Atlantic along the station's ground track. The camera starts
 * tight on New York and pulls back to show the whole strip.
 * props: { start?: [lat, lon], bearing?: number (deg), lengthKm?: number, widthKm?: number,
 *          labels?: Array<{ text: string, km: number }> }
 */

const R = 10;
const KM = R / 6371;

const DebrisFootprint: React.FC<SceneComponentProps> = ({ durationInFrames, props }) => {
  const t = useSceneTime();
  const [lat0, lon0] = (props.start as [number, number]) ?? [40.71, -74.01];
  const bearing = (props.bearing as number) ?? 55;
  const lengthKm = (props.lengthKm as number) ?? 6000;
  const widthKm = (props.widthKm as number) ?? 200;
  const leadKm = 120; // strip begins a little before Manhattan
  const labels = (props.labels as Array<{ text: string; km: number }>) ?? [];
  const reveal = 0.04 + 0.96 * smoothstep(0.1, 2.6, t);

  // centre line, from just behind Manhattan to the far end
  const N = 160;
  const line = useMemo(() => {
    const [la, lo] = destination(lat0, lon0, bearing + 180, leadKm);
    return Array.from({ length: N + 1 }, (_, i) => {
      const [a, b] = destination(la, lo, bearing, ((lengthKm + leadKm) * i) / N);
      return latLonToVec3(a, b, 1);
    });
  }, [lat0, lon0, bearing, lengthKm]);
  const at = (f: number) => {
    const x = Math.min(N - 1e-6, Math.max(0, f * N));
    const i = Math.floor(x);
    return line[i].clone().lerp(line[i + 1], x - i).normalize();
  };
  const sideAt = (f: number) => {
    const p = at(f);
    const q = at(Math.min(1, f + 0.01));
    return new THREE.Vector3().crossVectors(p, q.sub(p)).normalize();
  };

  // ribbon geometry (revealed via draw range)
  const ribbon = useMemo(() => {
    const pos: number[] = [];
    const halfW = (widthKm / 2) * KM;
    for (let i = 0; i < N; i++) {
      const quad = [i / N, (i + 1) / N].map((f) => {
        const p = at(f).multiplyScalar(R * 1.004);
        // taper the tail end
        const w = halfW * (f > 0.9 ? 1 - (f - 0.9) * 6 : 1);
        const s = sideAt(f).multiplyScalar(w);
        return [p.clone().add(s), p.clone().sub(s)];
      });
      const [[a, b], [c, d]] = quad;
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, widthKm]);
  ribbon.setDrawRange(0, Math.floor(N * reveal) * 6);

  // bright edges + falling debris + impact sparks
  const edges = useCallback<ParticleFn>(
    (i, time, out) => {
      const f = (i >> 1) / 600;
      const side = i & 1 ? 1 : -1;
      const w = (widthKm / 2) * KM * (f > 0.9 ? 1 - (f - 0.9) * 6 : 1);
      const p = at(f).multiplyScalar(R * 1.005).add(sideAt(f).multiplyScalar(side * w));
      out[0] = p.x;
      out[1] = p.y;
      out[2] = p.z;
      out[3] = 1;
      out[4] = f <= reveal ? 0.9 * (0.75 + 0.25 * Math.sin(time * 6 - f * 40)) : 0;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reveal, line],
  );
  const rain = useCallback<ParticleFn>(
    (_i, time, out, r) => {
      const f = Math.pow(r[0], 1.3);
      const life = 0.9;
      const age = (time + r[1] * life) % life;
      if (f > reveal) {
        out[4] = 0;
        return;
      }
      const w = (widthKm / 2) * KM * (r[2] * 2 - 1) * 0.9;
      const ground = at(f).add(sideAt(f).multiplyScalar(w / R)).normalize();
      const h = R * (1.004 + 0.12 * (1 - age / life));
      out[0] = ground.x * h;
      out[1] = ground.y * h;
      out[2] = ground.z * h;
      out[3] = 0.7 + r[3];
      out[4] = Math.min(1, (age / life) * 4) * (age / life < 0.97 ? 1 : 0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reveal, line],
  );

  // Orient the globe: strip midpoint faces the camera, strip runs lower-left → upper-right.
  const { quat, startW, midW } = useMemo(() => {
    const mid = at(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(mid.clone(), new THREE.Vector3(0, 0, 1));
    const a = at(0).applyQuaternion(q);
    const b = at(1).applyQuaternion(q);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const qr = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.9 - ang);
    const quat = qr.multiply(q);
    return { quat, startW: at(0.02).applyQuaternion(quat), midW: at(0.5).applyQuaternion(quat) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line]);

  // camera: tight on Manhattan → wide on the whole strip
  const cameraAt = useCallback(
    (frame: number) => {
      const p = Math.min(1, frame / Math.max(1, durationInFrames - 1));
      const e = 1 - Math.pow(1 - smoothstep(0.05, 0.85, p), 2.2);
      const look = startW.clone().lerp(midW, e).normalize().multiplyScalar(R);
      const dist = 8 + 17 * e;
      const pos = look.clone().normalize().multiplyScalar(R + dist);
      pos.y -= 1.0 * e;
      const target = look.clone();
      target.y -= 0.3 * e;
      return { pos: [pos.x, pos.y, pos.z] as [number, number, number], target: [target.x, target.y, target.z] as [number, number, number], fov: 42 };
    },
    [durationInFrames, startW, midW],
  );

  const ny = at(leadKm / (lengthKm + leadKm)).multiplyScalar(R * 1.01);

  return (
    <AbsoluteFill style={{ background: "#010208" }}>
      <SceneCanvas
        durationInFrames={durationInFrames}
        camera={{ type: "pullBack", from: [0, 0, 30], target: [0, 0, 0], fov: 42 }}
        cameraAt={cameraAt}
        background="#010208"
        sky="#cfe0ff"
        ground="#0a0f22"
        sunPosition={[6, 10, 14]}
        sunIntensity={1.3}
      >
        <Stars t={t} />
        <group quaternion={quat}>
          <NightEarth t={t} radius={R} lightSize={0.03} lights={16000} detail={110} />
          <mesh geometry={ribbon}>
            <meshBasicMaterial color="#ff5a1a" transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <Particles count={1200} t={t} compute={edges} size={0.06} color="#ffd08a" seed={71} softness={0.4} additive maxPixelSize={6} />
          <Particles count={2500} t={t} compute={rain} size={0.05} color="#ffe2b0" seed={72} softness={0.5} additive maxPixelSize={6} />
          <Glow position={[ny.x, ny.y, ny.z]} size={0.9} color="#ff7a2a" opacity={0.9} />
          <TextLabel card={{ lines: ["NEW YORK"], width: 512, height: 128, fg: "#ffffff", size: 88, weight: 900, glow: "#000000" }} height={0.42} position={[ny.x * 1.03, ny.y * 1.03 - 0.3, ny.z * 1.03]} />
          {labels.map((l, i) => {
            const p = at((l.km + leadKm) / (lengthKm + leadKm)).multiplyScalar(R * 1.04);
            const lf = (l.km + leadKm) / (lengthKm + leadKm);
            const on = smoothstep(lf - 0.12, lf - 0.02, reveal);
            return (
              <TextLabel
                key={i}
                card={{ lines: [l.text], width: 640, height: 128, fg: "#ffd08a", size: 84, weight: 900, glow: "#000000" }}
                height={0.75}
                opacity={on}
                position={[p.x, p.y, p.z]}
              />
            );
          })}
        </group>
      </SceneCanvas>
    </AbsoluteFill>
  );
};

export default DebrisFootprint;
