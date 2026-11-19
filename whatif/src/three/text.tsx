import React, { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender } from "remotion";
import * as THREE from "three";

/**
 * Text drawn into a CanvasTexture: billboards, map labels, signs, tickets.
 * Waits for the bundled Inter font before the frame is captured.
 */
export interface TextCard {
  lines: string[];
  /** canvas px */
  width?: number;
  height?: number;
  bg?: string;
  fg?: string | string[];
  /** px per line (array = per line) */
  size?: number | number[];
  weight?: number;
  border?: string;
  borderWidth?: number;
  radius?: number;
  /** soft outer glow around the letters */
  glow?: string;
  italic?: boolean;
  letterSpacing?: number;
}

const draw = (c: HTMLCanvasElement, spec: TextCard) => {
  const w = spec.width ?? 1024;
  const h = spec.height ?? 512;
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  const rad = spec.radius ?? 0;
  const bw = spec.borderWidth ?? (spec.border ? 14 : 0);
  if (spec.bg) {
    ctx.fillStyle = spec.bg;
    ctx.beginPath();
    ctx.roundRect(bw / 2, bw / 2, w - bw, h - bw, rad);
    ctx.fill();
  }
  if (spec.border) {
    ctx.strokeStyle = spec.border;
    ctx.lineWidth = bw;
    ctx.beginPath();
    ctx.roundRect(bw / 2, bw / 2, w - bw, h - bw, rad);
    ctx.stroke();
  }
  const n = spec.lines.length;
  const sizes = spec.lines.map((_, i) => (Array.isArray(spec.size) ? spec.size[i] ?? spec.size[0] : spec.size ?? 120));
  const total = sizes.reduce((a, b) => a + b * 1.12, 0);
  let y = (h - total) / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  spec.lines.forEach((line, i) => {
    const size = sizes[i];
    ctx.font = `${spec.italic ? "italic " : ""}${spec.weight ?? 900} ${size}px Inter, Arial, sans-serif`;
    if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${spec.letterSpacing ?? 0}px`;
    // shrink to fit the width
    const m = ctx.measureText(line).width;
    const maxW = w * 0.9;
    if (m > maxW) ctx.font = `${spec.italic ? "italic " : ""}${spec.weight ?? 900} ${Math.floor((size * maxW) / m)}px Inter, Arial, sans-serif`;
    const fg = Array.isArray(spec.fg) ? spec.fg[i] ?? spec.fg[0] : spec.fg ?? "#ffffff";
    ctx.fillStyle = fg;
    if (spec.glow) {
      ctx.shadowColor = spec.glow;
      ctx.shadowBlur = size * 0.35;
    }
    ctx.fillText(line, w / 2, y + (size * 1.12) / 2);
    ctx.shadowBlur = 0;
    y += size * 1.12;
  });
  void n;
};

export const useTextTexture = (spec: TextCard) => {
  const key = JSON.stringify(spec);
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    draw(c, spec);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const [handle] = useState(() => delayRender("text texture"));
  useEffect(() => {
    let done = false;
    document.fonts
      .load(`${spec.weight ?? 900} 64px Inter`)
      .then(() => document.fonts.ready)
      .then(() => {
        draw(tex.image as HTMLCanvasElement, spec);
        tex.needsUpdate = true;
      })
      .finally(() => {
        if (!done) continueRender(handle);
        done = true;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tex]);
  return tex;
};

/** A flat, self-lit text panel (billboard, sign, ticket). `height` in world units; width follows the canvas aspect. */
export const TextPanel: React.FC<{
  card: TextCard;
  height: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  opacity?: number;
  brightness?: number;
  doubleSide?: boolean;
}> = ({ card, height, position, rotation, opacity = 1, brightness = 1, doubleSide }) => {
  const tex = useTextTexture(card);
  const aspect = (card.width ?? 1024) / (card.height ?? 512);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[height * aspect, height]} />
      <meshBasicMaterial
        map={tex}
        transparent
        opacity={opacity}
        color={new THREE.Color(brightness, brightness, brightness)}
        toneMapped={false}
        side={doubleSide ? THREE.DoubleSide : THREE.FrontSide}
        depthWrite={!card.bg ? false : true}
      />
    </mesh>
  );
};

/** Camera-facing text label (map labels). `height` in world units. */
export const TextLabel: React.FC<{
  card: TextCard;
  height: number;
  position: [number, number, number];
  opacity?: number;
}> = ({ card, height, position, opacity = 1 }) => {
  const tex = useTextTexture(card);
  const aspect = (card.width ?? 1024) / (card.height ?? 512);
  return (
    <sprite position={position} scale={[height * aspect, height, 1]}>
      <spriteMaterial map={tex} transparent opacity={opacity} toneMapped={false} depthTest={false} depthWrite={false} />
    </sprite>
  );
};
