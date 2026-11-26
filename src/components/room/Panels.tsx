"use client";

import { useState } from "react";
import { assetBySymbol } from "@/lib/agents/assets";
import { bitWords } from "@/lib/agents/bits";
import { STRATEGIES, alerts, run, usage, type Decision, type RunResult } from "@/lib/agents/engine";
import type { AgentRecord } from "@/lib/agents/agent";
import { barsFrom, fetchHistory, now, type History } from "@/components/room/useAgents";
import { dateText } from "@/lib/format";

/* Panels of one agent in the control room: Test (backtest), Monitor (paper run), History (timeline). */

const usd = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)} %`;

export function Meter({ label, v, hint }: { label: string; v: number; hint: string }) {
  return (
    <div>
      <div className="cap flex justify-between gap-2">
        <span>{label}</span>
        <b>{Math.round(v * 100)} %</b>
      </div>
      <div className={`meter mt-1.5 ${v >= 1 ? "hit" : v >= 0.8 ? "near" : ""}`}>
        <i style={{ "--w": `${Math.min(100, v * 100)}%` } as React.CSSProperties} />
      </div>
      <p className="cap mt-1 !text-[var(--faint)] !normal-case !tracking-normal">{hint}</p>
    </div>
  );
}

function Curve({ curve }: { curve: RunResult["curve"] }) {
  if (curve.length < 2) return null;
  const W = 800;
  const H = 220;
  const vals = curve.flatMap((p) => [p.equity, p.hold]);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const x = (i: number) => (i / (curve.length - 1)) * W;
  const y = (v: number) => H - ((v - lo) / Math.max(1e-9, hi - lo)) * (H - 16) - 8;
  const line = (k: "equity" | "hold") => curve.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p[k]).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-[220px] w-full" preserveAspectRatio="none" aria-label="Agent equity against holding the asset" data-testid="bt-curve">
      <path d={line("hold")} fill="none" stroke="var(--line-2)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <path d={line("equity")} fill="none" stroke="var(--ink)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function DecisionRows({ rows, testid }: { rows: Decision[]; testid: string }) {
  return (
    <div className="scroll-x">
      <table className="tbl min-w-[620px]" data-testid={testid}>
        <thead>
          <tr>
            <th>Bar (UTC)</th>
            <th>Price</th>
            <th>Action</th>
            <th>Why</th>
            <th>Equity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d, i) => (
            <tr key={`${d.t}-${i}`}>
              <td className="mono text-[12px]">{dateText(d.t)}</td>
              <td className="mono text-[12px]">{d.price.toFixed(2)}</td>
              <td>
                <span className={`chip ${d.action === "BUY" || d.action === "SELL" ? "ink" : d.action === "BLOCKED" || d.action === "STOP" ? "bad" : ""}`}>{d.action}</span>
              </td>
              <td className="text-[13px]">
                {d.reason}
                {d.bits !== "0" ? <span className="block text-[12px] text-[var(--bad)]">{bitWords(BigInt(d.bits)).join(" · ")}</span> : null}
                {d.pnl ? <span className="block text-[12px] text-[var(--muted)]">P&amp;L {usd(d.pnl)} · fee {usd(d.fee)}</span> : null}
              </td>
              <td className="mono text-[12px]">{usd(d.equity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TestPanel({ a, onTested, onPaper }: { a: AgentRecord; onTested: (r: RunResult, h: History) => void; onPaper: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<{ r: RunResult; h: History } | null>(null);
  const [only, setOnly] = useState(true);
  const asset = assetBySymbol(a.config.asset);
  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      const h = await fetchHistory(a.config.asset);
      const bars = barsFrom(h, a.config.barMinutes);
      if (bars.length < a.config.strategy.lookback + 5) throw new Error(`Only ${bars.length} bars of history: too few for a ${a.config.strategy.lookback}-bar lookback. Use a shorter lookback or 15-minute bars.`);
      const r = run(a.config, bars);
      setRes({ r, h });
      onTested(r, h);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const s = res?.r.stats ?? (a.backtest ? { ...a.backtest, startEquity: a.config.capital, endEquity: 0, stops: 0 } : null);
  const rows = res ? [...res.r.decisions].reverse().filter((d) => !only || d.action !== "HOLD").slice(0, 80) : [];
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn solid" onClick={go} disabled={busy || a.status === "Stopped"} data-testid="run-backtest">
          {busy ? "Reading rounds…" : res || a.backtest ? "Run the backtest again" : "Run the backtest"}
        </button>
        {(a.status === "Testing" || a.status === "Draft") && (res || a.backtest) ? (
          <button type="button" className="btn" onClick={onPaper} data-testid="start-paper">
            Start paper mode →
          </button>
        ) : null}
        <span className="cap">Source: Chainlink {asset?.feedName} on Robinhood Chain</span>
      </div>
      {err ? <p className="note bad">{err}</p> : null}
      {s ? (
        <>
          <div className="hgrid grid-cols-4 two-sm" data-testid="bt-stats">
            <div>
              <p className="cap">Agent return</p>
              <p className="mt-3 text-[34px] font-black leading-none">{pct(s.returnPct)}</p>
            </div>
            <div>
              <p className="cap">Holding {a.config.asset}</p>
              <p className="mt-3 text-[34px] font-black leading-none">{pct(s.holdPct)}</p>
            </div>
            <div>
              <p className="cap">Max drawdown</p>
              <p className="mt-3 text-[34px] font-black leading-none">−{s.maxDrawdownPct.toFixed(2)} %</p>
            </div>
            <div>
              <p className="cap">Fees paid (simulated)</p>
              <p className="mt-3 text-[34px] font-black leading-none">{usd(s.fees)}</p>
            </div>
          </div>
          <p className="cap">
            {s.trades} fills · {s.blocked} buys refused by the limits · {s.bars} bars from {dateText(s.from)} to {dateText(s.to)}
          </p>
          {res ? (
            <>
              <div className="box !p-3">
                <Curve curve={res.r.curve} />
                <p className="cap mt-2">— agent equity · - - holding the asset · {res.h.rounds.length} Chainlink rounds read, phase {res.h.phase}</p>
              </div>
              <p className="note warn">Backtest results are not future results. Fees and slippage are your inputs; history covers only the feed&apos;s current phase.</p>
              <div className="flex items-center justify-between gap-3">
                <p className="cap">Decisions, newest first</p>
                <label className="cap inline-flex items-center gap-2">
                  <input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> hide holds
                </label>
              </div>
              <DecisionRows rows={rows} testid="bt-decisions" />
            </>
          ) : (
            <p className="note">Saved summary from {dateText(a.backtest!.at)}. Run it again to see every decision.</p>
          )}
        </>
      ) : (
        <p className="note">
          No backtest yet. It replays {STRATEGIES[a.config.strategy.kind].label.toLowerCase()} over the feed&apos;s round history, with your fees and slippage, and shows every decision with its reason.
        </p>
      )}
    </div>
  );
}

export function MonitorPanel({ a, price, priceAt, onPause, onResume, onKill, onNow }: { a: AgentRecord; price: number | null; priceAt: number | null; onPause: () => void; onResume: () => void; onKill: () => void; onNow: () => void }) {
  if (!a.paper)
    return <p className="note">This agent is not in paper mode yet. Run a backtest, then start paper mode from the Test tab.</p>;
  const s = a.paper.state;
  const px = price ?? a.paper.decisions[0]?.price ?? 0;
  const u = usage(a.config, s, px);
  const al = alerts(a.config, s, px, now());
  const equity = s.cash + s.units * px;
  const bar = a.config.barMinutes * 60;
  const next = a.paper.lastBar + bar;
  return (
    <div className="grid gap-5" data-testid="monitor">
      <div className="hgrid grid-cols-4 two-sm">
        <div>
          <p className="cap">Equity (paper)</p>
          <p className="mt-3 text-[30px] font-black leading-none" data-testid="m-equity">{usd(equity)}</p>
          <p className="cap mt-2">{pct(((equity - a.config.capital) / a.config.capital) * 100)} since start</p>
        </div>
        <div>
          <p className="cap">Position</p>
          <p className="mt-3 text-[30px] font-black leading-none">{usd(s.units * px)}</p>
          <p className="cap mt-2">{s.units ? `${s.units.toFixed(5)} ${a.config.asset} @ ${s.avgCost.toFixed(2)}` : "flat"}</p>
        </div>
        <div>
          <p className="cap">Live price</p>
          <p className="mt-3 text-[30px] font-black leading-none" data-testid="m-price">{price ? price.toFixed(2) : "—"}</p>
          <p className="cap mt-2">{priceAt ? `Chainlink round ${new Date(priceAt * 1000).toISOString().slice(11, 16)} UTC` : "reading"}</p>
        </div>
        <div>
          <p className="cap">Status</p>
          <p className="mt-3 text-[30px] font-black uppercase leading-none" data-testid="m-status">{a.status}</p>
          <p className="cap mt-2">{a.status === "Paper" ? `next bar ${new Date(next * 1000).toISOString().slice(11, 16)} UTC` : a.status === "Paused" ? "not evaluating" : "stopped for good"}</p>
        </div>
      </div>
      <div className="grid gap-5 min-[800px]:grid-cols-4">
        <Meter label="Position / max" v={u.position} hint={`max $${a.config.limits.maxPosition}`} />
        <Meter label="Trades today" v={u.trades} hint={`${s.tradesToday} of ${a.config.limits.maxTradesPerDay} (UTC day)`} />
        <Meter label="Daily loss" v={u.loss} hint={`${usd(s.lossToday)} of $${a.config.limits.maxDailyLoss}`} />
        <Meter label="Stop-loss distance" v={u.stop} hint={`stop at −${a.config.limits.stopLossPct} % from cost`} />
      </div>
      <div data-testid="m-alerts">
        {al.length ? al.map((x) => <p key={x.text} className={`note mb-2 ${x.level === "hit" ? "bad" : "warn"}`}>{x.level === "hit" ? "Limit hit" : "Near a limit"}: {x.text}</p>) : <p className="note">No alerts.</p>}
      </div>
      <div className="flex flex-wrap gap-3">
        {a.status === "Paper" ? (
          <>
            <button type="button" className="btn" onClick={onNow} disabled={!price} data-testid="m-now">
              Evaluate now
            </button>
            <button type="button" className="btn" onClick={onPause} data-testid="m-pause">
              Pause
            </button>
          </>
        ) : null}
        {a.status === "Paused" ? (
          <button type="button" className="btn" onClick={onResume} data-testid="m-resume">
            Resume
          </button>
        ) : null}
        {a.status !== "Stopped" ? (
          <button type="button" className="btn danger" onClick={onKill} data-testid="m-kill">
            Kill switch
          </button>
        ) : null}
      </div>
      <p className="cap !normal-case !tracking-normal">Paper mode runs while a tab of this site is open; bars missed while it was closed are replayed from Chainlink round history when you come back. No real orders are sent.</p>
      <DecisionRows rows={a.paper.decisions.slice(0, 40)} testid="m-decisions" />
    </div>
  );
}

export function HistoryPanel({ a }: { a: AgentRecord }) {
  return (
    <div className="scroll-x">
      <table className="tbl min-w-[560px]" data-testid="timeline">
        <thead>
          <tr>
            <th>When (UTC)</th>
            <th>Event</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {a.timeline.map((t, i) => (
            <tr key={i}>
              <td className="mono text-[12px]">{dateText(t.t)}</td>
              <td>
                <span className={`chip ${t.kind === "alert" || t.kind === "stopped" ? "bad" : t.kind === "chain" ? "ink" : ""}`}>{t.kind}</span>
              </td>
              <td className="text-[13px]">{t.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
