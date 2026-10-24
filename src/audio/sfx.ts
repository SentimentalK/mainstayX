// Every SfxName, 8-bit style. Each effect is a tiny recipe of tone()/noise()
// voices with times relative to the trigger. Rate-limited per name and capped
// in total polyphony so spamming can never get loud.
import type { SfxName, SfxOpts } from '../types';
import { mtof, noise, rand, tone, type NoiseOpts, type ToneOpts } from './synth';

type RelTone = Omit<ToneOpts, 't'> & { t?: number };
type RelNoise = Omit<NoiseOpts, 't'> & { t?: number };

interface Kit {
  tone(o: RelTone): void;
  noise(o: RelNoise): void;
  /** Random in [-1, 1) for humanising. */
  jit(): number;
}

/** Max simultaneous sfx sources (oscillators + noise). */
const MAX_VOICES = 36;
/** Default min gap between two triggers of the same effect (s). */
const MIN_GAP = 0.04;
const GAP: Partial<Record<SfxName, number>> = {
  type: 1 / 12, hover: 0.06, warp: 1.0, warpHit: 0.25, snore: 0.5, meeting: 0.3,
  found: 0.2, cheer: 0.3, doorOpen: 0.3, ping: 0.15, spout: 0.2,
};

const n = mtof;
const step = (dt: number, ...midis: number[]) => midis.map((m, i) => [i * dt, n(m)] as const);

const DEFS: Record<SfxName, (k: Kit) => void> = {
  knock(k) {
    const v = 1 + k.jit() * 0.06;
    const vol = 1 + k.jit() * 0.1;
    k.tone({ wave: 'square', f: 120 * v, f2: 55 * v, glide: 0.07, dur: 0.11, vol: 0.32 * vol, a: 0.001, lp: 700, lp2: 250 });
    k.tone({ wave: 'triangle', f: 85 * v, f2: 42, glide: 0.1, dur: 0.16, vol: 0.45 * vol, a: 0.001 });
    k.noise({ dur: 0.05, vol: 0.28 * vol, filter: 'lowpass', f: 1600 * v, f2: 400, a: 0.001 });
  },
  doorOpen(k) {
    k.tone({ wave: 'pulse25', f: n(57), steps: step(0.055, 57, 60, 64, 69, 72, 76), dur: 0.42, vol: 0.13, a: 0.004, d: 0.6, s: 0.4, r: 0.12 });
    k.tone({ wave: 'triangle', f: n(45), steps: step(0.11, 45, 52, 57), dur: 0.4, vol: 0.12, a: 0.004, d: 0.5, s: 0.3, r: 0.1 });
    k.noise({ dur: 0.55, vol: 0.06, filter: 'bandpass', f: 1500, f2: 6000, q: 0.6, a: 0.2, d: 0.4, s: 0.3, r: 0.15 });
  },
  greet(k) {
    k.tone({ wave: 'pulse25', f: 880, f2: 1175, glide: 0.04, dur: 0.07, vol: 0.13, a: 0.002 });
    k.tone({ wave: 'pulse25', t: 0.11, f: 1175, f2: 1568, glide: 0.05, dur: 0.1, vol: 0.13, a: 0.002 });
  },
  warp(k) {
    k.tone({ wave: 'sawtooth', f: 90, f2: 1500, dur: 2.5, vol: 0.09, a: 2.2, d: 9, s: 1, r: 0.06, lp: 500, lp2: 7000, q: 3, vib: 30, vibRate: 9 });
    k.tone({ wave: 'pulse25', f: 135, f2: 2250, dur: 2.5, vol: 0.05, a: 2.2, d: 9, s: 1, r: 0.06 });
    k.noise({ dur: 2.5, vol: 0.16, filter: 'bandpass', f: 400, f2: 9000, q: 1.2, a: 2.3, d: 9, s: 1, r: 0.05 });
  },
  warpHit(k) {
    k.tone({ wave: 'sine', f: 170, f2: 38, glide: 0.25, dur: 0.55, vol: 0.75, a: 0.001 });
    k.tone({ wave: 'square', f: n(33), dur: 0.5, vol: 0.12, a: 0.002, lp: 900, lp2: 120 });
    k.noise({ dur: 0.2, vol: 0.35, filter: 'lowpass', f: 3000, f2: 300, a: 0.001 });
    k.noise({ dur: 1.4, vol: 0.2, filter: 'highpass', f: 2500, a: 0.002, d: 1.4 });
  },
  blip(k) {
    k.tone({ wave: 'pulse25', f: 1250, dur: 0.045, vol: 0.09, a: 0.002 });
  },
  dispatch(k) {
    k.tone({ wave: 'square', f: 380, f2: 1250, dur: 0.12, vol: 0.07, a: 0.002, d: 0.2, s: 0.6, lp: 3000 });
    k.tone({ wave: 'pulse25', t: 0.12, f: 1660, dur: 0.05, vol: 0.08, a: 0.002 });
  },
  deliver(k) {
    k.tone({ wave: 'triangle', f: 880, dur: 0.06, vol: 0.14, a: 0.002 });
    k.tone({ wave: 'triangle', t: 0.055, f: 1320, dur: 0.09, vol: 0.12, a: 0.002 });
  },
  result(k) {
    k.tone({ wave: 'pulse12', f: n(84), steps: step(0.07, 84, 91), dur: 0.16, vol: 0.1, a: 0.002, d: 0.25, s: 0.3 });
    k.tone({ wave: 'triangle', f: n(72), steps: step(0.07, 72, 79), dur: 0.16, vol: 0.08, a: 0.002 });
  },
  found(k) {
    k.tone({ wave: 'pulse25', f: n(72), steps: step(0.07, 72, 76, 79, 84), dur: 0.5, vol: 0.11, a: 0.003, d: 0.8, s: 0.5, r: 0.15, vib: 20, vibDelay: 0.3, vibRate: 7 });
    k.tone({ wave: 'triangle', f: n(60), steps: step(0.14, 60, 67), dur: 0.45, vol: 0.12, a: 0.003, d: 0.6, s: 0.3, r: 0.1 });
  },
  question(k) {
    k.tone({ wave: 'pulse25', f: 520, f2: 820, glide: 0.1, glideAt: 0.04, dur: 0.17, vol: 0.1, a: 0.004, d: 0.3, s: 0.6, r: 0.04 });
  },
  drop(k) {
    k.tone({ wave: 'square', f: 900, f2: 160, dur: 0.24, vol: 0.06, a: 0.002, d: 0.4, s: 0.6, lp: 2500 });
    k.tone({ wave: 'triangle', t: 0.23, f: 130, f2: 50, dur: 0.09, vol: 0.25, a: 0.001 });
  },
  bump(k) {
    k.tone({ wave: 'triangle', f: 330, f2: 150, dur: 0.11, vol: 0.22, a: 0.001 });
    k.tone({ wave: 'square', f: 200, f2: 90, dur: 0.07, vol: 0.06, a: 0.001, lp: 1200 });
    k.noise({ dur: 0.03, vol: 0.12, filter: 'lowpass', f: 1800, a: 0.001 });
  },
  poof(k) {
    k.noise({ dur: 0.28, vol: 0.18, filter: 'bandpass', f: 2000, f2: 350, q: 0.9, a: 0.01 });
    k.tone({ wave: 'sine', f: 320, f2: 110, dur: 0.18, vol: 0.12, a: 0.005 });
  },
  meeting(k) {
    k.tone({ wave: 'triangle', f: n(79), dur: 0.5, vol: 0.14, a: 0.003 });
    k.tone({ wave: 'pulse12', f: n(79), dur: 0.25, vol: 0.04, a: 0.003 });
    k.tone({ wave: 'triangle', t: 0.22, f: n(76), dur: 0.5, vol: 0.14, a: 0.003 });
    k.tone({ wave: 'triangle', t: 0.44, f: n(72), dur: 0.8, vol: 0.15, a: 0.003 });
    k.tone({ wave: 'pulse12', t: 0.44, f: n(72), dur: 0.35, vol: 0.04, a: 0.003 });
  },
  cheer(k) {
    k.tone({ wave: 'pulse25', f: n(67), steps: [[0, n(67)], [0.06, n(72)], [0.12, n(76)], [0.18, n(79)], [0.3, n(76)], [0.36, n(79)]], dur: 0.62, vol: 0.1, a: 0.003, d: 0.9, s: 0.5, r: 0.12, vib: 22, vibDelay: 0.4, vibRate: 7 });
    k.tone({ wave: 'triangle', f: n(64), steps: [[0, n(64)], [0.06, n(67)], [0.12, n(72)], [0.18, n(76)], [0.3, n(72)], [0.36, n(76)]], dur: 0.62, vol: 0.09, a: 0.003, d: 0.9, s: 0.4, r: 0.12 });
    k.noise({ t: 0.36, dur: 0.25, vol: 0.04, filter: 'highpass', f: 6000, a: 0.005 });
  },
  snore(k) {
    k.noise({ dur: 0.75, vol: 0.09, filter: 'bandpass', f: 280, f2: 650, q: 2, a: 0.4, d: 0.5, s: 0.4, r: 0.25 });
    k.tone({ wave: 'triangle', f: 92, f2: 70, dur: 0.75, vol: 0.08, a: 0.35, d: 0.6, s: 0.5, r: 0.2, vib: 60, vibRate: 11 });
  },
  startle(k) {
    k.tone({ wave: 'square', f: 300, f2: 1400, glide: 0.06, dur: 0.06, vol: 0.06, a: 0.001, d: 0.2, s: 0.8, lp: 3500 });
    k.tone({ wave: 'pulse25', t: 0.06, f: 1400, steps: step(0.035, 89, 86, 89, 86), dur: 0.14, vol: 0.08, a: 0.001, d: 0.25, s: 0.4 });
    k.noise({ dur: 0.04, vol: 0.08, filter: 'highpass', f: 3000, a: 0.001 });
  },
  ping(k) {
    k.tone({ wave: 'sine', f: 1180, dur: 0.75, vol: 0.13, a: 0.003 });
    k.tone({ wave: 'triangle', f: 2360, dur: 0.25, vol: 0.025, a: 0.003 });
    k.tone({ wave: 'sine', t: 0.32, f: 1180, dur: 0.6, vol: 0.045, a: 0.01 });
  },
  type(k) {
    k.noise({ dur: 0.012 + rand() * 0.006, vol: 0.035, filter: 'highpass', f: 3500 + rand() * 2500, a: 0.0005 });
  },
  spout(k) {
    k.noise({ dur: 0.55, vol: 0.14, filter: 'bandpass', f: 500, f2: 2600, glide: 0.25, q: 0.8, a: 0.04, d: 0.6, s: 0.3, r: 0.2 });
    k.tone({ wave: 'pulse12', t: 0.05, f: n(72), steps: step(0.05, 72, 76, 79, 84), dur: 0.2, vol: 0.04, a: 0.002, d: 0.3, s: 0.5 });
  },
  pass(k) {
    k.noise({ dur: 0.3, vol: 0.13, filter: 'bandpass', f: 350, f2: 2800, glide: 0.18, q: 1.5, a: 0.12, d: 0.2, s: 0, r: 0.05 });
    k.tone({ wave: 'triangle', f: 400, f2: 900, dur: 0.18, vol: 0.05, a: 0.06 });
  },
  oops(k) {
    k.tone({ wave: 'pulse25', f: n(76), dur: 0.13, vol: 0.1, a: 0.003, d: 0.3, s: 0.6, r: 0.03 });
    k.tone({ wave: 'pulse25', t: 0.16, f: n(72), f2: n(70), glide: 0.25, dur: 0.28, vol: 0.1, a: 0.003, d: 0.5, s: 0.5, r: 0.06, vib: 35, vibRate: 7, vibDelay: 0.05 });
  },
  hover(k) {
    k.tone({ wave: 'triangle', f: 1760, dur: 0.025, vol: 0.035, a: 0.002 });
  },
};

export const SFX_NAMES = Object.keys(DEFS) as SfxName[];

export type SfxPlayer = (name: SfxName, opts?: SfxOpts, at?: number) => boolean;

/** Returns a player that triggers effects into `dest`. `at` defaults to now. */
export function createSfx(ctx: BaseAudioContext, dest: AudioNode): SfxPlayer {
  const last: Partial<Record<SfxName, number>> = {};
  let active = 0;

  return (name, opts, at) => {
    const def = DEFS[name];
    if (!def) return false;
    const t0 = (at ?? ctx.currentTime) + 0.004;
    const prev = last[name];
    if (prev !== undefined && t0 - prev < (GAP[name] ?? MIN_GAP)) return false;
    if (active >= MAX_VOICES) return false;
    const vol = Math.min(1, Math.max(0, opts?.volume ?? 1));
    if (vol <= 0) return false;
    last[name] = t0;

    const semis = opts?.detune ?? 0;
    const cents = semis * 100;
    const p = Math.pow(2, semis / 12);

    // Per-call output: volume (+ pan) → dest; torn down after the last voice ends.
    const out = ctx.createGain();
    out.gain.value = vol;
    let pan: StereoPannerNode | null = null;
    const pv = Math.min(1, Math.max(-1, opts?.pan ?? 0));
    if (pv !== 0 && typeof ctx.createStereoPanner === 'function') {
      pan = ctx.createStereoPanner();
      pan.pan.value = pv;
      out.connect(pan);
      pan.connect(dest);
    } else {
      out.connect(dest);
    }
    let pending = 0;
    const done = () => {
      active--;
      if (--pending === 0) { out.disconnect(); pan?.disconnect(); }
    };

    const kit: Kit = {
      tone(o) {
        if (active >= MAX_VOICES) return;
        pending++; active++;
        const r = o as ToneOpts;
        r.t = t0 + (o.t ?? 0);
        if (cents) r.cents = (o.cents ?? 0) + cents;
        if (r.lp && p !== 1) { r.lp *= p; if (r.lp2) r.lp2 *= p; }
        tone(ctx, out, r, done);
      },
      noise(o) {
        if (active >= MAX_VOICES) return;
        pending++; active++;
        const r = o as NoiseOpts;
        r.t = t0 + (o.t ?? 0);
        if (p !== 1) {
          r.rate = (o.rate ?? 1) * p;
          if (r.f) r.f *= p;
          if (r.f2) r.f2 *= p;
        }
        noise(ctx, out, r, done);
      },
      jit: () => rand() * 2 - 1,
    };
    def(kit);
    if (pending === 0) { out.disconnect(); pan?.disconnect(); return false; }
    return true;
  };
}
