import { continueRender, delayRender, staticFile } from "remotion";

export const SERIF = "'Playfair Display', Georgia, serif";
export const SANS = "Inter, 'Helvetica Neue', Arial, sans-serif";

const faces: Array<[string, string, FontFaceDescriptors]> = [
  ["Playfair Display", "fonts/PlayfairDisplay-Bold.woff2", { weight: "700", style: "normal" }],
  ["Playfair Display", "fonts/PlayfairDisplay-BoldItalic.woff2", { weight: "700", style: "italic" }],
  ["Inter", "fonts/Inter-Variable.woff2", { weight: "100 900", style: "normal" }],
];

let loaded = false;

/** Loads bundled fonts once and blocks rendering until they are ready. */
export const ensureFonts = () => {
  if (loaded || typeof document === "undefined") return;
  loaded = true;
  const handle = delayRender("Loading fonts");
  Promise.all(
    faces.map(([family, file, desc]) => {
      const face = new FontFace(family, `url(${staticFile(file)}) format('woff2')`, desc);
      return face.load().then((f) => (document.fonts as unknown as { add: (f: FontFace) => void }).add(f));
    }),
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error("Font loading failed", err);
      continueRender(handle);
    });
};
