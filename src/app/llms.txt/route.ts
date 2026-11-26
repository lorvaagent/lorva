import { BRAND, CHAIN } from "@/config/brand";
import { CONTRACTS, registryLive } from "@/config/contracts";
import { ASSETS } from "@/lib/agents/assets";

export const dynamic = "force-static";

export function GET() {
  const lines = [
    `# ${BRAND.name}`,
    "",
    `> ${BRAND.slogan} ${BRAND.tagline} A builder and monitor for trading agents on ${CHAIN.name} (chain ${CHAIN.id}). Agents are deterministic rules (trend follow, breakout, buy the dip, steady buying) with a position size, explicit fees and slippage, and limits (max position, max daily loss, trades per UTC day, stop-loss, expiry). Backtests run on Chainlink round history read from the chain (${ASSETS.map((a) => a.symbol).join(", ")}); paper mode runs the same rules on live prices with limit meters, alerts and a kill switch. Limits stop new risk and never block an exit. LorvaAgentRegistry records agents, versioned limits, an operator key and paper actions; it holds no funds. Real-money trading through a vault is a concept. Backtest results are not future results. Not affiliated with Robinhood.`,
    "",
    `Control room: ${BRAND.url}/room`,
    `Builder: ${BRAND.url}/build`,
    `Method and limits: ${BRAND.url}/method`,
    `Price history (JSON): ${BRAND.url}/api/prices?asset=ETH`,
    `Live prices (JSON): ${BRAND.url}/api/prices/latest`,
    `Registry events (JSON): ${BRAND.url}/api/registry`,
    `LorvaAgentRegistry: ${registryLive() ? CONTRACTS.registry : "not deployed yet"}`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
