import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

/** Punchy cut-in: the new scene zooms from 108% out of a quick dark dip (no white flash, so space stays black). */
export const SceneTransition: React.FC<{ children: React.ReactNode; enabled: boolean }> = ({ children, enabled }) => {
  const frame = useCurrentFrame();
  const scale = enabled ? interpolate(frame, [0, 9], [1.08, 1], { extrapolateRight: "clamp" }) : 1;
  const dip = enabled ? interpolate(frame, [0, 6], [0.7, 0], { extrapolateRight: "clamp" }) : 0;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>{children}</AbsoluteFill>
      {dip > 0 ? <AbsoluteFill style={{ background: "#020308", opacity: dip }} /> : null}
    </AbsoluteFill>
  );
};
