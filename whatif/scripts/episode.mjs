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
  req(ep.endCard?.teaser, "`endCard.teaser` is required");
  if (!Array.isArray(ep.scenes)) return { errors, warnings };

  if (ep.scenes.length < 6 || ep.scenes.length > 9) warnings.push(`Format calls for 6–9 scenes; this has ${ep.scenes.length}.`);
  ep.scenes.forEach((s, i) => {
    const n = `scene ${i + 1}`;
    req(s.component, `${n}: \`component\` is required`);
    if (s.component && !fs.existsSync(path.join(scenesDir, `${s.component}.scene.tsx`)))
      errors.push(`${n}: no file src/scenes/${s.component}.scene.tsx`);
    req(typeof s.durationInSeconds === "number", `${n}: \`durationInSeconds\` is required`);
    if (s.durationInSeconds < 4 || s.durationInSeconds > 7) warnings.push(`${n}: scenes should be 4–7s (is ${s.durationInSeconds}s)`);
    req(s.stat?.label && typeof s.stat?.value === "number", `${n}: \`stat.label\` and numeric \`stat.value\` are required`);
    req(typeof s.caption === "string", `${n}: \`caption\` is required`);
    const words = (s.caption ?? "").split(/\s+/).filter(Boolean).length;
    if (words > 10) errors.push(`${n}: caption has ${words} words (max 10): "${s.caption}"`);
  });
  if (!ep.scenes.some((s) => s.twist)) warnings.push("No scene is marked `twist: true`.");

  const total =
    ep.scenes.reduce((a, s) => a + (s.durationInSeconds ?? 0), 0) + (ep.endCard?.durationInSeconds ?? 3);
  if (total < 45 || total > 60) warnings.push(`Total length ${total}s is outside 45–60s.`);
  return { errors, warnings, total };
};
