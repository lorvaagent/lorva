"use client";

import { useEffect, useState } from "react";

/* The reference's left rail: a 000–100 counter and a square that follows scroll progress. */
export function Rail() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);
  return (
    <div className="rail" aria-hidden="true" style={{ "--p": p } as React.CSSProperties}>
      <span className="n">{String(Math.round(p * 100)).padStart(3, "0")}</span>
      <span className="m" />
    </div>
  );
}
