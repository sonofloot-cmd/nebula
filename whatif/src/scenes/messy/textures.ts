import * as THREE from "three";
import { mulberry32 } from "../../three/random";

/* Procedural canvas textures for the bedroom set (cached). */

const cache = new Map<string, THREE.CanvasTexture>();
const make = (key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, repeat = false) => {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set(key, t);
  return t;
};

/** Speckled grey dust (alpha) for layers on top of surfaces. */
export const dustTexture = () =>
  make("dust", 256, 256, (ctx, w, h) => {
    const r = mulberry32(3);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(190,182,168,0.55)";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const a = 0.15 + r() * 0.5;
      ctx.fillStyle = r() < 0.5 ? `rgba(225,218,205,${a})` : `rgba(120,112,100,${a})`;
      const s = 1 + r() * 3;
      ctx.fillRect(r() * w, r() * h, s, s);
    }
    // fluffy clumps
    for (let i = 0; i < 40; i++) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 10 + r() * 16);
      g.addColorStop(0, "rgba(230,224,212,0.6)");
      g.addColorStop(1, "rgba(230,224,212,0)");
      ctx.save();
      ctx.translate(r() * w, r() * h);
      ctx.fillStyle = g;
      ctx.fillRect(-30, -30, 60, 60);
      ctx.restore();
    }
  }, true);

/** Cobweb: radial threads + spiral, white on transparent. */
export const webTexture = () =>
  make("web", 512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(245,245,240,0.85)";
    ctx.lineWidth = 2;
    const cx = 0;
    const cy = 0; // anchored in a corner
    const spokes = 11;
    for (let i = 0; i <= spokes; i++) {
      const a = (i / spokes) * (Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * w * 1.1, cy + Math.sin(a) * h * 1.1);
      ctx.stroke();
    }
    ctx.lineWidth = 1.5;
    for (let ring = 1; ring < 16; ring++) {
      const rad = ring * 34 + (ring % 3) * 4;
      ctx.beginPath();
      for (let i = 0; i <= spokes; i++) {
        const a = (i / spokes) * (Math.PI / 2);
        const sag = 0.92 + 0.08 * Math.cos(i * 1.7 + ring);
        const x = cx + Math.cos(a) * rad * sag;
        const y = cy + Math.sin(a) * rad * sag;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // a few torn, hanging strands
    const r = mulberry32(8);
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      const x = 80 + r() * 360;
      const y = 80 + r() * 360;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 20, y + 60, x - 10 + r() * 30, y + 120 + r() * 60);
      ctx.stroke();
    }
  });

/** Striped wallpaper (repeating). */
export const wallpaperTexture = () =>
  make("wallpaper", 256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#2d3c4f";
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) {
      ctx.fillStyle = "#34465c";
      ctx.fillRect(x, 0, 30, h);
      ctx.fillStyle = "#3d5068";
      ctx.fillRect(x + 30, 0, 3, h);
    }
    const r = mulberry32(4);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.beginPath();
      ctx.arc(r() * w, r() * h, 3 + r() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, true);

/** Cracked-glass lines (transparent). */
export const crackTexture = () =>
  make("crack", 512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const r = mulberry32(12);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2.5;
    const ox = w * 0.22;
    const oy = h * 0.8;
    for (let i = 0; i < 9; i++) {
      let x = ox;
      let y = oy;
      const a = -Math.PI * (0.05 + r() * 0.9);
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += Math.cos(a + (r() - 0.5) * 0.7) * (30 + r() * 50);
        y += Math.sin(a + (r() - 0.5) * 0.7) * (30 + r() * 50);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.lineWidth = 1.5;
    for (let ring = 1; ring < 4; ring++) {
      ctx.beginPath();
      ctx.arc(ox, oy, ring * 28, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    // the hole the vine comes through
    ctx.fillStyle = "rgba(10,14,8,0.95)";
    ctx.beginPath();
    ctx.ellipse(ox, oy, 26, 18, 0.3, 0, Math.PI * 2);
    ctx.fill();
  });

/** Night / golden sky seen through the window. */
export const skyTexture = (mode: "day" | "night") =>
  make(`sky-${mode}`, 128, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (mode === "day") {
      g.addColorStop(0, "#ffb15c");
      g.addColorStop(0.55, "#ffd28f");
      g.addColorStop(1, "#ff8a3c");
    } else {
      g.addColorStop(0, "#0a1230");
      g.addColorStop(1, "#1f2e5a");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // rooftops silhouette
    ctx.fillStyle = mode === "day" ? "#7a3b22" : "#060914";
    const r = mulberry32(6);
    for (let x = 0; x < w; ) {
      const bw = 14 + r() * 26;
      const bh = 30 + r() * 60;
      ctx.fillRect(x, h - bh, bw, bh);
      x += bw;
    }
  });
