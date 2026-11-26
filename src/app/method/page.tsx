import Link from "next/link";
import type { Metadata } from "next";
import { BRAND, CHAIN, shortAddress } from "@/config/brand";
import { CONTRACTS, registryLive } from "@/config/contracts";
import { PageHead, StatusBadge } from "@/components/site/PageHead";
import { ASSETS } from "@/lib/agents/assets";
import { ACT_BITS, BIT_WORDS, LIMIT_BITS } from "@/lib/agents/bits";
import { STRATEGIES, type StrategyKind } from "@/lib/agents/engine";
import { FAQ } from "@/lib/faq";
import { faqLd, ldJson, pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  path: "/method",
  title: "Method · rules, data, limits and the registry",
  description: "How Lorva Agent agents decide, where the prices come from, how limits work, what the on-chain registry records, and what is still a concept.",
});

export default function Method() {
  return (
    <div className="pb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(faqLd(FAQ))} />
      <PageHead eyebrow="Method / read before you trust a number" title="How it works.">
        <p>Everything on this page describes the site as built. Concepts are named as concepts.</p>
      </PageHead>
      <div className="edge prose max-w-[980px] !ml-0">
        <h2>The agent</h2>
        <p>An agent is an asset, one rule, a position size, costs and limits, with a status: Draft (built), Testing (has a backtest), Paper (running on live prices), Paused, Stopped (the kill switch, final).</p>
        <div className="scroll-x">
          <table className="tbl min-w-[560px]">
            <tbody>
              {(Object.keys(STRATEGIES) as StrategyKind[]).map((k) => (
                <tr key={k}>
                  <td className="font-bold">{STRATEGIES[k].label}</td>
                  <td>{STRATEGIES[k].rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>Every bar gives exactly one decision: BUY, SELL, STOP (stop-loss), HOLD, BLOCKED (a buy refused by the limits, with the reasons) or WAIT (paused). Fills pay your fee and slippage. No leverage, no shorting.</p>

        <h2 id="data">The prices</h2>
        <p>Chainlink Data Feeds on {CHAIN.name}. History = the feed&apos;s rounds over its current phase (up to 1,000), turned into 15-minute or 1-hour bars (a bar closes at the last answer published before its end). Live = latestRoundData every 20 seconds.</p>
        <div className="scroll-x">
          <table className="tbl min-w-[560px]">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Feed on chain</th>
                <th>Token on chain</th>
              </tr>
            </thead>
            <tbody>
              {ASSETS.map((a) => (
                <tr key={a.symbol}>
                  <td className="font-bold">{a.symbol}</td>
                  <td className="mono text-[12px]">
                    {a.feedName} · <a href={`${CHAIN.explorer}/address/${a.feed}`} target="_blank" rel="noreferrer">{shortAddress(a.feed)}</a>
                  </td>
                  <td className="mono text-[12px]">{a.token ? <a href={`${CHAIN.explorer}/token/${a.token}`} target="_blank" rel="noreferrer">{shortAddress(a.token)}</a> : "—"} · {a.tokenNote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>A feed updates on a price move or a heartbeat, so quiet periods repeat the last answer. Stock tokens are tokens on Robinhood Chain, not the shares; the 24/7 feeds follow their own trading hours.</p>

        <h2 id="limits">The limits</h2>
        <p>Limits stop new risk and never block an exit. A buy is refused, and the decision says why, for any of:</p>
        <div className="scroll-x">
          <table className="tbl min-w-[520px]">
            <tbody>
              {(Object.keys(ACT_BITS) as (keyof typeof ACT_BITS)[]).map((k) => (
                <tr key={k}>
                  <td className="mono text-[12px]">{k}</td>
                  <td>{BIT_WORDS[k]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>The monitor warns at 80 % of a limit and marks it hit at 100 %. The day is the UTC day. Pause stops evaluation; the kill switch stops an agent for good.</p>

        <h2 id="contract">The registry on chain</h2>
        <p>
          <b>LorvaAgentRegistry</b> ({registryLive() ? <code>{CONTRACTS.registry}</code> : "not deployed yet"}) with the library LorvaLimitMath. An agent belongs to the wallet that registers it and carries its rules hash, versioned limits (USD with 6 decimals), one operator key, a status and per-day usage. The operator records each paper action; the registry counts trades and realised loss per UTC day and refuses anything over the limits; exits are always allowed. The operator can tighten limits but never raise them, and can pause but never resume. Kill is final and unbinds the operator. canAct() returns every reason before anything is sent. No funds, no fee, no admin over anyone&apos;s agent, no upgrade.
        </p>
        <p>Limits are refused at registration for:</p>
        <ul>
          {(Object.keys(LIMIT_BITS) as (keyof typeof LIMIT_BITS)[]).map((k) => (
            <li key={k}>
              <code>{k}</code>: {BIT_WORDS[k]}
            </li>
          ))}
        </ul>
        <p>An example operator (<code>examples/operator.mjs</code>) reads canAct and records actions with its own key.</p>

        <h2 id="status">Built and planned</h2>
        <ul>
          <li><StatusBadge status="Prototype" /> builder, backtests, paper mode with monitor, alerts, pause and kill switch, timeline, export/import, the registry and its tab.</li>
          <li><StatusBadge status="Concept" /> trading with real money through a vault (after permissions and limits are proven on paper).</li>
          <li><StatusBadge status="Concept" /> token features for {BRAND.symbol}: longer backtests, more active agents, deeper reports.</li>
        </ul>
        <p>Backtest results are not future results. Paper results are not real fills. Nothing here is advice. {BRAND.name} is not affiliated with Robinhood.</p>

        <h2 id="faq">FAQ</h2>
        {FAQ.map((f) => (
          <div key={f.q}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
        <p className="mt-10">
          <Link href="/build" className="btn solid">Build an agent →</Link>
        </p>
      </div>
    </div>
  );
}
