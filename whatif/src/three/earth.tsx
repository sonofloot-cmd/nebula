import React, { useCallback, useMemo } from "react";
import { sampleLandPoints } from "./geo";
import { Globe, GlobePalette } from "./Globe";
import { ParticleFn, Particles } from "./Particles";

/** Dark night-side palette with enough land/ocean contrast to read on a phone. */
export const DARK_EARTH: GlobePalette = { ocean: "#071226", land: "#2b3f62", land2: "#33496e", ice: "#4b5b78" };

/**
 * Night Earth: low-poly dark globe + warm specks of city light on land.
 * Lives in the globe's own (rotating) frame, radius R.
 */
export const NightEarth: React.FC<{
  t: number;
  radius?: number;
  lights?: number;
  lightSize?: number;
  atmosphere?: string;
  atmosphereOpacity?: number;
  palette?: GlobePalette;
  detail?: number;
}> = ({ t, radius = 10, lights = 9000, lightSize = 0.05, atmosphere = "#4f8cff", atmosphereOpacity = 0.22, palette = DARK_EARTH, detail = 48 }) => {
  const pts = useMemo(() => sampleLandPoints(lights, 7, 62), [lights]);
  const city = useCallback<ParticleFn>(
    (i, time, out, r) => {
      const n = pts[i];
      out[0] = n.x * radius * 1.002;
      out[1] = n.y * radius * 1.002;
      out[2] = n.z * radius * 1.002;
      out[3] = 0.4 + r[0] * r[0] * 2.2;
      out[4] = (0.35 + 0.65 * r[1]) * (0.85 + 0.15 * Math.sin(time * 3 + r[2] * 30));
    },
    [pts, radius],
  );
  return (
    <group>
      <Globe radius={radius} palette={palette} atmosphere={atmosphere} atmosphereOpacity={atmosphereOpacity} detail={detail} banding={0.004} />
      <Particles count={pts.length} t={t} compute={city} size={lightSize} color="#ffcf7a" seed={5} softness={0.6} additive maxPixelSize={6} />
    </group>
  );
};
