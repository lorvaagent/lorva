import { keccak256, stringToBytes, type Hex } from "viem";
import { ACT_BITS } from "@/lib/agents/bits";

/*
 * The Lorva agent engine. Deterministic code, no model: the same `step` runs the backtest over history and the paper run over live
 * prices, so a paper decision is exactly what the backtest would have done on that bar. Every bar yields one decision with its reason.
 *
 * Rules of the engine (also enforced by LorvaAgentRegistry for recorded actions):
 *   - limits stop NEW RISK: a buy is refused (BLOCKED, with reason bits) when it would pass the max position, the trades per UTC
 *     day are used up, today's realised loss reached the daily limit, or the limits expired;
 *   - limits never block an EXIT: sells and stop-losses always go through;
 *   - fees and slippage are explicit inputs, charged on every fill; no leverage, no shorting; no real money moves.
 */

export type StrategyKind = "trend" | "breakout" | "dip" | "dca";
export type AgentConfig = {
  name: string;
  asset: string;
  strategy: { kind: StrategyKind; lookback: number; dipPct: number; everyBars: number };
  sizing: { mode: "fixed" | "pct"; value: number };
  limits: { maxPosition: number; maxDailyLoss: number; maxTradesPerDay: number; stopLossPct: number; validDays: number };
  costs: { feeBps: number; slippageBps: number };
  capital: number;
  barMinutes: 15 | 60;
};

export type Bar = { t: number; c: number };
export type Action = "BUY" | "SELL" | "STOP" | "HOLD" | "BLOCKED" | "WAIT";
export type Decision = { t: number; price: number; action: Action; reason: string; bits: string; qty: number; notional: number; fee: number; pnl: number; equity: number; position: number };
export type State = {
  cash: number;
  units: number;
  avgCost: number;
  day: number;
  tradesToday: number;
  lossToday: number;
  realised: number;
  fees: number;
  trades: number;
  blocked: number;
  peak: number;
  maxDD: number;
  closes: number[];
  bars: number;
  startedAt: number;
  validUntil: number;
};

export const STRATEGIES: Record<StrategyKind, { label: string; rule: string }> = {
  trend: { label: "Trend follow", rule: "Buy when the price closes above its N-bar average after being below it; sell when it closes back below." },
  breakout: { label: "Breakout", rule: "Buy when the price closes above the highest close of the previous N bars; sell when it closes below the lowest close of the previous N/2 bars." },
  dip: { label: "Buy the dip", rule: "Buy when the price is X % or more below its N-bar average; sell when it is back at the average." },
  dca: { label: "Steady buying", rule: "Buy the same amount every K bars while the limits allow; it only sells on the stop-loss." },
};

export const DEFAULT_CONFIG: AgentConfig = {
  name: "Night shift",
  asset: "ETH",
  strategy: { kind: "trend", lookback: 24, dipPct: 3, everyBars: 24 },
  sizing: { mode: "fixed", value: 250 },
  limits: { maxPosition: 600, maxDailyLoss: 40, maxTradesPerDay: 4, stopLossPct: 4, validDays: 30 },
  costs: { feeBps: 30, slippageBps: 10 },
  capital: 1000,
  barMinutes: 60,
};

/** Why a config cannot be used (empty = fine). Mirrors LorvaLimitMath.check for the limits. */
export function configProblems(c: AgentConfig): string[] {
  const p: string[] = [];
  if (!c.name.trim() || c.name.length > 32) p.push("Name the agent (1–32 characters).");
  if (!(c.strategy.lookback >= 3 && c.strategy.lookback <= 200)) p.push("Lookback N is 3–200 bars.");
  if (c.strategy.kind === "dip" && !(c.strategy.dipPct > 0 && c.strategy.dipPct <= 50)) p.push("Dip X is 0.1–50 %.");
  if (c.strategy.kind === "dca" && !(c.strategy.everyBars >= 1 && c.strategy.everyBars <= 500)) p.push("Buy every K bars, K = 1–500.");
  if (!(c.sizing.value > 0) || (c.sizing.mode === "pct" && c.sizing.value > 100)) p.push("Position size must be above 0 (and at most 100 %).");
  if (!(c.capital >= 10 && c.capital <= 10_000_000)) p.push("Paper capital is 10 – 10,000,000 USD.");
  const l = c.limits;
  if (!(l.maxPosition > 0)) p.push("Max position must be above 0.");
  if (!(l.maxDailyLoss > 0)) p.push("Max daily loss must be above 0.");
  if (!(Number.isInteger(l.maxTradesPerDay) && l.maxTradesPerDay >= 1 && l.maxTradesPerDay <= 1000)) p.push("Trades per day is 1–1000.");
  if (!(l.stopLossPct >= 0.01 && l.stopLossPct <= 50)) p.push("Stop-loss is 0.01–50 %.");
  if (!(l.validDays >= 1 && l.validDays <= 366)) p.push("Limits last 1–366 days.");
  if (!(c.costs.feeBps >= 0 && c.costs.feeBps <= 1000) || !(c.costs.slippageBps >= 0 && c.costs.slippageBps <= 1000)) p.push("Fee and slippage are 0–1000 bps.");
  return p;
}

/** keccak256 of the canonical JSON of the rules (the configHash registered on chain). The name is not part of the rules. */
export function configHash(c: AgentConfig): Hex {
  const { name: _n, ...rules } = c;
  void _n;
  return keccak256(stringToBytes(canon(rules)));
}

/** JSON with object keys sorted at every level, so the same rules always hash the same. */
export function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

export function initialState(c: AgentConfig, startedAt: number): State {
  return { cash: c.capital, units: 0, avgCost: 0, day: Math.floor(startedAt / 86400), tradesToday: 0, lossToday: 0, realised: 0, fees: 0, trades: 0, blocked: 0, peak: c.capital, maxDD: 0, closes: [], bars: 0, startedAt, validUntil: startedAt + c.limits.validDays * 86400 };
}

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const r2 = (n: number) => Math.round(n * 100) / 100;

type Signal = { side: "buy" | "sell" | null; reason: string };

function signal(c: AgentConfig, s: State, price: number): Signal {
  const n = c.strategy.lookback;
  const prev = s.closes; // closes BEFORE this bar
  const holding = s.units > 0;
  if (c.strategy.kind === "dca") {
    if (s.bars % c.strategy.everyBars === 0) return { side: "buy", reason: `Scheduled buy (every ${c.strategy.everyBars} bars)` };
    return { side: null, reason: `Next scheduled buy in ${c.strategy.everyBars - (s.bars % c.strategy.everyBars)} bars` };
  }
  if (prev.length < n) return { side: null, reason: `Warming up: ${prev.length}/${n} bars of history` };
  if (c.strategy.kind === "trend") {
    const sma = mean([...prev.slice(-(n - 1)), price]);
    const prevSma = mean(prev.slice(-n));
    const prevClose = prev[prev.length - 1];
    if (!holding && prevClose <= prevSma && price > sma) return { side: "buy", reason: `Closed above the ${n}-bar average (${r2(price)} > ${r2(sma)})` };
    if (holding && price < sma) return { side: "sell", reason: `Closed below the ${n}-bar average (${r2(price)} < ${r2(sma)})` };
    return { side: null, reason: holding ? `Holding: still above the average (${r2(sma)})` : `No cross: ${price > sma ? "above" : "below"} the average (${r2(sma)})` };
  }
  if (c.strategy.kind === "breakout") {
    const hi = Math.max(...prev.slice(-n));
    const lo = Math.min(...prev.slice(-Math.max(2, Math.floor(n / 2))));
    if (!holding && price > hi) return { side: "buy", reason: `Broke above the ${n}-bar high (${r2(price)} > ${r2(hi)})` };
    if (holding && price < lo) return { side: "sell", reason: `Fell below the ${Math.max(2, Math.floor(n / 2))}-bar low (${r2(price)} < ${r2(lo)})` };
    return { side: null, reason: holding ? `Holding above the exit level (${r2(lo)})` : `No breakout (high ${r2(hi)})` };
  }
  const sma = mean(prev.slice(-n));
  const entry = sma * (1 - c.strategy.dipPct / 100);
  if (!holding && price <= entry) return { side: "buy", reason: `${r2(((sma - price) / sma) * 100)} % below the ${n}-bar average` };
  if (holding && price >= sma) return { side: "sell", reason: `Back at the ${n}-bar average (${r2(sma)})` };
  return { side: null, reason: holding ? `Holding until the average (${r2(sma)})` : `Not deep enough: entry at ${r2(entry)}` };
}

/** One bar. Pure: returns the decision and the next state. `paused` = evaluate nothing but record a HOLD. */
export function step(c: AgentConfig, prevState: State, bar: Bar, paused = false): { state: State; decision: Decision } {
  const s: State = { ...prevState, closes: prevState.closes };
  const price = bar.c;
  const day = Math.floor(bar.t / 86400);
  if (day !== s.day) {
    s.day = day;
    s.tradesToday = 0;
    s.lossToday = 0;
  }
  const slip = c.costs.slippageBps / 10_000;
  const feeRate = c.costs.feeBps / 10_000;
  const mk = (action: Action, reason: string, extra: Partial<Decision> = {}): Decision => {
    const equity = s.cash + s.units * price;
    return { t: bar.t, price, action, reason, bits: "0", qty: 0, notional: 0, fee: 0, pnl: 0, equity: r2(equity), position: r2(s.units * price), ...extra };
  };
  const sellAll = (action: "SELL" | "STOP", reason: string) => {
    const fillPx = price * (1 - slip);
    const notional = s.units * fillPx;
    const fee = notional * feeRate;
    const pnl = notional - fee - s.units * s.avgCost;
    const qty = s.units;
    s.cash += notional - fee;
    s.fees += fee;
    s.realised += pnl;
    if (pnl < 0) s.lossToday += -pnl;
    s.units = 0;
    s.avgCost = 0;
    s.trades += 1;
    s.tradesToday += 1;
    return mk(action, reason, { qty, notional: r2(notional), fee: r2(fee), pnl: r2(pnl) });
  };

  let decision: Decision;
  if (paused) decision = mk("WAIT", "Paused by the owner: nothing is evaluated");
  else if (s.units > 0 && price <= s.avgCost * (1 - c.limits.stopLossPct / 100)) {
    decision = sellAll("STOP", `Stop-loss: ${r2(((s.avgCost - price) / s.avgCost) * 100)} % below the average cost ${r2(s.avgCost)}`);
  } else {
    const sig = signal(c, s, price);
    if (sig.side === "sell" && s.units > 0) decision = sellAll("SELL", sig.reason);
    else if (sig.side === "buy") {
      const equity = s.cash + s.units * price;
      let notional = c.sizing.mode === "fixed" ? c.sizing.value : (equity * c.sizing.value) / 100;
      const position = s.units * price;
      let bits = 0n;
      if (bar.t >= s.validUntil) bits |= ACT_BITS.LIMITS_EXPIRED;
      if (s.tradesToday >= c.limits.maxTradesPerDay) bits |= ACT_BITS.TRADES_PER_DAY;
      if (s.lossToday >= c.limits.maxDailyLoss) bits |= ACT_BITS.DAILY_LOSS_HIT;
      const room = c.limits.maxPosition - position;
      let clamped = false;
      if (notional > room) {
        if (room < Math.min(1, c.limits.maxPosition * 0.01)) bits |= ACT_BITS.OVER_POSITION;
        else {
          notional = room;
          clamped = true;
        }
      }
      const spend = Math.min(notional, s.cash / (1 + feeRate));
      if (bits !== 0n) {
        s.blocked += 1;
        decision = mk("BLOCKED", `${sig.reason}; refused by the limits`, { bits: bits.toString() });
      } else if (spend < 1) decision = mk("HOLD", `${sig.reason}; no paper cash left`);
      else {
        const fillPx = price * (1 + slip);
        const qty = spend / fillPx;
        const fee = spend * feeRate;
        s.avgCost = (s.avgCost * s.units + spend + fee) / (s.units + qty);
        s.units += qty;
        s.cash -= spend + fee;
        s.fees += fee;
        s.trades += 1;
        s.tradesToday += 1;
        decision = mk("BUY", clamped ? `${sig.reason}; size cut to the max position` : sig.reason, { qty, notional: r2(spend), fee: r2(fee) });
      }
    } else decision = mk("HOLD", sig.reason);
  }
  const equity = s.cash + s.units * price;
  s.peak = Math.max(s.peak, equity);
  s.maxDD = Math.max(s.maxDD, s.peak > 0 ? (s.peak - equity) / s.peak : 0);
  s.closes = [...prevState.closes, price].slice(-Math.max(c.strategy.lookback + 2, 4));
  s.bars += 1;
  return { state: s, decision };
}

export type RunResult = {
  decisions: Decision[];
  curve: { t: number; equity: number; hold: number }[];
  stats: { startEquity: number; endEquity: number; returnPct: number; holdPct: number; maxDrawdownPct: number; fees: number; trades: number; blocked: number; stops: number; bars: number; from: number; to: number };
  state: State;
};

/** Backtest (or catch-up replay): every bar in order, from a fresh state or a given one. */
export function run(c: AgentConfig, bars: Bar[], from?: State): RunResult {
  let s = from ?? initialState(c, bars[0]?.t ?? 0);
  const decisions: Decision[] = [];
  const curve: RunResult["curve"] = [];
  const first = bars[0]?.c ?? 1;
  for (const b of bars) {
    const r = step(c, s, b);
    s = r.state;
    decisions.push(r.decision);
    curve.push({ t: b.t, equity: r.decision.equity, hold: r2((c.capital / first) * b.c) });
  }
  const end = curve.at(-1)?.equity ?? c.capital;
  const holdEnd = curve.at(-1)?.hold ?? c.capital;
  return {
    decisions,
    curve,
    state: s,
    stats: {
      startEquity: c.capital,
      endEquity: end,
      returnPct: r2(((end - c.capital) / c.capital) * 100),
      holdPct: r2(((holdEnd - c.capital) / c.capital) * 100),
      maxDrawdownPct: r2(s.maxDD * 100),
      fees: r2(s.fees),
      trades: s.trades,
      blocked: s.blocked,
      stops: decisions.filter((d) => d.action === "STOP").length,
      bars: bars.length,
      from: bars[0]?.t ?? 0,
      to: bars.at(-1)?.t ?? 0,
    },
  };
}

/** Limit usage for the monitor: share of each limit used now (1 = hit). */
export function usage(c: AgentConfig, s: State, price: number) {
  return {
    position: (s.units * price) / c.limits.maxPosition,
    trades: s.tradesToday / c.limits.maxTradesPerDay,
    loss: s.lossToday / c.limits.maxDailyLoss,
    stop: s.units > 0 ? Math.max(0, (s.avgCost - price) / s.avgCost) / (c.limits.stopLossPct / 100) : 0,
  };
}

export type Alert = { level: "near" | "hit"; text: string };
/** Alerts: 80 % of a limit is "near", 100 % is "hit". */
export function alerts(c: AgentConfig, s: State, price: number, now: number): Alert[] {
  const u = usage(c, s, price);
  const out: Alert[] = [];
  const add = (v: number, label: string) => {
    if (v >= 1) out.push({ level: "hit", text: `${label} reached` });
    else if (v >= 0.8) out.push({ level: "near", text: `${label} at ${Math.round(v * 100)} %` });
  };
  add(u.position, "Max position");
  add(u.trades, "Trades today");
  add(u.loss, "Daily loss limit");
  add(u.stop, "Stop-loss distance");
  if (now >= s.validUntil) out.push({ level: "hit", text: "Limits expired: no new buys" });
  else if (s.validUntil - now < 2 * 86400) out.push({ level: "near", text: "Limits expire within 2 days" });
  return out;
}

/** Limits as the registry stores them (USD with 6 decimals, bps, unix expiry). */
export function chainLimits(c: AgentConfig, now: number) {
  return {
    maxPosition: BigInt(Math.round(c.limits.maxPosition * 1e6)),
    maxDailyLoss: BigInt(Math.round(c.limits.maxDailyLoss * 1e6)),
    maxTradesPerDay: c.limits.maxTradesPerDay,
    stopLossBps: Math.round(c.limits.stopLossPct * 100),
    validUntil: BigInt(now + c.limits.validDays * 86400),
  };
}
