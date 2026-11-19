// Loading + validating episode files (JSON with // and /* */ comments allowed).
import fs from "node:fs";
import path from "node:path";

/** Strip // and /* *\/ comments and trailing commas, leaving string contents (e.g. URLs) intact. */
export const stripJsonComments = (src) => {
  let out = "";
  let inStr = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (inStr) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i++;
      } else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      out += ch;
    } else if (ch === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      out += "\n";
    } else if (ch === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i++;
    } else out += ch;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
};

export const loadEpisode = (file) => {
  const raw = fs.readFileSync(file, "utf8");
  try {
    return JSON.parse(stripJsonComments(raw));
  } catch (e) {
    throw new Error(`Could not parse ${file}: ${e.message}`);
  }
};

/** Returns { errors, warnings } for the format rules in the README. */
export const validateEpisode = (ep, scenesDir) => {
  const errors = [];
  const warnings = [];
  const req = (cond, msg) => cond || errors.push(msg);
  req(typeof ep.id === "string" && ep.id, "`id` is required");
  req(typeof ep.question === "string" && /^what if/i.test(ep.question), "`question` must start with 'What if'");
  req(Array.isArray(ep.scenes), "`scenes` must be an array");
  req(ep.endCard?.teaser || ep.endCard?.durationInSeconds === 0, "`endCard.teaser` is required (or set endCard.durationInSeconds to 0 for a loop ending)");
  if (!Array.isArray(ep.scenes)) return { errors, warnings };

  if (!ep.voiceover && (ep.scenes.length < 6 || ep.scenes.length > 9)) warnings.push(`Format calls for 6–9 scenes; this has ${ep.scenes.length}.`);
  ep.scenes.forEach((s, i) => {
    const n = `scene ${i + 1}`;
    req(s.component, `${n}: \`component\` is required`);
    if (s.component && !fs.existsSync(path.join(scenesDir, `${s.component}.scene.tsx`)))
      errors.push(`${n}: no file src/scenes/${s.component}.scene.tsx`);
    req(typeof s.durationInSeconds === "number", `${n}: \`durationInSeconds\` is required`);
    if (!s.vo && (s.durationInSeconds < 4 || s.durationInSeconds > 7)) warnings.push(`${n}: scenes should be 4–7s (is ${s.durationInSeconds}s)`);
    const stats = s.stat === undefined || s.stat === false ? [] : Array.isArray(s.stat) ? s.stat : [s.stat];
    stats.forEach((st, k) =>
      req(st?.label && typeof st?.value === "number", `${n}: stat ${k + 1} needs \`label\` and a numeric \`value\``),
    );
    const cues = s.vo && s.caption === undefined ? [{ text: s.vo, at: 0 }] : typeof s.caption === "string" ? [{ text: s.caption, at: 0 }] : s.caption;
    req(Array.isArray(cues) && cues.length > 0, `${n}: \`caption\` is required (a string or [{ text, at }]) unless the scene has \`vo\``);
    (Array.isArray(cues) ? cues : []).forEach((c) => {
      req(typeof c?.text === "string" && typeof c?.at === "number", `${n}: caption cues need \`text\` and a numeric \`at\``);
      const words = (c?.text ?? "").split(/\s+/).filter(Boolean).length;
      if (words > 10 && !s.vo) errors.push(`${n}: caption has ${words} words (max 10): "${c.text}"`);
      else if (words > 8 && !s.vo) warnings.push(`${n}: caption has ${words} words (aim for ≤ 8): "${c.text}"`);
      if (/^\s*twist\b/i.test(c?.text ?? "")) errors.push(`${n}: don't start a caption with "Twist" — the stat block already says TWIST`);
    });
    stats.forEach((st) => {
      if ((st?.sublabel ?? "").length > 34)
        warnings.push(`${n}: sub-label is ${st.sublabel.length} characters; it shrinks to fit one line, keep it ≤ 34: "${st.sublabel}"`);
    });
  });
  if (!ep.voiceover && !ep.scenes.some((s) => s.twist)) warnings.push("No scene is marked `twist: true`.");

  const total =
    ep.scenes.reduce((a, s) => a + (s.durationInSeconds ?? 0), 0) + (ep.endCard?.durationInSeconds ?? 3);
  if (total < 35 || total > 60) warnings.push(`Total length ${total}s is outside 35–60s.`);
  return { errors, warnings, total };
};
