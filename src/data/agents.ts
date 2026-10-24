// Who lives in the agent world, and which project each one will open once
// the project popover exists. Links are placeholders — edit freely.
import type { AgentProfile, CharacterId } from '../types';

const GH = 'https://github.com/SentimentalK';

export const AGENTS: Record<CharacterId, AgentProfile> = {
  orca: {
    id: 'orca', name: 'ORCA', role: 'dispatcher', color: '#ff4fd8', scale: 2,
    project: { title: 'MAINSTAY_X', blurb: 'This site: the hub that dispatches everything else.', url: '#', github: `${GH}/mainstayX` },
  },
  clawd: {
    id: 'clawd', name: 'CLAUDE', role: 'builder', color: '#d97757', scale: 2,
    project: { title: 'CEO', blurb: 'A long-term personal workspace that lets any AI pick up where the last one left off.', url: '#', github: `${GH}/CEO` },
  },
  gemini: {
    id: 'gemini', name: 'GEMINI', role: 'researcher', color: '#5b7cfa', scale: 2,
    project: { title: 'Voice Input', blurb: 'Speak instead of type: a voice input tool.', url: '#', github: `${GH}/voice-input` },
  },
  codex: {
    id: 'codex', name: 'CODEX', role: 'operator', color: '#a0a6ad', scale: 2,
    project: { title: 'K3s Home Lab', blurb: 'The homelab cluster this page is served from.', url: '#', github: `${GH}/homelab` },
  },
  qwen: {
    id: 'qwen', name: 'QWEN', role: 'agent', color: '#7c5cff', scale: 2,
    project: { title: '008', blurb: 'Project 008.', url: '#', github: `${GH}/008` },
  },
  kimi: {
    id: 'kimi', name: 'KIMI', role: 'reader', color: '#e6edf3', scale: 2,
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
