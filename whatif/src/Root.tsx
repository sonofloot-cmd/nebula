import React from "react";
import { Composition } from "remotion";
import { Episode } from "./Episode";
import { buildTimeline, FPS, HEIGHT, WIDTH } from "./timeline";
import type { EpisodeProps } from "./types";

// Placeholder shown in the Studio if no --props are passed.
const placeholder: EpisodeProps = {
  episode: {
    id: "placeholder",
    question: "What if you ran `npm run studio -- episodes/sneeze.json`?",
    scenes: [],
    endCard: { teaser: "Pass an episode file to preview it." },
  },
};

export const Root: React.FC = () => (
  <Composition
    id="Episode"
    component={Episode}
    width={WIDTH}
    height={HEIGHT}
    fps={FPS}
    durationInFrames={90}
    defaultProps={placeholder}
    calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, buildTimeline(props.episode).totalFrames) })}
  />
);
