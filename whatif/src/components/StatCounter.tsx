import React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SANS } from "../fonts";
import type { Stat } from "../types";

const formatNumber = (v: number, decimals: number, grouping = true) =>
  v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouping });

/** Sub-label size: 52 px, shrunk so it always fits on ONE line (phone-readable floor of 36 px). */
export const sublabelFontSize = (text: string) => Math.max(36, Math.min(52, Math.floor(960 / Math.max(1, text.length * 0.56))));

/** Seconds → "MM:SS.cc" */
export const formatCountdown = (seconds: number) => {
  const s = Math.max(0, seconds);
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const cc = Math.floor((s * 100) % 100);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(mm)}:${p(ss)}.${p(cc)}`;
};

export const statText = (stat: Stat, progress: number, from = 0) => {
  const decimals = stat.decimals ?? 0;
  if (stat.format === "countdown") {
    const v = interpolate(progress, [0, 1], [stat.value, stat.from ?? 0]);
    return `${stat.prefix ?? ""}${formatCountdown(v)}${stat.suffix ?? ""}`;
  }
  const v = interpolate(progress, [0, 1], [stat.from ?? from, stat.value]);
  const rounded = decimals === 0 ? Math.round(v) : v;
  return `${stat.prefix ?? ""}${formatNumber(rounded, decimals, stat.grouping ?? true)}${stat.suffix ?? ""}`;
};

/**
 * Count-up curve: fast at first (the dramatic part) but with a linear component,
 * so the number is still visibly ticking on the very last frame of the scene.
 */
const countCurve = (x: number) => 0.65 * Easing.out(Easing.cubic)(x) + 0.35 * x;

/**
 * Top-left stat block: small uppercase label, big animated number, sub-label.
 * `stats` may hold several stages on one shot (e.g. SNEEZES → DROPLETS); each
 * stage counts until the next one starts, the last one until the scene cuts.
 * `delay` (frames) holds it back, e.g. until the hook title has cleared.
 */
export const StatCounter: React.FC<{
  stats: Stat[];
  durationInFrames: number;
  delay?: number;
  accent: string;
  twist?: boolean;
}> = ({ stats, durationInFrames, delay = 0, accent, twist }) => {
  const frame = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  if (frame < 0 || stats.length === 0) return null;
  const available = durationInFrames - delay;
  const last = available - 1;

  // Stage windows [start, end] in frames (relative to `delay`).
  const starts = stats.map((s, i) => Math.round((s.startSeconds ?? (i === 0 ? 0.15 : 0)) * fps));
  let idx = 0;
  starts.forEach((s, i) => {
    if (frame >= s) idx = i;
  });
  const stat = stats[idx];
  const start = starts[idx];
  const end = idx + 1 < stats.length ? starts[idx + 1] - 1 : last;
  const prevValue = idx > 0 ? stats[idx - 1].value : 0;
  const isCountdown = stat.format === "countdown";

  const x = interpolate(frame, [start, Math.max(start + 1, end)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const progress = isCountdown ? x : countCurve(x);
  const text = statText(stat, progress, prevValue);

  // Size by the stage's FINAL string so the number never changes size while counting.
  const finalText = statText(stat, 1, prevValue);
  const fontSize = Math.min(132, Math.floor(1040 / Math.max(4, finalText.length * 0.62)));

  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 140 } });
  // Stage change: the label flips in.
  const flip = idx > 0 ? spring({ frame: frame - start, fps, config: { damping: 14, stiffness: 160 } }) : 1;
  const color = twist ? "#ff4d4d" : accent;
  const blink = isCountdown && x > 0 && x < 1 ? 0.78 + 0.22 * Math.round((Math.sin(frame * 0.5) + 1) / 2) : 1;

  return (
    <div
      style={{
        position: "absolute",
        top: 150,
        left: 60,
        right: 60,
        fontFamily: SANS,
        color: "white",
        opacity: enter,
        transform: `translateY(${(1 - enter) * -30}px)`,
        textShadow: "0 4px 24px rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          opacity: flip,
          transform: `translateY(${(1 - flip) * 16}px)`,
        }}
      >
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
          opacity: blink,
          color: twist ? "#fff2f2" : "white",
        }}
      >
        {text}
      </div>
      {stat.sublabel ? (
        <div
          style={{
            fontSize: sublabelFontSize(stat.sublabel),
            fontWeight: 600,
            lineHeight: 1.12,
            marginTop: 14,
            maxWidth: 960,
            whiteSpace: "nowrap",
            opacity: 0.88 * flip,
            letterSpacing: "-0.005em",
          }}
        >
          {stat.sublabel}
        </div>
      ) : null}
    </div>
  );
};
