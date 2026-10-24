// Orca — the dispatcher. The approved 30×15 design (which faced left) is
// mirrored to face RIGHT and given 1 row of headroom: 30×16.
import type { SpriteDef } from '../../types';
import { Grid, mirror, type Frame, type Pt } from './util';

const PAL = {
  K: '#1b2030', // body
  L: '#2f3854', // back highlight
  W: '#f2f4f8', // eye patch, belly
  S: '#c4cad6', // belly shade
  G: '#5b6378', // saddle patch
  B: '#bff8ff', // blowhole spray
  P: '#ff6fa3', // open mouth
  E: '#0a0c14', // eye
};

const ORIGINAL = [
  '..................KK..........',
  '.................KKK..........',
  '................KKKK..........',
  '.........KKKKKKKKKKKKKK.......',
  '......KKKKKKKKKKKKKKKKKKKK....',
  '....KKKKWWWKKKKKKKKKKKKKKKK..K',
  '...KKKKKWWWKKKKKKKKKKKKKKKKKKK',
  '..KKKKKKKKKKKKKKKKKKGGKKKKKKK.',
  '.KKKKKKKKKKKKKKKKKGGGKKKKKKKKK',
  'KWWWKKKKKKKKKKKKKKKKKKKKKK..KK',
  '.KWWWWWWKKKKKKKWWWWKKKKKK....K',
  '..KKWWWWWWWWWWWWWWKKKKK.......',
  '....KKKWWWWWWWWKKKK...........',
  '........KKKKKKKK..............',
  '..........KKK.................',
];

const W = 30, H = 16;

/** Base pose: mirrored original, 1 px down, with a little shading. */
function base(): Grid {
  const g = new Grid(W, H).stamp(mirror(ORIGINAL), 0, 1);
  // Highlight along the top of the back and the fin's leading edge.
  const hi: Pt[] = [[10, 1], [11, 1], [12, 2], [13, 3]];
  for (let x = 8; x <= 20; x++) hi.push([x, 4]);
  for (let x = 4; x <= 6; x++) hi.push([x, 5]);
  for (let x = 22; x <= 23; x++) hi.push([x, 5]);
  g.pts(hi, 0, 0, 'L');
  // Belly shading where the white meets the underside.
  g.pts([[13, 13], [14, 13], [15, 13], [16, 13], [17, 13], [18, 13], [19, 13], [20, 13], [21, 13], [22, 13]], 0, 0, 'S');
  // Eye, just ahead of and below the eye patch.
  g.set(24, 8, 'E');
  return g;
}

/** Copy of `f` with the pixels of columns x0..x1 moved by dy. */
function moveCols(f: Frame, x0: number, x1: number, dy: number): Frame {
  if (!dy) return f;
  const rows = f.map(r => [...r]);
  for (let x = x0; x <= x1; x++) {
    for (let y = 0; y < H; y++) rows[y][x] = '.';
    for (let y = 0; y < H; y++) {
      const ch = f[y][x];
      const ny = y + dy;
      if (ch !== '.' && ny >= 0 && ny < H) rows[ny][x] = ch;
    }
  }
  return rows.map(r => r.join(''));
}

/** Swim frame: tail fluke at phase s (-1 up, 0 level, +1 down); flipper nudged. */
function swim(s: number, flip = 0): Frame {
  let f = base().out();
  f = moveCols(f, 0, 1, 2 * s);
  f = moveCols(f, 2, 3, s);
  if (flip) {
    // Pectoral flipper (bottom row) swings one pixel back.
    const g = new Grid(W, H).stamp(f.slice(0, H - 1));
    g.pts([[16, H - 1], [17, H - 1], [18, H - 1]], 0, 0, 'K');
    f = g.out();
  }
  return f;
}

function edit(f: Frame, pts: Pt[], clear: Array<[number, number]> = []): Frame {
  const g = new Grid(W, H).stamp(f);
  for (const [x, y] of clear) g.set(x, y, '.');
  g.pts(pts, 0, 0, 'K');
  return g.out();
}

// Blow: blowhole on the top of the head opens, a first jet of spray.
const blow0 = edit(swim(0), [[20, 4, 'B'], [20, 3, 'B']]);
const blow1 = edit(swim(0), [[20, 4, 'B'], [20, 3, 'B'], [20, 2, 'B'], [19, 1, 'B'], [21, 1, 'B'], [20, 0, 'B'], [18, 0, 'B'], [22, 0, 'B']]);

// Call: mouth opens (chomp) and the flipper lifts forward.
const call0 = edit(swim(0), [[26, 10, 'P'], [27, 10, 'P'], [28, 10, 'P'], [28, 11, 'W']], [[29, 10]]);
const call1 = edit(
  swim(0),
  [
    [25, 10, 'P'], [26, 10, 'P'], [27, 10, 'P'], [28, 10, 'P'],
    [25, 11, 'P'], [26, 11, 'P'], [27, 11, 'P'], [28, 11, 'W'],
    [26, 12, 'W'], [27, 12, 'W'],
    [19, 14], [20, 14], [21, 13, 'G'], [22, 12, 'G'],
  ],
  [[29, 10], [17, 15], [18, 15], [19, 15]],
);

export const ORCA: SpriteDef = {
  palette: PAL,
  anims: {
    swim: { frames: [swim(-1), swim(0, 1), swim(1), swim(0)], fps: 5 },
    blow: { frames: [blow0, blow1], fps: 4 },
    call: { frames: [call0, call1], fps: 4 },
  },
};
