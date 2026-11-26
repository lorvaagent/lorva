import { test } from "node:test";
import assert from "node:assert/strict";
import { ACT_BITS } from "@/lib/agents/bits";
import { toBars } from "@/lib/agents/bars";
import { DEFAULT_CONFIG, alerts, chainLimits, configHash, configProblems, initialState, run, step, usage, type AgentConfig, type Bar } from "@/lib/agents/engine";
import { canMove, move, type AgentRecord } from "@/lib/agents/agent";

const H = 3600;
const T0 = 1_800_000_000 - (1_800_000_000 % 86400);
const bars = (prices: number[], every = H): Bar[] => prices.map((c, i) => ({ t: T0 + i * every, c }));
const cfg = (over: Partial<AgentConfig> = {}): AgentConfig => ({ ...DEFAULT_CONFIG, ...over, strategy: { ...DEFAULT_CONFIG.strategy, ...(over.strategy ?? {}) }, limits: { ...DEFAULT_CONFIG.limits, ...(over.limits ?? {}) }, costs: { ...DEFAULT_CONFIG.costs, ...(over.costs ?? {}) }, sizing: { ...DEFAULT_CONFIG.sizing, ...(over.sizing ?? {}) } });

test("trend: warms up, buys on the cross up, sells on the cross down, fees charged", () => {
  const c = cfg({ strategy: { kind: "trend", lookback: 3, dipPct: 3, everyBars: 1 } });
  const r = run(c, bars([100, 100, 100, 99, 104, 106, 107, 101, 98]));
  const acts = r.decisions.map((d) => d.action);
  assert.equal(acts[0], "HOLD");
  assert.match(r.decisions[0].reason, /Warming up/);
  assert.ok(acts.includes("BUY") && acts.includes("SELL"), acts.join(","));
  assert.ok(r.stats.fees > 0);
  assert.equal(r.stats.trades, 2);
  for (const d of r.decisions) assert.ok(d.reason.length > 5, "every decision has a reason");
});

test("same rules, same bars → same decisions (backtest = paper replay)", () => {
  const prices = Array.from({ length: 120 }, (_, i) => 100 + 10 * Math.sin(i / 6) + i * 0.05);
  const c = cfg({ strategy: { kind: "breakout", lookback: 12, dipPct: 3, everyBars: 1 } });
  const full = run(c, bars(prices));
  let s = initialState(c, T0);
  const paper = bars(prices).map((b) => {
    const r = step(c, s, b);
    s = r.state;
    return r.decision;
  });
  assert.deepEqual(paper, full.decisions);
});

test("limits stop new risk: max position, trades per day, daily loss, expiry", () => {
  const c = cfg({ strategy: { kind: "dca", lookback: 3, dipPct: 3, everyBars: 1 }, sizing: { mode: "fixed", value: 300 }, limits: { maxPosition: 500, maxDailyLoss: 40, maxTradesPerDay: 10, stopLossPct: 50, validDays: 30 } });
  const r = run(c, bars([100, 100, 100, 100]));
  assert.equal(r.decisions[0].action, "BUY");
  assert.match(r.decisions[1].reason, /cut to the max position/);
  assert.equal(r.decisions[2].action, "BLOCKED");
  assert.equal(BigInt(r.decisions[2].bits) & ACT_BITS.OVER_POSITION, ACT_BITS.OVER_POSITION);
  const t = cfg({ strategy: { kind: "dca", lookback: 3, dipPct: 3, everyBars: 1 }, sizing: { mode: "fixed", value: 10 }, limits: { maxPosition: 1000, maxDailyLoss: 40, maxTradesPerDay: 2, stopLossPct: 50, validDays: 30 } });
  const r2 = run(t, bars([100, 100, 100, 100, 100], 60));
  assert.deepEqual(r2.decisions.map((d) => d.action), ["BUY", "BUY", "BLOCKED", "BLOCKED", "BLOCKED"]);
  assert.equal(BigInt(r2.decisions[2].bits), ACT_BITS.TRADES_PER_DAY);
  const next = step(t, r2.state, { t: T0 + 86400, c: 100 });
  assert.equal(next.decision.action, "BUY", "new UTC day resets the trade count");
  const exp = cfg({ strategy: { kind: "dca", lookback: 3, dipPct: 3, everyBars: 1 }, limits: { ...DEFAULT_CONFIG.limits, validDays: 1 } });
  const r3 = run(exp, [{ t: T0, c: 100 }, { t: T0 + 2 * 86400, c: 100 }]);
  assert.equal(BigInt(r3.decisions[1].bits) & ACT_BITS.LIMITS_EXPIRED, ACT_BITS.LIMITS_EXPIRED);
});

test("stop-loss and exits are never blocked; daily loss then blocks new buys", () => {
  const c = cfg({ strategy: { kind: "dca", lookback: 3, dipPct: 3, everyBars: 1 }, sizing: { mode: "fixed", value: 400 }, limits: { maxPosition: 2000, maxDailyLoss: 20, maxTradesPerDay: 2, stopLossPct: 5, validDays: 30 } });
  const r = run(c, bars([100, 100, 90, 90], 60));
  assert.deepEqual(r.decisions.map((d) => d.action), ["BUY", "BUY", "STOP", "BLOCKED"]);
  assert.ok(r.decisions[2].pnl < 0);
  assert.equal(BigInt(r.decisions[3].bits) & ACT_BITS.DAILY_LOSS_HIT, ACT_BITS.DAILY_LOSS_HIT);
});

test("dip strategy and drawdown / hold comparison", () => {
  const c = cfg({ strategy: { kind: "dip", lookback: 4, dipPct: 5, everyBars: 1 } });
  const r = run(c, bars([100, 100, 100, 100, 94, 96, 101, 102]));
  assert.ok(r.decisions.some((d) => d.action === "BUY" && /below the 4-bar average/.test(d.reason)));
  assert.ok(r.decisions.some((d) => d.action === "SELL"));
  assert.ok(r.stats.maxDrawdownPct >= 0);
  assert.equal(r.stats.holdPct, 2);
});

test("usage meters and alerts", () => {
  const c = cfg({ strategy: { kind: "dca", lookback: 3, dipPct: 3, everyBars: 1 }, sizing: { mode: "fixed", value: 500 }, limits: { maxPosition: 600, maxDailyLoss: 40, maxTradesPerDay: 1, stopLossPct: 10, validDays: 30 } });
  const r = run(c, bars([100]));
  const u = usage(c, r.state, 100);
  assert.ok(u.position > 0.8 && u.position < 0.84);
  assert.equal(u.trades, 1);
  const a = alerts(c, r.state, 100, T0 + 10);
  assert.ok(a.some((x) => x.level === "near" && /Max position/.test(x.text)));
  assert.ok(a.some((x) => x.level === "hit" && /Trades today/.test(x.text)));
});

test("config checks, hash and chain limits", () => {
  assert.deepEqual(configProblems(DEFAULT_CONFIG), []);
  assert.ok(configProblems(cfg({ limits: { ...DEFAULT_CONFIG.limits, maxTradesPerDay: 0, stopLossPct: 60 } })).length >= 2);
  assert.equal(configHash(DEFAULT_CONFIG), configHash({ ...DEFAULT_CONFIG, name: "other name" }), "name is not part of the rules");
  assert.notEqual(configHash(DEFAULT_CONFIG), configHash(cfg({ limits: { ...DEFAULT_CONFIG.limits, maxPosition: 601 } })));
  const l = chainLimits(DEFAULT_CONFIG, 1000);
  assert.equal(l.maxPosition, 600_000_000n);
  assert.equal(l.stopLossBps, 400);
  assert.equal(l.validUntil, BigInt(1000 + 30 * 86400));
});

test("rounds become forward-filled bars", () => {
  const b = toBars([{ id: "1", price: 10, updatedAt: 100 }, { id: "2", price: 12, updatedAt: 3700 }, { id: "3", price: 0, updatedAt: 3800 }], 3600, 11000);
  assert.deepEqual(b, [{ t: 3600, c: 10 }, { t: 7200, c: 12 }, { t: 10800, c: 12 }]);
  assert.deepEqual(toBars([], 60, 100), []);
});

test("status machine: draft → testing → paper ⇄ paused → stopped, stopped is final", () => {
  let a = { id: "a", config: DEFAULT_CONFIG, status: "Draft", createdAt: 0, version: 1, timeline: [] } as AgentRecord;
  assert.equal(canMove("Draft", "Paper"), false);
  a = move(a, "Testing", 1, "t");
  a = move(a, "Paper", 2, "p");
  a = move(a, "Paused", 3, "x");
  a = move(a, "Paper", 4, "y");
  a = move(a, "Stopped", 5, "kill");
  assert.throws(() => move(a, "Paper", 6, "no"));
  assert.deepEqual(a.timeline.map((t) => t.kind), ["stopped", "resumed", "paused", "paper", "tested"]);
});
