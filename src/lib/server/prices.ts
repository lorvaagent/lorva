import "server-only";
import { decodeFunctionResult, encodeFunctionData } from "viem";
import { ASSETS, assetBySymbol } from "@/lib/agents/assets";
import type { Round } from "@/lib/agents/bars";
import { FEED_ABI } from "@/lib/abi";
import { memo, multicall, rpc } from "@/lib/server/chainread";

/*
 * Price history straight from the Chainlink feeds on Robinhood Chain: latestRoundData(), then getRoundData() for the previous rounds
 * of the current phase (round id = phase << 64 | aggregator round), in Multicall3 batches. A round that does not answer is skipped.
 * The answer says exactly which rounds and which time span were read.
 */

const ROUND_ABI = [
  { type: "function", name: "getRoundData", stateMutability: "view", inputs: [{ name: "id", type: "uint80" }], outputs: [{ type: "uint80" }, { type: "int256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint80" }] },
] as const;

export type History = { symbol: string; feed: string; rounds: Round[]; phase: number; firstRound: string; lastRound: string; readAt: number; source: string };

const MAX_ROUNDS = 1000;

/** Multicall in chunks of 100, four chunks at a time (a sequential walk took ~25 s through the official RPC). */
async function parallelCalls(calls: { to: string; data: string }[]) {
  const chunks: { to: string; data: string }[][] = [];
  for (let i = 0; i < calls.length; i += 100) chunks.push(calls.slice(i, i + 100));
  const out: (string | null)[][] = new Array(chunks.length);
  for (let i = 0; i < chunks.length; i += 4) {
    const part = await Promise.all(chunks.slice(i, i + 4).map((c) => multicall(c, 100)));
    part.forEach((p, k) => (out[i + k] = p));
  }
  return out.flat();
}

async function readHistory(symbol: string): Promise<History> {
  const a = assetBySymbol(symbol);
  if (!a) throw new Error("unknown asset");
  const raw = await rpc<string>("eth_call", [{ to: a.feed, data: encodeFunctionData({ abi: FEED_ABI, functionName: "latestRoundData" }) }, "latest"]);
  const [rid, answer, , updatedAt] = decodeFunctionResult({ abi: FEED_ABI, functionName: "latestRoundData", data: raw as `0x${string}` }) as readonly [bigint, bigint, bigint, bigint, bigint];
  const phase = rid >> 64n;
  const agg = rid & ((1n << 64n) - 1n);
  const from = agg > BigInt(MAX_ROUNDS) ? agg - BigInt(MAX_ROUNDS) + 1n : 1n;
  const ids: bigint[] = [];
  for (let r = from; r < agg; r++) ids.push((phase << 64n) | r);
  const answers = await parallelCalls(ids.map((id) => ({ to: a.feed, data: encodeFunctionData({ abi: ROUND_ABI, functionName: "getRoundData", args: [id] }) })));
  const rounds: Round[] = [];
  answers.forEach((hex, i) => {
    if (!hex) return;
    try {
      const [, p, , u] = decodeFunctionResult({ abi: ROUND_ABI, functionName: "getRoundData", data: hex as `0x${string}` }) as readonly [bigint, bigint, bigint, bigint, bigint];
      if (p > 0n && u > 0n) rounds.push({ id: ids[i].toString(), price: Number(p) / 10 ** a.decimals, updatedAt: Number(u) });
    } catch {
      // skipped
    }
  });
  rounds.push({ id: rid.toString(), price: Number(answer) / 10 ** a.decimals, updatedAt: Number(updatedAt) });
  return { symbol, feed: a.feed, rounds, phase: Number(phase), firstRound: rounds[0]?.id ?? "", lastRound: rid.toString(), readAt: Date.now(), source: `Chainlink ${a.feedName} on Robinhood Chain, getRoundData over the current phase` };
}

export const history = memo(5 * 60_000, readHistory, 8);

export type Latest = { symbol: string; price: number; updatedAt: number; round: string; feed: string };

async function readLatest(): Promise<Latest[]> {
  const answers = await multicall(ASSETS.map((a) => ({ to: a.feed, data: encodeFunctionData({ abi: FEED_ABI, functionName: "latestRoundData" }) })));
  return ASSETS.flatMap((a, i) => {
    const hex = answers[i];
    if (!hex) return [];
    const [rid, p, , u] = decodeFunctionResult({ abi: FEED_ABI, functionName: "latestRoundData", data: hex as `0x${string}` }) as readonly [bigint, bigint, bigint, bigint, bigint];
    return p > 0n ? [{ symbol: a.symbol, price: Number(p) / 10 ** a.decimals, updatedAt: Number(u), round: rid.toString(), feed: a.feed }] : [];
  });
}

export const latest = memo(10_000, () => readLatest(), 2);
