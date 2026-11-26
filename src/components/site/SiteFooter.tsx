"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BRAND, CHAIN, hasGithub } from "@/config/brand";
import { CONTRACTS, registryLive } from "@/config/contracts";
import { storageKey } from "@/config/storage";
import { CaBox } from "@/components/site/CaCopy";
import { useJson } from "@/lib/useJson";

/* The reference's footer status bar: ©, a live signal, a real "pause animations" switch, links, back to top. */
export function SiteFooter() {
  const { data } = useJson<{ block: number | null }>("/api/chain", 30_000);
  const [still, setStill] = useState(false);
  useEffect(() => setStill(document.documentElement.classList.contains("still")), []);
  const toggle = () => {
    const v = !still;
    document.documentElement.classList.toggle("still", v);
    try {
      localStorage.setItem(storageKey("still"), v ? "1" : "0");
    } catch {}
    setStill(v);
  };
  return (
    <footer className="edge mt-24">
      <div className="hgrid grid-cols-4 two-sm">
        <div>
          <p className="cap">Product</p>
          <ul className="mt-3 grid gap-1.5 text-[13px]">
            <li><Link className="elink" href="/room">Control room</Link></li>
            <li><Link className="elink" href="/build">Agent builder</Link></li>
            <li><Link className="elink" href="/method">Method and limits</Link></li>
          </ul>
        </div>
        <div>
          <p className="cap">On chain</p>
          <ul className="mt-3 grid gap-1.5 text-[13px]">
            <li>
              {registryLive() ? (
                <a className="elink" href={`${CHAIN.explorer}/address/${CONTRACTS.registry}`} target="_blank" rel="noreferrer">LorvaAgentRegistry ↗</a>
              ) : (
                <Link className="elink" href="/method#contract">Registry (not deployed yet)</Link>
              )}
            </li>
            <li><Link className="elink" href="/token">{BRAND.symbol}</Link></li>
            <li><a className="elink" href="/llms.txt">llms.txt</a></li>
          </ul>
        </div>
        <div className="col-span-2 max-[720px]:col-span-2">
          <p className="cap">Contract address</p>
          <div className="mt-3 max-w-[440px]">
            <CaBox testid="footer-ca" compact />
          </div>
        </div>
      </div>
      <div className="fbar">
        <div className="cap flex flex-wrap items-center gap-x-7 gap-y-2">
          <span>© 2026 {BRAND.name}</span>
          <span className="inline-flex items-center gap-2" data-testid="signal">
            <span className="sq blink" /> Signal: {data?.block ? <b>live · #{data.block.toLocaleString("en-US")}</b> : "reading"}
          </span>
          <button type="button" className="cap elink" onClick={toggle} data-testid="pause-anim">
            — {still ? "Play animations" : "Pause animations"}
          </button>
        </div>
        <div className="cap flex flex-wrap items-center gap-x-6 gap-y-2">
          <a className="elink" href={BRAND.x} target="_blank" rel="noreferrer">X ↗</a>
          {hasGithub ? <a className="elink" href={BRAND.github} target="_blank" rel="noreferrer">GitHub ↗</a> : null}
          <span>Not affiliated with Robinhood · not advice</span>
          <a className="elink" href="#top">Back to top ↑</a>
        </div>
      </div>
    </footer>
  );
}
