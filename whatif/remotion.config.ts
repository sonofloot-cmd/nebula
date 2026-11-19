// Used by `npm run studio` (Remotion CLI). `npm run render` configures the
// same things programmatically in scripts/render.mjs.
import { Config } from "@remotion/cli/config";

Config.setPublicDir("assets");
Config.setVideoImageFormat("jpeg");
// Software WebGL so 3D renders on machines without a GPU (CI, servers).
Config.setChromiumOpenGlRenderer("swangle");
