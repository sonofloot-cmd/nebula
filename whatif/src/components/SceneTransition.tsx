import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

/** Punchy cut-in: the new scene zooms from 108% with a quick white flash. */
export const SceneTransition: React.FC<{ children: React.ReactNode; enabled: boolean }> = ({ children, enabled }) => {
  const frame = useCurrentFrame();
  const scale = enabled ? interpolate(frame, [0, 9], [1.08, 1], { extrapolateRight: "clamp" }) : 1;
  const flash = enabled ? interpolate(frame, [0, 7], [0.55, 0], { extrapolateRight: "clamp" }) : 0;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>{children}</AbsoluteFill>
      {flash > 0 ? <AbsoluteFill style={{ background: "white", opacity: flash }} /> : null}
    </AbsoluteFill>
  );
};
