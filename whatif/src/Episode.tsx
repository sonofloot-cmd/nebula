import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import { Caption } from "./components/Caption";
import { EndCard } from "./components/EndCard";
import { Grade } from "./components/Grade";
import { HookTitle } from "./components/HookTitle";
import { SceneTransition } from "./components/SceneTransition";
import { StatCounter } from "./components/StatCounter";
import { Watermark } from "./components/Watermark";
import { ensureFonts, SANS } from "./fonts";
import { sceneRegistry } from "./scenes/registry";
import { buildTimeline } from "./timeline";
import type { EpisodeProps } from "./types";

ensureFonts();

const MissingScene: React.FC<{ name: string }> = ({ name }) => (
  <AbsoluteFill style={{ background: "#300", color: "white", fontFamily: SANS, fontSize: 40, alignItems: "center", justifyContent: "center", textAlign: "center", padding: 60 }}>
    Unknown scene component "{name}". Available: {Object.keys(sceneRegistry).join(", ")}
  </AbsoluteFill>
);

export const Episode: React.FC<EpisodeProps> = ({ episode, audio }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const tl = buildTimeline(episode);
  const accent = episode.accent ?? "#7fe3ff";

  return (
    <AbsoluteFill style={{ background: "#05060b" }}>
      {episode.scenes.map((scene, i) => {
        const slot = tl.scenes[i];
        const Scene = sceneRegistry[scene.component];
        // The first scene's stat + caption wait for the hook to clear.
        const overlayDelay = Math.max(0, tl.hookFrames - slot.from);
        return (
          <Sequence key={i} from={slot.from} durationInFrames={slot.durationInFrames} name={`${i + 1}. ${scene.component}`}>
            <SceneTransition enabled={i > 0 && scene.transition !== "none"}>
              {Scene ? (
                <Scene
                  durationInFrames={slot.durationInFrames}
                  camera={scene.camera}
                  props={scene.props ?? {}}
                  prevProps={episode.scenes[i - 1]?.props}
                  accent={accent}
                />
              ) : (
                <MissingScene name={scene.component} />
              )}
            </SceneTransition>
            <Grade />
            <StatCounter stats={Array.isArray(scene.stat) ? scene.stat : [scene.stat]} durationInFrames={slot.durationInFrames} delay={overlayDelay} accent={accent} twist={scene.twist} />
            <Caption text={scene.caption} durationInFrames={slot.durationInFrames} delay={overlayDelay + 4} />
          </Sequence>
        );
      })}

      <Sequence from={0} durationInFrames={tl.hookFrames} name="Hook">
        <HookTitle question={episode.hook?.text ?? episode.question} durationInFrames={tl.hookFrames} />
      </Sequence>

      <Sequence from={tl.endFrom} durationInFrames={tl.endFrames} name="End card">
        <EndCard
          question={episode.question}
          teaser={episode.endCard.teaser}
          cta={episode.endCard.cta ?? "FOLLOW FOR MORE WHAT IFS"}
          accent={accent}
        />
      </Sequence>

      <Watermark handle={episode.handle ?? "@simfinity"} />

      {(audio ?? []).map((cue, i) => (
        <Sequence key={`a${i}`} from={cue.from} name={`♪ ${cue.file}`} layout="none">
          <Audio
            src={staticFile(cue.file)}
            loop={cue.loop}
            volume={(f) =>
              cue.volume *
              (cue.music
                ? interpolate(f, [0, 8, durationInFrames - fps * 1.2, durationInFrames], [0, 1, 1, 0], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })
                : 1)
            }
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
