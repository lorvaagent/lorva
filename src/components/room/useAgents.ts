"use client";

import { useCallback, useEffect, useState } from "react";
import { storageKey } from "@/config/storage";
import { MAX_AGENTS, move, type AgentRecord, type AgentStatus, type TimelineItem } from "@/lib/agents/agent";
import { toBars, type Round } from "@/lib/agents/bars";
import type { AgentConfig, Bar } from "@/lib/agents/engine";

/*
 * The control room's agents live in this browser (localStorage), like a workbench. Nothing is sent to a server; the optional
 * on-chain record is separate. Export/import keeps a copy.
 */
const KEY = storageKey("agents");
const EVT = "lv-agents";

function read(): AgentRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as AgentRecord[]) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function write(list: AgentRecord[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage blocked: the list lives for this visit only
  }
  window.dispatchEvent(new Event(EVT));
}

export const now = () => Math.floor(Date.now() / 1000);

export function useAgents() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const load = () => setAgents(read());
    load();
    setReady(true);
    window.addEventListener(EVT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(EVT, load);
      window.removeEventListener("storage", load);
    };
  }, []);

  const update = useCallback((id: string, fn: (a: AgentRecord) => AgentRecord) => {
    const list = read().map((a) => (a.id === id ? fn(a) : a));
    write(list);
    setAgents(list);
  }, []);

  const add = useCallback((config: AgentConfig): AgentRecord => {
    const list = read();
    if (list.filter((a) => a.status !== "Stopped").length >= MAX_AGENTS) throw new Error(`At most ${MAX_AGENTS} active agents in this browser.`);
    const t = now();
    const a: AgentRecord = { id: `ag_${Math.random().toString(36).slice(2, 10)}`, config, status: "Draft", createdAt: t, version: 1, timeline: [{ t, kind: "built", text: `Built: ${config.asset}, ${config.strategy.kind}, limits v1` }] };
    write([a, ...list]);
    setAgents([a, ...list]);
    return a;
  }, []);

  const remove = useCallback((id: string) => {
    const list = read().filter((a) => a.id !== id);
    write(list);
    setAgents(list);
  }, []);

  const setStatus = useCallback(
    (id: string, to: AgentStatus, note: string) => {
      update(id, (a) => move(a, to, now(), note));
    },
    [update],
  );

  const log = useCallback(
    (id: string, item: Omit<TimelineItem, "t">) => {
      update(id, (a) => ({ ...a, timeline: [{ t: now(), ...item }, ...a.timeline].slice(0, 200) }));
    },
    [update],
  );

  const replaceAll = useCallback((list: AgentRecord[]) => {
    write(list);
    setAgents(list);
  }, []);

  return { agents, ready, add, update, remove, setStatus, log, replaceAll };
}

export type History = { symbol: string; feed: string; rounds: Round[]; phase: number; readAt: number; source: string };

const cache = new Map<string, { at: number; h: History }>();

/** Round history from /api/prices (5-minute cache here and on the server). */
export async function fetchHistory(symbol: string): Promise<History> {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.h;
  const res = await fetch(`/api/prices?asset=${encodeURIComponent(symbol)}`, { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as (History & { error?: string }) | null;
  if (!res.ok || !body?.rounds) throw new Error(body?.error ?? `Price history unavailable (${res.status}).`);
  cache.set(symbol, { at: Date.now(), h: body });
  return body;
}

export function barsFrom(h: History, barMinutes: number, until = now()): Bar[] {
  return toBars(h.rounds, barMinutes * 60, until);
}

export type LatestPrice = { symbol: string; price: number; updatedAt: number; round: string };

export async function fetchLatest(): Promise<LatestPrice[]> {
  const res = await fetch("/api/prices/latest", { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as { prices?: LatestPrice[]; error?: string } | null;
  if (!res.ok || !body?.prices) throw new Error(body?.error ?? "Live prices unavailable.");
  return body.prices;
}
