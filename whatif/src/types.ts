// Episode schema. One JSON(C) file in /episodes == one video.

export type Vec3 = [number, number, number];

export type CameraMoveType = "pushIn" | "pullBack" | "orbit" | "crane" | "dolly";

export interface CameraMove {
  /** Only used for documentation / readability; all types interpolate from→to. */
  type: CameraMoveType;
  /** Start camera position. */
  from: Vec3;
  /** End camera position (ignored for pure orbit unless given). */
  to?: Vec3;
  /** Point the camera looks at. */
  target: Vec3;
  /** Optional end look-at point (target is interpolated to it). */
  targetTo?: Vec3;
  /** Orbit: degrees to rotate around the target's Y axis over the scene. */
  orbitDegrees?: number;
  /** Vertical field of view in degrees. */
  fov?: number;
  fovTo?: number;
  /** Easing: "inOut" (default), "out", "linear". */
  ease?: "inOut" | "out" | "linear";
}

export type StatFormat = "number" | "countdown";

export interface Stat {
  /** Small uppercase label above the number, e.g. "SNEEZES". */
  label: string;
  /** Final value the counter lands on (or, for countdowns, the starting value). */
  value: number;
  /** Starting value for count-ups (default 0). For countdowns: the end value (default 0). */
  from?: number;
  /** "number" counts up; "countdown" counts down and shows MM:SS.cc */
  format?: StatFormat;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Tiny line under the number. Always one line: the font shrinks to fit (keep it ≤ ~32 characters). */
  sublabel?: string;
  /** Thousands separators (default true). Set false for years, e.g. 1979. */
  grouping?: boolean;
  /**
   * Seconds into the scene (after any hook delay) when this stat starts counting.
   * It keeps counting until the next stage starts or the scene cuts — never frozen.
   */
  startSeconds?: number;
}

export interface CaptionCue {
  text: string;
  at: number;
}

export interface SceneDef {
  /** Path of the scene component under src/scenes without ".scene.tsx", e.g. "sneeze/SneezeCloseUp". */
  component: string;
  durationInSeconds: number;
  /** One stat, or several stages shown on the same shot (e.g. SNEEZES → DROPLETS). */
  stat: Stat | Stat[];
  /**
   * One short punchy line, max 10 words. Or a timed sequence of lines:
   * [{ "text": "It's happened before…", "at": 0 }, { "text": "…just not where you'd think.", "at": 1.1 }]
   * (`at` = seconds into the scene; each line shows until the next one).
   */
  caption: string | CaptionCue[];
  /** Override the scene's default camera move (merged over the default). */
  camera?: Partial<CameraMove>;
  /** Marks the twist scene: red accent + countdown styling. */
  twist?: boolean;
  /** Free-form props passed to the scene component. */
  props?: Record<string, unknown>;
  /** Sound effects: a synth recipe (see scripts/audio/sfx.mjs) or an audio file in /assets. */
  sfx?: Array<{
    synth?: string;
    file?: string;
    at?: number;
    volume?: number;
    /** "hit" (default): the sound's impact lands on `at`. "start": the file starts at `at`. */
    align?: "hit" | "start";
    params?: Record<string, unknown>;
  }>;
}

export interface Episode {
  id: string;
  /** The "What if…?" question. */
  question: string;
  handle?: string;
  /** Accent colour for labels (CSS colour). */
  accent?: string;
  hook?: { durationInSeconds?: number };
  scenes: SceneDef[];
  endCard: {
    durationInSeconds?: number;
    teaser: string;
    cta?: string;
  };
  music?: { file?: string; volume?: number };
  /** Auto-composed score settings, or false for no score. */
  score?: false | { key?: string; volume?: number };
  /** Loudness-normalise the final MP4 (two-pass ffmpeg loudnorm), e.g. { "lufs": -14, "truePeak": -1 }. */
  loudness?: { lufs?: number; truePeak?: number };
}

/** A sound placed on the timeline (built by scripts/audio). */
export interface AudioCue {
  file: string;
  from: number;
  volume: number;
  music?: boolean;
  loop?: boolean;
}

export interface EpisodeProps extends Record<string, unknown> {
  episode: Episode;
  /** Built by the render script (scripts/audio): score, music and sound effects. */
  audio?: AudioCue[];
}

export interface SceneComponentProps {
  durationInFrames: number;
  camera?: Partial<CameraMove>;
  props: Record<string, unknown>;
  accent: string;
}
