import type { Episode } from "./types";

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const DEFAULT_HOOK_SECONDS = 3;
export const DEFAULT_END_SECONDS = 3;

export interface SceneSlot {
  index: number;
  from: number;
  durationInFrames: number;
}

export interface Timeline {
  hookFrames: number;
  scenes: SceneSlot[];
  endFrom: number;
  endFrames: number;
  totalFrames: number;
}

const sec = (s: number) => Math.round(s * FPS);

/** The hook plays OVER the first scene; the end card follows the last scene. */
export const buildTimeline = (episode: Episode): Timeline => {
  const hookFrames = Math.max(0, sec(episode.hook?.durationInSeconds ?? DEFAULT_HOOK_SECONDS));
  let cursor = 0;
  const scenes = episode.scenes.map((s, index) => {
    const slot = { index, from: cursor, durationInFrames: sec(s.durationInSeconds) };
    cursor += slot.durationInFrames;
    return slot;
  });
  const endFrames = sec(episode.endCard.durationInSeconds ?? DEFAULT_END_SECONDS);
  return { hookFrames, scenes, endFrom: cursor, endFrames, totalFrames: cursor + endFrames };
};
