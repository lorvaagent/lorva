"use client";

import { useCallback, useEffect, useState } from "react";
import { decodeEventLog, encodeFunctionData, keccak256, stringToBytes, type Hex } from "viem";
import { CHAIN, explorerTx, isAddress, shortAddress } from "@/config/brand";
import { CONTRACTS, registryLive } from "@/config/contracts";
import { REGISTRY_ABI } from "@/lib/abi";
import { bitWords } from "@/lib/agents/bits";
import { canon, chainLimits, configHash } from "@/lib/agents/engine";
import type { AgentRecord } from "@/lib/agents/agent";
import { explain, read, rpcCall, simulate, waitForReceipt } from "@/lib/client";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useJson } from "@/lib/useJson";
import { now } from "@/components/room/useAgents";

/*
 * The agent's on-chain record in LorvaAgentRegistry: register (rules hash + limits + operator key), new limits versions, pause /
 * resume, the kill switch (final), and anchoring a paper decision as an action (operator only, after canAct says yes). Every write
 * is checked with the contract's view and simulated before the wallet opens.
 */

type OnChain = { owner: string; operator: string; status: number; version: number; configHash: string; limits: { maxPosition: bigint; maxDailyLoss: bigint; maxTradesPerDay: number; stopLossBps: number; validUntil: bigint } };
type UsageView = { day: number; trades: number; loss: bigint; position: bigint; actions: bigint };
const STATUS = ["None", "Active", "Paused", "Killed"];
const R = () => CONTRACTS.registry as `0x${string}`;
const toMicro = (n: number) => BigInt(Math.max(0, Math.round(n * 1e6)));

export function ChainPanel({ a, onLinked, onLog, onKilledOnChain }: { a: AgentRecord; onLinked: (c: AgentRecord["chain"]) => void; onLog: (text: string, tx?: string) => void; onKilledOnChain: () => void }) {
  const { address, sendTransaction } = useWallet();
  const { open } = useWalletModal();
  const [operator, setOperator] = useState("");
  const [rec, setRec] = useState<OnChain | null>(null);
  const [use, setUse] = useState<UsageView | null>(null);
  const [nextBits, setNextBits] = useState<bigint | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [lastTx, setLastTx] = useState<string | null>(null);
  const id = a.chain?.id ?? null;
  const { data: events } = useJson<{ events: { name: string; block: number; tx: string; args: Record<string, string | number | boolean> }[] }>(registryLive() && id ? `/api/registry?agent=${id}` : null, 30_000);

  useEffect(() => {
    if (address && !operator) setOperator(address);
  }, [address, operator]);

  const refresh = useCallback(async () => {
    if (!registryLive() || !id) return;
    const r = (await read<OnChain>({ to: R(), abi: REGISTRY_ABI, fn: "agentOf", args: [BigInt(id)] }).catch(() => null)) as OnChain | null;
    const u = (await read<UsageView>({ to: R(), abi: REGISTRY_ABI, fn: "usageOf", args: [BigInt(id)] }).catch(() => null)) as UsageView | null;
    setRec(r);
    setUse(u);
    if (r && a.paper) {
      const pos = a.paper.state.units * (a.paper.decisions[0]?.price ?? 0);
      const b = (await read<bigint>({ to: R(), abi: REGISTRY_ABI, fn: "canAct", args: [BigInt(id), r.operator, r.version, toMicro(pos + 1)] }).catch(() => null)) as bigint | null;
      setNextBits(b);
    }
  }, [id, a.paper]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const send = async (label: string, data: Hex) => {
    if (!address) {
      open();
      throw new Error("Connect a wallet first.");
    }
    setBusy(label);
    try {
      await simulate(address, R(), data);
      const hash = await sendTransaction({ to: R(), data });
      setLastTx(hash);
      const r = await waitForReceipt(hash);
      if (!r.ok) throw new Error("The transaction reverted.");
      return hash;
    } catch (e) {
      throw new Error(explain(e));
    } finally {
      setBusy(null);
    }
  };
  const run = async (fn: () => Promise<string | void>, ok: string) => {
    setMsg({});
    try {
      await fn();
      setMsg({ ok });
      await refresh();
    } catch (e) {
      setMsg({ err: e instanceof Error ? e.message : String(e) });
    }
  };

  const register = () =>
    run(async () => {
      if (!isAddress(operator)) throw new Error("The operator must be an address (0x + 40 hex).");
      const lim = chainLimits(a.config, now());
      const hash = await send("register", encodeFunctionData({ abi: REGISTRY_ABI, functionName: "register", args: [configHash(a.config), lim, operator] }));
      const r = await rpcCall<{ logs: { address: string; topics: Hex[]; data: Hex }[] }>("eth_getTransactionReceipt", [hash]);
      const ev = r.logs
        .filter((l) => l.address.toLowerCase() === R().toLowerCase())
        .map((l) => {
          try {
            return decodeEventLog({ abi: REGISTRY_ABI, data: l.data, topics: l.topics as [Hex, ...Hex[]] });
          } catch {
            return null;
          }
        })
        .find((e) => e?.eventName === "AgentRegistered");
      const newId = ev ? Number((ev.args as unknown as { agent: bigint }).agent) : null;
      if (!newId) throw new Error("Registered, but the agent number could not be read from the receipt.");
      onLinked({ id: newId, owner: address!, operator, version: 1 });
      onLog(`Registered on ${CHAIN.name} as agent #${newId} (operator ${shortAddress(operator)})`, hash);
    }, "Registered on chain.");

  const newLimits = () =>
    run(async () => {
      const hash = await send("limits", encodeFunctionData({ abi: REGISTRY_ABI, functionName: "setLimits", args: [BigInt(id!), configHash(a.config), chainLimits(a.config, now())] }));
      onLog("New limits version recorded on chain", hash);
    }, "New limits version recorded.");

  const statusTx = (fn: "pause" | "resume" | "kill") =>
    run(async () => {
      const hash = await send(fn, encodeFunctionData({ abi: REGISTRY_ABI, functionName: fn, args: [BigInt(id!)] }));
      onLog(`${fn === "kill" ? "Killed" : fn === "pause" ? "Paused" : "Resumed"} on chain`, hash);
      if (fn === "kill") onKilledOnChain();
    }, fn === "kill" ? "Killed on chain: final." : fn === "pause" ? "Paused on chain." : "Resumed on chain.");

  const anchor = () =>
    run(async () => {
      const d = a.paper?.decisions.find((x) => x.action === "BUY" || x.action === "SELL" || x.action === "STOP");
      if (!d || !rec) throw new Error("No paper buy or sell to record yet.");
      if (!address || address.toLowerCase() !== rec.operator.toLowerCase()) throw new Error(`Only the operator key ${shortAddress(rec.operator)} can record actions. Connect it, or run examples/operator.mjs.`);
      const actionHash = keccak256(stringToBytes(canon({ agent: id, t: d.t, action: d.action, price: d.price, qty: d.qty })));
      const pnl = BigInt(Math.round(d.pnl * 1e6));
      const bits = (await read<bigint>({ to: R(), abi: REGISTRY_ABI, fn: "canAct", args: [BigInt(id!), address, rec.version, toMicro(d.position)] })) as bigint;
      if (bits !== 0n) throw new Error(`The registry would refuse it: ${bitWords(bits).join(", ")}.`);
      const hash = await send("record", encodeFunctionData({ abi: REGISTRY_ABI, functionName: "recordAction", args: [BigInt(id!), rec.version, actionHash, toMicro(d.position), pnl] }));
      onLog(`${d.action} at ${d.price.toFixed(2)} recorded on chain`, hash);
    }, "Paper action recorded on chain.");

  if (!registryLive())
    return (
      <div className="grid gap-4" data-testid="chain-panel">
        <p className="note warn">LorvaAgentRegistry is not deployed on {CHAIN.name} yet. The builder, backtests, paper mode and the kill switch all work in this browser; once the owner deploys the registry, this tab records the agent and its limits on chain.</p>
        <p className="cap break-all">
          Would register: rules hash <b>{configHash(a.config)}</b> · max position {a.config.limits.maxPosition} USD · daily loss {a.config.limits.maxDailyLoss} USD · {a.config.limits.maxTradesPerDay} trades/day
        </p>
      </div>
    );

  const changed = rec && rec.configHash.toLowerCase() !== configHash(a.config).toLowerCase();
  return (
    <div className="grid gap-5" data-testid="chain-panel">
      {!id ? (
        <div className="grid max-w-[640px] gap-4">
          <p className="text-[14px]">Register this agent in LorvaAgentRegistry. Your wallet becomes its owner; the operator key is the one allowed to record its actions (by default your own wallet). The rules stay here; only their hash and the limits go on chain.</p>
          <label className="field">
            <span>Operator key</span>
            <input className="input mono" value={operator} onChange={(e) => setOperator(e.target.value.trim())} placeholder="0x…" data-testid="c-operator" />
          </label>
          <button type="button" className="btn solid w-max" disabled={Boolean(busy) || a.status === "Stopped"} onClick={register} data-testid="c-register">
            {busy === "register" ? "Confirm in wallet…" : address ? "Register on chain" : "Connect a wallet"}
          </button>
        </div>
      ) : (
        <>
          <div className="hgrid grid-cols-4 two-sm" data-testid="c-record">
            <div>
              <p className="cap">Agent</p>
              <p className="mt-3 text-[30px] font-black leading-none">#{id}</p>
              <p className="cap mt-2">{rec ? STATUS[rec.status] : "reading"}</p>
            </div>
            <div>
              <p className="cap">Limits version</p>
              <p className="mt-3 text-[30px] font-black leading-none">{rec ? `v${rec.version}` : "—"}</p>
              <p className="cap mt-2">{changed ? "rules changed here" : "matches this agent"}</p>
            </div>
            <div>
              <p className="cap">Today on chain</p>
              <p className="mt-3 text-[30px] font-black leading-none">{use ? `${use.trades} / ${rec?.limits.maxTradesPerDay ?? "—"}` : "—"}</p>
              <p className="cap mt-2">{use ? `loss $${(Number(use.loss) / 1e6).toFixed(2)} · ${use.actions} actions all-time` : ""}</p>
            </div>
            <div>
              <p className="cap">Next buy</p>
              <p className="mt-3 text-[18px] font-bold leading-tight" data-testid="c-canact">{nextBits === null ? "—" : nextBits === 0n ? "Allowed" : bitWords(nextBits).join(", ")}</p>
              <p className="cap mt-2">canAct() for the operator</p>
            </div>
          </div>
          <p className="cap">
            Owner {rec ? shortAddress(rec.owner) : "—"} · operator {rec ? shortAddress(rec.operator) : "—"}
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn" disabled={Boolean(busy) || !rec || rec.status !== 1} onClick={anchor} data-testid="c-anchor">
              Record the last paper action
            </button>
            {changed ? (
              <button type="button" className="btn" disabled={Boolean(busy)} onClick={newLimits} data-testid="c-limits">
                Record new limits version
              </button>
            ) : null}
            {rec?.status === 1 ? (
              <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => statusTx("pause")} data-testid="c-pause">
                Pause on chain
              </button>
            ) : null}
            {rec?.status === 2 ? (
              <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => statusTx("resume")} data-testid="c-resume">
                Resume on chain
              </button>
            ) : null}
            {rec && rec.status !== 3 ? (
              <button type="button" className="btn danger" disabled={Boolean(busy)} onClick={() => statusTx("kill")} data-testid="c-kill">
                Kill on chain
              </button>
            ) : null}
          </div>
          {events?.events?.length ? (
            <div className="scroll-x">
              <table className="tbl min-w-[560px]" data-testid="c-events">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Block</th>
                    <th>Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {events.events.map((e) => (
                    <tr key={`${e.tx}-${e.name}`}>
                      <td className="font-bold">{e.name}</td>
                      <td className="mono text-[12px]">{e.block}</td>
                      <td>
                        <a className="mono text-[12px] underline" href={explorerTx(e.tx)} target="_blank" rel="noreferrer">
                          {e.tx.slice(0, 10)}…
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
      {msg.err ? <p className="note bad" role="alert" data-testid="c-error">{msg.err}</p> : null}
      {msg.ok ? <p className="note ok" role="status" data-testid="c-ok">{msg.ok}</p> : null}
      {lastTx ? (
        <p className="cap">
          Last tx <a className="underline" href={explorerTx(lastTx)} target="_blank" rel="noreferrer">{lastTx.slice(0, 18)}…</a>
        </p>
      ) : null}
    </div>
  );
}
