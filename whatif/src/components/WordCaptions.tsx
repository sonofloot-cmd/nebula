import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SANS } from "../fonts";
import type { WordTiming } from "../types";

/**
 * Voiceover captions: bold white words with a thick black outline, centred low, appearing
 * word by word in sync with the narration. Words are grouped into short phrases (≤ 4 words,
 * broken at punctuation); the word being spoken pops and turns yellow.
 */
export const WordCaptions: React.FC<{ words: WordTiming[]; durationInFrames: number; highlight?: string }> = ({
  words,
  durationInFrames,
  highlight = "#ffe14d",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (!words.length) return null;

  // phrases
  const phrases: WordTiming[][] = [];
  let cur: WordTiming[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    const breakHere = cur.length >= 4 || /[.!?…,;:]$/.test(w.w) || i === words.length - 1;
    if (breakHere) {
      phrases.push(cur);
      cur = [];
    }
  });
  // which phrase is on screen: from its first word until the next phrase starts (last one holds)
  let pi = -1;
  phrases.forEach((ph, i) => {
    if (t >= ph[0].start - 0.05) pi = i;
  });
  if (pi < 0) return null;
  const phrase = phrases[pi];
  const exit = Math.min(1, Math.max(0, (durationInFrames - frame) / 4));

  const stroke = "#000";
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        bottom: 470,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        columnGap: "0.26em",
        rowGap: 4,
        fontFamily: SANS,
        fontWeight: 900,
        fontSize: 84,
        lineHeight: 1.08,
        textAlign: "center",
        letterSpacing: "-0.01em",
        textTransform: "uppercase",
        opacity: exit,
      }}
    >
      {phrase.map((w, i) => {
        const shown = t >= w.start - 0.03;
        const active = t >= w.start - 0.03 && t < w.end + 0.05;
        const pop = spring({ frame: Math.round((t - w.start) * fps) + 1, fps, config: { damping: 12, stiffness: 260 } });
        return (
          <span
            key={`${pi}-${i}`}
            style={{
              display: "inline-block",
              color: active ? highlight : "#ffffff",
              opacity: shown ? 1 : 0,
              transform: `scale(${shown ? 0.85 + 0.15 * pop + (active ? 0.06 : 0) : 0.85})`,
              WebkitTextStroke: `10px ${stroke}`,
              paintOrder: "stroke fill",
              textShadow: "0 6px 0 rgba(0,0,0,0.35)",
            }}
          >
            {w.w}
          </span>
        );
      })}
    </div>
  );
};
