import { allowPublic, tooMany } from "@/lib/guard";
import { fail, ok } from "@/lib/server/respond";
import { readRegistry } from "@/lib/server/registry";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/* GET /api/registry[?agent=<id>] → LorvaAgentRegistry events from chain logs, newest first. */
export async function GET(request: Request) {
  if (!(await allowPublic(getStore(), request, "registry", 30, 600))) return tooMany();
  const agent = Number(new URL(request.url).searchParams.get("agent") ?? "");
  try {
    const log = await readRegistry("all");
    return ok(Number.isInteger(agent) && agent > 0 ? { ...log, events: log.events.filter((e) => e.agent === agent) } : log, 10);
  } catch (e) {
    return fail(e);
  }
}
