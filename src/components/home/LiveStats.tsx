"use client";

import { useJson } from "@/lib/useJson";

/* The reference's 4-cell stats grid, filled with live chain numbers (and one structural fact). */
type Snap = { block: number | null; gasPriceWei: string | null; ethUsd: { price: number; updatedAt: number } | null };
type Latest = { prices: { symbol: string; price: number; updatedAt: number }[] };

export function LiveStats() {
  const { data } = useJson<Snap>("/api/chain", 30_000);
  const { data: lat } = useJson<Latest>("/api/prices/latest", 30_000);
  const fresh = lat?.prices?.length ?? null;
  const cells = [
    { n: data?.block ? `${(data.block / 1e6).toFixed(2)}M` : "—", l: "Latest Robinhood Chain block", t: data?.block ? `#${data.block.toLocaleString("en-US")}` : "reading" },
    { n: data?.ethUsd ? `$${Math.round(data.ethUsd.price).toLocaleString("en-US")}` : "—", l: "ETH / USD, Chainlink on chain", t: data?.ethUsd ? `updated ${new Date(data.ethUsd.updatedAt * 1000).toISOString().slice(11, 16)} UTC` : "reading" },
    { n: fresh === null ? "—" : String(fresh), l: "Assets with live on-chain feeds", t: lat ? lat.prices.map((p) => p.symbol).join(" · ") : "reading" },
    { n: "0", l: "Funds the registry can hold", t: "nothing is payable, by design" },
  ];
  return (
    <div className="hgrid grid-cols-4 two-sm" data-testid="live-stats">
      {cells.map((c) => (
        <div key={c.l} data-reveal="">
          <p className="d-num">{c.n}</p>
          <p className="cap mt-5">{c.l}</p>
          <p className="cap mt-1 !text-[var(--faint)]">{c.t}</p>
        </div>
      ))}
    </div>
  );
}
