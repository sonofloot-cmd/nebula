import React, { useCallback, useMemo } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { mergeCamera } from "../../three/camera";
import { useSceneTime } from "../../three/hooks";
import { ParticleFn, Particles } from "../../three/Particles";
import { BuildingSpec, Buildings, makeCity } from "../../three/props";
import { mulberry32 } from "../../three/random";
import { SceneCanvas } from "../../three/SceneCanvas";
import type { SceneComponentProps } from "../../types";

/**
 * CONSEQUENCE (metro-region scale): the megacity at dusk with its satellite towns.
 * A fraction of the sneezes glow red — the ones carrying a cold virus — and red
 * contagion rings spread outward across the region.
 * props: { infectedShare?: number }  (visual only; the number is in the stat)
 */

const BG = "#141b2c";

const CityContagion: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const share = (props.infectedShare as number) ?? 0.06;

  const specs = useMemo(() => {
    const core = makeCity({ seed: 11, radius: 260, block: 16, street: 7, maxHeight: 120, skip: (x, z) => Math.abs(-0.825 * x + 0.565 * z) < 18 });
    const rand = mulberry32(19);
    const sats: BuildingSpec[] = [];
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + rand() * 0.4;
      const d = 420 + rand() * 260;
      const town = makeCity({ seed: 30 + k, radius: 70 + rand() * 50, block: 14, street: 6, maxHeight: 22 });
      town.forEach((b) => sats.push({ ...b, x: b.x + Math.cos(a) * d, z: b.z + Math.sin(a) * d }));
    }
    return [...core, ...sats];
  }, []);

  // Every sneeze: faint pale dots over all the buildings; a share of them glow red.
  const dots = useCallback<ParticleFn>(
    (i, time, out, r) => {
      const b = specs[i % specs.length];
      out[0] = b.x + (r[0] - 0.5) * 8;
      out[1] = b.h + 2 + r[1] * 4 + Math.sin(time * 1.5 + r[2] * 9) * 0.8;
      out[2] = b.z + (r[3] - 0.5) * 8;
      const infected = r[4] < share * 3; // over-sampled so the red reads on a phone
      const pulse = 0.65 + 0.35 * Math.sin(time * 4 + r[5] * 12);
      out[3] = infected ? 2.6 * pulse : 1;
      out[4] = infected ? Math.min(1, time * 2) : 0.35;
    },
    [specs, share],
  );
  const colorFn = useCallback(
    (_i: number, r: Float32Array): [number, number, number] => (r[4] < share * 3 ? [1, 0.18, 0.28] : [0.85, 0.92, 0.95]),
    [share],
  );

  // Contagion rings: staggered, spreading from infected hot spots across the region.
  const rings = useMemo(() => {
    const rand = mulberry32(23);
    return Array.from({ length: 26 }, () => {
      const b = specs[Math.floor(rand() * specs.length)];
      return { x: b.x, z: b.z, t0: rand() * 3.2, speed: 60 + rand() * 50 };
    });
  }, [specs]);

  const cam = mergeCamera(
    { type: "pullBack", from: [250, 300, 400], to: [520, 820, 980], target: [0, 0, 0], orbitDegrees: 18, fov: 50 },
    camera,
  );

  return (
    <AbsoluteFill style={{ background: BG }}>
      <SceneCanvas
        durationInFrames={durationInFrames}
        camera={cam}
        background={BG}
        fog={[BG, 700, 2600]}
        sky="#9fb0d8"
        ground="#1a1f2e"
        sunPosition={[-200, 160, 120]}
        sunIntensity={0.9}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2400, 64]} />
          <meshStandardMaterial color="#2b3242" roughness={1} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0.6]} position={[0, 0.3, 0]}>
          <planeGeometry args={[24, 3000]} />
          <meshStandardMaterial color="#2a4d73" roughness={0.4} />
        </mesh>
        <Buildings specs={specs} />
        {rings.map((ring, i) => {
          const dt = t - ring.t0;
          if (dt < 0) return null;
          const r = 10 + dt * ring.speed;
          const a = Math.max(0, 1 - dt / 2.4);
          return (
            <mesh key={i} position={[ring.x, 3, ring.z]} rotation={[-Math.PI / 2, 0, 0]} scale={r}>
              <ringGeometry args={[0.93, 1, 64]} />
              <meshBasicMaterial color="#ff3b5c" transparent opacity={a * 0.7} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
          );
        })}
        <Particles
          count={specs.length * 2}
          t={t}
          compute={dots}
          colorFn={colorFn}
          size={4}
          seed={57}
          softness={0.8}
          additive
          maxPixelSize={18}
        />
      </SceneCanvas>
    </AbsoluteFill>
  );
};

export default CityContagion;
