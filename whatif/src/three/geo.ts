import * as THREE from "three";
import { feature } from "topojson-client";
import countriesTopo from "world-atlas/countries-110m.json";
import landTopo from "world-atlas/land-110m.json";
import { mulberry32 } from "./random";

/* Natural Earth 1:110m (public domain) via the world-atlas package. */

type Ring = number[][];
type Polys = Ring[][];

const toPolys = (geom: GeoJSON.Geometry): Polys => {
  if (geom.type === "Polygon") return [geom.coordinates as Ring[]];
  if (geom.type === "MultiPolygon") return geom.coordinates as Ring[][];
  return [];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const topo = (t: any, key: string) => feature(t, t.objects[key]) as unknown as GeoJSON.FeatureCollection;

let landPolys: Polys | null = null;
export const getLandPolys = (): Polys => {
  if (!landPolys) landPolys = topo(landTopo, "land").features.flatMap((f) => toPolys(f.geometry));
  return landPolys;
};

/** ISO 3166 numeric id, e.g. "356" = India. */
export const getCountryPolys = (id: string): Polys => {
  const f = topo(countriesTopo, "countries").features.find((x) => String(x.id) === id);
  return f ? toPolys(f.geometry) : [];
};

/** A rasterised mask you can sample by lon/lat. */
export interface Mask {
  test: (lon: number, lat: number) => boolean;
}

export const rasterMask = (
  polys: Polys,
  bounds = { lon0: -180, lon1: 180, lat0: -90, lat1: 90 },
  w = 2048,
  h = 1024,
): Mask => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const px = (lon: number) => ((lon - bounds.lon0) / (bounds.lon1 - bounds.lon0)) * w;
  const py = (lat: number) => ((bounds.lat1 - lat) / (bounds.lat1 - bounds.lat0)) * h;
  ctx.fillStyle = "#fff";
  for (const poly of polys) {
    ctx.beginPath();
    for (const ring of poly) {
      ring.forEach(([lon, lat], i) => (i === 0 ? ctx.moveTo(px(lon), py(lat)) : ctx.lineTo(px(lon), py(lat))));
      ctx.closePath();
    }
    ctx.fill("evenodd");
  }
  const data = ctx.getImageData(0, 0, w, h).data;
  return {
    test: (lon, lat) => {
      const x = Math.floor(px(lon));
      const y = Math.floor(py(lat));
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      return data[(y * w + x) * 4] > 127;
    },
  };
};

let worldMask: Mask | null = null;
export const getWorldMask = () => {
  if (!worldMask) worldMask = rasterMask(getLandPolys());
  return worldMask;
};

export const latLonToVec3 = (lat: number, lon: number, r: number): THREE.Vector3 => {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
};

export const vec3ToLatLon = (v: THREE.Vector3) => {
  const r = v.length();
  const lat = 90 - THREE.MathUtils.radToDeg(Math.acos(v.y / r));
  let lon = THREE.MathUtils.radToDeg(Math.atan2(v.z, -v.x)) - 180;
  if (lon < -180) lon += 360;
  return { lat, lon };
};

/** Random points on land (area-uniform), as unit vectors. Deterministic per seed. */
export const sampleLandPoints = (n: number, seed: number, latLimit = 72): THREE.Vector3[] => {
  const mask = getWorldMask();
  const rand = mulberry32(seed);
  const pts: THREE.Vector3[] = [];
  let guard = 0;
  while (pts.length < n && guard++ < n * 60) {
    const lat = THREE.MathUtils.radToDeg(Math.asin(rand() * 2 - 1));
    const lon = rand() * 360 - 180;
    if (Math.abs(lat) > latLimit) continue;
    if (mask.test(lon, lat)) pts.push(latLonToVec3(lat, lon, 1));
  }
  return pts;
};

/**
 * Low-poly globe geometry: a flat-shaded icosphere whose faces are coloured
 * land / ocean / ice by the Natural Earth mask.
 */
export const makeGlobeGeometry = (
  radius: number,
  detail: number,
  colors: { ocean: string; land: string; land2: string; ice: string },
  /** subtle light/dark ripple on the ocean (0 = flat) */
  banding = 0.015,
) => {
  const mask = getWorldMask();
  const g = new THREE.IcosahedronGeometry(radius, detail); // already non-indexed
  const pos = g.getAttribute("position");
  const col = new Float32Array(pos.count * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ocean = new THREE.Color(colors.ocean);
  const land = new THREE.Color(colors.land);
  const land2 = new THREE.Color(colors.land2);
  const ice = new THREE.Color(colors.ice);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    const centroid = a.add(b).add(c).divideScalar(3);
    const { lat, lon } = vec3ToLatLon(centroid);
    const isLand = mask.test(lon, lat);
    if (Math.abs(lat) > 68 && (isLand || Math.abs(lat) > 78)) tmp.copy(ice);
    else if (isLand) tmp.copy(land).lerp(land2, Math.min(0.7, Math.max(0, 0.3 + 0.35 * Math.sin(lon * 0.09 + 1) * Math.cos(lat * 0.11))));
    else tmp.copy(ocean).offsetHSL(0, 0, Math.sin(lat * 0.7 + lon * 0.4) * banding);
    for (let k = 0; k < 3; k++) col.set([tmp.r, tmp.g, tmp.b], (i + k) * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
};

const EARTH_KM = 6371;

/** Point reached from (lat, lon) after `km` along initial `bearing` (degrees) on a great circle. */
export const destination = (lat: number, lon: number, bearing: number, km: number): [number, number] => {
  const d = km / EARTH_KM;
  const p1 = THREE.MathUtils.degToRad(lat);
  const l1 = THREE.MathUtils.degToRad(lon);
  const b = THREE.MathUtils.degToRad(bearing);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [THREE.MathUtils.radToDeg(p2), ((THREE.MathUtils.radToDeg(l2) + 540) % 360) - 180];
};

/** Unit vector on the great circle from a to b at fraction f (slerp). */
export const slerpUnit = (a: THREE.Vector3, b: THREE.Vector3, f: number) => {
  const an = a.clone().normalize();
  const bn = b.clone().normalize();
  const om = Math.acos(Math.min(1, Math.max(-1, an.dot(bn))));
  if (om < 1e-6) return an;
  const s = Math.sin(om);
  return an.multiplyScalar(Math.sin((1 - f) * om) / s).add(bn.multiplyScalar(Math.sin(f * om) / s));
};
