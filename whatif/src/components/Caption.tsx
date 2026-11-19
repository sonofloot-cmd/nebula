import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SANS } from "../fonts";
import type { CaptionCue } from "../types";

/** One line whose words pop in from `frame` 0; fades out over the last 6 frames of `available`. */
const Line: React.FC<{ text: string; frame: number; available: number }> = ({ text, frame, available }) => {
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/).filter(Boolean);
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

/**
 * Bottom caption: one short punchy line, white with a soft shadow. Words pop in.
 * `text` may also be a timed sequence of lines; each shows until the next one starts.
 */
export const Caption: React.FC<{ text: string | CaptionCue[]; durationInFrames: number; delay?: number }> = ({
  text,
  durationInFrames,
  delay = 0,
}) => {
  const frame = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  if (frame < 0) return null;
  const available = durationInFrames - delay;
  if (typeof text === "string") return <Line text={text} frame={frame} available={available} />;

  // Cue times are scene seconds; the first cue starts no earlier than `delay`.
  const starts = text.map((c) => Math.max(0, Math.round(c.at * fps) - delay));
  let idx = -1;
  starts.forEach((s, i) => {
    if (frame >= s) idx = i;
  });
  if (idx < 0) return null;
  const start = starts[idx];
  const end = idx + 1 < text.length ? starts[idx + 1] : available;
  return <Line key={idx} text={text[idx].text} frame={frame - start} available={end - start} />;
};
