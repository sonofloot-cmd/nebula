import React, { useMemo } from "react";
import { AbsoluteFill, spring, useVideoConfig } from "remotion";
import { SANS } from "../../fonts";
import { mergeCamera } from "../../three/camera";
import { useSceneTime } from "../../three/hooks";
import { mulberry32 } from "../../three/random";
import type { SceneComponentProps } from "../../types";
import { BrightCanvas, BrightSky, Building, Ground, HOUSE_COLORS, Phone } from "./kit";

/** Generic TV news: city with a towering phone, LIVE tag, "PHONE-POCALYPSE" banner, scrolling ticker. */
export const NewsCity: React.FC<{ t: number; L: number; mode?: "apps" | "battery" }> = ({ t, L, mode = "apps" }) => {
  const city = useMemo(() => {
    const r = mulberry32(12);
    return Array.from({ length: 60 }, (_, i) => ({
      x: -420 + (i % 15) * 58 + r() * 10,
      z: -80 - Math.floor(i / 15) * 60,
      f: 4 + Math.floor(r() * 16),
      c: HOUSE_COLORS[i % HOUSE_COLORS.length],
    }));
  }, []);
  return (
    <>
      <BrightSky t={t} scale={4} />
      <Ground size={6000} road={false} />
      {city.map((b, i) => (
        <Building key={i} p={[b.x, 0, b.z]} w={30} d={30} floors={b.f} color={b.c} />
      ))}
      <group position={[0, 0, -900]}>
        <Phone length={L} p={[0, L / 2, 0]} mode={mode} />
      </group>
    </>
  );
};

const NewsBulletin: React.FC<SceneComponentProps> = ({ durationInFrames, camera, props }) => {
  const t = useSceneTime();
  const { fps } = useVideoConfig();
  const L = (props.length as number) ?? 850;
  const channel = (props.channel as string) ?? "NEWS 9000";
  const ticker = (props.ticker as string) ?? "EVACUATE NOW • DO NOT ANSWER IT • ";
  const inBanner = spring({ frame: Math.round(t * fps), fps, config: { damping: 14 } });
  const cam = mergeCamera({ type: "pushIn", from: [40, 30, 380], to: [30, 40, 320], target: [0, 420, -900], fov: 50, ease: "inOut" }, camera);
  return (
    <AbsoluteFill>
      <BrightCanvas durationInFrames={durationInFrames} camera={cam} fog={[600, 4000]}>
        <NewsCity t={t} L={L} />
      </BrightCanvas>
      {/* broadcast graphics */}
      <div style={{ position: "absolute", right: 60, top: 470, display: "flex", gap: 14, alignItems: "center", fontFamily: SANS }}>
        <div style={{ background: "#e0182d", color: "#fff", fontWeight: 900, fontSize: 40, padding: "8px 20px", borderRadius: 8, opacity: 0.6 + 0.4 * Math.round((Math.sin(t * 6) + 1) / 2) }}>● LIVE</div>
        <div style={{ background: "rgba(255,255,255,0.92)", color: "#0b1d3a", fontWeight: 900, fontSize: 32, padding: "10px 16px", borderRadius: 8 }}>{channel}</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 960, transform: `translateX(${(1 - inBanner) * -1100}px)`, fontFamily: SANS }}>
        <div style={{ background: "#e0182d", color: "#fff", fontWeight: 900, fontSize: 92, padding: "18px 48px", letterSpacing: "0.02em", boxShadow: "0 10px 0 rgba(0,0,0,0.25)" }}>
          PHONE-POCALYPSE
        </div>
        <div style={{ background: "#0b1d3a", color: "#ffe14d", fontWeight: 800, fontSize: 40, padding: "12px 0", whiteSpace: "nowrap", overflow: "hidden" }}>
          <span style={{ display: "inline-block", transform: `translateX(${-((t * 380) % 1400)}px)`, paddingLeft: 40 }}>
            {(ticker + ticker + ticker + ticker).toUpperCase()}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default NewsBulletin;
