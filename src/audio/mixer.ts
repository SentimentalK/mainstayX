// Master chain: [music bus → fade] + [sfx bus] → master gain → compressor → out.

/** Master level when unmuted. */
export const MASTER_LEVEL = 0.8;
/** Bus levels: music sits under the effects. */
export const MUSIC_LEVEL = 0.42;
export const SFX_LEVEL = 0.9;

export interface Mixer {
  master: GainNode;
  /** Music fade (0..1, automated by start/stop). */
  fade: GainNode;
  /** Where the music engine connects. */
  music: GainNode;
  /** Where sound effects connect. */
  sfx: GainNode;
}

export function createMixer(ctx: BaseAudioContext, muted: boolean): Mixer {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 10;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.18;
  comp.connect(ctx.destination);

  const master = ctx.createGain();
  master.gain.value = muted ? 0 : MASTER_LEVEL;
  master.connect(comp);

  const fade = ctx.createGain();
  fade.gain.value = 0;
  fade.connect(master);

  const music = ctx.createGain();
  music.gain.value = MUSIC_LEVEL;
  music.connect(fade);

  const sfx = ctx.createGain();
  sfx.gain.value = SFX_LEVEL;
  sfx.connect(master);

  return { master, fade, music, sfx };
}

/** Click-free ramp of a gain param to `target` starting now. */
export function rampTo(ctx: BaseAudioContext, p: AudioParam, target: number, seconds: number): void {
  const now = ctx.currentTime;
  p.cancelScheduledValues(now);
  p.setValueAtTime(p.value, now);
  p.linearRampToValueAtTime(target, now + seconds);
}
