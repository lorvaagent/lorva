import Link from "next/link";
import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { registryLive } from "@/config/contracts";
import { CaBox } from "@/components/site/CaCopy";
import { Preloader } from "@/components/site/Preloader";
import { StatusBadge } from "@/components/site/PageHead";
import { Pipeline } from "@/components/home/Pipeline";
import { HeroTitle } from "@/components/home/HeroTitle";
import { LiveStats } from "@/components/home/LiveStats";
import { Chapter } from "@/components/home/Chapter";
import { BIT_WORDS } from "@/lib/agents/bits";
import { HOME_DESCRIPTION, HOME_TITLE, appLd, ldJson, pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ path: "/", title: HOME_TITLE, description: HOME_DESCRIPTION });

const STEPS = [
  { n: "01", t: "Asset", d: "ETH or a Robinhood stock token with a Chainlink feed on Robinhood Chain." },
  { n: "02", t: "Rule", d: "Trend follow, breakout, buy the dip or steady buying, with its lookback." },
  { n: "03", t: "Size", d: "A fixed USD amount or a share of the paper account, plus fee and slippage." },
  { n: "04", t: "Limits", d: "Max position, max daily loss, trades per day, stop-loss, expiry." },
  { n: "05", t: "Review", d: "Every rule in plain words and the hash that identifies this exact version." },
];

const ROOM = [
  { name: "Night shift", asset: "ETH", status: "Paper", pos: 0.62, trades: 0.5, loss: 0.1, alert: null as string | null, last: "HOLD · above the 24-bar average" },
  { name: "Gap hunter", asset: "NVDA", status: "Paper", pos: 0.88, trades: 1, loss: 0.35, alert: "Trades today reached", last: "BLOCKED · trades-per-day limit" },
  { name: "Slow stack", asset: "TSLA", status: "Paused", pos: 0.4, trades: 0.25, loss: 0.84, alert: "Daily loss at 84 %", last: "WAIT · paused by the owner" },
];

const LIMIT_ROWS: (keyof typeof BIT_WORDS)[] = ["OVER_POSITION", "TRADES_PER_DAY", "DAILY_LOSS_HIT", "LIMITS_EXPIRED", "PAUSED", "KILLED", "NOT_OPERATOR", "STALE_VERSION"];

const STATUS: { f: string; s: "Prototype" | "Concept"; n: string }[] = [
  { f: "Step builder for agents (asset, rule, size, limits, review)", s: "Prototype", n: "Saved in this browser; up to 12 agents." },
  { f: "Backtest on Chainlink round history from Robinhood Chain", s: "Prototype", n: "Up to 1,000 rounds of the feed's current phase, fees and slippage as inputs." },
  { f: "Paper mode on live prices with the monitor and kill switch", s: "Prototype", n: "Runs while a tab is open; replays missed bars when you come back." },
  { f: "On-chain agent records (LorvaAgentRegistry)", s: "Prototype", n: registryLive() ? "Live on Robinhood Chain." : "Built and tested; the owner deploys it. The site says so until then." },
  { f: "Real-money trading through a vault", s: "Concept", n: "Not built. It comes after permissions and limits are proven on paper." },
  { f: `Token features (${BRAND.symbol})`, s: "Concept", n: "Longer backtests, more active agents, deeper reports. Not built." },
];

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(appLd)} />
      <Preloader />

      {/* hero: the pipeline + the giant headline */}
      <section className="relative overflow-hidden">
        <Pipeline className="max-[900px]:hidden" />
        <div className="edge relative flex min-h-[calc(100svh-78px)] flex-col pb-10 pt-[72px] max-[900px]:min-h-0 max-[900px]:pt-10">
          <p className="cap" data-reveal="">
            {BRAND.name} / Trading agents on {BRAND.chainName}
          </p>
          <div className="mt-8">
            <HeroTitle lines={["Trading agents.", "Your rules."]} />
          </div>
          <div className="relative mt-8 hidden h-[160px] max-[900px]:block" aria-hidden="true">
            <Pipeline />
          </div>
          <div className="mt-auto grid gap-8 pt-14 min-[901px]:grid-cols-[1fr_minmax(0,430px)] min-[901px]:items-end">
            <Link href="/room" className="inline-flex items-center gap-3 self-end text-[13px]" data-reveal="">
              <span aria-hidden="true">↓</span> <span className="elink">Open the control room</span>
            </Link>
            <div className="bg-[var(--ground)] p-1" data-reveal="">
              <p className="lede">
                Build a trading agent step by step, test it on real price history from {BRAND.chainName}, then watch it run on paper with every limit in view: position,
                daily loss, trades per day, stop-loss. No real money moves. A backtest result is not a future result.
              </p>
              <p className="cap mt-4">
                Test the strategy / <b>Set the limits</b>
              </p>
              <div className="mt-5">
                <CaBox testid="hero-ca" compact />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="edge">
        <LiveStats />
        <div className="py-8">
          <p className="cap">Reads from</p>
          <div className="mt-5 grid grid-cols-2 gap-6 min-[901px]:grid-cols-4">
            {["Chainlink feeds", "Robinhood Chain", "Multicall3", "Your wallet"].map((w) => (
              <p key={w} className="text-[clamp(22px,2.8vw,40px)] font-black leading-none" data-reveal="">
                {w}
              </p>
            ))}
          </div>
          <p className="cap mt-5 !text-[var(--faint)]">Data sources the site reads directly. Not partners, no affiliation.</p>
        </div>
        <div className="rule" />
        <Chapter n={1} of={4} title="The builder." href="#builder" />
      </section>

      {/* builder */}
      <section id="builder" className="edge scroll-mt-24">
        <div className="grid gap-6 min-[901px]:grid-cols-[1fr_minmax(0,430px)] min-[901px]:items-end">
          <h2 className="display d-sec" data-reveal="">
            Build it in
            <br />
            five steps.
          </h2>
          <p className="lede" data-reveal="">
            Every agent is deterministic code you can read: no model decides anything. The same rules run the backtest and the paper run, so a paper decision is
            exactly what the backtest would have done on that bar.
          </p>
        </div>
        <div className="hgrid mt-12 grid-cols-5 max-[900px]:grid-cols-1 max-[900px]:[&>*]:!border-l-0 max-[900px]:[&>*]:!pl-0 max-[900px]:[&>*+*]:border-t max-[900px]:[&>*+*]:border-[var(--line)]">
          {STEPS.map((s) => (
            <div key={s.n} data-reveal="">
              <p className="cap">Step {s.n}</p>
              <p className="mt-6 text-[26px] font-black uppercase leading-none">{s.t}</p>
              <p className="mt-3 text-[13.5px] text-[var(--muted)]">{s.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Link href="/build" className="btn solid">
            Build an agent →
          </Link>
        </div>
        <Chapter n={2} of={4} title="The monitor." href="#monitor" />
      </section>

      {/* monitor */}
      <section id="monitor" className="edge scroll-mt-24">
        <div className="grid gap-6 min-[901px]:grid-cols-[1fr_minmax(0,430px)] min-[901px]:items-end">
          <h2 className="display d-sec" data-reveal="">
            A control room
            <br />
            for every agent.
          </h2>
          <p className="lede" data-reveal="">
            Each agent shows its status, its position, how much of every limit it has used today, and the reason for its last decision. Near a limit, it warns. At a
            limit, it stops adding risk. One button stops it for good.
          </p>
        </div>
        <div className="mt-12 grid gap-4 min-[901px]:grid-cols-3">
          {ROOM.map((a) => (
            <div key={a.name} className="box" data-reveal="">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[20px] font-black uppercase leading-none">{a.name}</p>
                <span className={`chip ${a.status === "Paper" ? "ok" : "warn"}`}>
                  <i /> {a.status}
                </span>
              </div>
              <p className="cap mt-2">{a.asset} · paper account</p>
              {[
                ["Position / max", a.pos],
                ["Trades today", a.trades],
                ["Daily loss / limit", a.loss],
              ].map(([k, v]) => (
                <div key={k as string} className="mt-4">
                  <div className="cap flex justify-between">
                    <span>{k}</span>
                    <b>{Math.round((v as number) * 100)} %</b>
                  </div>
                  <div className={`meter mt-1.5 ${(v as number) >= 1 ? "hit" : (v as number) >= 0.8 ? "near" : ""}`}>
                    <i style={{ "--w": `${Math.min(100, (v as number) * 100)}%` } as React.CSSProperties} />
                  </div>
                </div>
              ))}
              {a.alert ? <p className={`note mt-4 ${a.alert.includes("reached") ? "bad" : "warn"}`}>{a.alert}</p> : <p className="note mt-4">No alerts</p>}
              <p className="cap mt-4 !normal-case !tracking-normal">Last: {a.last}</p>
              <div className="mt-4 flex gap-2">
                <span className="btn sm">{a.status === "Paused" ? "Resume" : "Pause"}</span>
                <span className="btn sm danger">Kill switch</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3">
          <span className="badge sample">Sample data</span>
        </p>
        <Chapter n={3} of={4} title="The limits." href="#limits" />
      </section>

      {/* limits */}
      <section id="limits" className="edge scroll-mt-24">
        <div className="grid gap-6 min-[901px]:grid-cols-[1fr_minmax(0,430px)] min-[901px]:items-end">
          <h2 className="display d-sec" data-reveal="">
            Limits stop risk.
            <br />
            Never an exit.
          </h2>
          <p className="lede" data-reveal="">
            A buy is refused when it would pass a limit; a sell or a stop-loss always goes through. The same rules live in LorvaAgentRegistry on {BRAND.chainName}: an agent
            belongs to your wallet, its limits are versioned, one operator key acts for it, and canAct() returns every reason before anything is sent.
          </p>
        </div>
        <div className="hgrid mt-12 grid-cols-4 two-sm">
          {LIMIT_ROWS.slice(0, 4).map((k) => (
            <div key={k} data-reveal="">
              <p className="cap">{k}</p>
              <p className="mt-4 text-[17px] font-bold">{BIT_WORDS[k]}</p>
            </div>
          ))}
        </div>
        <div className="hgrid grid-cols-4 two-sm border-t-0">
          {LIMIT_ROWS.slice(4).map((k) => (
            <div key={k} data-reveal="">
              <p className="cap">{k}</p>
              <p className="mt-4 text-[17px] font-bold">{BIT_WORDS[k]}</p>
            </div>
          ))}
        </div>
        <p className="cap mt-4">
          Contract: LorvaAgentRegistry · {registryLive() ? <b>live on {BRAND.chainName}</b> : <b>built and tested, not deployed yet</b>} · no funds, no admin, no upgrade
        </p>
        <Chapter n={4} of={4} title="What is real." href="#real" />
      </section>

      {/* status */}
      <section id="real" className="edge scroll-mt-24">
        <h2 className="display d-sec" data-reveal="">
          Built today.
          <br />
          Concepts, named.
        </h2>
        <div className="scroll-x mt-10" data-reveal="">
          <table className="tbl min-w-[640px]">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {STATUS.map((r) => (
                <tr key={r.f}>
                  <td className="font-bold">{r.f}</td>
                  <td>
                    <StatusBadge status={r.s} />
                  </td>
                  <td className="text-[var(--muted)]">{r.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cap mt-6 !normal-case !tracking-normal">
          Backtest results are not future results. Paper trading uses live prices but no real orders, so real fills, fees and slippage can differ. Nothing here is advice.
          {` ${BRAND.name} is not affiliated with Robinhood.`}
        </p>
        <Link href="/room" className="group mt-16 block" data-reveal="">
          <p className="cap">Open →</p>
          <p className="display d-chapter mt-2 group-hover:!text-[var(--ink)]">The control room.</p>
        </Link>
      </section>
    </>
  );
}
