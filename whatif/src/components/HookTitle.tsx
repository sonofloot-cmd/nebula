import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { SERIF } from "../fonts";

/**
 * The "What if…?" question, large serif, centred over the first scene.
 * Fully legible on frame 0 (that's the frame people scroll past), then
 * slowly scales and fades out at the end of the hook.
 */
export const HookTitle: React.FC<{ question: string; durationInFrames: number }> = ({ question, durationInFrames }) => {
  const frame = useCurrentFrame();
  const exit = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.06]);
  const blur = interpolate(frame, [durationInFrames - 8, durationInFrames], [0, 10], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Split "What if" so it can be set in italic on its own line.
  const m = question.match(/^(what if)\s+(.*)$/i);
  const lead = m ? m[1] : null;
  const rest = m ? m[2] : question;
  const fontSize = rest.length > 50 ? 92 : rest.length > 32 ? 104 : 120;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 80px",
        opacity: exit,
        filter: `blur(${blur}px)`,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, rgba(5,8,20,0.55) 0%, rgba(5,8,20,0.15) 65%, rgba(5,8,20,0) 100%)",
        }}
      />
      {lead ? (
        <div
          style={{
            position: "relative",
            fontFamily: SERIF,
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: fontSize * 0.75,
            color: "#ffe9a8",
            textShadow: "0 6px 30px rgba(0,0,0,0.6)",
            marginBottom: 10,
          }}
        >
          {lead.charAt(0).toUpperCase() + lead.slice(1).toLowerCase()}…
        </div>
      ) : null}
      <div
        style={{
          position: "relative",
          fontFamily: SERIF,
          fontWeight: 700,
          fontSize,
          lineHeight: 1.08,
          textAlign: "center",
          color: "white",
          textShadow: "0 4px 10px rgba(0,0,0,0.5), 0 10px 50px rgba(0,0,0,0.6)",
          textWrap: "balance",
        }}
      >
        {rest}
      </div>
    </div>
  );
};
