import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect } from "react";
import { Easing, useCurrentFrame } from "remotion";
import * as THREE from "three";
import type { CameraMove, Vec3 } from "../types";
import { lerp } from "./random";

const EASE = {
  inOut: Easing.inOut(Easing.cubic),
  out: Easing.out(Easing.cubic),
  linear: (t: number) => t,
};

/** Merge a JSON override onto a scene's default camera move. */
export const mergeCamera = (base: CameraMove, override?: Partial<CameraMove>): CameraMove => ({
  ...base,
  ...(override ?? {}),
});

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Pure function: where is the camera at progress p (0..1)? */
export const evaluateCamera = (move: CameraMove, p: number) => {
  const e = EASE[move.ease ?? "inOut"](Math.min(1, Math.max(0, p)));
  const target = move.targetTo ? lerp3(move.target, move.targetTo, e) : move.target;
  let pos = move.to ? lerp3(move.from, move.to, e) : move.from;
  if (move.orbitDegrees) {
    const angle = THREE.MathUtils.degToRad(move.orbitDegrees) * e;
    const dx = pos[0] - target[0];
    const dz = pos[2] - target[2];
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    pos = [target[0] + dx * cos - dz * sin, pos[1], target[2] + dx * sin + dz * cos];
  }
  const fov = move.fovTo !== undefined ? lerp(move.fov ?? 45, move.fovTo, e) : move.fov ?? 45;
  return { pos, target, fov };
};

/**
 * Drives the R3F camera from the current Remotion frame. Never static: every
 * scene passes a move with a from/to or orbit, and a tiny handheld drift is added.
 */
export const CameraRig: React.FC<{ move: CameraMove; durationInFrames: number; drift?: number }> = ({
  move,
  durationInFrames,
  drift = 0.015,
}) => {
  const frame = useCurrentFrame();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    const p = frame / Math.max(1, durationInFrames - 1);
    const { pos, target, fov } = evaluateCamera(move, p);
    const dist = Math.hypot(pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]);
    const wobble = drift * dist;
    camera.position.set(
      pos[0] + Math.sin(frame * 0.05) * wobble * 0.3,
      pos[1] + Math.sin(frame * 0.037 + 1) * wobble * 0.2,
      pos[2],
    );
    camera.fov = fov;
    camera.near = Math.max(0.01, dist / 500);
    camera.far = dist * 40 + 200;
    camera.updateProjectionMatrix();
    camera.lookAt(target[0], target[1], target[2]);
  }, [frame, move, durationInFrames, camera, drift]);
  return null;
};
