import { allowPublic, tooMany } from "@/lib/guard";
import { assetBySymbol } from "@/lib/agents/assets";
import { bad, fail, ok } from "@/lib/server/respond";
import { history } from "@/lib/server/prices";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/* GET /api/prices?asset=ETH → the feed's rounds over its current phase (≤ 1,000 rounds), cached 5 minutes. Bars are built in the browser. */
export async function GET(request: Request) {
  if (!(await allowPublic(getStore(), request, "prices", 30, 600))) return tooMany();
  const asset = new URL(request.url).searchParams.get("asset") ?? "";
  if (!assetBySymbol(asset)) return bad("Unknown asset.");
  try {
    return ok(await history(asset), 60);
  } catch (e) {
    return fail(e);
  }
}
