// Live WebAudio chiptune: BGM sequencer + synthesised sound effects.
// The AudioContext is created only inside unlock() (a user gesture); before
// that every call is a silent no-op and music(true) is remembered.
import type { AudioAPI } from '../types';
import { createMixer, MASTER_LEVEL, rampTo, type Mixer } from './mixer';
import { compile, createMusicBus, Sequencer } from './sequencer';
import { createSfx, type SfxPlayer } from './sfx';
import { SONG } from './song';

const MUTE_KEY = 'mx.muted';
const FADE_IN = 1.6;
const FADE_OUT = 0.9;

function readMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}
function writeMuted(m: boolean): void {
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* storage blocked */ }
}

type ACtor = typeof AudioContext;

export function createAudio(): AudioAPI {
  let ctx: AudioContext | null = null;
  let tried = false;
  let muted = readMuted();
  let paused = false;
  let wantMusic = false;
  let mix: Mixer | null = null;
  let seq: Sequencer | null = null;
  let play: SfxPlayer | null = null;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;

  const resume = () => {
    if (!ctx || ctx.state === 'closed') return;
    ctx.resume().then(() => { if (!paused) seq?.resume(); }, () => {});
  };

  const startMusic = () => {
    if (!ctx || !mix || !seq) return;
    if (stopTimer !== null) { clearTimeout(stopTimer); stopTimer = null; }
    rampTo(ctx, mix.fade.gain, 1, FADE_IN);
    if (!seq.playing) {
      seq.start();
      if (paused) seq.pause();
    }
  };

  const stopMusic = () => {
    if (!ctx || !mix || !seq || !seq.playing || stopTimer !== null) return;
    rampTo(ctx, mix.fade.gain, 0, FADE_OUT);
    stopTimer = setTimeout(() => { stopTimer = null; seq?.stop(); }, FADE_OUT * 1000 + 120);
  };

  return {
    unlock() {
      if (ctx) {
        if (!paused && ctx.state !== 'running') resume();
        return;
      }
      if (tried) return;
      tried = true;
      const w = window as unknown as { AudioContext?: ACtor; webkitAudioContext?: ACtor };
      const AC = w.AudioContext ?? w.webkitAudioContext;
      if (!AC) return;
      try {
        ctx = new AC({ latencyHint: 'interactive' });
      } catch {
        ctx = null;
        return;
      }
      mix = createMixer(ctx, muted);
      const song = compile(SONG);
      seq = new Sequencer(ctx, createMusicBus(ctx, mix.music, song.bpm), song);
      play = createSfx(ctx, mix.sfx);
      if (!paused) ctx.resume().catch(() => {});
      if (wantMusic) startMusic();
    },

    get unlocked() { return ctx !== null; },
    get muted() { return muted; },

    setMuted(m) {
      muted = m;
      writeMuted(m);
      if (ctx && mix) rampTo(ctx, mix.master.gain, m ? 0 : MASTER_LEVEL, 0.08);
    },

    sfx(name, opts) {
      if (!play || muted || paused) return;
      play(name, opts);
    },

    music(on) {
      wantMusic = on;
      if (!ctx) return;
      if (on) startMusic(); else stopMusic();
    },

    setPaused(p) {
      if (p === paused) return;
      paused = p;
      if (!ctx) return;
      if (p) {
        seq?.pause();
        ctx.suspend().catch(() => {});
      } else {
        resume();
      }
    },
  };
}
