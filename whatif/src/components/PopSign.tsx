import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SANS } from "../fonts";
import type { SceneDef } from "../types";

/** Cartoon in-world signs that pop up ("CHARGING: FAILED", "DAMAGE: 0%"). Positions are frame px. */
export const PopSigns: React.FC<{ signs: NonNullable<SceneDef["signs"]>; durationInFrames: number }> = ({ signs, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      {signs.map((s, i) => {
        const f = frame - Math.round(s.at * fps);
        if (f < 0) return null;
        const pop = spring({ frame: f, fps, config: { damping: 9, stiffness: 220 } });
        const wobble = Math.sin(frame * 0.25 + i) * 1.2;
        const exit = Math.min(1, Math.max(0, (durationInFrames - frame) / 3));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: s.x ?? 140,
              top: s.y ?? 700,
              transform: `rotate(${(s.rotate ?? -4) + wobble}deg) scale(${pop})`,
              transformOrigin: "50% 100%",
              opacity: exit,
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: s.size ?? 54,
              letterSpacing: "0.02em",
              color: s.fg ?? "#111111",
              background: s.bg ?? "#ffe14d",
              border: "8px solid #111111",
              borderRadius: 18,
              padding: "14px 28px 12px",
              boxShadow: "0 10px 0 #111111",
              whiteSpace: "nowrap",
            }}
          >
            {s.text}
          </div>
        );
      })}
    </>
  );
};
