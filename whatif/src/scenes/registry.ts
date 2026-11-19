import type React from "react";
import type { SceneComponentProps } from "../types";

/**
 * Auto-registry: every file matching src/scenes/**\/*.scene.tsx is picked up
 * at bundle time (webpack require.context). Its default export becomes
 * available to episode JSON as "<folder>/<Name>", e.g.
 *   src/scenes/sneeze/SneezeCloseUp.scene.tsx  ->  "sneeze/SneezeCloseUp"
 * So a new episode never needs to touch this file.
 */
declare const require: {
  context: (
    dir: string,
    recursive: boolean,
    re: RegExp,
  ) => { keys: () => string[]; (key: string): { default: React.FC<SceneComponentProps> } };
};

const ctx = require.context("./", true, /\.scene\.tsx$/);

export const sceneRegistry: Record<string, React.FC<SceneComponentProps>> = Object.fromEntries(
  ctx.keys()
    .filter((k) => k.startsWith("./"))
    .map((k) => [k.replace(/^\.\//, "").replace(/\.scene\.tsx$/, ""), ctx(k).default]),
);
