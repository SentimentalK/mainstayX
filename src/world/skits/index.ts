// Skit registry (weights / cooldowns live in each SkitDef).
import type { SkitDef } from '../skit';
import { lost } from './lost';
import { drop } from './drop';
import { collision } from './collision';
import { summon } from './summon';
import { meeting } from './meeting';
import { relay } from './relay';
import { celebrate } from './celebrate';
import { nap } from './nap';
import { bug } from './bug';
import { review } from './review';
import { ctxOverflow } from './ctx';
import { coffee } from './coffee';
import { tug } from './tug';
import { whaleSong } from './whale';

export const SKITS: readonly SkitDef[] = [
  lost, drop, collision, summon, meeting, relay, celebrate, nap,
  bug, review, ctxOverflow, coffee, tug, whaleSong,
];
