// GPT (works in Codex) and Grok (works in Cursor). Homages only: colours and
// motifs, no logo artwork. Same rig + pose table as ./agents.ts.
import type { SpriteDef } from '../../types';
import { buildAgent, type AgentArt, type Pose } from './rig';
import type { Grid, Pt } from './util';

const shift = (l: readonly Pt[], dx: number, dy = 0): Pt[] =>
  l.map(p => (p.length > 2 ? [p[0] + dx, p[1] + dy, (p as readonly [number, number, string])[2]] : [p[0] + dx, p[1] + dy]) as Pt);

// ------------------------------------------------------------------ gpt
// A white rounded head with a dark face band and mint eyes, and a small green
// knot on a stalk that spins while it thinks. 13×14.
const GPT = {
  X: '#ffffff', // highlight
  W: '#eef1f3', // shell
  L: '#c3c9cf', // shell shade, arms
  D: '#7b848c', // legs, stalk, deep shade
  K: '#101418', // face band
  H: '#7ff0cf', // eyes, knot highlight
  M: '#2f6f60', // closed eyes
  G: '#10a37f', // knot
  g: '#0b5e4b', // knot asleep
  Y: '#ffe259', // alarm sparks
};

// The knot is a little ring; its highlight runs around it (6 positions).
const KNOT: Pt[] = [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2]];
const KNOT_HI: Pt[] = [[1, 0], [3, 0], [4, 1], [3, 2], [1, 2], [0, 1]];

const GPT_EYES: Pt[] = [[2, 2], [2, 3], [6, 2], [6, 3]];

const gptArt: AgentArt = {
  w: 13, h: 14, bx: 2, by: 5,
  body: [
    '..XXWWL..',
    '.XWWWWWWL',
    'WKKKKKKKL',
    'WKKKKKKKL',
    'WKKKKKKKL',
    '.WWWWWWL.',
    '..LLLLD..',
  ],
  back: [
    '..XXWWL..',
    '.XWWWWWWL',
    'WWWWWWWWL',
    'WDDDDDDDL',
    'WWWWWWWWL',
    '.WWWWWLL.',
    '..LLLLD..',
  ],
  legs: {
    std: ['....D...D....', '....DD..DD...'],
    A: ['....D...DD...', '....DD.......'],
    B: ['...DD...D....', '........DD...'],
    tuck: ['...DD...DD...', '.............'],
    splay: ['....D...D....', '...DD....DD..'],
    none: [],
  },
  armCh: 'L',
  arms: {
    rest: [[-1, 3], [-1, 4, 'D'], [9, 3], [9, 4, 'D']],
    workA: [[-1, 3], [-1, 4, 'D'], [9, 4], [10, 4], [10, 5, 'D']],
    workB: [[-1, 4], [-1, 5, 'D'], [9, 3], [10, 3], [10, 4, 'D']],
    waveA: [[-1, 3], [-1, 4, 'D'], [9, 3], [9, 2], [10, 1], [10, 0, 'X']],
    waveB: [[-1, 3], [-1, 4, 'D'], [9, 3], [9, 2], [9, 1], [9, 0, 'X']],
    up: [[-1, 3], [-1, 2], [-1, 1], [-1, 0, 'X'], [9, 3], [9, 2], [9, 1], [9, 0, 'X']],
    droop: [[-1, 4], [-1, 5, 'D'], [9, 4], [9, 5, 'D']],
    droop2: [[-1, 5, 'D'], [9, 4], [9, 5, 'D']],
  },
  eyeCh: 'H',
  eyes: {
    open: GPT_EYES,
    blink: [[1, 3, 'M'], [2, 3, 'M'], [6, 3, 'M'], [7, 3, 'M']],
    closed: [[1, 3, 'M'], [2, 3, 'M'], [3, 3, 'M'], [5, 3, 'M'], [6, 3, 'M'], [7, 3, 'M']],
    happy: [[1, 3], [2, 2], [3, 3], [5, 3], [6, 2], [7, 3]],
    wide: [[2, 2, 'X'], [2, 3, 'X'], [2, 4, 'X'], [6, 2, 'X'], [6, 3, 'X'], [6, 4, 'X']],
    left: shift(GPT_EYES, -1),
    right: shift(GPT_EYES, 1),
    down: [[3, 3], [3, 4], [7, 3], [7, 4]],
    dizzyA: [[1, 2], [3, 2], [2, 3], [1, 4], [3, 4], [5, 2], [7, 2], [6, 3], [5, 4], [7, 4]],
    dizzyB: [[2, 2], [1, 3], [2, 3], [3, 3], [2, 4], [6, 2], [5, 3], [6, 3], [7, 3], [6, 4]],
  },
  sleepDy: 2,
  paint(g: Grid, p: Pose, ox: number, oy: number) {
    const t = p.tag ?? '';
    // where the knot sits: it lags the body (stays put on the breath, sinks a
    // beat late), leans back while walking and pops when startled
    let kx = 2, ky = Math.min(oy, 5) - 4, hi = 0, ch = 'G', hiCh = 'H';
    if (t.startsWith('walk')) { hi = Number(t[4]); if (t === 'walk0' || t === 'walk2') kx = 1; }
    if (t.startsWith('back')) hi = Number(t[4]);
    if (t === 'work0') hi = 1;
    if (t === 'work1') hi = 4;
    if (t === 'look0') kx = 1;
    if (t === 'look1') kx = 3;
    if (t === 'dizzy0') { hi = 2; kx = 1; }
    if (t === 'dizzy1') { hi = 5; kx = 3; }
    if (t === 'jump1') hi = 3;
    if (t === 'wave1') hi = 2;
    if (t === 'shock') { ch = 'H'; hiCh = 'X'; ky = 0; }
    if (t.startsWith('sleep')) { ch = 'g'; hiCh = 'g'; kx = 3; ky = oy - 3; }
    g.pts(KNOT, ox + kx, ky, ch);
    g.pts([KNOT_HI[hi]], ox + kx, ky, hiCh);
    for (let y = ky + 3; y < oy; y++) g.set(ox + 4, y, 'D');
    if (t === 'shock') g.pts([[1, 1], [0, 0], [7, 1], [8, 0]], ox, 0, 'Y');
  },
};

// ------------------------------------------------------------------ grok
// A charcoal bot with a black visor, one white eye and a white diagonal slash
// across the visor; a little bent antenna with a red tip light. 13×14.
const GROK = {
  L: '#55555f', // highlight, arms
  B: '#2b2b33', // shell
  K: '#16161a', // shade
  V: '#060608', // visor
  W: '#f5f5f5', // slash + eye
  S: '#6a6a74', // dimmed slash / lids
  R: '#ff5a5a', // antenna light
  r: '#5a2026', // antenna light off
  Y: '#ffe259', // alarm
};

const SLASH: Pt[] = [[7, 1], [6, 2], [5, 3], [4, 4], [3, 5], [2, 6]];
const GROK_EYE: Pt[] = [[2, 2], [2, 3]];

const grokArt: AgentArt = {
  w: 13, h: 14, bx: 2, by: 4,
  body: [
    '.LLBBBBB.',
    'LBBBBBBBK',
    'BVVVVVVVK',
    'BVVVVVVVK',
    'BVVVVVVVK',
    'BVVVVVVVK',
    'BBBBBBBBK',
    '.KKKKKKK.',
  ],
  back: [
    '.LLBBBBB.',
    'LBBBBBBBK',
    'BBBBBBBBK',
    'BBKKKKBBK',
    'BBBBBBBBK',
    'BBKKKKBBK',
    'BBBBBBBBK',
    '.KKKKKKK.',
  ],
  legs: {
    std: ['....B...B....', '....BL..BL...'],
    A: ['....B...BL...', '....BL.......'],
    B: ['...BL...B....', '........BL...'],
    tuck: ['...BL...BL...', '.............'],
    splay: ['....B...B....', '...BL....BL..'],
    none: [],
  },
  armCh: 'L',
  arms: {
    rest: [[-1, 3], [-1, 4, 'K'], [9, 3], [9, 4, 'K']],
    workA: [[-1, 3], [-1, 4, 'K'], [9, 4], [10, 4], [10, 5, 'K']],
    workB: [[-1, 4], [-1, 5, 'K'], [9, 3], [10, 3], [10, 4, 'K']],
    waveA: [[-1, 3], [-1, 4, 'K'], [9, 3], [9, 2], [10, 1], [10, 0, 'W']],
    waveB: [[-1, 3], [-1, 4, 'K'], [9, 3], [9, 2], [9, 1], [9, 0, 'W']],
    up: [[-1, 3], [-1, 2], [-1, 1], [-1, 0, 'W'], [9, 3], [9, 2], [9, 1], [9, 0, 'W']],
    droop: [[-1, 4], [-1, 5, 'K'], [9, 4], [9, 5, 'K']],
    droop2: [[-1, 5, 'K'], [9, 4], [9, 5, 'K']],
  },
  eyeCh: 'W',
  eyes: {
    open: GROK_EYE,
    blink: [[1, 3, 'S'], [2, 3, 'S']],
    closed: [[1, 4, 'S'], [2, 4, 'S']],
    happy: [[1, 3], [2, 2], [3, 3]],
    wide: [[1, 2], [2, 2], [1, 3], [2, 3]],
    left: shift(GROK_EYE, -1),
    right: shift(GROK_EYE, 1),
    down: [[2, 3], [2, 4]],
    dizzyA: [[1, 2], [3, 2], [2, 3], [1, 4], [3, 4]],
    dizzyB: [[2, 2], [1, 3], [3, 3], [2, 4]],
  },
  sleepDy: 2,
  paint(g: Grid, p: Pose, ox: number, oy: number) {
    const t = p.tag ?? '';
    // the slash: dims asleep, kinks when dizzy
    let slash: readonly Pt[] = SLASH, sc = 'W';
    if (t.startsWith('sleep')) sc = 'S';
    if (t === 'dizzy0') slash = [[7, 1], [6, 2], [5, 3], [5, 4], [4, 5], [3, 6]];
    if (t === 'dizzy1') slash = [[6, 1], [5, 2], [5, 3], [4, 4], [3, 5], [2, 6]];
    if (!p.back) g.pts(slash, ox, oy, sc);
    // antenna, bent like the slash; the tip light blinks while working
    let tip = 'R', ax = 0;
    if (t === 'work1' || t === 'blink' || t.startsWith('sleep')) tip = 'r';
    if (t === 'walk0' || t === 'walk2') ax = -1;
    if (t === 'shock') tip = 'Y';
    if (t.startsWith('sleep')) { g.pts([[6, -1], [7, -1]], ox, oy, 'L'); g.set(ox + 8, oy - 1, tip); return; }
    g.pts([[6, -1], [7 + ax, -2]], ox, oy, 'L');
    g.set(ox + 8 + ax, oy - 3, tip);
    if (t === 'shock') g.pts([[10, -3], [10, -1], [7, -3]], ox, oy, 'Y');
  },
};

export const GPT_DEF: SpriteDef = { palette: GPT, anims: buildAgent(gptArt) };
export const GROK_DEF: SpriteDef = { palette: GROK, anims: buildAgent(grokArt) };
