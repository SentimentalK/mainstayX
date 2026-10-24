// Agent characters: homages to AI CLIs / models (colours + silhouettes only,
// no logos). All face RIGHT, bottom row = feet. Built from parts by rig.ts.
import type { SpriteDef } from '../../types';
import { buildAgent, type AgentArt, type Pose } from './rig';
import type { Grid, Pt } from './util';

// ------------------------------------------------------------------ clawd
// Orange crab-like Claude mascot. 13×9 (original 13×8 + 1 row headroom for
// raised arms / the walk bob).
const CLAUDE = { O: '#d97757', H: '#f0a07c', D: '#a8532f', K: '#1a1210' };

const clawdArt: AgentArt = {
  w: 13, h: 9, bx: 2, by: 1,
  body: [
    'HHOOOOOOO',
    'HOOOOOOOO',
    'OOOOOOOOO',
    'OOOOOOOOO',
    'OOOOOOOOO',
    'ODDDDDDDD',
  ],
  back: [
    'OOOOOOOOO',
    'OOOOOOOOO',
    'OOOOOOOOD',
    'OOOOOOOOD',
    'DOOOOOOOD',
    'DDDDDDDDD',
  ],
  legs: {
    std: ['..D.D...D.D..', '..D.D...D.D..', '..D.D...D.D..'],
    A: ['..D.D...D.D..', '..D..D..D..D.', '..D.....D....'],
    B: ['..D.D...D.D..', '...DD....DD..', '....D.....D..'],
    tuck: ['..D.D...D.D..', '.D.........D.', '.............'],
    splay: ['..D.D...D.D..', '.D..D...D..D.', '.D..D...D..D.'],
    none: [],
  },
  armCh: 'O',
  arms: {
    rest: [[-2, 3], [-1, 3], [-2, 4, 'D'], [-1, 4], [9, 3], [10, 3], [9, 4], [10, 4, 'D']],
    workA: [[-2, 3], [-1, 3], [-2, 4, 'D'], [-1, 4], [9, 4], [10, 4], [9, 5], [10, 5, 'D']],
    workB: [[-2, 4], [-1, 4], [-2, 5, 'D'], [-1, 5], [9, 3], [10, 3], [9, 4], [10, 4, 'D']],
    waveA: [[-2, 3], [-1, 3], [-2, 4, 'D'], [-1, 4], [9, 3], [9, 4], [10, 3], [10, 2], [10, 1], [10, 0], [10, -1]],
    waveB: [[-2, 3], [-1, 3], [-2, 4, 'D'], [-1, 4], [9, 3], [9, 4], [10, 3], [10, 2], [9, 1], [9, 0]],
    up: [[-1, 3], [-2, 3], [-2, 2], [-2, 1], [9, 3], [10, 3], [10, 2], [10, 1]],
    droop: [[-2, 4], [-1, 4], [-2, 5, 'D'], [-1, 5], [9, 4], [10, 4], [9, 5], [10, 5, 'D']],
    droop2: [[-2, 3], [-1, 3], [-2, 4, 'D'], [-1, 4], [9, 4], [10, 4], [9, 5], [10, 5, 'D']],
  },
  eyeCh: 'K',
  eyes: {
    open: [[2, 1], [2, 2], [6, 1], [6, 2]],
    happy: [[2, 1], [2, 2], [6, 1], [6, 2]],
    blink: [[2, 2], [6, 2]],
    closed: [[1, 2], [2, 2], [6, 2], [7, 2]],
    wide: [[1, 1], [2, 1], [1, 2], [2, 2], [6, 1], [7, 1], [6, 2], [7, 2]],
    left: [[1, 1], [1, 2], [5, 1], [5, 2]],
    right: [[3, 1], [3, 2], [7, 1], [7, 2]],
    down: [[3, 2], [3, 3], [7, 2], [7, 3]],
    dizzyA: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3], [5, 1], [7, 1], [6, 2], [5, 3], [7, 3]],
    dizzyB: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3], [5, 1], [7, 1], [6, 2], [5, 3], [7, 3]],
  },
  sleepDy: 2,
};

// ------------------------------------------------------------------ mini
// Small Clawd sub-agent, drawn at scale 1. 9×6.
const miniArt: AgentArt = {
  w: 9, h: 6, bx: 1, by: 1,
  body: [
    'HOOOOOO',
    'OOOOOOO',
    'OOOOOOO',
    'DDDDDDD',
  ],
  back: [
    'OOOOOOO',
    'OOOOOOO',
    'OOOOOOD',
    'DDDDDDD',
  ],
  legs: {
    std: ['.D.D.D.D.', '.D.D.D.D.'],
    A: ['.........', '.D...D...'],
    B: ['.........', '...D...D.'],
    tuck: ['.D.D.D.D.', '.........'],
    splay: ['.D.D.D.D.', 'D..D.D..D'],
    none: [],
  },
  armCh: 'O',
  arms: {
    rest: [[-1, 2], [7, 2]],
    breath: [[-1, 1], [7, 1]],
    workA: [[-1, 2], [7, 3]],
    workB: [[-1, 3], [7, 2]],
    waveA: [[-1, 2], [7, 2], [7, 1], [7, 0], [7, -1]],
    waveB: [[-1, 2], [7, 2], [7, 1], [6, -1]],
    up: [[-1, 1], [-1, 0], [7, 1], [7, 0]],
    droop: [[-1, 3], [7, 3]],
  },
  eyeCh: 'K',
  eyes: {
    open: [[1, 1], [5, 1]],
    blink: [[1, 1, 'D'], [5, 1, 'D']],
    closed: [[1, 2], [2, 2], [4, 2], [5, 2]],
    wide: [[1, 0], [1, 1], [5, 0], [5, 1]],
    left: [[0, 1], [4, 1]],
    right: [[2, 1], [6, 1]],
    down: [[2, 2], [6, 2]],
    dizzyA: [[1, 0], [5, 1]],
    dizzyB: [[1, 1], [5, 0]],
  },
  sleepDy: 1,
  poses: {
    idle: { fps: 2.5, poses: [{}, { arms: 'breath', tag: 'breath' }] },
  },
};
miniArt.eyes.happy = miniArt.eyes.open;

// ------------------------------------------------------------------ gemini
// Blue blob crowned with a four-point sparkle. 9×11.
const GEM = { A: '#9ab8ff', W: '#eef3ff', V: '#b79bff', B: '#5b7cfa', L: '#86a2ff', C: '#3b52c4', K: '#0b1030', S: '#56648f' };
const STAR_PLUS = ['....W....', '...AAA...', '.AAAWAAA.', '...AVA...', '....V....'];
const STAR_TWINKLE = ['....W....', '...AWA...', '.WAWWWAW.', '...AWA...', '....V....'];
const STAR_X = ['.A.....A.', '..A...A..', '...AWA...', '..V...V..', '.V.....V.'];
const STAR_DIM = ['.........', '....S....', '...SSS...', '....S....', '.........'];

const geminiArt: AgentArt = {
  w: 9, h: 11, bx: 0, by: 1,
  body: [
    '.........', '.........', '.........', '.........', '.........',
    '..LBBBB..',
    '.LBBBBBB.',
    '.BBBBBBC.',
    '..CCCCC..',
  ],
  back: [
    '.........', '.........', '.........', '.........', '.........',
    '..BBBBB..',
    '.BBBBBBB.',
    '.BBBBBBC.',
    '..CCCCC..',
  ],
  legs: {
    std: ['..B...B..', '..B...B..'],
    A: ['.......B.', '..B......'],
    B: ['.B.......', '......B..'],
    tuck: ['.B.....B.', '.........'],
    splay: ['..B...B..', '.B.....B.'],
    none: [],
  },
  armCh: 'B',
  arms: {
    rest: [],
    workA: [[0, 7], [8, 6]],
    workB: [[0, 6], [8, 7]],
    waveA: [[0, 7], [8, 7], [8, 6], [8, 5], [8, 4]],
    waveB: [[0, 7], [8, 7], [8, 6], [8, 5], [7, 4]],
    up: [[0, 6], [0, 5], [8, 6], [8, 5]],
    droop: [[0, 8], [8, 8]],
  },
  eyeCh: 'K',
  eyes: {
    open: [[3, 6], [5, 6]],
    happy: [[3, 6], [5, 6], [4, 7]],
    blink: [[3, 6, 'C'], [5, 6, 'C']],
    closed: [[2, 7], [3, 7], [5, 7], [6, 7]],
    wide: [[3, 5], [3, 6], [5, 5], [5, 6]],
    left: [[2, 6], [4, 6]],
    right: [[4, 6], [6, 6]],
    down: [[4, 7], [6, 7]],
    dizzyA: [[3, 6], [5, 7]],
    dizzyB: [[3, 7], [5, 6]],
  },
  sleepDy: 1,
  poses: {
    idle: { fps: 2.5, poses: [{}, { tag: 'breath' }] },
  },
  paint(g: Grid, p: Pose, ox: number, oy: number) {
    const t = p.tag ?? '';
    let star = STAR_PLUS, sy = 0;
    if (t === 'breath') sy = 1;
    if (t === 'blink' || t === 'work1' || t === 'wave1' || t === 'jump1' || t === 'shock') star = STAR_TWINKLE;
    if (t.startsWith('dizzy')) star = t === 'dizzy0' ? STAR_X : STAR_PLUS;
    if (t.startsWith('sleep')) { star = STAR_DIM; sy = t === 'sleep1' ? 1 : 0; }
    if (t.startsWith('walk') && (t === 'walk1' || t === 'walk3')) sy = 1;
    if (p.back) star = STAR_PLUS;
    g.stamp(star, ox, oy + sy);
  },
};

// ------------------------------------------------------------------ codex
// A little terminal on a stand with a ">_" prompt for a face. 11×11.
const CODEX_PAL = { K: '#a0a6ad', H: '#d3d7dc', D: '#6b717a', W: '#0d1117', G: '#e8e8e8', C: '#3df5ff', S: '#4a5361', Y: '#ffe259', R: '#1d2430' };
const MONITOR = [
  '.HHHHHHH.',
  'HWWWWWWRK',
  'HWWWWWWWK',
  'HWWWWWWWK',
  'HWWWWWWWK',
  'KWWWWWWWD',
  '.DDDDDDD.',
];
const STAND = ['...KKK...', '..KKKKD..'];
const MONITOR_BACK = [
  '.HHHHHHH.',
  'HKKKKKKKD',
  'HKDDDDDKD',
  'HKKKKKKKD',
  'HKDDDDDKD',
  'KKKKKKKKD',
  '.DDDDDDD.',
];
const codexBody = [...MONITOR, ...STAND];
const codexSquash = ['.........', ...MONITOR, STAND[1]];
const codexBack = [...MONITOR_BACK, ...STAND];
const PROMPT: Pt[] = [[2, 2], [3, 3], [2, 4], [5, 4], [6, 4]];
const shiftPts = (l: readonly Pt[], dx: number, dy = 0): Pt[] => l.map(p => (p.length > 2 ? [p[0] + dx, p[1] + dy, (p as readonly [number, number, string])[2]] : [p[0] + dx, p[1] + dy]) as Pt);

const codexArt: AgentArt = {
  w: 11, h: 11, bx: 1, by: 1,
  body: codexBody,
  back: codexBack,
  bodyFor: p => (p.tag === 'breath' ? codexSquash : null),
  eyeDy: p => (p.tag === 'breath' ? 1 : 0),
  legs: {
    std: ['...K...K...', '...K...K...'],
    A: ['........K..', '...K.......'],
    B: ['..K........', '.......K...'],
    tuck: ['..K.....K..', '...........'],
    splay: ['...K...K...', '..K.....K..'],
    none: [],
  },
  armCh: 'K',
  arms: {
    rest: [],
    workA: [[2, 7], [1, 8], [6, 7], [7, 7]],
    workB: [[2, 7], [1, 7], [6, 7], [7, 8]],
    waveA: [[2, 7], [1, 8], [6, 7], [7, 7], [8, 6], [9, 5], [9, 4]],
    waveB: [[2, 7], [1, 8], [6, 7], [7, 7], [8, 7], [9, 6], [9, 5]],
    up: [[2, 7], [1, 7], [0, 6], [-1, 5], [6, 7], [7, 7], [8, 6], [9, 5]],
    droop: [[2, 7], [1, 8], [6, 7], [7, 8]],
  },
  eyeCh: 'G',
  eyes: {
    open: PROMPT,
    blink: [[2, 2], [3, 3], [2, 4]],
    closed: [[2, 4, 'S'], [3, 4, 'S'], [5, 4, 'S'], [6, 4, 'S']],
    wide: [[4, 1, 'Y'], [4, 2, 'Y'], [4, 3, 'Y'], [4, 5, 'Y']],
    left: shiftPts(PROMPT, -1),
    right: shiftPts(PROMPT, 1),
    happy: [[1, 3], [2, 2], [3, 3], [5, 3], [6, 2], [7, 3]],
    down: [],
    dizzyA: [[1, 2], [3, 2], [2, 3], [1, 4], [3, 4], [5, 2], [7, 2], [6, 3], [5, 4], [7, 4]],
    dizzyB: [[2, 2], [1, 3], [2, 3], [3, 3], [2, 4], [6, 2], [5, 3], [6, 3], [7, 3], [6, 4]],
  },
  sleepDy: 1,
  poses: {
    idle: { fps: 2.5, poses: [{}, { tag: 'breath' }] },
  },
  paint(g: Grid, p: Pose, ox: number, oy: number) {
    // Scrolling code while working.
    if (p.tag === 'work0') g.pts([[2, 1], [3, 1], [4, 1], [3, 3, 'C'], [4, 3, 'C'], [5, 3, 'C'], [6, 3, 'C'], [2, 5], [3, 5], [5, 5]], ox, oy, 'G');
    if (p.tag === 'work1') g.pts([[3, 1, 'C'], [4, 1, 'C'], [5, 1, 'C'], [6, 1, 'C'], [2, 3], [3, 3], [5, 3], [2, 5], [3, 5], [4, 5], [5, 5]], ox, oy, 'G');
    if (p.tag?.startsWith('sleep')) {
      // Dim screen: swap the black for a slightly lighter "standby" tone.
      for (let y = 1; y <= 5; y++) for (let x = 1; x <= 7; x++) if (g.get(ox + x, oy + y) === 'W') g.set(ox + x, oy + y, 'R');
    }
  },
};

// ------------------------------------------------------------------ qwen
// Purple bean with an antenna. 9×9.
const QWEN = { A: '#c4b5fd', T: '#f3eeff', P: '#7c5cff', L: '#a28cff', D: '#5a3ed6', K: '#160d3a', Y: '#ffe259' };
const qwenArt: AgentArt = {
  w: 9, h: 9, bx: 0, by: 1,
  body: [
    '.........',
    '....A....',
    '..LPPPP..',
    '.LPPPPPP.',
    '.PPPPPPD.',
    '.PPPPPPD.',
    '..DDDDD..',
  ],
  back: [
    '.........',
    '....A....',
    '..PPPPP..',
    '.PPPPPPD.',
    '.PPPPPPD.',
    '.PPPPPDD.',
    '..DDDDD..',
  ],
  legs: {
    std: ['.P..P..P.', '.PP.P.PP.'],
    A: ['.......P.', '.PP.P....'],
    B: ['.P.......', '....P.PP.'],
    tuck: ['.PP.P.PP.', '.........'],
    splay: ['.P..P..P.', 'PP..P..PP'],
    none: [],
  },
  armCh: 'P',
  arms: {
    rest: [],
    workA: [[0, 5], [8, 4]],
    workB: [[0, 4], [8, 5]],
    waveA: [[0, 5], [8, 5], [8, 4], [8, 3], [8, 2]],
    waveB: [[0, 5], [8, 5], [8, 4], [8, 3], [7, 2]],
    up: [[0, 4], [0, 3], [8, 4], [8, 3]],
    droop: [[0, 6], [8, 6]],
  },
  eyeCh: 'K',
  eyes: {
    open: [[2, 4], [6, 4]],
    happy: [[2, 4], [6, 4], [4, 5]],
    blink: [[2, 4, 'D'], [6, 4, 'D']],
    closed: [[1, 4], [2, 4], [6, 4], [7, 4, 'K']],
    wide: [[2, 3], [2, 4], [6, 3], [6, 4]],
    left: [[1, 4], [5, 4]],
    right: [[3, 4], [7, 4]],
    down: [[3, 5], [7, 5]],
    dizzyA: [[1, 3], [2, 4], [6, 3], [7, 4]],
    dizzyB: [[2, 3], [1, 4], [7, 3], [6, 4]],
  },
  sleepDy: 1,
  paint(g: Grid, p: Pose, ox: number, oy: number) {
    // Antenna tip wobbles: lags behind when walking, droops when asleep.
    const t = p.tag ?? '';
    let x = 4, y = 0, ch = 'T';
    if (t.startsWith('walk')) x = t === 'walk1' || t === 'walk3' ? 4 : 3;
    if (t === 'breath') x = 5;
    if (t === 'look0') x = 3;
    if (t === 'look1') x = 5;
    if (t === 'dizzy0') x = 3;
    if (t === 'dizzy1') x = 5;
    if (t === 'shock' || t === 'jump1') ch = 'Y';
    if (t.startsWith('sleep')) { x = 5; y = 1; ch = 'A'; }
    if (t.startsWith('back')) x = 4;
    g.set(ox + x, oy + y, ch);
  },
};

// ------------------------------------------------------------------ kimi
// Pale moon-ghost with a wavy hem. 11×8 (original 9×7 + room for arms).
const KIMI = { C: '#e6edf3', L: '#ffffff', S: '#9aa8b8', K: '#111111', B: '#7fb2ff' };
const kimiArt: AgentArt = {
  w: 11, h: 8, bx: 1, by: 1,
  body: [
    '..LCCCC..',
    '.LCCCCCC.',
    'CCCCCCCCS',
    'CCCCCCCCS',
    'CCCCCCCCS',
    'CCCCCCCSS',
  ],
  back: [
    '..CCCCC..',
    '.CCCCCCS.',
    'CCCCCCCSS',
    'CCCCCCCCS',
    'SCCCCCCCS',
    'SCCCCCCSS',
  ],
  legs: {
    std: ['...........', '.C.CC.CC.S.'],
    A: ['...........', '.CC.CC.CS..'],
    B: ['...........', '..CC.CC.SS.'],
    tuck: ['.C.CC.CC.S.', '...........'],
    splay: ['.CCCCCCCCS.', 'C..C...C..S'],
    none: [],
  },
  armCh: 'C',
  arms: {
    rest: [],
    workA: [[-1, 4], [9, 3]],
    workB: [[-1, 3], [9, 4]],
    waveA: [[-1, 4], [9, 3], [9, 2], [9, 1], [9, 0]],
    waveB: [[-1, 4], [9, 3], [9, 2], [8, 1], [8, 0]],
    up: [[-1, 3], [-1, 2], [9, 3], [9, 2]],
    droop: [[-1, 5], [9, 5]],
  },
  eyeCh: 'K',
  eyes: {
    open: [[2, 2], [6, 2]],
    happy: [[2, 2], [6, 2], [1, 3, 'B'], [7, 3, 'B']],
    blink: [[2, 2, 'S'], [6, 2, 'S']],
    closed: [[1, 3], [2, 3], [6, 3], [7, 3]],
    wide: [[2, 1], [2, 2], [6, 1], [6, 2]],
    left: [[1, 2], [5, 2]],
    right: [[3, 2], [7, 2]],
    down: [[3, 3], [7, 3]],
    dizzyA: [[1, 1], [2, 2], [6, 1], [7, 2]],
    dizzyB: [[2, 1], [1, 2], [7, 1], [6, 2]],
  },
  sleepDy: 1,
  poses: {
    idle: { fps: 2.5, poses: [{}, { legs: 'A', tag: 'breath' }] },
  },
};

export const CLAWD: SpriteDef = { palette: CLAUDE, anims: buildAgent(clawdArt) };
export const MINI: SpriteDef = { palette: CLAUDE, anims: buildAgent(miniArt) };
export const GEMINI: SpriteDef = { palette: GEM, anims: buildAgent(geminiArt) };
export const CODEX: SpriteDef = { palette: CODEX_PAL, anims: buildAgent(codexArt) };
export const QWEN_DEF: SpriteDef = { palette: QWEN, anims: buildAgent(qwenArt) };
export const KIMI_DEF: SpriteDef = { palette: KIMI, anims: buildAgent(kimiArt) };
