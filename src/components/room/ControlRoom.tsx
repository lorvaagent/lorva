"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { alerts, usage } from "@/lib/agents/engine";
import type { AgentRecord } from "@/lib/agents/agent";
import { barsFrom, fetchHistory, fetchLatest, now, useAgents, type LatestPrice } from "@/components/room/useAgents";
import { advance, evaluateNow, pendingBars, startPaper } from "@/components/room/paper";
import { HistoryPanel, Meter, MonitorPanel, TestPanel } from "@/components/room/Panels";
import { ChainPanel } from "@/components/room/ChainPanel";

/*
 * The control room: every agent as a tile (status, limit meters, alerts), one selected agent in detail (Test, Monitor, History,
 * On chain), and the paper engine that advances every agent in Paper status on live Chainlink prices while this tab is open.
 */

const TABS = ["Monitor", "Test", "History", "On chain"] as const;
type Tab = (typeof TABS)[number];

export function ControlRoom() {
  const { agents, ready, update, setStatus, log, remove, replaceAll } = useAgents();
  const params = useSearchParams();
  const router = useRouter();
  const [sel, setSel] = useState<string | null>(params.get("agent"));
  const [tab, setTab] = useState<Tab>("Monitor");
  const [prices, setPrices] = useState<Record<string, LatestPrice>>({});
  const [feedErr, setFeedErr] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!sel && agents.length) setSel(agents[0].id);
  }, [agents, sel]);
  const a = agents.find((x) => x.id === sel) ?? null;
  useEffect(() => {
    if (a && !a.backtest && !a.paper) setTab("Test");
  }, [a?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- the paper engine: every 20 s, advance agents whose bar closed (catch-up replay from history if bars were missed)
  const tick = useCallback(async () => {
    if (busy.current || document.visibilityState === "hidden") return;
    busy.current = true;
    try {
      const latest = await fetchLatest();
      setFeedErr(null);
      const map = Object.fromEntries(latest.map((p) => [p.symbol, p]));
      setPrices(map);
      const t = now();
      for (const ag of agents.filter((x) => x.status === "Paper" && x.paper)) {
        const live = map[ag.config.asset]?.price ?? null;
        let bars = pendingBars(ag, t, null, live);
        if (bars.length > 1 || (bars.length === 1 && bars[0].t - ag.paper!.lastBar > ag.config.barMinutes * 60)) {
          const h = await fetchHistory(ag.config.asset).catch(() => null);
          bars = pendingBars(ag, t, h ? barsFrom(h, ag.config.barMinutes, t) : null, live);
        }
        if (bars.length) update(ag.id, (cur) => advance(cur, bars, t).agent);
      }
    } catch (e) {
      setFeedErr(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
    }
  }, [agents, update]);

  useEffect(() => {
    if (!ready) return;
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, [ready, tick]);

  const startPaperMode = async (ag: AgentRecord) => {
    const h = await fetchHistory(ag.config.asset);
    const t = now();
    update(ag.id, (cur) => {
      const started = startPaper(cur, barsFrom(h, cur.config.barMinutes, t), t);
      return { ...started, status: "Paper", timeline: [{ t, kind: "paper", text: `Paper mode started with $${cur.config.capital} (indicators warmed with ${cur.config.strategy.lookback} bars of history)` }, ...cur.timeline] };
    });
    setTab("Monitor");
  };

  const killAll = () => {
    for (const ag of agents.filter((x) => x.status !== "Stopped")) setStatus(ag.id, "Stopped", "Kill switch (all agents)");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(agents, null, 1)], { type: "application/json" });
    const u = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = u;
    el.download = "lorva-agents.json";
    el.click();
    URL.revokeObjectURL(u);
  };
  const importJson = async (f: File) => {
    try {
      const v = JSON.parse(await f.text());
      if (Array.isArray(v) && v.every((x) => x && typeof x.id === "string" && x.config)) replaceAll(v);
    } catch {
      // ignored: not a Lorva export
    }
  };

  const live = useMemo(() => agents.filter((x) => x.status !== "Stopped").length, [agents]);

  if (!ready) return <p className="note">Loading the control room…</p>;

  if (!agents.length)
    return (
      <div className="grid max-w-[640px] gap-5">
        <p className="lede">No agents in this browser yet. Build one in five steps; it starts as a Draft, then you test it and run it on paper.</p>
        <Link href="/build" className="btn solid w-max" data-testid="room-build">
          Build an agent →
        </Link>
      </div>
    );

  return (
    <div className="grid gap-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="cap">
          {agents.length} agents · <b>{live} not stopped</b> · prices {Object.keys(prices).length ? `live (${Object.keys(prices).join(", ")})` : "reading"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/build" className="btn sm">
            + New agent
          </Link>
          <button type="button" className="btn sm" onClick={exportJson}>
            Export
          </button>
          <label className="btn sm cursor-pointer">
            Import
            <input type="file" accept="application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
          </label>
          <button type="button" className="btn sm danger" onClick={killAll} disabled={!live} data-testid="kill-all">
            Kill all
          </button>
        </div>
      </div>
      {feedErr ? <p className="note bad">Live prices: {feedErr}</p> : null}

      <div className="grid grid-cols-1 gap-3 min-[700px]:grid-cols-2 min-[1100px]:grid-cols-3" data-testid="tiles">
        {agents.map((ag) => {
          const px = prices[ag.config.asset]?.price ?? ag.paper?.decisions[0]?.price ?? 0;
          const u = ag.paper ? usage(ag.config, ag.paper.state, px) : null;
          const al = ag.paper ? alerts(ag.config, ag.paper.state, px, now()) : [];
          return (
            <button key={ag.id} type="button" onClick={() => setSel(ag.id)} className={`box text-left ${sel === ag.id ? "!border-[var(--ink)]" : ""}`} data-testid={`tile-${ag.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[22px] font-black uppercase leading-none">{ag.config.name}</p>
                  <p className="cap mt-2">
                    {ag.config.asset} · {ag.config.strategy.kind} {ag.chain ? `· chain #${ag.chain.id}` : ""}
                  </p>
                </div>
                <span className={`chip ${ag.status === "Paper" ? "ok" : ag.status === "Paused" ? "warn" : ag.status === "Stopped" ? "bad" : ""}`} data-testid={`tile-status-${ag.id}`}>
                  <i /> {ag.status}
                </span>
              </div>
              {u ? (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <Meter label="Pos" v={u.position} hint="" />
                  <Meter label="Trades" v={u.trades} hint="" />
                  <Meter label="Loss" v={u.loss} hint="" />
                </div>
              ) : (
                <p className="cap mt-4 !normal-case !tracking-normal">{ag.backtest ? `Backtest ${ag.backtest.returnPct > 0 ? "+" : ""}${ag.backtest.returnPct} % vs hold ${ag.backtest.holdPct > 0 ? "+" : ""}${ag.backtest.holdPct} %` : "Not tested yet"}</p>
              )}
              {al.length ? <p className={`note mt-3 ${al.some((x) => x.level === "hit") ? "bad" : "warn"}`}>{al[0].text}</p> : null}
            </button>
          );
        })}
      </div>

      {a ? (
        <section className="grid gap-6" data-testid="detail">
          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-[var(--line)] pt-8">
            <div>
              <p className="cap">Agent · {a.id}</p>
              <h2 className="display d-sec mt-3" data-testid="detail-name">
                {a.config.name}
              </h2>
            </div>
            <div className="seg" role="tablist">
              {TABS.map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} data-testid={`tab-${t.replace(" ", "-").toLowerCase()}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          {tab === "Test" ? (
            <TestPanel
              a={a}
              onTested={(r, h) =>
                update(a.id, (cur) => ({
                  ...cur,
                  status: cur.status === "Draft" ? "Testing" : cur.status,
                  backtest: { at: now(), ...r.stats, source: h.source },
                  timeline: [{ t: now(), kind: "tested", text: `Backtest: ${r.stats.returnPct} % vs hold ${r.stats.holdPct} %, max drawdown ${r.stats.maxDrawdownPct} %, ${r.stats.trades} fills, ${r.stats.blocked} refused` }, ...cur.timeline],
                }))
              }
              onPaper={() => startPaperMode(a)}
            />
          ) : null}
          {tab === "Monitor" ? (
            <MonitorPanel
              a={a}
              price={prices[a.config.asset]?.price ?? null}
              priceAt={prices[a.config.asset]?.updatedAt ?? null}
              onPause={() => setStatus(a.id, "Paused", "Paused by the owner")}
              onResume={() =>
                update(a.id, (cur) => {
                  const bar = cur.config.barMinutes * 60;
                  const resumed = { ...cur, paper: cur.paper ? { ...cur.paper, lastBar: Math.floor(now() / bar) * bar } : cur.paper };
                  return { ...resumed, status: "Paper", timeline: [{ t: now(), kind: "resumed", text: "Resumed (bars during the pause are not replayed)" }, ...cur.timeline] };
                })
              }
              onKill={() => setStatus(a.id, "Stopped", "Kill switch: stopped for good")}
              onNow={() => {
                const p = prices[a.config.asset]?.price;
                if (p) update(a.id, (cur) => evaluateNow(cur, p, now()).agent);
              }}
            />
          ) : null}
          {tab === "History" ? <HistoryPanel a={a} /> : null}
          {tab === "On chain" ? (
            <ChainPanel
              a={a}
              onLinked={(c) => update(a.id, (cur) => ({ ...cur, chain: c }))}
              onLog={(text, tx) => log(a.id, { kind: "chain", text, tx })}
              onKilledOnChain={() => a.status !== "Stopped" && setStatus(a.id, "Stopped", "Kill switch on chain")}
            />
          ) : null}
          {a.status === "Stopped" ? (
            <button
              type="button"
              className="btn sm w-max"
              onClick={() => {
                remove(a.id);
                setSel(null);
                router.replace("/room");
              }}
            >
              Remove this stopped agent from the browser
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
