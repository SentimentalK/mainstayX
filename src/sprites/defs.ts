// Sprite pixel matrices. PLACEHOLDER — the sprites module owner replaces this
// with the full art set (see docs/PLAN.md §Sprites). Keep the export shape.
import type { SpriteDef, SpriteId } from '../types';

const CLAUDE = { O: '#d97757', K: '#1a1210' };
const clawd = [
  '..OOOOOOOOO..',
  '..OOKOOOKOO..',
  '..OOKOOOKOO..',
  'OOOOOOOOOOOOO',
  'OOOOOOOOOOOOO',
  '..OOOOOOOOO..',
  '..O.O...O.O..',
  '..O.O...O.O..',
];
const wave = [
  '............O',
  '..OOOOOOOOO.O',
  '..OOKOOOKOO.O',
  '..OOKOOOKOOOO',
  'OOOOOOOOOOOO.',
  '..OOOOOOOOO..',
  '..O.O...O.O..',
  '..O.O...O.O..',
];

export const SPRITES: Record<SpriteId, SpriteDef> = {
  clawd: { palette: CLAUDE, anims: { idle: { frames: [clawd], fps: 2 }, wave: { frames: [wave, clawd], fps: 4 } } },
  mini: { palette: CLAUDE, anims: { idle: { frames: [clawd], fps: 2 } } },
  orca: { palette: { K: '#1b2030', W: '#f2f4f8', G: '#5b6378' }, anims: { swim: { frames: [[
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
  ]], fps: 4 } } },
  gemini: { palette: { A: '#9ab8ff', B: '#5b7cfa', K: '#0b1030' }, anims: { idle: { frames: [[
    '....A....', '...AAA...', '.AAAAAAA.', '...AAA...', '....A....',
    '..BBBBB..', '.BBKBKBB.', '.BBBBBBB.', '..BBBBB..', '..B...B..',
  ]], fps: 2 } } },
  codex: { palette: { K: '#a0a6ad', W: '#0d1117', G: '#e8e8e8' }, anims: { idle: { frames: [[
    '.KKKKKKK.', 'KWWWWWWWK', 'KWGWWWWWK', 'KWWGWWWWK', 'KWGWWGGWK',
    'KWWWWWWWK', '.KKKKKKK.', '...KKK...', '..KKKKK..', '..K...K..',
  ]], fps: 2 } } },
  qwen: { palette: { A: '#c4b5fd', P: '#7c5cff', K: '#160d3a' }, anims: { idle: { frames: [[
    '....A....', '....A....', '..PPPPP..', '.PPPPPPP.', '.PKPPPKP.', '.PPPPPPP.', '..PPPPP..', '.PP.P.PP.',
  ]], fps: 2 } } },
  kimi: { palette: { C: '#e6edf3', K: '#111111' }, anims: { idle: { frames: [[
    '..CCCCC..', '.CCCCCCC.', 'CCKCCCKCC', 'CCCCCCCCC', 'CCCCCCCCC', 'CCCCCCCCC', 'C.CC.CC.C',
  ]], fps: 2 } } },
  packet: { palette: { A: '#ff4fd8', B: '#3df5ff', W: '#ffffff' }, anims: {
    task: { frames: [['AAA', 'AWA', 'AAA']], fps: 1 },
    result: { frames: [['BBB', 'BWB', 'BBB']], fps: 1 },
  } },
  icon: { palette: { W: '#ffffff' }, anims: { q: { frames: [['WWW', '..W', '.W.', '...', '.W.']], fps: 1 } } },
  fx: { palette: { W: '#ffffff' }, anims: { poof: { frames: [['.W.', 'WWW', '.W.']], fps: 8 } } },
};
