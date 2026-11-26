import { allowPublic, tooMany } from "@/lib/guard";
import { fail, ok } from "@/lib/server/respond";
import { latest } from "@/lib/server/prices";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/* GET /api/prices/latest → latestRoundData of every supported feed (Chainlink on Robinhood Chain), cached 10 s. */
export async function GET(request: Request) {
  if (!(await allowPublic(getStore(), request, "latest", 120, 3000))) return tooMany();
  try {
    return ok({ prices: await latest("all"), readAt: Date.now() }, 10);
  } catch (e) {
    return fail(e);
  }
}
