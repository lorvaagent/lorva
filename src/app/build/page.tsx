import type { Metadata } from "next";
import { PageHead } from "@/components/site/PageHead";
import { ClientOnly } from "@/components/room/ClientOnly";
import { Builder } from "@/components/room/Builder";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  path: "/build",
  title: "Build an agent · asset, rule, size, limits, review",
  description: "Build a trading agent in five steps: an asset with an on-chain price feed, a deterministic rule, a position size with explicit fees and slippage, and the limits it must keep.",
});

export default function BuildPage() {
  return (
    <div className="pb-10">
      <PageHead eyebrow="Agent builder / five steps" title="Build an agent.">
        <p>Every rule is plain code you can read. The agent starts as a Draft; you test it before it can run on paper.</p>
      </PageHead>
      <div className="edge">
        <ClientOnly fallback={<p className="note">The builder needs JavaScript.</p>}>
          <Builder />
        </ClientOnly>
      </div>
    </div>
  );
}
