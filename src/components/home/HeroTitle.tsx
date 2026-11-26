/* The giant two-line headline; characters rise in one after another (MOTION.txt 3). Words never break; plain text without motion. */
export function HeroTitle({ lines }: { lines: string[] }) {
  let k = 0;
  return (
    <h1 className="display d-hero hero-title" aria-label={lines.join(" ")}>
      {lines.map((l) => (
        <span key={l} className="block" aria-hidden="true">
          {l.split(" ").map((w, wi) => (
            <span key={wi}>
              {wi ? " " : null}
              <span className="hword">
                {[...w].map((ch, i) => (
                  <span key={i} className="hchar" style={{ "--cd": `${1200 + k++ * 28}ms` } as React.CSSProperties}>
                    {ch}
                  </span>
                ))}
              </span>
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}
