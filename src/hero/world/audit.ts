// World invariants, checked by window.__mxWorld.audit() and (with ?debug=1)
// once a second. Returns human-readable violations; [] means all good.
//   - a seated agent's desk is of its own tool, and the seat points back at it
//   - no seat holds two agents, no agent holds two seats, ≤ 4 per desk
//   - desks don't overlap each other, Orca's keep-out zone or Orca itself
//   - nobody benched is on stage
//   - sub-agents belong to a live job (or one that ended < a few s ago) and
//     are of a kind their summoner may summon
import { STATION } from '../sprites/art/stations';
import { AGENTS } from '../data/agents';
import { ORCA_VIS, insideKeep, rectsOverlap, type Pt } from './layout';
import { DESK_SEATS } from './desks';
import { SUB_GRACE } from './jobs';
import { BENCHED, SUB_IDS } from './roster';
import type { Agent } from './agent';
import type { World } from './world';

/** How long a sub-agent may linger after its job ended. */
const SUB_LINGER = SUB_GRACE + 2;
const p: Pt = { x: 0, y: 0 };

export function audit(w: World): string[] {
  const out: string[] = [];
  const everyone: Agent[] = [...w.agents, ...w.subs];
  const tag = (a: Agent) => `${a.id}${a.sub ? '(sub)' : ''}@${Math.round(a.x)},${Math.round(a.y)}`;

  // ---- seats
  const seatOf = new Map<Agent, string>();
  for (const d of w.desks.list) {
    if (d.seats.length > DESK_SEATS) out.push(`desk#${d.id} ${d.tool} has ${d.seats.length} seats`);
    let n = 0;
    for (let i = 0; i < d.seats.length; i++) {
      const a = d.seats[i];
      if (!a) continue;
      n++;
      const key = `desk#${d.id}[${i}]`;
      const prev = seatOf.get(a);
      if (prev) out.push(`${tag(a)} holds two seats: ${prev} and ${key}`);
      seatOf.set(a, key);
      if (a.desk !== d || a.seatI !== i) out.push(`${key} holds ${tag(a)} but it thinks it sits at ${a.desk ? `desk#${a.desk.id}[${a.seatI}]` : 'nothing'}`);
      if (AGENTS[a.id].tool !== d.tool) out.push(`${tag(a)} (tool ${AGENTS[a.id].tool}) sits at a ${d.tool} desk (${key})`);
      if (!w.has(a)) out.push(`${key} holds ${tag(a)}, who is gone`);
    }
    if (n > DESK_SEATS) out.push(`desk#${d.id} ${d.tool} has ${n} occupants`);
  }
  for (const a of everyone) {
    if (!a.desk) continue;
    if (w.desks.list.indexOf(a.desk) < 0) out.push(`${tag(a)} sits at desk#${a.desk.id}, which is gone`);
    else if (a.desk.seats[a.seatI] !== a) out.push(`${tag(a)} thinks it sits at desk#${a.desk.id}[${a.seatI}] but that seat holds ${a.desk.seats[a.seatI]?.id ?? 'nobody'}`);
    if (AGENTS[a.id].tool !== a.desk.tool) out.push(`${tag(a)} (tool ${AGENTS[a.id].tool}) is assigned to a ${a.desk.tool} desk`);
    // working means sitting in the seat
    if (a.brain === 'work' && !a.owner && a.desk.state === 'open') {
      w.desks.seatPos(a.desk, a.seatI, p, a.small);
      if (Math.abs(p.x - a.x) > 2.5 || Math.abs(p.y - a.y) > 2.5) out.push(`${tag(a)} is working away from its seat (${Math.round(p.x)},${Math.round(p.y)})`);
    }
  }

  // ---- desk placement
  const L = w.desks.list, hw = STATION.w / 2;
  for (let i = 0; i < L.length; i++) {
    const d = L[i];
    const x = d.cx - hw, y = d.by - STATION.h;
    for (let j = i + 1; j < L.length; j++) {
      const e = L[j];
      if (rectsOverlap(x, y, STATION.w, STATION.h, e.cx - hw, e.by - STATION.h, STATION.w, STATION.h))
        out.push(`desk#${d.id} ${d.tool} overlaps desk#${e.id} ${e.tool}`);
    }
    if (rectsOverlap(x, y, STATION.w, STATION.h, ORCA_VIS.x, ORCA_VIS.y, ORCA_VIS.w, ORCA_VIS.h))
      out.push(`desk#${d.id} ${d.tool} at ${d.cx},${d.by} covers Orca`);
    for (let k = 0; k <= 4; k++) {
      const fx = x + (STATION.w * k) / 4;
      if (insideKeep(fx, d.by) || insideKeep(fx, d.by - 6)) { out.push(`desk#${d.id} ${d.tool} at ${d.cx},${d.by} is inside Orca's keep-out zone`); break; }
    }
  }

  // ---- cast
  for (const a of everyone) {
    if (BENCHED.has(a.id)) out.push(`benched ${a.id} is on stage`);
    if (a.sub !== SUB_IDS.has(a.id)) out.push(`${tag(a)} sub flag doesn't match its profile`);
  }

  // ---- sub-agents and their jobs
  for (const s of w.subs) {
    const j = s.job, by = s.summoner;
    if (!j) { out.push(`${tag(s)} has no job`); continue; }
    if (j.done && w.time - j.endT > SUB_LINGER) out.push(`${tag(s)} outlived job #${j.id} by ${(w.time - j.endT).toFixed(1)}s`);
    if (w.jobs.list.indexOf(j) < 0) out.push(`${tag(s)} belongs to job #${j.id}, which is gone`);
    if (!by || j.lead !== by) out.push(`${tag(s)} isn't summoned by its job's lead`);
    else if (!AGENTS[by.id].summons.includes(s.id)) out.push(`${by.id} may not summon ${s.id}`);
  }
  return out;
}
