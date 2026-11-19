import React, { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { mergeCamera } from "../../three/camera";
import { getCountryPolys, getLandPolys, rasterMask } from "../../three/geo";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { mulberry32 } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import type { SceneComponentProps } from "../../types";

/**
 * COUNTRY scale: a hex-tile map of a country (default India, ISO 356) with
 * sound rings bursting from its cities at the same instant.
 * props: { countryId?: string, centre?: [lon, lat], span?: number, cities?: [lon, lat][] }
 */

const DEFAULT_CITIES: Array<[number, number]> = [
  [77.2, 28.6], [72.88, 19.08], [88.36, 22.57], [80.27, 13.08], [77.59, 12.97], [78.49, 17.39],
  [72.57, 23.02], [73.86, 18.52], [75.79, 26.91], [80.95, 26.85], [80.33, 26.45], [79.09, 21.15],
  [85.14, 25.59], [77.41, 23.26], [75.86, 22.72], [72.83, 21.17], [83.22, 17.69], [91.74, 26.14],
  [76.27, 9.93], [76.78, 30.73], [74.8, 34.08], [85.82, 20.3], [81.63, 21.25], [82.97, 25.32], [85.31, 23.34],
];
const SNEEZE_AT = 0.7;
const HEX = 0.42; // tile radius in degrees

const HexMap: React.FC<{ countryId: string; centre: [number, number]; span: number }> = ({ countryId, centre, span }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tiles = useMemo(() => {
    const bounds = { lon0: centre[0] - span, lon1: centre[0] + span, lat0: centre[1] - span, lat1: centre[1] + span };
    const land = rasterMask(getLandPolys(), bounds, 1024, 1024);
    const country = rasterMask(getCountryPolys(countryId), bounds, 1024, 1024);
    const rand = mulberry32(8);
    const out: Array<{ x: number; z: number; h: number; c: THREE.Color }> = [];
    const dx = HEX * Math.sqrt(3);
    const dz = HEX * 1.5;
    let row = 0;
    for (let lat = bounds.lat0; lat <= bounds.lat1; lat += dz, row++) {
      for (let lon = bounds.lon0 + (row % 2) * (dx / 2); lon <= bounds.lon1; lon += dx) {
        const inCountry = country.test(lon, lat);
        if (!inCountry && !land.test(lon, lat)) continue;
        const x = lon - centre[0];
        const z = -(lat - centre[1]);
        const mountain = Math.max(0, (lat - 28) / 8) * (inCountry ? 0.6 : 1.6);
        const h = (inCountry ? 0.5 : 0.25) + rand() * 0.25 + mountain * (0.6 + rand());
        const c = new THREE.Color(inCountry ? "#86bf6b" : "#a8a796");
        if (inCountry) c.offsetHSL((rand() - 0.5) * 0.04, 0, (rand() - 0.5) * 0.08 - Math.max(0, 20 - lat) * 0.004);
        if (mountain > 0.9) c.set("#eef2f5");
        out.push({ x, z, h, c });
      }
    }
    return out;
  }, [countryId, centre, span]);

  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(HEX * 0.96, HEX * 0.96, 1, 6);
    g.translate(0, 0.5, 0);
    return g;
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    tiles.forEach((tile, i) => {
      m.makeScale(1, tile.h, 1).setPosition(tile.x, 0, tile.z);
      ref.current!.setMatrixAt(i, m);
      ref.current!.setColorAt(i, tile.c);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
  }, [tiles]);

  return (
    <instancedMesh ref={ref} args={[geo, undefined, tiles.length]} frustumCulled={false}>
      <meshStandardMaterial flatShading roughness={0.9} />
    </instancedMesh>
  );
};

/** Expanding sound rings (2 pulses per city). */
const SoundRings: React.FC<{ t: number; points: Array<[number, number]>; color: string }> = ({ t, points, color }) => {
  const rings: Array<{ x: number; z: number; r: number; a: number }> = [];
  points.forEach(([x, z], i) => {
    for (let k = 0; k < 2; k++) {
      const dt = t - SNEEZE_AT - k * 0.9 - (i % 5) * 0.02;
      if (dt < 0) continue;
      const r = 0.3 + dt * 4;
      const a = Math.max(0, 1 - dt / 1.8);
      if (a > 0) rings.push({ x, z, r, a });
    }
  });
  return (
    <>
      {rings.map((ring, i) => (
        <mesh key={i} position={[ring.x, 1.35, ring.z]} rotation={[-Math.PI / 2, 0, 0]} scale={ring.r}>
          <ringGeometry args={[0.95, 1, 64]} />
          <meshBasicMaterial color={color} transparent opacity={ring.a * 0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </>
  );
};

const CountrySoundwave: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props, accent }) => {
  const t = useSceneTime();
  const countryId = (props.countryId as string) ?? "356";
  const centre = useMemo(() => (props.centre as [number, number]) ?? [80, 22], [props.centre]);
  const span = (props.span as number) ?? 18;
  const cities = (props.cities as Array<[number, number]>) ?? DEFAULT_CITIES;
  const pts = cities.map(([lon, lat]) => [lon - centre[0], -(lat - centre[1])] as [number, number]);

  const lights = useCallback<ParticleFn>(
    (i, time, out, r) => {
      const [x, z] = pts[i % pts.length];
      const big = i < pts.length;
      const a = r[0] * Math.PI * 2;
      const rr = big ? 0 : Math.sqrt(r[1]) * 2.2;
      out[0] = x + Math.cos(a) * rr;
      out[1] = 1.4;
      out[2] = z + Math.sin(a) * rr;
      const flash = Math.exp(-Math.pow((time - SNEEZE_AT) * 4, 2));
      out[3] = (big ? 1.8 : 0.5) * (1 + flash * 2);
      out[4] = 0.5 + 0.5 * flash + 0.15 * Math.sin(time * 3 + r[2] * 9);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cities, centre],
  );

  const cam = mergeCamera({ type: "pullBack", from: [2, 20, 20], to: [3, 44, 36], target: [0, 0, 1], fov: 48 }, camera);

  return (
    <AbsoluteFill>
      <SceneCanvas durationInFrames={durationInFrames} camera={cam} background="#0d2238" fog={["#0d2238", 40, 110]} sunPosition={[-20, 40, 25]} sunIntensity={2}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
          <planeGeometry args={[400, 400]} />
          <meshStandardMaterial color="#1f5a85" roughness={0.5} />
        </mesh>
        <HexMap countryId={countryId} centre={centre} span={span} />
        <SoundRings t={t} points={pts} color={accent} />
        <Particles count={pts.length * 8} t={t} compute={lights} size={0.35} color="#fff1b8" seed={61} softness={0.8} additive maxPixelSize={60} />
      </SceneCanvas>
    </AbsoluteFill>
  );
};

export default CountrySoundwave;
