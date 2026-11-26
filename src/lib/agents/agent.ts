import type { AgentConfig, Decision, State } from "@/lib/agents/engine";

/*
 * The AGENT as the control room keeps it (in this browser): its rules, a status, its backtest summary, its paper run and its
 * timeline. Statuses: Draft (built, not tested) → Testing (has a backtest) → Paper (running on live prices) ⇄ Paused; Stopped is
 * final (the kill switch). The on-chain record (LorvaAgentRegistry) is optional and linked by id.
 */
export type AgentStatus = "Draft" | "Testing" | "Paper" | "Paused" | "Stopped";
export type TimelineItem = { t: number; kind: "built" | "tested" | "paper" | "paused" | "resumed" | "stopped" | "limits" | "decision" | "alert" | "chain"; text: string; tx?: string };
export type AgentRecord = {
  id: string;
  config: AgentConfig;
  status: AgentStatus;
  createdAt: number;
  version: number;
  backtest?: { at: number; returnPct: number; holdPct: number; maxDrawdownPct: number; fees: number; trades: number; blocked: number; bars: number; from: number; to: number; source: string };
  paper?: { startedAt: number; state: State; lastBar: number; decisions: Decision[] };
  chain?: { id: number; owner: string; operator: string; version: number };
  timeline: TimelineItem[];
};

export const MAX_AGENTS = 12;

const TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  Draft: ["Testing", "Stopped"],
  Testing: ["Testing", "Paper", "Stopped", "Draft"],
  Paper: ["Paused", "Stopped"],
  Paused: ["Paper", "Stopped"],
  Stopped: [],
};

export function canMove(from: AgentStatus, to: AgentStatus) {
  return TRANSITIONS[from].includes(to);
}

export function move(a: AgentRecord, to: AgentStatus, t: number, note: string): AgentRecord {
  if (!canMove(a.status, to)) throw new Error(`An agent in ${a.status} cannot go to ${to}.`);
  const kind: TimelineItem["kind"] = to === "Paused" ? "paused" : to === "Stopped" ? "stopped" : to === "Paper" ? (a.status === "Paused" ? "resumed" : "paper") : to === "Testing" ? "tested" : "built";
  return { ...a, status: to, timeline: [{ t, kind, text: note }, ...a.timeline].slice(0, 200) };
}
