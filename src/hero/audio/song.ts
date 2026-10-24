// BGM — "Neon Doorway", synthwave chiptune in A minor, 108 BPM, 32-bar loop.
//
// FORMAT (compiled by sequencer.ts; everything is on a 16th-note grid,
// 16 steps per bar, whitespace and '|' are ignored — use them for layout):
//
//   lead:  note names, one token per step:  'A4'  'C#5'  'Bb4'
//          '-' = hold the previous note one more step, '.' = rest.
//   bass:  semitone offsets from the bar's chord root in the bass octave
//          (E2..D#3): '0' root, '7' fifth, '12' octave, '-' hold, '.' rest.
//   arp:   chord-tone index: 1 root, 2 third, 3 fifth, then 4/5/6 = the same
//          an octave up (4-note chords wrap after 4). '-' hold, '.' rest.
//   drums: one CHARACTER per step per lane (k kick, s snare, h hat, o open
//          hat): '.' rest, 'x' hit, 'X' accent, 'g' ghost.
//
// A pattern may be any whole number of bars; it repeats to fill its section
// (pattern position restarts at each section). `sections` is the arrangement:
// each one names its chords (one per bar, repeating) and which pattern each
// track plays (omit a track to silence it). The loop is all sections in order.
//
// To change the tune: edit / add patterns below, then reference them from a
// section. Chord names: root (+ '#'/'b') + '', 'm', '7', 'm7', 'maj7',
// 'sus2', 'sus4', 'dim', 'add9', 'madd9'.
import type { Song } from './sequencer';

export const SONG: Song = {
  bpm: 108,

  lead: {
    // 8 bars over Am F C G ×2
    A: `
      E5 -  -  .   E5 .  D5 .   C5 -  -  .   A4 -  -  .  |
      C5 -  -  .   C5 .  D5 .   E5 -  -  .   F5 -  E5 -  |
      G5 -  -  .   G5 .  E5 .   C5 -  -  .   E5 -  D5 -  |
      D5 -  -  -   -  -  -  .   B4 -  -  .   D5 -  -  .  |
      E5 -  -  .   E5 .  D5 .   C5 -  -  .   A4 -  -  .  |
      C5 -  -  .   C5 .  D5 .   E5 -  -  .   A5 -  G5 -  |
      G5 -  -  .   E5 .  G5 .   C6 -  -  .   B5 -  G5 -  |
      B5 -  -  -   -  -  -  .   G5 -  -  .   A5 -  -  .  `,
    // 8 bars over Dm Bb F C | Dm Bb C E
    B: `
      F5 -  -  .   E5 .  D5 .   A4 -  -  .   D5 -  E5 -  |
      F5 -  -  .   G5 .  F5 .   D5 -  -  -   -  -  .  .  |
      C5 -  -  .   F5 .  A5 .   G5 -  -  .   F5 -  E5 -  |
      E5 -  -  -   -  -  G5 -   -  -  E5 -   C5 -  -  .  |
      F5 -  -  .   E5 .  D5 .   A4 -  -  .   D5 -  E5 -  |
      F5 -  -  .   G5 .  A5 .   Bb5 - -  .   A5 -  G5 -  |
      G5 -  -  .   E5 .  C5 .   G5 -  -  .   E5 -  -  .  |
      G#5 - -  -   -  -  -  .   B5 -  -  .   G#5 - E5 -  `,
    // 4 bars, long tones over F G Am Am
    bd: `
      A4 -  -  -   -  -  -  -   C5 -  -  -   -  -  -  -  |
      B4 -  -  -   -  -  -  -   D5 -  -  -   -  -  -  -  |
      E5 -  -  -   -  -  -  -   -  -  -  -   -  -  -  .  |
      .  .  .  .   .  .  .  .   .  .  .  .   .  .  .  .  `,
  },

  bass: {
    whole: '0 - - - - - - - - - - - 0 - 12 -',
    oct8: '0 . 12 . 0 . 12 . 0 . 12 . 0 . 12 .',
    push: '0 . 12 . 0 . 12 0 . 0 12 . 0 . 12 7',
    long: '0 - - - - - - - - - - - - - - .',
  },

  arp: {
    up: '1 2 3 5 4 3 2 3 1 2 3 5 4 3 2 3',
    wave: '1 3 5 3 2 4 6 4 1 3 5 3 2 4 6 4',
    sparse: '1 . . 3 . . 5 . . 3 . . 4 . . .',
  },

  drums: {
    intro: {
      k: 'x............... ................ x............... x.......x.......',
      h: '..x...x...x...x. ..x...x...x...x. ..x...x...x...x. ..x...x...x...x.',
      s: '................ ................ ................ ........g.g.x.xX',
    },
    main: {
      k: 'x.....x.x....... x.....x.x....... x.....x.x....... x.....x.x...x...',
      s: '....x.......x... ....x.......x... ....x.......x... ....x.......x.gg',
      h: 'x.x.x.x.x.x.x.x. x.x.x.x.x.x.x.g. x.x.x.x.x.x.x.x. x.x.x.x.x.x.x.x.',
    },
    disco: {
      k: 'x...x...x...x... x...x...x...x... x...x...x...x... x...x...x...x...',
      s: '....x.......x... ....x.......x... ....x.......x... ....x.....g.XgXX',
      h: 'x...x...x...x... x...x...x...x... x...x...x...x... x...x...x.......',
      o: '..x...x...x...x. ..x...x...x...x. ..x...x...x...x. ..x...x.........',
    },
    breakdown: {
      k: 'x............... ................ x............... ................',
      h: '................ ................ x.x.x.x.x.x.x.x. x.x.x.x.x.x.x.x.',
      s: '................ ................ ................ g...g...x.x.xXXX',
    },
  },

  sections: [
    { name: 'intro', bars: 4, chords: ['Am', 'F', 'C', 'G'], bass: 'whole', arp: 'up', drums: 'intro', pad: true },
    { name: 'A', bars: 8, chords: ['Am', 'F', 'C', 'G'], lead: 'A', bass: 'oct8', arp: 'up', drums: 'main' },
    { name: 'B', bars: 8, chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'C', 'E'], lead: 'B', bass: 'oct8', arp: 'wave', drums: 'main', pad: true },
    { name: 'breakdown', bars: 4, chords: ['F', 'G', 'Am', 'Am'], lead: 'bd', leadVol: 0.75, bass: 'long', arp: 'sparse', drums: 'breakdown', pad: true },
    { name: "A'", bars: 8, chords: ['Am', 'F', 'C', 'G'], lead: 'A', bass: 'push', arp: 'up', arpOct: 1, drums: 'disco' },
  ],
};
