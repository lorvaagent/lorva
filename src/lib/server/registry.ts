import "server-only";
import { decodeEventLog } from "viem";
import { CONTRACTS, registryLive } from "@/config/contracts";
import { REGISTRY_ABI } from "@/lib/abi";
import { blocksMissing, scanBack } from "@/lib/logscan";
import { headBlock, logReader, memo, type RawLog } from "@/lib/server/chainread";

/* LorvaAgentRegistry events from its own logs, newest first: each agent's public timeline. */

export type RegistryEvent = { name: string; agent: number | null; block: number; tx: string; logIndex: number; args: Record<string, string | number | boolean> };
export type RegistryLog = { live: boolean; address: string; events: RegistryEvent[]; fromBlock: number; toBlock: number; missingBlocks: number; readAt: number };

const plain = (v: unknown): string | number | boolean => (typeof v === "bigint" ? v.toString() : typeof v === "number" || typeof v === "boolean" ? v : String(v));

async function scan(): Promise<RegistryLog> {
  if (!registryLive()) return { live: false, address: "", events: [], fromBlock: 0, toBlock: 0, missingBlocks: 0, readAt: Date.now() };
  const head = await headBlock();
  const res = await scanBack<RawLog>(logReader({ address: CONTRACTS.registry, topics: [] }), CONTRACTS.block || Math.max(0, head - 5_000_000), head, { maxCalls: 30 });
  const events: RegistryEvent[] = [];
  for (const l of res.logs) {
    try {
      const d = decodeEventLog({ abi: REGISTRY_ABI, data: l.data as `0x${string}`, topics: l.topics as [`0x${string}`, ...`0x${string}`[]] });
      const args = Object.fromEntries(Object.entries((d.args ?? {}) as Record<string, unknown>).map(([k, v]) => [k, plain(v)]));
      events.push({ name: d.eventName ?? "?", agent: args.agent !== undefined ? Number(args.agent) : null, block: Number(BigInt(l.blockNumber)), tx: l.transactionHash, logIndex: Number(BigInt(l.logIndex)), args });
    } catch {
      // not one of ours
    }
  }
  events.sort((a, b) => b.block - a.block || b.logIndex - a.logIndex);
  return { live: true, address: CONTRACTS.registry, events: events.slice(0, 500), fromBlock: res.fromBlock, toBlock: res.toBlock, missingBlocks: blocksMissing(res.gaps), readAt: Date.now() };
}

export const readRegistry = memo(10_000, () => scan(), 4);
