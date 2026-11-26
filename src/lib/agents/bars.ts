import type { Bar } from "@/lib/agents/engine";

/*
 * Chainlink rounds → fixed bars. A bar's close is the latest round answer published at or before the bar's end (forward fill: a
 * feed updates on a price move or a heartbeat, so a quiet hour simply keeps the last answer). Bars before the first round are dropped.
 */
export type Round = { id: string; price: number; updatedAt: number };

export function toBars(rounds: Round[], barSeconds: number, endAt: number): Bar[] {
  const rs = rounds.filter((r) => r.price > 0 && r.updatedAt > 0).sort((a, b) => a.updatedAt - b.updatedAt);
  if (!rs.length) return [];
  const first = Math.ceil(rs[0].updatedAt / barSeconds) * barSeconds;
  const last = Math.floor(endAt / barSeconds) * barSeconds;
  const bars: Bar[] = [];
  let i = 0;
  let px = rs[0].price;
  for (let t = first; t <= last; t += barSeconds) {
    while (i < rs.length && rs[i].updatedAt <= t) px = rs[i++].price;
    bars.push({ t, c: px });
  }
  return bars;
}
