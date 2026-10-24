// Who's on stage, who's a sub-agent and who's benched, derived from the
// profiles in data/agents.ts so the world never hard-codes a cast.
import type { CharacterId, ToolId } from '../types';
import { AGENTS } from '../data/agents';

const ALL = Object.keys(AGENTS) as CharacterId[];

/** Anything some agent can summon for a big job. */
export const SUB_IDS: ReadonlySet<CharacterId> = new Set(ALL.flatMap(id => AGENTS[id].summons));

/** Main agents in the world. Claude (the lead) first. */
export const ROSTER: readonly CharacterId[] = ALL
  .filter(id => id !== 'orca' && AGENTS[id].onStage && AGENTS[id].tool && !SUB_IDS.has(id))
  .sort((a, b) => (a === 'clawd' ? -1 : b === 'clawd' ? 1 : 0));

/** Kept in code and data but never shown. */
export const BENCHED: ReadonlySet<CharacterId> = new Set(ALL.filter(id => id !== 'orca' && !AGENTS[id].onStage && !SUB_IDS.has(id)));

export function toolOf(id: CharacterId): ToolId | null { return AGENTS[id].tool; }
