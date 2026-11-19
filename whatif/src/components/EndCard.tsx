import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SANS, SERIF } from "../fonts";

/** Dark end card: the question again, "PART 2: …" teaser, follow CTA. */
export const EndCard: React.FC<{ question: string; teaser: string; cta: string; accent: string }> = ({
  question,
  teaser,
  cta,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame, fps, config: { damping: 20 } });
  const b = spring({ frame: frame - 8, fps, config: { damping: 16 } });
  const c = spring({ frame: frame - 16, fps, config: { damping: 14 } });
  const pulse = 1 + 0.03 * Math.sin(frame * 0.35);
  const fadeIn = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        opacity: fadeIn,
        background: "radial-gradient(ellipse at 50% 40%, #182038 0%, #0a0d18 60%, #05060b 100%)",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 80px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: SERIF,
          fontWeight: 700,
          fontSize: 82,
          lineHeight: 1.12,
          color: "white",
          opacity: a,
          transform: `translateY(${(1 - a) * 30}px)`,
          textWrap: "balance",
        }}
      >
        {question}
      </div>
      <div style={{ width: 120, height: 4, background: accent, margin: "56px 0", opacity: b, borderRadius: 2 }} />
      <div style={{ opacity: b, transform: `translateY(${(1 - b) * 30}px)` }}>
        <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 40, letterSpacing: "0.25em", color: accent }}>PART 2</div>
        <div
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 64,
            lineHeight: 1.15,
            color: "white",
            marginTop: 16,
            textWrap: "balance",
          }}
        >
          {teaser}
        </div>
      </div>
      <div
        style={{
          marginTop: 90,
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: 40,
          letterSpacing: "0.12em",
          color: "#0a0d18",
          background: "white",
          padding: "22px 40px",
          borderRadius: 999,
          opacity: c,
          transform: `scale(${(0.8 + 0.2 * c) * pulse})`,
        }}
      >
        {cta}
      </div>
    </AbsoluteFill>
  );
};
