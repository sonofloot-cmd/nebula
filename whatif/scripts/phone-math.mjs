#!/usr/bin/env node
// Math for episodes/phone-doubling.json — "What if your phone doubled in size every 4 seconds?"
// Run: node scripts/phone-math.mjs   (prints the table; the episode file uses these numbers)
//
// Model: mass m(t) = 0.2 kg × 2^(t/4). Same proportions and density as a normal phone
// (ρ = 2,500 kg/m³), so every length scales with the cube root of mass: L(t) = L0 × 2^(t/12).
// Black hole: the phone collapses when a ball of its volume fits inside its own Schwarzschild radius:
//   (3M / 4πρ)^(1/3) = 2GM/c²   →   M = sqrt(3c⁶ / (32πρG³))

const G = 6.674e-11;
const c = 2.998e8;
const RHO = 2500;
const M0 = 0.2;
const SUN = 1.989e30;

// a normal phone's proportions (≈ 150 × 71.5 × 8 mm), scaled to 0.2 kg at 2,500 kg/m³
const V0 = M0 / RHO;
const base = [0.15, 0.0715, 0.008];
const k = Math.cbrt(V0 / (base[0] * base[1] * base[2]));
export const PHONE0 = base.map((b) => b * k); // [L, W, D] metres

export const massAt = (t) => M0 * 2 ** (t / 4);
export const lengthAt = (t) => PHONE0[0] * 2 ** (t / 12);
export const tForMass = (m) => 4 * Math.log2(m / M0);
export const tForLength = (l) => 12 * Math.log2(l / PHONE0[0]);
export const M_BH = Math.sqrt((3 * c ** 6) / (32 * Math.PI * RHO * G ** 3));
export const R_S = (2 * G * M_BH) / c ** 2;

const clock = (s) => (s < 60 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`);
const len = (m) => (m < 1 ? `${(m * 100).toFixed(1)} cm` : m < 1000 ? `${m.toFixed(2)} m` : `${(m / 1000).toPrecision(3)} km`);
const kg = (m) => (m < 1 ? `${(m * 1000).toFixed(0)} g` : m < 1e4 ? `${m.toFixed(0)} kg` : m < 1e7 ? `${(m / 1000).toFixed(0)} t` : `${m.toExponential(2)} kg`);

export const BEATS = [
  ["2  Right now", 0],
  ["3  No longer fits a 20 cm pocket (shallowest men's front pocket, The Pudding 2018)", tForLength(0.2)],
  ["5  As long as a 55-inch TV is wide (1.22 m)", tForLength(1.22)],
  ["5  As heavy as a fridge (~113 kg, typical full-size)", tForMass(113)],
  ["6  Heavier than a small car (~1,000 kg)", tForMass(1000)],
  ["8  As tall as a 10-storey building (30 m at ~3 m/storey)", tForLength(30)],
  ["13 Heavier than the Earth (5.972e24 kg)", tForMass(5.972e24)],
  ["14 Black hole: fits inside its own Schwarzschild radius", tForMass(M_BH)],
];

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`Phone at t=0: ${(PHONE0[0] * 1000).toFixed(0)} × ${(PHONE0[1] * 1000).toFixed(1)} × ${(PHONE0[2] * 1000).toFixed(1)} mm, ${M0} kg, ρ = ${RHO} kg/m³`);
  console.log("beat | real time t | mass | phone length");
  for (const [name, t] of BEATS) console.log(`${name} | ${clock(t)} (${t.toFixed(1)} s) | ${kg(massAt(t))} | ${len(lengthAt(t))}`);
  console.log(`Black-hole mass ${M_BH.toExponential(3)} kg = ${(M_BH / SUN).toExponential(2)} solar masses; Schwarzschild radius ${(R_S / 1000).toExponential(2)} km`);
}
