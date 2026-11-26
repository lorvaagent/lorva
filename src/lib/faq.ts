/* Questions answered on the method page (and as FAQ structured data). Every answer is true of the site as built. */
import { BRAND, TOKEN } from "@/config/brand";

export type Faq = { q: string; a: string };

export const FAQ: Faq[] = [
  {
    q: "Does Lorva Agent trade with real money?",
    a: "No. Backtests and paper mode only: paper mode uses live prices from Robinhood Chain and sends no orders. Trading through a vault you control is a concept that comes after permissions and limits are proven on paper.",
  },
  {
    q: "Does an AI model make the decisions?",
    a: "No. Every agent is a deterministic rule (trend follow, breakout, buy the dip, steady buying) with numbers you set. The same code runs the backtest and the paper run, and every decision is shown with its reason.",
  },
  {
    q: "Where do the prices come from?",
    a: "From Chainlink Data Feeds on Robinhood Chain: the latest round live, and the history by walking back through the feed's rounds of its current phase (up to 1,000 rounds). Each test shows how many rounds were read and over which dates.",
  },
  {
    q: "Is a good backtest a good agent?",
    a: "Not necessarily. Backtest results are not future results; fees and slippage are your inputs; the history is short. Compare against simply holding the asset, look at the drawdown and at how often the limits refused a buy.",
  },
  {
    q: "What do the limits do?",
    a: "They stop new risk: a buy is refused when it would pass the max position, when today's trades or today's realised loss reached its limit, or when the limits expired. They never block an exit: sells and stop-losses always go through.",
  },
  {
    q: "What does the on-chain registry add?",
    a: "A public record that the agent exists, whose it is, which limits version it runs, which operator key may act for it and what it did. The registry refuses actions over the limits, the operator can only tighten limits, and pause or kill takes effect in the same block. It holds no funds.",
  },
  {
    q: "Where are my agents stored?",
    a: "In this browser (localStorage). Export and import keep a copy. Nothing about your agents is sent to a server unless you register one on chain, and then only its rules hash and limits.",
  },
  {
    q: `Do I need ${BRAND.symbol}?`,
    a: TOKEN.isLive
      ? `No. ${BRAND.symbol} is the community token of ${BRAND.name} on Robinhood Chain at ${BRAND.ca}; only trust this address. Token features are concepts, not built yet.`
      : `No. ${BRAND.symbol} has not launched; the contract address and the launchpad are TBA. Token features are concepts, not built yet. The product works fully without it.`,
  },
  {
    q: `Is ${BRAND.name} connected to Robinhood?`,
    a: `No. It reads public contracts on Robinhood Chain, a public network. Stock tokens are tokens on that chain, not the shares. Nothing here is advice.`,
  },
];
