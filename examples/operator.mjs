// A minimal operator for one Lorva agent: the key that records the agent's paper actions in LorvaAgentRegistry.
// It never trades and never holds funds; it asks canAct() first and only sends what the registry would accept.
//   RPC=<robinhood chain rpc> REGISTRY=0x… OPERATOR_PK=0x… node examples/operator.mjs status <agentId>
//   … node examples/operator.mjs record <agentId> <positionAfterUsd> <realisedPnlUsd> [label]
//   … node examples/operator.mjs pause <agentId>        (an operator may pause, never resume)
// Exit code: 0 ok, 3 refused by the registry (reasons printed), 1 other error.
import { createPublicClient, createWalletClient, defineChain, http, keccak256, stringToBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "node:fs";

const { RPC, REGISTRY, OPERATOR_PK } = process.env;
const [cmd, idArg, posArg, pnlArg, label = "paper action"] = process.argv.slice(2);
if (!RPC || !REGISTRY || !OPERATOR_PK || !cmd || !idArg) {
  console.error("usage: RPC=… REGISTRY=0x… OPERATOR_PK=0x… node examples/operator.mjs status|record|pause <agentId> [positionUsd pnlUsd label]");
  process.exit(1);
}
const ABI = JSON.parse(readFileSync(new URL("../src/lib/contracts/artifacts.json", import.meta.url), "utf8")).contracts.LorvaAgentRegistry.abi;
const BITS = ["UNKNOWN_AGENT", "NOT_OPERATOR", "PAUSED", "KILLED", "LIMITS_EXPIRED", "OVER_POSITION", "TRADES_PER_DAY", "DAILY_LOSS_HIT", "STALE_VERSION", "ZERO_ACTION"];
const words = (b) => BITS.filter((_, i) => (b >> BigInt(i)) & 1n).join(", ");
const chain = defineChain({ id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const account = privateKeyToAccount(OPERATOR_PK);
const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = createWalletClient({ chain, transport: http(RPC), account });
const id = BigInt(idArg);
const usd = (s) => BigInt(Math.round(Number(s) * 1e6));

const agent = await pub.readContract({ address: REGISTRY, abi: ABI, functionName: "agentOf", args: [id] });
const usage = await pub.readContract({ address: REGISTRY, abi: ABI, functionName: "usageOf", args: [id] });
if (cmd === "status") {
  const next = await pub.readContract({ address: REGISTRY, abi: ABI, functionName: "canAct", args: [id, account.address, agent.version, usage.position + 1n] });
  console.log(JSON.stringify({ agent: idArg, owner: agent.owner, operator: agent.operator, status: ["None", "Active", "Paused", "Killed"][agent.status], version: agent.version, tradesToday: usage.trades, lossToday: Number(usage.loss) / 1e6, position: Number(usage.position) / 1e6, nextBuy: next === 0n ? "allowed" : words(next) }, null, 2));
  process.exit(0);
}
if (cmd === "pause") {
  const hash = await wallet.writeContract({ address: REGISTRY, abi: ABI, functionName: "pause", args: [id] });
  await pub.waitForTransactionReceipt({ hash });
  console.log(`paused agent ${idArg}: ${hash}`);
  process.exit(0);
}
if (cmd === "record") {
  const pos = usd(posArg ?? "0");
  const pnl = usd(pnlArg ?? "0");
  const bits = await pub.readContract({ address: REGISTRY, abi: ABI, functionName: "canAct", args: [id, account.address, agent.version, pos] });
  if (bits !== 0n) {
    console.log(`REFUSED by the registry: ${words(bits)}`);
    process.exit(3);
  }
  const actionHash = keccak256(stringToBytes(JSON.stringify({ agent: idArg, label, pos: posArg, pnl: pnlArg, at: Date.now() })));
  const hash = await wallet.writeContract({ address: REGISTRY, abi: ABI, functionName: "recordAction", args: [id, agent.version, actionHash, pos, pnl] });
  const r = await pub.waitForTransactionReceipt({ hash });
  console.log(`recorded (${r.status}): ${hash}`);
  process.exit(r.status === "success" ? 0 : 1);
}
console.error(`unknown command ${cmd}`);
process.exit(1);
