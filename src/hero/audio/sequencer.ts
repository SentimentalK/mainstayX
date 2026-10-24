// Song data types, a compiler from the readable song format (see song.ts) to
// per-step events, the music instruments, and a lookahead scheduler that
// plays them on the AudioContext clock.
import { mtof, noise, tone } from './synth';

// ---------------------------------------------------------------- data format

/** Drum lanes: one char per 16th step. '.' rest, 'x' hit, 'X' accent, 'g' ghost. */
export interface DrumPattern {
  /** Kick. */
  k?: string;
  /** Snare. */
  s?: string;
  /** Closed hat. */
  h?: string;
  /** Open hat. */
  o?: string;
}

export interface Section {
  name: string;
  bars: number;
  /** One chord per bar ('Am', 'F', 'C#m', 'Bb', 'E7', 'Gsus4' …); repeats if shorter. */
  chords: string[];
  /** Pattern names (keys into Song.lead / bass / arp / drums). Omit = silent. */
  lead?: string;
  bass?: string;
  arp?: string;
  drums?: string;
  /** Hold the chord on a soft triangle pad for each bar. */
  pad?: boolean;
  /** Octave shift for the arp (default 0). */
  arpOct?: number;
  /** Lead level multiplier (default 1). */
  leadVol?: number;
}

export interface Song {
  bpm: number;
  /** Melody patterns: note names ('A4', 'C#5', 'Bb4'), '-' hold, '.' rest. */
  lead: Record<string, string>;
  /** Bass patterns: semitones above the chord root (bass octave), '-' hold, '.' rest. */
  bass: Record<string, string>;
  /** Arp patterns: chord-tone index (1 = root, 2 = 3rd, 3 = 5th, 4 = root+8va …), '-', '.'. */
  arp: Record<string, string>;
  drums: Record<string, DrumPattern>;
  sections: Section[];
}

export const STEPS_PER_BAR = 16;

// ---------------------------------------------------------------- parsing

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'A4' → 69, 'C#5' → 73, 'Bb3' → 58. */
export function parseNote(s: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
  if (!m) throw new Error(`bad note "${s}"`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + acc;
}

const QUALITY: Record<string, number[]> = {
  '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
  sus2: [0, 2, 7], sus4: [0, 5, 7], dim: [0, 3, 6], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14],
};

interface Chord { pc: number; tones: number[] }
export function parseChord(s: string): Chord {
  const m = /^([A-G])([#b]?)(.*)$/.exec(s);
  const q = m ? QUALITY[m[3]] : undefined;
  if (!m || !q) throw new Error(`bad chord "${s}"`);
  const pc = (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  return { pc, tones: q };
}

/** Lowest midi note >= lo with pitch class pc. */
const placeAbove = (pc: number, lo: number) => lo + ((pc - lo) % 12 + 12) % 12;
const BASS_LO = 40; // E2
const ARP_LO = 52;  // E3

const tokens = (s: string) => s.split(/[\s|]+/).filter(Boolean);
const lanes = (s: string) => s.replace(/[\s|]+/g, '').split('');

// ---------------------------------------------------------------- compile

export const Inst = { Lead: 0, Bass: 1, Arp: 2, Pad: 3, Kick: 4, Snare: 5, Hat: 6, Open: 7 } as const;
export type Inst = (typeof Inst)[keyof typeof Inst];

export interface Ev {
  inst: Inst;
  midi: number;
  /** Length in steps. */
  len: number;
  vel: number;
}

export interface Compiled {
  bpm: number;
  stepDur: number;
  /** Events starting at each step. */
  steps: Ev[][];
  /** Step index where each section begins. */
  marks: { name: string; step: number }[];
}

const VEL: Record<string, number> = { x: 1, X: 1.3, g: 0.45 };

export function compile(song: Song): Compiled {
  const steps: Ev[][] = [];
  const marks: Compiled['marks'] = [];
  let g0 = 0;
  for (const sec of song.sections) {
    const n = sec.bars * STEPS_PER_BAR;
    marks.push({ name: sec.name, step: g0 });
    for (let i = 0; i < n; i++) steps.push([]);
    const chords = sec.chords.map(parseChord);
    const chordAt = (i: number) => chords[Math.floor(i / STEPS_PER_BAR) % chords.length];

    // Melodic tracks: walk tokens, '-' extends the open note.
    const track = (inst: Inst, src: string | undefined, toMidi: (tok: string, i: number) => number, vel: number) => {
      if (!src) return;
      const tk = tokens(src);
      if (tk.length % STEPS_PER_BAR) console.warn(`[audio] ${sec.name}: pattern length ${tk.length} is not whole bars`);
      let open: Ev | null = null;
      for (let i = 0; i < n; i++) {
        const tok = tk[i % tk.length];
        if (tok === '-') { if (open) open.len++; continue; }
        if (tok === '.') { open = null; continue; }
        open = { inst, midi: toMidi(tok, i), len: 1, vel };
        steps[g0 + i].push(open);
      }
    };
    const lookup = (rec: Record<string, unknown>, k: string | undefined, kind: string) => {
      if (k && !(k in rec)) throw new Error(`[audio] ${sec.name}: no ${kind} pattern "${k}"`);
    };
    lookup(song.lead, sec.lead, 'lead'); lookup(song.bass, sec.bass, 'bass');
    lookup(song.arp, sec.arp, 'arp'); lookup(song.drums, sec.drums, 'drums');

    track(Inst.Lead, sec.lead && song.lead[sec.lead], tok => parseNote(tok), sec.leadVol ?? 1);
    track(Inst.Bass, sec.bass && song.bass[sec.bass], (tok, i) => placeAbove(chordAt(i).pc, BASS_LO) + Number(tok), 1);
    const arpOct = 12 * (sec.arpOct ?? 0);
    track(Inst.Arp, sec.arp && song.arp[sec.arp], (tok, i) => {
      const c = chordAt(i);
      const k = Number(tok) - 1;
      return placeAbove(c.pc, ARP_LO) + arpOct + c.tones[k % c.tones.length] + 12 * Math.floor(k / c.tones.length);
    }, 1);
    if (sec.pad) {
      for (let b = 0; b < sec.bars; b++) {
        const c = chords[b % chords.length];
        const root = placeAbove(c.pc, ARP_LO);
        for (const iv of c.tones.slice(0, 3)) steps[g0 + b * STEPS_PER_BAR].push({ inst: Inst.Pad, midi: root + iv, len: STEPS_PER_BAR, vel: 1 });
      }
    }
    const dp = sec.drums ? song.drums[sec.drums] : undefined;
    if (dp) {
      const lane = (inst: Inst, src: string | undefined) => {
        if (!src) return;
        const ch = lanes(src);
        for (let i = 0; i < n; i++) {
          const v = VEL[ch[i % ch.length]];
          if (v) steps[g0 + i].push({ inst, midi: 0, len: 1, vel: v });
        }
      };
      lane(Inst.Kick, dp.k); lane(Inst.Snare, dp.s); lane(Inst.Hat, dp.h); lane(Inst.Open, dp.o);
    }
    g0 += n;
  }
  return { bpm: song.bpm, stepDur: 60 / song.bpm / 4, steps, marks };
}

// ---------------------------------------------------------------- instruments

export interface MusicOut {
  lead: AudioNode;
  arp: AudioNode;
  bass: AudioNode;
  pad: AudioNode;
  drums: AudioNode;
}

/** Instrument buses + a dotted-8th feedback delay for lead / arp. */
export function createMusicBus(ctx: BaseAudioContext, dest: AudioNode, bpm: number): MusicOut {
  const bus = (level: number) => { const g = ctx.createGain(); g.gain.value = level; g.connect(dest); return g; };
  const lead = bus(1), arp = bus(1), bass = bus(1), pad = bus(1), drums = bus(1);

  const send = ctx.createGain();
  const delay = ctx.createDelay(1.5);
  delay.delayTime.value = Math.min(1.4, (0.75 * 60) / bpm);
  const fb = ctx.createGain();
  fb.gain.value = 0.3;
  const damp = ctx.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.value = 2400;
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  send.connect(delay);
  delay.connect(damp);
  damp.connect(fb);
  fb.connect(delay);
  damp.connect(wet);
  wet.connect(dest);

  const sendLead = ctx.createGain(); sendLead.gain.value = 0.45; lead.connect(sendLead); sendLead.connect(send);
  const sendArp = ctx.createGain(); sendArp.gain.value = 0.3; arp.connect(sendArp); sendArp.connect(send);
  return { lead, arp, bass, pad, drums };
}

export function playEvent(ctx: BaseAudioContext, out: MusicOut, e: Ev, t: number, stepDur: number): void {
  const len = e.len * stepDur;
  const v = e.vel;
  switch (e.inst) {
    case Inst.Lead:
      tone(ctx, out.lead, {
        wave: 'pulse25', f: mtof(e.midi), t, dur: len * 0.9, vol: 0.15 * v,
        a: 0.006, d: 0.25, s: 0.55, r: 0.08, lp: 3400,
        vib: e.len >= 4 ? 16 : 0, vibRate: 5.2, vibDelay: 0.16,
      });
      break;
    case Inst.Bass:
      tone(ctx, out.bass, {
        wave: 'sawtooth', f: mtof(e.midi), t, dur: Math.max(len * 0.85, 0.06), vol: 0.26 * v,
        a: 0.003, d: 0.22, s: 0.45, r: 0.04, lp: 1300, lp2: 380, q: 2,
      });
      tone(ctx, out.bass, {
        wave: 'triangle', f: mtof(e.midi - 12), t, dur: Math.max(len * 0.85, 0.06), vol: 0.22 * v,
        a: 0.003, d: 0.3, s: 0.6, r: 0.04,
      });
      break;
    case Inst.Arp:
      tone(ctx, out.arp, {
        wave: 'pulse12', f: mtof(e.midi), t, dur: Math.min(len, 0.16), vol: 0.065 * v,
        a: 0.002, lp: 4200,
      });
      break;
    case Inst.Pad:
      tone(ctx, out.pad, {
        wave: 'triangle', f: mtof(e.midi), t, dur: len, vol: 0.05 * v,
        a: 0.35, d: 1.2, s: 0.7, r: 0.4, cents: (e.midi % 3 - 1) * 6,
      });
      break;
    case Inst.Kick:
      tone(ctx, out.drums, { wave: 'sine', f: 150, f2: 42, glide: 0.11, t, dur: 0.3, vol: 0.7 * v, a: 0.001 });
      noise(ctx, out.drums, { t, dur: 0.018, vol: 0.12 * v, filter: 'lowpass', f: 2200, a: 0.001 });
      break;
    case Inst.Snare:
      noise(ctx, out.drums, { t, dur: 0.17, vol: 0.28 * v, filter: 'bandpass', f: 1900, q: 0.7, a: 0.001 });
      tone(ctx, out.drums, { wave: 'triangle', f: 210, f2: 150, t, dur: 0.09, vol: 0.22 * v, a: 0.001 });
      break;
    case Inst.Hat:
      noise(ctx, out.drums, { t, dur: 0.035, vol: 0.09 * v, filter: 'highpass', f: 7500, a: 0.001 });
      break;
    case Inst.Open:
      noise(ctx, out.drums, { t, dur: 0.2, vol: 0.06 * v, filter: 'highpass', f: 7000, a: 0.002 });
      break;
  }
}

// ---------------------------------------------------------------- scheduler

const TICK_MS = 25;
const LOOKAHEAD = 0.15;

/** Lookahead scheduler: a 25 ms timer schedules every step due in the next 150 ms. */
export class Sequencer {
  readonly stepDur: number;
  readonly length: number;
  private pos = 0;
  private next = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private active = false;

  constructor(private ctx: BaseAudioContext, private out: MusicOut, private song: Compiled) {
    this.stepDur = song.stepDur;
    this.length = song.steps.length;
  }

  /** Loop length in seconds. */
  get loopSeconds(): number { return this.length * this.stepDur; }
  get playing(): boolean { return this.active; }
  get position(): number { return this.pos; }

  /** Start from the top. */
  start(): void {
    this.active = true;
    this.pos = 0;
    this.next = this.ctx.currentTime + 0.08;
    this.arm();
  }

  stop(): void {
    this.active = false;
    this.disarm();
  }

  /** Stop the timer but keep the position (tab hidden). */
  pause(): void { this.disarm(); }

  /** Re-sync the clock to now (no burst of overdue notes) and continue. */
  resume(): void {
    if (!this.active) return;
    this.next = this.ctx.currentTime + 0.05;
    this.arm();
  }

  /** Schedule every step of the loop from t0 (offline rendering). */
  renderAll(t0: number, loops = 1): void {
    for (let i = 0; i < this.length * loops; i++) this.playStep(i % this.length, t0 + i * this.stepDur);
  }

  private arm(): void {
    if (this.timer === null) this.timer = setInterval(this.tick, TICK_MS);
    this.tick();
  }

  private disarm(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private tick = (): void => {
    if (!this.active) return;
    const now = this.ctx.currentTime;
    // Fell behind (throttled timer, suspended context…)? Skip ahead, don't burst.
    if (this.next < now - 0.03) this.next = now + 0.03;
    const horizon = now + LOOKAHEAD;
    while (this.next < horizon) {
      this.playStep(this.pos, this.next);
      this.pos = (this.pos + 1) % this.length;
      this.next += this.stepDur;
    }
  };

  private playStep(i: number, t: number): void {
    const evs = this.song.steps[i];
    for (let k = 0; k < evs.length; k++) playEvent(this.ctx, this.out, evs[k], t, this.stepDur);
  }
}
