import React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SANS } from "../fonts";
import type { Stat } from "../types";

const formatNumber = (v: number, decimals: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** Seconds → "MM:SS.cc" */
export const formatCountdown = (seconds: number) => {
  const s = Math.max(0, seconds);
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const cc = Math.floor((s * 100) % 100);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(mm)}:${p(ss)}.${p(cc)}`;
};

export const statText = (stat: Stat, progress: number) => {
  const decimals = stat.decimals ?? 0;
  if (stat.format === "countdown") {
    const v = interpolate(progress, [0, 1], [stat.value, stat.from ?? 0]);
    return `${stat.prefix ?? ""}${formatCountdown(v)}${stat.suffix ?? ""}`;
  }
  const v = interpolate(progress, [0, 1], [stat.from ?? 0, stat.value]);
  const rounded = decimals === 0 ? Math.round(v) : v;
  return `${stat.prefix ?? ""}${formatNumber(rounded, decimals)}${stat.suffix ?? ""}`;
};

/**
 * Top-left stat block: small uppercase label, big animated number, tiny sub-label.
 * `delay` (frames) holds it back, e.g. until the hook title has cleared.
 */
export const StatCounter: React.FC<{
  stat: Stat;
  durationInFrames: number;
  delay?: number;
  accent: string;
  twist?: boolean;
}> = ({ stat, durationInFrames, delay = 0, accent, twist }) => {
  const frame = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  if (frame < 0) return null;

  const isCountdown = stat.format === "countdown";
  const available = durationInFrames - delay;
  const start = Math.round((stat.startSeconds ?? 0.2) * fps);
  const countFrames = stat.countSeconds
    ? stat.countSeconds * fps
    : isCountdown
      ? available - start - 6
      : Math.min(available * 0.65, 3.2 * fps);
  const progress = interpolate(frame, [start, start + countFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: isCountdown ? (t) => t : Easing.out(Easing.exp),
  });

  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 140 } });
  const exit = interpolate(frame, [available - 6, available], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const text = statText(stat, progress);
  // Size by the FINAL string so the number never changes size while counting.
  const finalText = statText(stat, 1);
  const fontSize = Math.min(132, Math.floor(1040 / Math.max(4, finalText.length * 0.62)));
  const landed = progress >= 1 && !isCountdown;
  const pop = landed ? 1 + 0.06 * Math.exp(-(frame - start - countFrames) / 4) : 1;
  const color = twist ? "#ff4d4d" : accent;
  const blink = isCountdown && progress > 0 && progress < 1 ? 0.75 + 0.25 * Math.round((Math.sin(frame * 0.5) + 1) / 2) : 1;

  return (
    <div
      style={{
        position: "absolute",
        top: 150,
        left: 60,
        right: 60,
        fontFamily: SANS,
        color: "white",
        opacity: enter * exit,
        transform: `translateY(${(1 - enter) * -30}px)`,
        textShadow: "0 4px 24px rgba(0,0,0,0.45)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {twist ? (
          <span
            style={{
              background: color,
              color: "white",
              fontWeight: 800,
              fontSize: 22,
              letterSpacing: "0.18em",
              padding: "6px 12px",
              borderRadius: 6,
              textShadow: "none",
            }}
          >
            TWIST
          </span>
        ) : null}
        <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "0.22em", color, textTransform: "uppercase" }}>
          {stat.label}
        </span>
      </div>
      <div
        style={{
          fontSize,
          fontWeight: 900,
          lineHeight: 1.02,
          marginTop: 8,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.02em",
          whiteSpace: "nowrap",
          transformOrigin: "left center",
          transform: `scale(${pop})`,
          opacity: blink,
          color: twist ? "#fff2f2" : "white",
        }}
      >
        {text}
      </div>
      {stat.sublabel ? (
        <div style={{ fontSize: 26, fontWeight: 500, marginTop: 10, opacity: 0.78, letterSpacing: "0.02em" }}>{stat.sublabel}</div>
      ) : null}
    </div>
  );
};
