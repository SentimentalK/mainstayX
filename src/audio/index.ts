// PLACEHOLDER — the audio module owner replaces this with the real
// WebAudio synth / sequencer. Keep the createAudio() signature.
import type { AudioAPI } from '../types';

export function createAudio(): AudioAPI {
  let unlocked = false, muted = false;
  return {
    unlock() { unlocked = true; },
    get unlocked() { return unlocked; },
    get muted() { return muted; },
    setMuted(m) { muted = m; },
    sfx() {},
    music() {},
    setPaused() {},
  };
}
