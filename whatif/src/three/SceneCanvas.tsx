import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { useVideoConfig } from "remotion";
import type { CameraMove } from "../types";
import { CameraRig } from "./camera";

export interface SceneCanvasProps {
  durationInFrames: number;
  camera: CameraMove;
  background: string;
  /** [color, near, far] — linear fog for depth / haze. */
  fog?: [string, number, number];
  /** Soft default lighting. Set false to bring your own. */
  lights?: boolean;
  /** Sky / ground colours for the hemisphere light. */
  sky?: string;
  ground?: string;
  sunIntensity?: number;
  sunPosition?: [number, number, number];
  children: React.ReactNode;
}

/** A full-frame 3D canvas with soft lighting, fog and a moving camera. */
export const SceneCanvas: React.FC<SceneCanvasProps> = ({
  durationInFrames,
  camera,
  background,
  fog,
  lights = true,
  sky = "#dfe9ff",
  ground = "#2a2f45",
  sunIntensity = 1.6,
  sunPosition = [6, 10, 8],
  children,
}) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={1}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ fov: camera.fov ?? 45, position: camera.from, near: 0.05, far: 2000 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={[background]} />
      {fog ? <fog attach="fog" args={fog} /> : null}
      {lights ? (
        <>
          <hemisphereLight args={[sky, ground, 1.1]} />
          <directionalLight position={sunPosition} intensity={sunIntensity} color="#fff3e6" />
          <directionalLight position={[-8, 4, -6]} intensity={0.45} color="#9db8ff" />
        </>
      ) : null}
      <CameraRig move={camera} durationInFrames={durationInFrames} />
      {children}
    </ThreeCanvas>
  );
};
