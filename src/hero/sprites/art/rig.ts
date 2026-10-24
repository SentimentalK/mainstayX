// Shared "rig" for the agent characters: every agent is legs + body + arms +
// eyes stamped onto a fixed-size canvas, and every AGENT_ANIMS animation is a
// list of poses. Characters only describe their parts; this file turns the
// standard pose table into frames, so all agents animate consistently.
import type { AgentAnim, SpriteAnim } from '../../types';
import { AGENT_ANIMS } from '../../types';
import { Grid, type Frame, type Pt } from './util';

export type Eye = 'open' | 'blink' | 'closed' | 'wide' | 'left' | 'right' | 'down' | 'happy' | 'dizzyA' | 'dizzyB';

export interface Pose {
  /** Body offset from rest (negative = up). Legs stay bottom-aligned. */
  dy?: number;
  dx?: number;
  eyes?: Eye;
  /** Key into AgentArt.arms (default 'rest'). */
  arms?: string;
  /** Key into AgentArt.legs (default 'std'). */
  legs?: string;
  back?: boolean;
  /** Free-form hint for a character's custom paint (e.g. 'breath', 'work0'). */
  tag?: string;
}

export interface AgentArt {
  w: number;
  h: number;
  /** Body origin at rest. */
  bx: number;
  by: number;
  body: Frame;
  back: Frame;
  /** Optional body override for a pose (e.g. a squashed breathing body). */
  bodyFor?: (p: Pose) => Frame | null;
  /** Leg sets, bottom-aligned to the canvas, drawn first (the body covers their top). */
  legs: Record<string, Frame>;
  /** Arm pixel sets relative to the body origin. */
  arms: Record<string, readonly Pt[]>;
  armCh: string;
  /** Eye pixel sets relative to the body origin. Missing kinds fall back to 'open'. */
  eyes: Partial<Record<Eye, readonly Pt[]>>;
  eyeCh: string;
  /** Extra eye offset for a pose (e.g. when only the head moves). */
  eyeDy?: (p: Pose) => number;
  /** How far the body sinks when asleep (usually the visible leg height). */
  sleepDy: number;
  /** Custom details drawn last (star, antenna, screen glyphs...). */
  paint?: (g: Grid, p: Pose, ox: number, oy: number) => void;
  /** Per-character overrides of the standard pose table. */
  poses?: Partial<Record<AgentAnim, AnimSpec>>;
}

export interface AnimSpec {
  fps: number;
  loop?: boolean;
  poses: Pose[];
}

const UP = -1;
/** The standard pose table shared by every agent. */
export function standardPoses(sleepDy: number): Record<AgentAnim, AnimSpec> {
  return {
    idle: { fps: 2.5, poses: [{}, { dy: 1, tag: 'breath' }] },
    blink: { fps: 1, poses: [{ eyes: 'blink' }] },
    walk: {
      fps: 8,
      poses: [
        { legs: 'A', eyes: 'right', tag: 'walk0' },
        { legs: 'std', dy: UP, eyes: 'right', tag: 'walk1' },
        { legs: 'B', eyes: 'right', tag: 'walk2' },
        { legs: 'std', dy: UP, eyes: 'right', tag: 'walk3' },
      ],
    },
    work: { fps: 6, poses: [{ arms: 'workA', eyes: 'down', tag: 'work0' }, { arms: 'workB', eyes: 'down', tag: 'work1' }] },
    wave: { fps: 4, poses: [{ arms: 'waveA', eyes: 'happy', tag: 'wave0' }, { arms: 'waveB', eyes: 'happy', tag: 'wave1' }] },
    jump: {
      fps: 6,
      loop: false,
      poses: [
        { legs: 'std', dy: UP, arms: 'up', eyes: 'open', tag: 'jump0' },
        { legs: 'tuck', dy: UP, arms: 'up', eyes: 'happy', tag: 'jump1' },
      ],
    },
    sleep: {
      fps: 1.2,
      poses: [
        { legs: 'none', dy: sleepDy, arms: 'droop', eyes: 'closed', tag: 'sleep0' },
        { legs: 'none', dy: sleepDy, arms: 'droop2', eyes: 'closed', tag: 'sleep1' },
      ],
    },
    shock: { fps: 1, poses: [{ legs: 'splay', dy: UP, arms: 'up', eyes: 'wide', tag: 'shock' }] },
    look: { fps: 1.5, poses: [{ eyes: 'left', tag: 'look0' }, { eyes: 'right', tag: 'look1' }] },
    dizzy: { fps: 5, poses: [{ dx: -1, eyes: 'dizzyA', tag: 'dizzy0' }, { dx: 1, eyes: 'dizzyB', tag: 'dizzy1' }] },
    back: {
      fps: 7,
      poses: [
        { back: true, legs: 'A', tag: 'back0' },
        { back: true, legs: 'std', dy: UP, tag: 'back1' },
        { back: true, legs: 'B', tag: 'back2' },
        { back: true, legs: 'std', dy: UP, tag: 'back3' },
      ],
    },
  };
}

export function renderPose(a: AgentArt, p: Pose): Frame {
  const g = new Grid(a.w, a.h);
  const legs = a.legs[p.legs ?? 'std'] ?? a.legs.std;
  g.stamp(legs, 0, a.h - legs.length);
  const ox = a.bx + (p.dx ?? 0);
  const oy = a.by + (p.dy ?? 0);
  g.stamp(a.bodyFor?.(p) ?? (p.back ? a.back : a.body), ox, oy);
  const arms = a.arms[p.arms ?? 'rest'] ?? a.arms[(p.arms ?? '').replace(/\d$/, '')] ?? a.arms.rest ?? [];
  g.pts(arms, ox, oy, a.armCh);
  if (!p.back) {
    const eyes = a.eyes[p.eyes ?? 'open'] ?? a.eyes.open ?? [];
    g.pts(eyes, ox, oy + (a.eyeDy?.(p) ?? 0), a.eyeCh);
  }
  a.paint?.(g, p, ox, oy);
  return g.out();
}

export function buildAgent(a: AgentArt): Record<string, SpriteAnim> {
  const table = { ...standardPoses(a.sleepDy), ...a.poses };
  const out: Record<string, SpriteAnim> = {};
  for (const name of AGENT_ANIMS) {
    const spec = table[name];
    const frames = spec.poses.map(p => renderPose(a, p));
    out[name] = spec.loop === false ? { frames, fps: spec.fps, loop: false } : { frames, fps: spec.fps };
  }
  return out;
}
