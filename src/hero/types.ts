// Shared contracts between modules. Owned by the lead; module owners code
// against these and must not change them (ask the lead instead).
//
// Coordinates are always in low-res pixels (0..W, 0..H) unless noted.
// Time is in seconds. update() runs at a fixed 60 Hz step.

export const W = 320;
export const H = 180;
export const STEP = 1 / 60;

// ---------------------------------------------------------------- flow

/** Experience state machine: DOOR → KNOCK → OPEN → GREET → WARP → WORLD. */
export type Phase = 'DOOR' | 'KNOCK' | 'OPEN' | 'GREET' | 'WARP' | 'WORLD';

/** Scenes the director can switch between. `intro` covers DOOR..GREET. */
export type SceneId = 'intro' | 'warp' | 'world' | 'sheet';

export interface Params {
  /** `?scene=door|warp|world|sheet` — jump straight to a scene. */
  scene: 'door' | 'warp' | 'world' | 'sheet' | null;
  /** `?seed=123` — makes all random behaviour reproducible. */
  seed: number;
  /** `?speed=4` — debug time multiplier (default 1). */
  speed: number;
  /** `?debug=1` — fps / hitbox overlay, verbose logs. */
  debug: boolean;
}

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [lo, hi). */
  range(lo: number, hi: number): number;
  /** Integer in [lo, hi] inclusive. */
  int(lo: number, hi: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Independent deterministic stream derived from this one's seed. */
  fork(salt: number): Rng;
}

export interface PointerState {
  /** Low-res coordinates (may be fractional). */
  x: number;
  y: number;
  /** Pointer is over the stage. */
  inside: boolean;
  down: boolean;
}

export interface SceneContext {
  readonly rng: Rng;
  readonly audio: AudioAPI;
  readonly pointer: PointerState;
  readonly params: Params;
  /** prefers-reduced-motion: skip shakes, fewer particles, gentler motion. */
  readonly reducedMotion: boolean;
  /** Switch scene at the end of the current update. */
  goto(id: SceneId): void;
  /** Report where we are in the experience state machine. */
  setPhase(p: Phase): void;
  /** Screen shake in low-res px for `duration` seconds (ignored when reducedMotion). */
  shake(amplitude: number, duration: number): void;
  /** Full-screen colour flash that fades over `duration` seconds; survives scene switches. */
  flash(color: string, duration: number): void;
  setCursor(c: 'default' | 'pointer'): void;
}

export interface Gfx {
  /** 320×180 low-res context. Already cleared to black and shake-translated. */
  readonly ctx: CanvasRenderingContext2D;
  /** Crisp text + speech bubbles on the hi-res overlay (always above ctx). */
  readonly text: TextLayer;
}

export interface Scene {
  enter(ctx: SceneContext): void;
  update(dt: number): void;
  render(g: Gfx): void;
  exit?(): void;
  /** Click / tap / Enter-Space on the stage, in low-res coords. */
  pointerDown?(x: number, y: number): void;
  /** Anything useful for automated checks; exposed on window.__mx.debug(). */
  debug?(): unknown;
}

export type SceneFactory = () => Scene;

// ---------------------------------------------------------------- text

export interface TextStyle {
  /** Font size in low-res px (Silkscreen). Default 5. */
  size?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  baseline?: 'top' | 'middle' | 'bottom';
  /** Hard drop shadow colour (1 low-res px down-right). null = none. */
  shadow?: string | null;
  /** Soft neon glow colour. */
  glow?: string | null;
  alpha?: number;
  /** Radians, around (x, y). */
  rotate?: number;
}

export interface BubbleStyle {
  size?: number;
  /** Text colour. */
  color?: string;
  /** Box colour. */
  bg?: string;
  /** Outline colour (1 low-res px). */
  border?: string;
  /** Tail pointing down to (x, y). Default true. */
  tail?: boolean;
  alpha?: number;
}

export interface TextLayer {
  draw(str: string, x: number, y: number, style?: TextStyle): void;
  /** Width in low-res px. */
  measure(str: string, size?: number): number;
  /**
   * Speech bubble whose tail tip sits at (x, y) and box sits above it.
   * The box is kept inside the screen. Returns the box rect.
   */
  bubble(str: string, x: number, y: number, style?: BubbleStyle): Rect;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------------------------------------------------------------- audio

/**
 * Sound effects. All synthesised live with WebAudio, short and quiet.
 * knock      low square thud + noise (each knock on the door)
 * doorOpen   rising arpeggio + hiss
 * greet      two cute blips (Clawd says HI!)
 * warp       ~2.5 s rising pitch sweep + white noise swell
 * warpHit    big hit when cutting into the world
 * blip       generic tiny UI/speech blip
 * dispatch   Orca sends a task packet
 * deliver    packet arrives (soft blip)
 * result     result packet arrives back at Orca
 * found      "found it!" jingle
 * question   curious "?" boop
 * drop       something falls
 * bump       collision bonk
 * poof       sub-agent split / merge puff
 * meeting    Orca's call-to-meeting chime
 * cheer      celebration fanfare (tiny)
 * snore      zzz
 * startle    jolt awake
 * ping       Orca sonar ping
 * type       keyboard tick (very quiet, may be called often)
 * spout      water spout
 * pass       relay hand-off whoosh
 * oops       descending "uh-oh"
 * hover      very soft hover tick
 */
export type SfxName =
  | 'knock' | 'doorOpen' | 'greet' | 'warp' | 'warpHit'
  | 'blip' | 'dispatch' | 'deliver' | 'result' | 'found' | 'question'
  | 'drop' | 'bump' | 'poof' | 'meeting' | 'cheer' | 'snore' | 'startle'
  | 'ping' | 'type' | 'spout' | 'pass' | 'oops' | 'hover';

export interface SfxOpts {
  /** 0..1 multiplier on the effect's default level. */
  volume?: number;
  /** -1 (left) .. 1 (right). Callers usually pass (x / W) * 2 - 1. */
  pan?: number;
  /** Pitch offset in semitones. */
  detune?: number;
}

export interface AudioAPI {
  /** Must be called from inside a user gesture handler. Idempotent. */
  unlock(): void;
  readonly unlocked: boolean;
  readonly muted: boolean;
  setMuted(muted: boolean): void;
  /** No-op until unlocked or while muted. */
  sfx(name: SfxName, opts?: SfxOpts): void;
  /** Start/stop the looping BGM. If not unlocked yet, remembers the intent. */
  music(on: boolean): void;
  /** Tab hidden → true. Suspends the AudioContext. */
  setPaused(paused: boolean): void;
}

// ---------------------------------------------------------------- sprites

/**
 * Pixel-matrix sprite. Each frame is an array of equal-length rows; each
 * char is a palette key, '.' is transparent. Sprites face RIGHT by default
 * and are anchored at bottom-centre (their feet).
 */
export interface SpriteAnim {
  frames: string[][];
  /** Frames per second when played with frameAt(). */
  fps: number;
  /** Default true. Non-looping anims hold their last frame. */
  loop?: boolean;
}

export interface SpriteDef {
  palette: Record<string, string>;
  anims: Record<string, SpriteAnim>;
}

/**
 * Character sprite ids. `mini` is the small Clawd sub-agent.
 * Agents (clawd, mini, gemini, codex, qwen, kimi, glm, deepseek) provide AGENT_ANIMS.
 * orca provides ORCA_ANIMS.
 */
export type CharacterId = 'clawd' | 'mini' | 'gemini' | 'codex' | 'qwen' | 'kimi' | 'glm' | 'deepseek' | 'orca';
/** Props / icons / effects. Anim names for these are listed in PROP_ANIMS. */
export type PropId = 'packet' | 'icon' | 'fx';
export type SpriteId = CharacterId | PropId;

export const AGENT_ANIMS = [
  'idle',   // ≥2 frames, breathing
  'blink',  // 1 frame, eyes closed (shown briefly over idle)
  'walk',   // 4 frames walk cycle (also used, faster, for running)
  'work',   // 2 frames, typing / hammering
  'wave',   // 2 frames, waving
  'jump',   // 1–2 frames, airborne pose
  'sleep',  // 1–2 frames, eyes closed, slumped
  'shock',  // 1 frame, startled / "!"
  'look',   // 2 frames, looking around (left/right)
  'dizzy',  // 1–2 frames, after a bump
  'back',   // 1–2 frames, seen from behind (walking into the door)
] as const;
export type AgentAnim = (typeof AGENT_ANIMS)[number];

export const ORCA_ANIMS = [
  'swim',   // ≥4 frames, tail wag
  'blow',   // 1–2 frames, spouting pose
  'call',   // 1–2 frames, calling a meeting (mouth open / fin up)
] as const;
export type OrcaAnim = (typeof ORCA_ANIMS)[number];

export const PROP_ANIMS = {
  packet: ['task', 'result', 'open'] as const,
  icon: ['q', 'bang', 'zzz', 'bulb', 'bug', 'check', 'heart', 'coffee', 'chart', 'note', 'fire', 'star', 'sweat', 'key', 'ctx'] as const,
  fx: ['poof', 'spark', 'star', 'sparkle', 'dust', 'ring'] as const,
};

export interface DrawSpriteOpts {
  /** Face left. */
  flip?: boolean;
  /** Integer pixel scale. Default 1. */
  scale?: number;
  /** 1px rim around the silhouette in this colour. */
  outline?: string;
  /** Draw every pixel in this colour (silhouettes, hit flashes). */
  solid?: string;
  alpha?: number;
}

// ---------------------------------------------------------------- world

/** Clicking an agent in the world reports one of these (console.info for now). */
export interface AgentProfile {
  id: CharacterId;
  name: string;
  /** Tag line shown nowhere yet; reserved for the future project popover. */
  role: string;
  color: string;
  /** Default render scale in the world. */
  scale: number;
  project: { title: string; blurb: string; url?: string; github?: string } | null;
}
