import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHead } from "@/components/site/PageHead";
import { ClientOnly } from "@/components/room/ClientOnly";
import { ControlRoom } from "@/components/room/ControlRoom";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  path: "/room",
  title: "Control room · your agents, their limits, live",
  description: "Every agent with its status, position, limit usage and alerts. Backtest on Chainlink round history, run paper mode on live prices, pause or stop any agent, and record it on Robinhood Chain.",
});

export default function RoomPage() {
  return (
    <div className="pb-10">
      <PageHead eyebrow="Control room / paper mode only" title="Your agents.">
        <p>Agents live in this browser. Paper mode uses live Chainlink prices on Robinhood Chain and sends no orders. A backtest result is not a future result.</p>
      </PageHead>
      <div className="edge">
        <ClientOnly fallback={<p className="note">The control room needs JavaScript. The method page explains everything without it.</p>}>
          <Suspense fallback={<p className="note">Loading…</p>}>
            <ControlRoom />
          </Suspense>
        </ClientOnly>
      </div>
    </div>
  );
}
