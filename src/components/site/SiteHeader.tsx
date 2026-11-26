"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/site/Mark";
import { NavWallet } from "@/components/wallet/WalletButton";
import { NAV } from "@/config/nav";
import { BRAND } from "@/config/brand";
import { storageKey } from "@/config/storage";

/* Header in the reference's pattern: name + square left; small text links; a mono theme switch; the wallet; a MENU on phones. */

export function ThemeSwitch({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.getAttribute("data-theme") === "dark"), []);
  const flip = () => {
    const next = dark ? "light" : "dark";
    const root = document.documentElement;
    root.classList.add("wiping");
    root.setAttribute("data-theme", next);
    setTimeout(() => root.classList.remove("wiping"), 650);
    try {
      localStorage.setItem(storageKey("theme"), next);
    } catch {}
    setDark(!dark);
  };
  return (
    <button type="button" onClick={flip} className={`cap inline-flex items-center gap-2 ${className}`} aria-label={`Switch to ${dark ? "light" : "dark"} mode`} data-testid="theme-switch">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <rect x="0.5" y="0.5" width="11" height="11" fill="none" stroke="currentColor" />
        <rect x="0.5" y="0.5" width="5.5" height="11" fill="currentColor" />
      </svg>
      <b className="max-[420px]:hidden">{dark ? "Dark" : "Light"}</b>
      <span className="theme-cap max-[1100px]:hidden">mode — switch to {dark ? "light" : "dark"}</span>
    </button>
  );
}

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  return (
    <>
      <header className="hdr">
        <div className="edge row">
          <Link href="/" aria-label={`${BRAND.name} home`} className="shrink-0">
            <Wordmark />
          </Link>
          <div className="flex min-w-0 items-center gap-6 max-[900px]:gap-3">
            <nav className="links flex items-center gap-6 max-[900px]:hidden" aria-label="Main">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined} className="elink">
                  {n.label}
                </Link>
              ))}
            </nav>
            <ThemeSwitch />
            <NavWallet />
            <button type="button" className="cap inline-flex items-center gap-2 min-[901px]:hidden" aria-expanded={open} onClick={() => setOpen(!open)} data-testid="menu-toggle">
              <b>{open ? "Close" : "Menu"}</b>
              <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true">
                <path d="M0 1h18M0 9h18" stroke="currentColor" />
              </svg>
            </button>
          </div>
        </div>
      </header>
      {open ? (
        <div className="menu-sheet" role="dialog" aria-label="Menu">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)}>
              {n.label}
            </Link>
          ))}
          <p className="cap mt-6">{BRAND.chainName} · chain 4663</p>
        </div>
      ) : null}
    </>
  );
}
