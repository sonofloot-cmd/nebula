import React from "react";
import { AbsoluteFill } from "remotion";

/** Legibility gradients (top for the stat block, bottom for captions) + vignette. */
export const Grade: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.38) 82%, rgba(0,0,0,0.5) 100%)",
      }}
    />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.35) 100%)" }} />
  </AbsoluteFill>
);
