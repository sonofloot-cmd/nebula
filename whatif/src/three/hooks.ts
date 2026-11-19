import { useCurrentFrame, useVideoConfig } from "remotion";

/** Scene-local time in seconds. Everything animated should be a pure function of this. */
export const useSceneTime = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};
