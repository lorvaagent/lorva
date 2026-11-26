import { alerts, initialState, step, type Bar, type Decision, type State } from "@/lib/agents/engine";
import type { AgentRecord, TimelineItem } from "@/lib/agents/agent";

/*
 * Paper mode, as pure functions over an AgentRecord: start (indicators warmed with history, a fresh paper account), advance to the
 * latest closed bar (one bar from the live price, or a catch-up replay over history bars when bars were missed), and the alerts
 * that turned on since the last check.
 */

export const MAX_DECISIONS = 300;

export function startPaper(a: AgentRecord, history: Bar[], t: number): AgentRecord {
  const s = initialState(a.config, t);
  s.closes = history.filter((b) => b.t <= t).map((b) => b.c).slice(-(a.config.strategy.lookback + 2));
  const bar = a.config.barMinutes * 60;
  return { ...a, paper: { startedAt: t, state: s, lastBar: Math.floor(t / bar) * bar, decisions: [] } };
}

/** Bars to evaluate now: every closed bar after lastBar. `live` = the latest price for the current bucket if no history covers it. */
export function pendingBars(a: AgentRecord, t: number, history: Bar[] | null, live: number | null): Bar[] {
  if (!a.paper) return [];
  const bar = a.config.barMinutes * 60;
  const closed = Math.floor(t / bar) * bar;
  if (closed <= a.paper.lastBar) return [];
  const fromHistory = (history ?? []).filter((b) => b.t > a.paper!.lastBar && b.t <= closed);
  if (fromHistory.length && fromHistory.at(-1)!.t === closed) return fromHistory;
  if (live !== null) return [...fromHistory, { t: closed, c: live }];
  return fromHistory;
}

export function advance(a: AgentRecord, bars: Bar[], t: number): { agent: AgentRecord; decisions: Decision[]; newAlerts: TimelineItem[] } {
  if (!a.paper || !bars.length) return { agent: a, decisions: [], newAlerts: [] };
  let s: State = a.paper.state;
  const out: Decision[] = [];
  for (const b of bars) {
    const r = step(a.config, s, b);
    s = r.state;
    out.push(r.decision);
  }
  const price = bars.at(-1)!.c;
  const before = new Set(alerts(a.config, a.paper.state, price, t).map((x) => x.text.replace(/\d+ %/, "")));
  const fresh = alerts(a.config, s, price, t).filter((x) => !before.has(x.text.replace(/\d+ %/, "")));
  const newAlerts: TimelineItem[] = fresh.map((x) => ({ t, kind: "alert", text: `${x.level === "hit" ? "Limit hit" : "Near limit"}: ${x.text}` }));
  const traded: TimelineItem[] = out.filter((d) => d.action !== "HOLD" && d.action !== "WAIT").map((d) => ({ t: d.t, kind: "decision", text: `${d.action} at ${d.price.toFixed(2)}: ${d.reason}` }));
  const agent: AgentRecord = {
    ...a,
    paper: { ...a.paper, state: s, lastBar: bars.at(-1)!.t, decisions: [...out.reverse(), ...a.paper.decisions].slice(0, MAX_DECISIONS) },
    timeline: [...newAlerts, ...traded.reverse(), ...a.timeline].slice(0, 200),
  };
  return { agent, decisions: out, newAlerts };
}

/** "Evaluate now": one extra decision at the live price (it counts as a bar; the next scheduled bar still runs). */
export function evaluateNow(a: AgentRecord, price: number, t: number) {
  if (!a.paper) return { agent: a, decisions: [] as Decision[], newAlerts: [] as TimelineItem[] };
  const r = advance({ ...a, paper: { ...a.paper } }, [{ t, c: price }], t);
  return { ...r, agent: { ...r.agent, paper: { ...r.agent.paper!, lastBar: a.paper.lastBar } } };
}
