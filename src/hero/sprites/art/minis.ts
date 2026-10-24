// The OpenCode sub-agents: a tiny GLM and a tiny DeepSeek, drawn at 1× like
// Claude's own `mini`. Same rig + pose table as ./agents.ts.
import type { SpriteDef } from '../../types';
import { buildAgent, type AgentArt, type Pose } from './rig';
import type { Grid, Pt } from './util';

// ------------------------------------------------------------------ glmMini
// A pocket GLM: navy box, cyan-eyed visor, a springy "Z" bolt on a stalk. 9×11.
const GLM = {
  H: '#9fb0ff', L: '#5b6cf0', I: '#3341c4', N: '#1c2378', V: '#070b26',
  C: '#5ff3ff', Z: '#8fdcff', W: '#ffffff', S: '#47508c', Y: '#ffe259',
};
const Z4: Pt[] = [[0, 0], [1, 0], [2, 0], [3, 0], [2, 1], [1, 2], [0, 3], [1, 3], [2, 3], [3, 3]];

const glmMiniArt: AgentArt = {
  w: 9, h: 11, bx: 1, by: 5,
  body: [
    '.HHLLL.',
    'LVVVVVN',
    'IVVVVVN',
    '.NNNNN.',
  ],
  back: [
    '.HHLLL.',
    'LIIIIIN',
    'IINNIIN',
    '.NNNNN.',
  ],
  // three rows so the top one shows (and joins the body) on the walk bob
  legs: {
    std: ['..N...N..', '..N...N..', '..NN..NN.'],
    A: ['..N...N..', '..N...NN.', '..NN.....'],
    B: ['..N...N..', '.NN...N..', '......NN.'],
    tuck: ['..N...N..', '.NN...NN.', '.........'],
    splay: ['..N...N..', '..N...N..', '.NN....NN'],
    none: [],
  },
  armCh: 'L',
  arms: {
    rest: [[-1, 2], [7, 2]],
    workA: [[-1, 2], [7, 3]],
    workB: [[-1, 3], [7, 2]],
    waveA: [[-1, 2], [7, 2], [7, 1], [7, 0], [7, -1, 'H']],
    waveB: [[-1, 2], [7, 2], [7, 1], [6, -1, 'H']],
    up: [[-1, 1], [-1, 0, 'H'], [7, 1], [7, 0, 'H']],
    droop: [[-1, 3], [7, 3]],
  },
  eyeCh: 'C',
  eyes: {
    open: [[2, 1], [2, 2], [4, 1], [4, 2]],
    blink: [[2, 2], [4, 2]],
    closed: [[1, 2, 'S'], [2, 2, 'S'], [4, 2, 'S'], [5, 2, 'S']],
    happy: [[1, 2], [2, 1], [3, 2], [4, 1], [5, 2]],
    wide: [[1, 1], [2, 1], [1, 2], [2, 2], [4, 1], [5, 1], [4, 2], [5, 2]],
    left: [[1, 1], [1, 2], [3, 1], [3, 2]],
    right: [[3, 1], [3, 2], [5, 1], [5, 2]],
    down: [[3, 2], [5, 2]],
    dizzyA: [[1, 1], [2, 2], [4, 1], [5, 2]],
    dizzyB: [[2, 1], [1, 2], [5, 1], [4, 2]],
  },
  sleepDy: 2,
  paint(g: Grid, p: Pose, ox: number, oy: number) {
    // The bolt stays at the top of the canvas while the body bobs, so its stalk
    // stretches and squashes like a spring. It lags while walking, flashes when
    // startled, and flops onto the head asleep.
    const t = p.tag ?? '';
    let zx = 1, zy = 0, ch = 'Z';
    if (t === 'walk0' || t === 'walk2' || t === 'look0' || t === 'dizzy0') zx = 0;
    if (t === 'look1' || t === 'dizzy1') zx = 2;
    if (t === 'jump1' || t === 'wave1' || t === 'work1') ch = 'W';
    if (t === 'shock') ch = 'Y';
    if (t.startsWith('sleep')) { ch = 'S'; zx = 2; zy = oy - 4; }
    g.pts(Z4, ox + zx, zy, ch);
    for (let y = zy + 4; y < oy; y++) g.set(ox + 3, y, 'N');
  },
};

// ------------------------------------------------------------------ deepseekMini
// A whale calf: round blue head, white belly, a fluke curled up behind, two
// stubby flippers and a spout. 11×8.
const DEEP = {
  B: '#4d6bfe', L: '#8ea2ff', D: '#2a3cb4', W: '#c9d6ff', K: '#0a1030',
  P: '#ff8fc0', S: '#bff8ff', T: '#ffffff',
};

const deepMiniArt: AgentArt = {
  w: 11, h: 8, bx: 0, by: 1,
  body: [
    'D.D........',
    '.D....LLL..',
    '.DD.LBBBBB.',
    '..DBBBBBBBB',
    '...DBBWWWWB',
    '....DDDDDD.',
  ],
  back: [
    'D.D........',
    '.D....LLL..',
    '.DD.LBBBBB.',
    '..DBBBBBBBB',
    '...DBBBBBBD',
    '....DDDDDD.',
  ],
  legs: {
    std: ['.....D..D..', '....DD.DD..'],
    A: ['.....D..D..', '.......DD..'],
    B: ['.....D..D..', '....DD.....'],
    tuck: ['....DD.DD..', '...........'],
    splay: ['.....D..D..', '...DD...DD.'],
    none: [],
  },
  armCh: 'D',
  arms: {
    rest: [[5, 4]],
    workA: [[5, 4], [6, 4]],
    workB: [[5, 3], [6, 3]],
    waveA: [[5, 3], [5, 2], [4, 1, 'L']],
    waveB: [[5, 3], [4, 2], [3, 1, 'L']],
    up: [[5, 3], [5, 2], [5, 1, 'L']],
    droop: [[5, 4], [4, 5]],
  },
  eyeCh: 'K',
  eyes: {
    open: [[8, 3], [9, 4, 'P']],
    blink: [[7, 3, 'D'], [8, 3, 'D'], [9, 4, 'P']],
    closed: [[7, 3], [8, 3], [9, 4, 'P']],
    happy: [[7, 3], [8, 2], [9, 3], [9, 4, 'P']],
    wide: [[8, 2], [9, 2], [8, 3], [9, 3], [10, 4, 'P']],
    left: [[7, 3], [9, 4, 'P']],
    right: [[9, 3], [10, 4, 'P']],
    down: [[8, 4], [9, 4, 'P']],
    dizzyA: [[7, 2], [9, 2], [8, 3], [7, 4], [9, 4]],
    dizzyB: [[8, 2], [7, 3], [9, 3], [8, 4]],
  },
  sleepDy: 1,
  paint(g: Grid, p: Pose, ox: number, oy: number) {
    const t = p.tag ?? '';
    // a spout from the blowhole when happy / startled / airborne
    if (t === 'wave1' || t === 'jump1') g.pts([[7, 0], [6, -1, 'T'], [8, -1, 'T']], ox, oy, 'S');
    else if (t === 'shock') g.pts([[7, 0], [7, -1, 'T']], ox, oy, 'S');
    else if (t === 'breath' || t === 'work1') g.set(ox + 7, oy, 'S');
    // the fluke flicks while walking
    if (t === 'walk1' || t === 'walk3' || t === 'back1' || t === 'back3') { g.set(ox, oy, '.'); g.set(ox + 1, oy, 'D'); }
  },
};

export const GLM_MINI: SpriteDef = { palette: GLM, anims: buildAgent(glmMiniArt) };
export const DEEPSEEK_MINI: SpriteDef = { palette: DEEP, anims: buildAgent(deepMiniArt) };
