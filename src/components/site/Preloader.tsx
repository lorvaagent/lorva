"use client";

import { useEffect, useState } from "react";
import { BRAND } from "@/config/brand";

/*
 * The reference's intro (MOTION.txt 1): a point cloud gathering with mono captions and a counter. Only shown under html.motion,
 * and a CSS failsafe hides it after 2.2 s even if this script never runs, so content is never stuck behind it.
 */
export function Preloader() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const v = Math.min(100, Math.round(((performance.now() - t0) / 1400) * 100));
      setN(v);
      if (v < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="preloader" aria-hidden="true">
      <div className="cloud" />
      <p className="cap absolute left-[var(--edge)] top-9">{BRAND.name} / {BRAND.chainName}</p>
      <p className="cap absolute right-[var(--edge)] top-[100px]">
        00 — Load · Rules <b className="ml-4">{String(n).padStart(3, "0")} / 100</b>
      </p>
      <p className="cap absolute bottom-9 left-[var(--edge)]">Chainlink rounds · Robinhood Chain 4663</p>
    </div>
  );
}
