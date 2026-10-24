// Who lives in the agent world, and which project each one will open once
// the project popover exists. Keep in sync with src/content/projects/.
import type { AgentProfile, CharacterId } from '../types';

const GH = 'https://github.com/SentimentalK';

const OPENCODE_SUBS: CharacterId[] = ['glmMini', 'deepseekMini'];

export const AGENTS: Record<CharacterId, AgentProfile> = {
  orca: {
    id: 'orca', name: 'ORCA', role: 'dispatcher', color: '#ff4fd8', scale: 2,
    tool: null, onStage: true, summons: [],
    project: { title: 'MAINSTAYX', blurb: 'This site: the hub that dispatches everything else.', github: `${GH}/mainstayX` },
  },

  // ---- on stage
  clawd: {
    id: 'clawd', name: 'CLAUDE', role: 'lead', color: '#d97757', scale: 2,
    tool: 'claudecode', onStage: true, summons: ['mini'],
    project: { title: 'CEO', blurb: 'A long-term personal workspace that lets any AI pick up where the last one left off.', url: 'https://ceo.sentimentalk.com', github: `${GH}/chief-everything-officer` },
  },
  gpt: {
    id: 'gpt', name: 'GPT', role: 'builder', color: '#10a37f', scale: 2,
    tool: 'codex', onStage: true, summons: OPENCODE_SUBS,
    project: { title: 'K3s Home Lab', blurb: 'The homelab cluster this page is served from.', github: `${GH}/k3s-homelab` },
  },
  grok: {
    id: 'grok', name: 'GROK', role: 'builder', color: '#9aa0aa', scale: 2,
    tool: 'cursor', onStage: true, summons: OPENCODE_SUBS,
    project: { title: 'Reliquary', blurb: 'A zero-friction voice bridge to your AI exobrain.', url: 'https://reliquary.sentimentalk.com', github: `${GH}/Reliquary` },
  },
  gemini: {
    id: 'gemini', name: 'GEMINI', role: 'researcher', color: '#5b7cfa', scale: 2,
    tool: 'antigravity', onStage: true, summons: OPENCODE_SUBS,
    project: { title: 'Echolet', blurb: 'Local AI voice typing, 100% on-device.', github: `${GH}/echolet` },
  },
  // Chinese models all work through OpenCode.
  glm: {
    id: 'glm', name: 'GLM', role: 'agent', color: '#7385ff', scale: 2,
    tool: 'opencode', onStage: true, summons: [],
    project: null,
  },
  deepseek: {
    id: 'deepseek', name: 'DEEPSEEK', role: "orca's little cousin", color: '#4d6bfe', scale: 2,
    tool: 'opencode', onStage: true, summons: [],
    project: null,
  },

  // ---- benched (kept, not shown)
  codex: {
    id: 'codex', name: 'CODEX', role: 'operator', color: '#a0a6ad', scale: 2,
    tool: 'codex', onStage: false, summons: [],
    project: null,
  },
  qwen: {
    id: 'qwen', name: 'QWEN', role: 'agent', color: '#7c5cff', scale: 2,
    tool: 'opencode', onStage: false, summons: [],
    project: null,
  },
  kimi: {
    id: 'kimi', name: 'KIMI', role: 'reader', color: '#e6edf3', scale: 2,
    tool: 'opencode', onStage: false, summons: [],
    project: null,
  },

  // ---- sub-agents (spawned for jobs, never on stage by themselves)
  mini: {
    id: 'mini', name: 'sub-agent', role: "Claude's own sub-agent", color: '#d97757', scale: 1,
    tool: 'claudecode', onStage: false, summons: [],
    project: null,
  },
  glmMini: {
    id: 'glmMini', name: 'sub-agent', role: 'OpenCode sub-agent', color: '#7385ff', scale: 1,
    tool: 'opencode', onStage: false, summons: [],
    project: null,
  },
  deepseekMini: {
    id: 'deepseekMini', name: 'sub-agent', role: 'OpenCode sub-agent', color: '#4d6bfe', scale: 1,
    tool: 'opencode', onStage: false, summons: [],
    project: null,
  },
};

/** Called when an agent is clicked in the world. The popover will hook in here later. */
export function openAgent(id: CharacterId): void {
  const a = AGENTS[id];
  console.info('[mainstayX] agent clicked:', a.name, a.project ?? '(no project yet)');
}
