// Props: task/result packets, little icons (shown in bubbles on a dark
// #0d0221 box, so they are bright), and one-shot effects.
import type { SpriteDef } from '../../types';
import { anim } from './util';

// ------------------------------------------------------------------ packet
// 5×6 parcels. Task = neon pink with a ribbon; result = cyan with a tick.
export const PACKET: SpriteDef = {
  palette: {
    A: '#ff4fd8', D: '#a8268f', L: '#ffe6f7', W: '#ffffff', Y: '#ffe259',
    C: '#3df5ff', E: '#1b9fbf', K: '#0d0221',
  },
  anims: {
    task: anim([
      [
        '.L.L.',
        'AALAA',
        'LLLLL',
        'AALAA',
        'AALAD',
        'DDLDD',
      ],
      [
        '.W.W.',
        'WALAA',
        'LLWLL',
        'AALAA',
        'AALAD',
        'DDLDD',
      ],
    ], 4),
    result: anim([
      [
        '.....',
        'CCCCK',
        'CCCKC',
        'KCKCC',
        'CKCCE',
        'EEEEE',
      ],
      [
        '.....',
        'WCCCK',
        'CCCKC',
        'KCKCC',
        'CKCCE',
        'EEEEE',
      ],
    ], 4),
    open: anim([
      [
        '...LL',
        '.LL..',
        'AWYWA',
        'AALAA',
        'AALAD',
        'DDLDD',
      ],
    ], 1),
  },
};

// ------------------------------------------------------------------ icon
const IP = {
  W: '#ffffff', L: '#ffe6f7', Y: '#ffe259', O: '#ff9a3d', R: '#ff3d7f', P: '#ff4fd8',
  C: '#3df5ff', F: '#1f9fc4', G: '#5dff8f', H: '#1f9e5a', N: '#8a5232', M: '#c98a5e',
  T: '#c9cfe0', S: '#b9a6ff', V: '#7a4fb0', E: '#9ff0ff', B: '#4c8dff',
};

export const ICON: SpriteDef = {
  palette: IP,
  anims: {
    q: anim([[
      '.CCCC.',
      'CC..CC',
      '....CC',
      '...CC.',
      '..CC..',
      '......',
      '..CC..',
    ]], 1),
    bang: anim([[
      'YY',
      'YY',
      'YY',
      'YY',
      'OO',
      '..',
      'YY',
    ]], 1),
    zzz: anim([[
      '....EEE',
      '.....E.',
      '....EEE',
      'EEEE...',
      '..E....',
      '.E.....',
      'EEEE...',
    ]], 1),
    bulb: anim([
      [
        '..YYY..',
        '.YWYYY.',
        '.YYYYY.',
        '.YYYYO.',
        '..YYO..',
        '..TTT..',
        '...T...',
      ],
      [
        'Y.YYY.Y',
        '.YWWYY.',
        '.YWYYY.',
        'YYYYYOY',
        '..YYO..',
        '..TTT..',
        '...T...',
      ],
    ], 3),
    bug: anim([[
      '.H...H.',
      '..HHH..',
      'H.GHG.H',
      '.GGHGG.',
      'HGGHGGH',
      '.GGHGG.',
      'H.GGG.H',
    ]], 1),
    check: anim([[
      '......G',
      '.....GG',
      'G...GG.',
      'GG.GG..',
      '.GGGH..',
      '..GH...',
    ]], 1),
    heart: anim([
      [
        '.RR.RR.',
        'RWRRRRR',
        'RRRRRRR',
        '.RRRRR.',
        '..RRR..',
        '...R...',
      ],
      [
        '.......',
        '.RR.RR.',
        '.RWRRR.',
        '..RRR..',
        '...R...',
        '.......',
      ],
    ], 3),
    coffee: anim([
      [
        '..T.T..',
        '.T.T...',
        'MNNNM..',
        'MMMMMM.',
        'MMMMM.M',
        'MMMMMM.',
        '.MMM...',
      ],
      [
        '.T.T...',
        '..T.T..',
        'MNNNM..',
        'MMMMMM.',
        'MMMMM.M',
        'MMMMMM.',
        '.MMM...',
      ],
    ], 3),
    chart: anim([[
      '.....P.',
      '.....P.',
      '...C.P.',
      '...C.P.',
      '.Y.C.P.',
      '.Y.C.P.',
      'TTTTTTT',
    ]], 1),
    note: anim([[
      '..PPPPP',
      '..P...P',
      '..P...P',
      '..P...P',
      '.PP..PP',
      'PPP.PPP',
      'PP..PP.',
    ]], 1),
    fire: anim([
      [
        '...R...',
        '..RR.R.',
        '.RROR..',
        'RROORRR',
        'RROYORR',
        'ROYYYOR',
        '.RYYYR.',
      ],
      [
        '...R...',
        '.R.RR..',
        '..RORR.',
        'RRROORR',
        'RROYORR',
        'ROYYYOR',
        '.RYYYR.',
      ],
    ], 6),
    star: anim([[
      '...Y...',
      '..YWY..',
      'YYYYYYY',
      '.YYYYY.',
      '..YYY..',
      '.YY.YY.',
      '.Y...Y.',
    ]], 1),
    sweat: anim([[
      '..E..',
      '..E..',
      '.EEE.',
      'EWEEE',
      'EWEEF',
      'EEEEF',
      '.EFF.',
    ]], 1),
    key: anim([[
      '.YYY.',
      'Y...Y',
      'Y...Y',
      '.YOY.',
      '..Y..',
      '..YY.',
      '..YYY',
    ]], 1),
    ctx: anim([[
      'LLLLT.',
      'LLLLTT',
      'LSSSSL',
      'LLLLLL',
      'LSSSLL',
      'LLLLLL',
      'LSSSSL',
    ]], 1),
  },
};

// ------------------------------------------------------------------ fx
const FX = { W: '#ffffff', L: '#ffe6f7', P: '#ff9de6', Y: '#ffe259', O: '#ffb347', C: '#3df5ff', D: '#8a6fa8', M: '#c9b6d9' };

export const EFFECTS: SpriteDef = {
  palette: FX,
  anims: {
    // 11×9 cloud puff for sub-agent split / merge. Non-looping.
    poof: anim([
      [
        '...........',
        '...........',
        '...........',
        '....LWL....',
        '...LWWWL...',
        '...LWWWL...',
        '....LLL....',
        '...........',
        '...........',
      ],
      [
        '...........',
        '....LLL....',
        '..LLWWWLL..',
        '..LWWWWWL..',
        '.LWWWWWWWL.',
        '.LWWWWWWWL.',
        '..LWWWWWL..',
        '...LLLLL...',
        '...........',
      ],
      [
        '..LL...LL..',
        '.LWWL.LWWL.',
        'LWWWWLWWWWL',
        'LWWWWWWWWWL',
        '.LWWWWWWWL.',
        'LWWWWWWWWWL',
        'LWWWLWLWWWL',
        '.LLL.P.LLL.',
        '...........',
      ],
      [
        '.LL.....LL.',
        'LWWL...LWWL',
        'LWL.....LWL',
        '.L.......L.',
        '...........',
        '.P.......P.',
        'LWL.....LWL',
        'LWWL...LWWL',
        '.LL.....LL.',
      ],
      [
        'P.........P',
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
        'P.........P',
      ],
    ], 12, false),
    // 5×5 tiny typing spark.
    spark: anim([
      ['.....', '.....', '..Y..', '.....', '.....'],
      ['.....', '..Y..', '.YWY.', '..Y..', '.....'],
      ['Y...Y', '.....', '..O..', '.....', 'Y...Y'],
    ], 12),
    // 5×5 dizzy star (orbits a bumped head).
    star: anim([
      ['..Y..', '.YYY.', 'YYWYY', '.YYY.', '..Y..'],
      ['Y...Y', '.YYY.', '.YWY.', '.YYY.', 'Y...Y'],
    ], 6),
    // 7×7 twinkle.
    sparkle: anim([
      ['.......', '.......', '.......', '...C...', '.......', '.......', '.......'],
      ['.......', '.......', '...C...', '..CWC..', '...C...', '.......', '.......'],
      ['...C...', '...C...', '...W...', 'CCWWWCC', '...W...', '...C...', '...C...'],
    ], 8),
    // 9×4 foot dust puff. Non-looping.
    dust: anim([
      ['.........', '.........', '..M...M..', '.MMM.MMM.'],
      ['.........', '.M.....M.', 'MMM...MMM', 'MDM...MDM'],
      ['M.......M', '.........', 'D.......D', '.........'],
    ], 10, false),
    // 11×11 expanding ring.
    ring: anim([
      [
        '...........', '...........', '...........', '...........', '.....C.....',
        '....C.C....', '.....C.....', '...........', '...........', '...........', '...........',
      ],
      [
        '...........', '...........', '...........', '....CCC....', '...C...C...',
        '...C...C...', '...C...C...', '....CCC....', '...........', '...........', '...........',
      ],
      [
        '...........', '...CCCCC...', '..C.....C..', '.C.......C.', '.C.......C.',
        '.C.......C.', '.C.......C.', '.C.......C.', '..C.....C..', '...CCCCC...', '...........',
      ],
      [
        '...WWWWW...', '.WW.....WW.', '.W.......W.', 'W.........W', 'W.........W',
        'W.........W', 'W.........W', 'W.........W', '.W.......W.', '.WW.....WW.', '...WWWWW...',
      ],
    ], 10),
  },
};
