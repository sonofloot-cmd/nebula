import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SANS } from "../fonts";

/** Bottom caption: one short punchy line, white with a soft shadow. Words pop in. */
export const Caption: React.FC<{ text: string; durationInFrames: number; delay?: number }> = ({
  text,
  durationInFrames,
  delay = 0,
}) => {
  const frame = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  if (frame < 0) return null;
  const words = text.split(/\s+/).filter(Boolean);
  const available = durationInFrames - delay;
  const exit = interpolate(frame, [available - 6, available], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        bottom: 430,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        columnGap: "0.28em",
        fontFamily: SANS,
        fontWeight: 800,
        fontSize: 64,
        lineHeight: 1.15,
        textAlign: "center",
        color: "white",
        opacity: exit,
        textShadow: "0 2px 6px rgba(0,0,0,0.55), 0 8px 30px rgba(0,0,0,0.45)",
      }}
    >
      {words.map((w, i) => {
        const s = spring({ frame: frame - 4 - i * 2.5, fps, config: { damping: 14, stiffness: 180 } });
        return (
          <span key={i} style={{ display: "inline-block", opacity: s, transform: `translateY(${(1 - s) * 24}px) scale(${0.9 + 0.1 * s})` }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};
