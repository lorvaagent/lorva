/*
 * The assets an agent can be built for. Prices and history come from Chainlink Data Feeds ON Robinhood Chain (chain 4663): the
 * site reads latestRoundData() and walks getRoundData() back through the feed's current phase. Stock tokens are tokens on Robinhood
 * Chain, not the shares; their addresses come from the proven list (beacon proxies, checked 23 Nov 2026). Feeds: the Chainlink
 * directory for Robinhood mainnet, description() and decimals() read on chain; history density checked 26 Nov 2026 (NVDA 24/7:
 * ~200 rounds per ~2 days).
 */
export type Asset = { symbol: string; name: string; feed: `0x${string}`; feedName: string; token: `0x${string}` | null; tokenNote: string; decimals: number };

export const ASSETS: Asset[] = [
  { symbol: "ETH", name: "Ether", feed: "0x78f3556b67e17df817d51ef5a990cdaf09e8d3a9", feedName: "ETH / USD", token: "0x0bd7d308f8e1639fab988df18a8011f41eacad73", tokenNote: "WETH on Robinhood Chain", decimals: 8 },
  { symbol: "NVDA", name: "NVIDIA stock token", feed: "0x321a36e441dfbada01aa6f9884f14a344e133d1f", feedName: "Robinhood NVDA (24/7)", token: "0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec", tokenNote: "Robinhood stock token (beacon proxy)", decimals: 8 },
  { symbol: "TSLA", name: "Tesla stock token", feed: "0x39edf5ef54150a30d2c4f1b982fbb8f93050bc37", feedName: "Robinhood TSLA (24/7)", token: "0x322f0929c4625ed5bad873c95208d54e1c003b2d", tokenNote: "Robinhood stock token (beacon proxy)", decimals: 8 },
  { symbol: "GOOGL", name: "Alphabet stock token", feed: "0x53e040d2c8c9278cbc4b702328ac652068a0e063", feedName: "Robinhood GOOGL (24/7)", token: "0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3", tokenNote: "Robinhood stock token (beacon proxy)", decimals: 8 },
];

export const assetBySymbol = (s: string) => ASSETS.find((a) => a.symbol === s) ?? null;
