// Low-level WebAudio voices: one-shot oscillators / noise with envelopes.
// Everything takes a BaseAudioContext + destination node so it works the same
// in a live AudioContext and in an OfflineAudioContext (used for checks).
// Every node created here is disconnected when its source ends.

export type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'pulse25' | 'pulse12';

/**
 * Envelope (seconds). Attack ramps linearly to `vol`, then decays towards
 * `vol * s` with time-to-silence `d`; at `dur` the release fades to 0 over `r`.
 * Defaults (a=4ms, d=dur, s=0, r=20ms) give a pluck that dies out over `dur`.
 */
export interface Env {
  a?: number;
  d?: number;
  s?: number;
  r?: number;
}

export interface ToneOpts extends Env {
  wave: Wave;
  /** Start frequency (Hz). */
  f: number;
  /** Absolute start time on the context clock. */
  t: number;
  /** Gate length (s); the voice stops at t + dur + r. */
  dur: number;
  /** Peak gain. */
  vol: number;
  /** Exponential glide to f2 … */
  f2?: number;
  /** … taking `glide` seconds (default dur) … */
  glide?: number;
  /** … starting `glideAt` seconds after t (default 0). */
  glideAt?: number;
  /** Hard pitch steps [offset s, Hz] (chiptune arpeggios on one oscillator). */
  steps?: ReadonlyArray<readonly [number, number]>;
  /** Static detune in cents. */
  cents?: number;
  /** Vibrato depth in cents (fades in after vibDelay). */
  vib?: number;
  vibRate?: number;
  vibDelay?: number;
  /** Optional low-pass cutoff (Hz), swept exponentially to lp2 over dur. */
  lp?: number;
  lp2?: number;
  q?: number;
}

export interface NoiseOpts extends Env {
  t: number;
  dur: number;
  vol: number;
  filter?: BiquadFilterType;
  f?: number;
  /** Filter sweep target, reached after `glide` s (default dur). */
  f2?: number;
  glide?: number;
  q?: number;
  /** Playback rate of the noise buffer (pitch-ish). */
  rate?: number;
}

interface Cache {
  noise?: AudioBuffer;
  waves: Map<number, PeriodicWave>;
}
const caches = new WeakMap<BaseAudioContext, Cache>();
function cache(ctx: BaseAudioContext): Cache {
  let c = caches.get(ctx);
  if (!c) { c = { waves: new Map() }; caches.set(ctx, c); }
  return c;
}

// Tiny deterministic LCG for noise data / offsets / humanising.
let seed = 0x2f6b1d;
export function rand(): number {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}

/** The single shared 1 s white-noise buffer for this context. */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const c = cache(ctx);
  if (!c.noise) {
    const len = Math.floor(ctx.sampleRate);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = rand() * 2 - 1;
    c.noise = buf;
  }
  return c.noise;
}

/** Band-limited pulse wave with the given duty cycle (cached). */
function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  const c = cache(ctx);
  let w = c.waves.get(duty);
  if (!w) {
    const n = 40;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    w = ctx.createPeriodicWave(real, imag);
    c.waves.set(duty, w);
  }
  return w;
}

export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** Schedules the envelope on `p`; returns the time the voice may stop. */
export function envelope(p: AudioParam, t: number, dur: number, vol: number, e: Env): number {
  const a = Math.min(e.a ?? 0.004, dur);
  const d = e.d ?? dur;
  const s = e.s ?? 0;
  const r = e.r ?? 0.02;
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(vol, t + a);
  if (dur > a) p.setTargetAtTime(vol * s, t + a, Math.max(d, 0.001) / 5);
  p.setTargetAtTime(0, t + dur, Math.max(r, 0.002) / 5);
  return t + dur + r;
}

/** One oscillator voice. Returns its stop time. */
export function tone(ctx: BaseAudioContext, dest: AudioNode, o: ToneOpts, done?: () => void): number {
  const t = o.t;
  const osc = ctx.createOscillator();
  if (o.wave === 'pulse25') osc.setPeriodicWave(pulseWave(ctx, 0.25));
  else if (o.wave === 'pulse12') osc.setPeriodicWave(pulseWave(ctx, 0.125));
  else osc.type = o.wave;
  const fr = osc.frequency;
  fr.setValueAtTime(o.f, t);
  if (o.steps) for (const [dt, f] of o.steps) fr.setValueAtTime(f, t + dt);
  if (o.f2) {
    const g0 = t + (o.glideAt ?? 0);
    if (g0 > t) fr.setValueAtTime(o.f, g0);
    fr.exponentialRampToValueAtTime(o.f2, g0 + (o.glide ?? o.dur));
  }
  if (o.cents) osc.detune.setValueAtTime(o.cents, t);

  const g = ctx.createGain();
  g.gain.value = 0;
  let filt: BiquadFilterNode | null = null;
  if (o.lp) {
    filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = o.q ?? 0.7;
    filt.frequency.setValueAtTime(o.lp, t);
    if (o.lp2) filt.frequency.exponentialRampToValueAtTime(o.lp2, t + o.dur);
    osc.connect(filt);
    filt.connect(g);
  } else {
    osc.connect(g);
  }
  g.connect(dest);
  const end = envelope(g.gain, t, o.dur, o.vol, o);

  let lfo: OscillatorNode | null = null;
  let lfoG: GainNode | null = null;
  if (o.vib) {
    lfo = ctx.createOscillator();
    lfo.frequency.value = o.vibRate ?? 5.5;
    lfoG = ctx.createGain();
    const vd = t + (o.vibDelay ?? 0);
    lfoG.gain.setValueAtTime(0, t);
    lfoG.gain.setValueAtTime(0, vd);
    lfoG.gain.linearRampToValueAtTime(o.vib, vd + 0.2);
    lfo.connect(lfoG);
    lfoG.connect(osc.detune);
    lfo.start(t);
    lfo.stop(end);
  }

  osc.onended = () => {
    osc.disconnect();
    filt?.disconnect();
    g.disconnect();
    lfo?.disconnect();
    lfoG?.disconnect();
    done?.();
  };
  osc.start(t);
  osc.stop(end);
  return end;
}

/** One filtered-noise voice (shared buffer, looped, random offset). */
export function noise(ctx: BaseAudioContext, dest: AudioNode, o: NoiseOpts, done?: () => void): number {
  const t = o.t;
  const src = ctx.createBufferSource();
  const buf = noiseBuffer(ctx);
  src.buffer = buf;
  src.loop = true;
  if (o.rate) src.playbackRate.value = o.rate;

  const g = ctx.createGain();
  g.gain.value = 0;
  let filt: BiquadFilterNode | null = null;
  if (o.filter) {
    filt = ctx.createBiquadFilter();
    filt.type = o.filter;
    filt.Q.value = o.q ?? 0.8;
    filt.frequency.setValueAtTime(o.f ?? 1000, t);
    if (o.f2) filt.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide ?? o.dur));
    src.connect(filt);
    filt.connect(g);
  } else {
    src.connect(g);
  }
  g.connect(dest);
  const end = envelope(g.gain, t, o.dur, o.vol, o);
  src.onended = () => {
    src.disconnect();
    filt?.disconnect();
    g.disconnect();
    done?.();
  };
  src.start(t, rand() * buf.duration * 0.9);
  src.stop(end);
  return end;
}
