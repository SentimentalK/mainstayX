// The two later arrivals: GLM (a navy visor-bot with a "Z" bolt antenna) and
// DeepSeek (a little blue whale, Orca's cousin). Homages only: colours and
// motifs, no logo artwork. Same rig + pose table as ./agents.ts.
import type { SpriteDef } from '../../types';
import { buildAgent, type AgentArt, type Pose } from './rig';
import type { Grid, Pt } from './util';

// ------------------------------------------------------------------ glm
// Boxy navy helmet with a cyan visor, little side bolts and a "Z" antenna
// on a stalk. 12×14.
const GLM = {
  H: '#9fb0ff', // top highlight
  L: '#5b6cf0', // light indigo
  I: '#3341c4', // body indigo
  N: '#1c2378', // dark navy (shade, legs)
  V: '#070b26', // visor glass
  C: '#5ff3ff', // visor eyes
  Z: '#8fdcff', // the Z bolt
  W: '#ffffff', // bolt flash
  S: '#47508c', // dimmed bolt (asleep)
  Y: '#ffe259', // alarm
};

const Z_BOLT: Pt[] = [[0, 0], [1, 0], [2, 0], [3, 0], [2, 1], [1, 2], [0, 3], [1, 3], [2, 3], [3, 3]];

const glmArt: AgentArt = {
  w: 12, h: 14, bx: 1, by: 6,
  body: [
    '.HHLLLLLL.',
    'HLIIIIIIIN',
    'LVVVVVVVVN',
    'IVVVVVVVVN',
    'IIIIIIIIIN',
    '.NNNNNNNN.',
  ],
  back: [
    '.HHLLLLLL.',
    'LIIIIIIIIN',
    'IIINNNNIIN',
    'IIIIIIIIIN',
    'IIIIIIIIIN',
    '.NNNNNNNN.',
  ],
  legs: {
    std: ['...N....N...', '...NN...NN..'],
    A: ['...N....N...', '........NN..'],
    B: ['...N....N...', '...NN.......'],
    tuck: ['..NN....NN..', '............'],
    splay: ['...N....N...', '..NN....NN..'],
    none: [],
  },
  armCh: 'L',
  arms: {
    rest: [[-1, 3], [-1, 4, 'N'], [10, 3], [10, 4, 'N']],
    workA: [[-1, 3], [-1, 4, 'N'], [10, 4], [10, 5, 'N']],
    workB: [[-1, 4], [-1, 5, 'N'], [10, 3], [10, 4, 'N']],
    waveA: [[-1, 3], [-1, 4, 'N'], [10, 3], [10, 2], [10, 1], [10, 0], [10, -1, 'H']],
    waveB: [[-1, 3], [-1, 4, 'N'], [10, 3], [10, 2], [11, 1], [11, 0, 'H']],
    up: [[-1, 3], [-1, 2], [-1, 1], [-1, 0, 'H'], [10, 3], [10, 2], [10, 1], [10, 0, 'H']],
    droop: [[-1, 4], [-1, 5, 'N'], [10, 4], [10, 5, 'N']],
  },
  eyeCh: 'C',
  eyes: {
    open: [[2, 2], [3, 2], [2, 3], [3, 3], [6, 2], [7, 2], [6, 3], [7, 3]],
    happy: [[2, 3], [3, 2], [4, 3], [5, 3], [6, 2], [7, 3]],
    blink: [[2, 3], [3, 3], [6, 3], [7, 3]],
    closed: [[2, 3, 'S'], [3, 3, 'S'], [6, 3, 'S'], [7, 3, 'S']],
    wide: [[1, 2], [2, 2], [3, 2], [1, 3], [2, 3], [3, 3], [6, 2], [7, 2], [8, 2], [6, 3], [7, 3], [8, 3]],
    left: [[1, 2], [2, 2], [1, 3], [2, 3], [5, 2], [6, 2], [5, 3], [6, 3]],
    right: [[3, 2], [4, 2], [3, 3], [4, 3], [7, 2], [8, 2], [7, 3], [8, 3]],
    down: [[2, 3], [3, 3], [6, 3], [7, 3]],
    // a zig-zag scan line across the visor
    dizzyA: [[1, 3], [2, 2], [3, 3], [4, 2], [5, 3], [6, 2], [7, 3], [8, 2]],
    dizzyB: [[1, 2], [2, 3], [3, 2], [4, 3], [5, 2], [6, 3], [7, 2], [8, 3]],
  },
  sleepDy: 1,
  paint(g: Grid, p: Pose, ox: number, oy: number) {
    // Z bolt on a stalk: lags while walking, flashes when startled, dims asleep.
    const t = p.tag ?? '';
    let zx = 3, ch = 'Z', zy = 0;
    if (t === 'walk0' || t === 'walk2') zx = 2;
    if (t === 'look0' || t === 'dizzy0') zx = 2;
    if (t === 'look1' || t === 'dizzy1') zx = 4;
    if (t === 'shock' || t === 'jump1' || t === 'wave1') ch = 'W';
    if (t === 'shock') ch = 'Y';
    if (t.startsWith('sleep')) { ch = 'S'; zy = 1; zx = 4; }
    g.pts(Z_BOLT, ox + zx, oy - 5 + zy, ch);
    g.set(ox + 4, oy - 1, 'N');
  },
};

// ------------------------------------------------------------------ deepseek
// Small blue whale (Orca's little cousin): round head, white belly, tail curled
// up behind, two paddle flippers to waddle on and a tiny spout. 13×12.
const DEEP = {
  B: '#4d6bfe', // body blue
  L: '#8ea2ff', // back highlight
  D: '#2a3cb4', // shade / fluke / flippers
  W: '#c9d6ff', // throat + belly
  K: '#0a1030', // eye
  P: '#ff8fc0', // blush
  S: '#bff8ff', // spout
  T: '#ffffff', // spout tip
};

const deepArt: AgentArt = {
  w: 13, h: 12, bx: 0, by: 3,
  body: [
    'DD.DD........',
    '.DBBD...LLL..',
    '..DB..LBBBBB.',
    '..DBBBBBBBBBB',
    '..DBBBBBBBBBB',
    '...DBBBBWWWWB',
    '....DBWWWWWD.',
    '.....DDDDDD..',
  ],
  back: [
    'DD.DD........',
    '.DBBD...LLL..',
    '..DB..LBBBBB.',
    '..DBBBBBBBBBB',
    '..DBBBBBBBBBB',
    '...DBBBBBBBBD',
    '....DBBBBBBD.',
    '.....DDDDDD..',
  ],
  legs: {
    std: ['.....D...D...', '....DD..DD...'],
    A: ['.....D...D...', '........DD...'],
    B: ['.....D...D...', '....DD.......'],
    tuck: ['....DD..DD...', '.............'],
    splay: ['.....D...D...', '...DD....DD..'],
    none: [],
  },
  // a side flipper that paddles / waves
  armCh: 'D',
  arms: {
    rest: [[6, 5], [7, 6]],
    workA: [[6, 5], [7, 6], [8, 6]],
    workB: [[6, 4], [7, 5], [8, 5]],
    waveA: [[6, 5], [6, 4], [6, 3], [5, 2], [5, 1], [4, 0, 'L']],
    waveB: [[6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [7, 0, 'L']],
    up: [[6, 5], [6, 4], [5, 3], [5, 2], [5, 1, 'L']],
    droop: [[6, 6], [7, 6]],
  },
  eyeCh: 'K',
  eyes: {
    open: [[10, 3], [10, 4], [11, 5, 'P']],
    happy: [[9, 4], [10, 3], [11, 4], [11, 5, 'P']],
    blink: [[10, 4], [11, 5, 'P']],
    closed: [[9, 4], [10, 4], [11, 4]],
    wide: [[10, 2], [11, 2], [10, 3], [11, 3], [11, 5, 'P']],
    left: [[9, 3], [9, 4], [11, 5, 'P']],
    right: [[11, 3], [11, 4], [12, 5, 'P']],
    down: [[10, 4], [10, 5], [11, 5, 'P']],
    dizzyA: [[9, 3], [11, 3], [10, 4], [9, 5], [11, 5]],
    dizzyB: [[10, 3], [9, 4], [10, 4], [11, 4], [10, 5]],
  },
  sleepDy: 2,
  paint(g: Grid, p: Pose, ox: number, oy: number) {
    // Tiny spout from the blowhole when happy / startled / airborne.
    const t = p.tag ?? '';
    if (t === 'wave1' || t === 'jump1') g.pts([[9, 0], [9, -1], [8, -2, 'T'], [10, -2, 'T']], ox, oy, 'S');
    else if (t === 'shock') g.pts([[9, 0], [9, -1, 'T']], ox, oy, 'S');
    else if (t === 'breath') g.set(ox + 9, oy, 'S');
    // fluke flicks while walking
    if (t === 'walk1' || t === 'walk3') { g.set(ox, oy, '.'); g.set(ox, oy + 1, 'D'); g.set(ox + 4, oy, '.'); g.set(ox + 5, oy, 'D'); }
  },
};

export const GLM_DEF: SpriteDef = { palette: GLM, anims: buildAgent(glmArt) };
export const DEEPSEEK: SpriteDef = { palette: DEEP, anims: buildAgent(deepArt) };
