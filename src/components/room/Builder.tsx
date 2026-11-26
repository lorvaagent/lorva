"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ASSETS } from "@/lib/agents/assets";
import { DEFAULT_CONFIG, STRATEGIES, configHash, configProblems, type AgentConfig, type StrategyKind } from "@/lib/agents/engine";
import { useAgents } from "@/components/room/useAgents";
import { shortAddress } from "@/config/brand";

/* The step builder: asset → rule → size → limits → review. Every field is explicit; nothing is guessed for you. */

const STEPS = ["Asset", "Rule", "Size", "Limits", "Review"] as const;

function Num({ label, value, onChange, step = 1, min, max, unit, testid }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; unit?: string; testid?: string }) {
  return (
    <label className="field">
      <span>
        {label}
        {unit ? ` (${unit})` : ""}
      </span>
      <input className="input mono" type="number" step={step} min={min} max={max} value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(Number(e.target.value))} data-testid={testid} />
    </label>
  );
}

export function Builder() {
  const router = useRouter();
  const { add } = useAgents();
  const [i, setI] = useState(0);
  const [c, setC] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [err, setErr] = useState<string | null>(null);
  const problems = useMemo(() => configProblems(c), [c]);
  const set = (fn: (x: AgentConfig) => AgentConfig) => setC((x) => fn(structuredClone(x)));
  const asset = ASSETS.find((a) => a.symbol === c.asset)!;

  const save = () => {
    setErr(null);
    if (problems.length) return setErr(problems.join(" "));
    try {
      const a = add(c);
      router.push(`/room?agent=${a.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8 min-[1000px]:grid-cols-[220px_1fr]">
      <ol className="grid h-max gap-0 border-t border-[var(--line)]" aria-label="Steps">
        {STEPS.map((s, k) => (
          <li key={s}>
            <button type="button" onClick={() => setI(k)} className={`flex w-full items-baseline gap-4 border-b border-[var(--line)] py-3 text-left ${k === i ? "" : "text-[var(--muted)]"}`} aria-current={k === i ? "step" : undefined} data-testid={`step-${k}`}>
              <span className="cap">{String(k + 1).padStart(2, "0")}</span>
              <span className="text-[20px] font-black uppercase leading-none">{s}</span>
              {k < i ? <span className="cap ml-auto">done</span> : null}
            </button>
          </li>
        ))}
      </ol>

      <div className="min-w-0">
        {i === 0 ? (
          <div className="grid gap-5">
            <label className="field max-w-[420px]">
              <span>Agent name</span>
              <input className="input" value={c.name} maxLength={32} onChange={(e) => set((x) => ({ ...x, name: e.target.value }))} data-testid="b-name" />
            </label>
            <div className="hgrid grid-cols-4 two-sm">
              {ASSETS.map((a) => (
                <button key={a.symbol} type="button" onClick={() => set((x) => ({ ...x, asset: a.symbol }))} className={`text-left ${c.asset === a.symbol ? "" : "opacity-55"}`} aria-pressed={c.asset === a.symbol} data-testid={`b-asset-${a.symbol}`}>
                  <p className="text-[30px] font-black leading-none">{a.symbol}</p>
                  <p className="cap mt-3">{a.name}</p>
                  <p className="cap mt-1 !text-[var(--faint)]">{a.feedName}</p>
                </button>
              ))}
            </div>
            <p className="note">
              Price: Chainlink {asset.feedName} on Robinhood Chain ({shortAddress(asset.feed)}). {asset.token ? `Token: ${asset.tokenNote} ${shortAddress(asset.token)}.` : ""} Stock tokens are tokens on Robinhood Chain, not the shares.
            </p>
          </div>
        ) : null}

        {i === 1 ? (
          <div className="grid gap-5">
            <div className="hgrid grid-cols-4 two-sm">
              {(Object.keys(STRATEGIES) as StrategyKind[]).map((k) => (
                <button key={k} type="button" onClick={() => set((x) => ({ ...x, strategy: { ...x.strategy, kind: k } }))} className={`text-left ${c.strategy.kind === k ? "" : "opacity-55"}`} aria-pressed={c.strategy.kind === k} data-testid={`b-rule-${k}`}>
                  <p className="text-[22px] font-black uppercase leading-none">{STRATEGIES[k].label}</p>
                  <p className="mt-3 text-[13px] text-[var(--muted)]">{STRATEGIES[k].rule}</p>
                </button>
              ))}
            </div>
            <div className="grid max-w-[640px] grid-cols-2 gap-4 min-[700px]:grid-cols-3">
              <label className="field">
                <span>Bar size</span>
                <select className="input" value={c.barMinutes} onChange={(e) => set((x) => ({ ...x, barMinutes: Number(e.target.value) as 15 | 60 }))} data-testid="b-bar">
                  <option value={60}>1 hour</option>
                  <option value={15}>15 minutes</option>
                </select>
              </label>
              {c.strategy.kind !== "dca" ? <Num label="Lookback N" unit="bars" value={c.strategy.lookback} min={3} max={200} onChange={(v) => set((x) => ({ ...x, strategy: { ...x.strategy, lookback: v } }))} testid="b-lookback" /> : null}
              {c.strategy.kind === "dip" ? <Num label="Dip X" unit="%" step={0.1} value={c.strategy.dipPct} onChange={(v) => set((x) => ({ ...x, strategy: { ...x.strategy, dipPct: v } }))} /> : null}
              {c.strategy.kind === "dca" ? <Num label="Buy every K" unit="bars" value={c.strategy.everyBars} onChange={(v) => set((x) => ({ ...x, strategy: { ...x.strategy, everyBars: v } }))} testid="b-every" /> : null}
            </div>
          </div>
        ) : null}

        {i === 2 ? (
          <div className="grid max-w-[640px] gap-5">
            <div className="seg" role="group" aria-label="Position size">
              <button type="button" aria-pressed={c.sizing.mode === "fixed"} onClick={() => set((x) => ({ ...x, sizing: { mode: "fixed", value: 250 } }))}>
                Fixed USD
              </button>
              <button type="button" aria-pressed={c.sizing.mode === "pct"} onClick={() => set((x) => ({ ...x, sizing: { mode: "pct", value: 25 } }))}>
                % of account
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Num label="Size per buy" unit={c.sizing.mode === "fixed" ? "USD" : "%"} value={c.sizing.value} onChange={(v) => set((x) => ({ ...x, sizing: { ...x.sizing, value: v } }))} testid="b-size" />
              <Num label="Paper account" unit="USD" value={c.capital} onChange={(v) => set((x) => ({ ...x, capital: v }))} testid="b-capital" />
              <Num label="Fee" unit="bps" value={c.costs.feeBps} onChange={(v) => set((x) => ({ ...x, costs: { ...x.costs, feeBps: v } }))} />
              <Num label="Slippage" unit="bps" value={c.costs.slippageBps} onChange={(v) => set((x) => ({ ...x, costs: { ...x.costs, slippageBps: v } }))} />
            </div>
            <p className="note">Fees and slippage are your assumptions, charged on every simulated fill. Real costs can be different.</p>
          </div>
        ) : null}

        {i === 3 ? (
          <div className="grid max-w-[640px] grid-cols-2 gap-4">
            <Num label="Max position" unit="USD" value={c.limits.maxPosition} onChange={(v) => set((x) => ({ ...x, limits: { ...x.limits, maxPosition: v } }))} testid="b-maxpos" />
            <Num label="Max daily loss" unit="USD" value={c.limits.maxDailyLoss} onChange={(v) => set((x) => ({ ...x, limits: { ...x.limits, maxDailyLoss: v } }))} testid="b-maxloss" />
            <Num label="Trades per UTC day" value={c.limits.maxTradesPerDay} onChange={(v) => set((x) => ({ ...x, limits: { ...x.limits, maxTradesPerDay: v } }))} testid="b-trades" />
            <Num label="Stop-loss" unit="%" step={0.1} value={c.limits.stopLossPct} onChange={(v) => set((x) => ({ ...x, limits: { ...x.limits, stopLossPct: v } }))} testid="b-stop" />
            <Num label="Limits valid for" unit="days" value={c.limits.validDays} onChange={(v) => set((x) => ({ ...x, limits: { ...x.limits, validDays: v } }))} />
            <p className="note col-span-2">Limits stop new risk; they never block an exit. A stop-loss sells the whole position.</p>
          </div>
        ) : null}

        {i === 4 ? (
          <div className="grid gap-5" data-testid="b-review">
            <div className="hgrid grid-cols-3 two-sm">
              <div>
                <p className="cap">Agent</p>
                <p className="mt-3 text-[24px] font-black uppercase leading-none">{c.name}</p>
                <p className="cap mt-2">{c.asset} · {c.barMinutes === 60 ? "1 h" : "15 min"} bars</p>
              </div>
              <div>
                <p className="cap">Rule</p>
                <p className="mt-3 text-[14px]">{STRATEGIES[c.strategy.kind].rule.replace("N-bar", `${c.strategy.lookback}-bar`).replace(/N\/2/, String(Math.floor(c.strategy.lookback / 2))).replace("X %", `${c.strategy.dipPct} %`).replace("K bars", `${c.strategy.everyBars} bars`)}</p>
              </div>
              <div>
                <p className="cap">Size and costs</p>
                <p className="mt-3 text-[14px]">
                  {c.sizing.mode === "fixed" ? `$${c.sizing.value}` : `${c.sizing.value} % of the account`} per buy · account ${c.capital} · fee {c.costs.feeBps} bps · slippage {c.costs.slippageBps} bps
                </p>
              </div>
            </div>
            <div className="hgrid grid-cols-5 two-sm">
              {[
                ["Max position", `$${c.limits.maxPosition}`],
                ["Max daily loss", `$${c.limits.maxDailyLoss}`],
                ["Trades / day", String(c.limits.maxTradesPerDay)],
                ["Stop-loss", `${c.limits.stopLossPct} %`],
                ["Valid", `${c.limits.validDays} days`],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="cap">{k}</p>
                  <p className="mt-3 text-[26px] font-black leading-none">{v}</p>
                </div>
              ))}
            </div>
            <p className="cap break-all">
              Rules hash <b>{configHash(c)}</b>
            </p>
            {problems.length ? <p className="note bad">{problems.join(" ")}</p> : <p className="note ok">Ready. It starts as a Draft; test it before paper mode.</p>}
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          {i > 0 ? (
            <button type="button" className="btn" onClick={() => setI(i - 1)}>
              ← Back
            </button>
          ) : null}
          {i < 4 ? (
            <button type="button" className="btn solid" onClick={() => setI(i + 1)} data-testid="b-next">
              Next →
            </button>
          ) : (
            <button type="button" className="btn solid" onClick={save} disabled={problems.length > 0} data-testid="b-save">
              Save agent
            </button>
          )}
        </div>
        {err ? (
          <p className="note bad mt-4" role="alert">
            {err}
          </p>
        ) : null}
      </div>
    </div>
  );
}
