// Sprite pixel matrices for every character, prop, icon and effect.
// Art lives in ./art/*; this file only assembles the SPRITES table.
// Preview everything with ?scene=sheet.
import type { SpriteDef, SpriteId } from '../types';
import { CLAWD, CODEX, GEMINI, KIMI_DEF, MINI, QWEN_DEF } from './art/agents';
import { ORCA } from './art/orca';
import { EFFECTS, ICON, PACKET } from './art/props';
import { validate } from './art/util';

export const SPRITES: Record<SpriteId, SpriteDef> = {
  clawd: CLAWD,
  mini: MINI,
  gemini: GEMINI,
  codex: CODEX,
  qwen: QWEN_DEF,
  kimi: KIMI_DEF,
  orca: ORCA,
  packet: PACKET,
  icon: ICON,
  fx: EFFECTS,
};

if (import.meta.env?.DEV) for (const [id, def] of Object.entries(SPRITES)) validate(id, def.palette, def.anims);
