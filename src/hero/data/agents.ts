// Who lives in the agent world, and which project each one will open once
// the project popover exists. Keep in sync with src/content/projects/.
import type { AgentProfile, CharacterId } from '../types';

const GH = 'https://github.com/SentimentalK';

export const AGENTS: Record<CharacterId, AgentProfile> = {
  orca: {
    id: 'orca', name: 'ORCA', role: 'dispatcher', color: '#ff4fd8', scale: 2,
    project: { title: 'MAINSTAYX', blurb: 'This site: the hub that dispatches everything else.', github: `${GH}/mainstayX` },
  },
  clawd: {
    id: 'clawd', name: 'CLAUDE', role: 'builder', color: '#d97757', scale: 2,
    project: { title: 'CEO', blurb: 'A long-term personal workspace that lets any AI pick up where the last one left off.', url: 'https://ceo.sentimentalk.com', github: `${GH}/chief-everything-officer` },
  },
  gemini: {
    id: 'gemini', name: 'GEMINI', role: 'researcher', color: '#5b7cfa', scale: 2,
    project: { title: 'Echolet', blurb: 'Local AI voice typing, 100% on-device.', github: `${GH}/echolet` },
  },
  codex: {
    id: 'codex', name: 'CODEX', role: 'operator', color: '#a0a6ad', scale: 2,
    project: { title: 'K3s Home Lab', blurb: 'The homelab cluster this page is served from.', github: `${GH}/k3s-homelab` },
  },
  qwen: {
    id: 'qwen', name: 'QWEN', role: 'agent', color: '#7c5cff', scale: 2,
    project: { title: 'Reliquary', blurb: 'A zero-friction voice bridge to your AI exobrain.', url: 'https://reliquary.sentimentalk.com', github: `${GH}/Reliquary` },
  },
  kimi: {
    id: 'kimi', name: 'KIMI', role: 'reader', color: '#e6edf3', scale: 2,
    project: null,
  },
  glm: {
    id: 'glm', name: 'GLM', role: 'agent', color: '#7385ff', scale: 2,
    project: null,
  },
  deepseek: {
    id: 'deepseek', name: 'DEEPSEEK', role: "orca's little cousin", color: '#4d6bfe', scale: 2,
    project: null,
  },
  mini: {
    id: 'mini', name: 'sub-agent', role: 'summoned helper', color: '#d97757', scale: 1,
    project: null,
  },
};

/** Called when an agent is clicked in the world. The popover will hook in here later. */
export function openAgent(id: CharacterId): void {
  const a = AGENTS[id];
  console.info('[mainstayX] agent clicked:', a.name, a.project ?? '(no project yet)');
}
