/*
 * The reference's signature diagram, turned into what Lorva Agent does: three inputs (rules, limits, prices) flow into the agent core
 * and out to three outputs (backtest, paper run, decision log). Dashed flows animate (MOTION.txt 2); static without motion.
 */
const IN = [
  { y: 260, k: "SRC.01", v: "RULES" },
  { y: 380, k: "SRC.02", v: "LIMITS" },
  { y: 500, k: "SRC.03", v: "PRICES" },
];
const OUT = [
  { y: 260, k: "DST.01", v: "BACKTEST" },
  { y: 380, k: "DST.02", v: "PAPER" },
  { y: 500, k: "DST.03", v: "DECISION LOG" },
];

function Cube({ x, y, w = 64, h = 34 }: { x: number; y: number; w?: number; h?: number }) {
  const d = 9;
  return (
    <g>
      <rect className="box" x={x} y={y} width={w} height={h} />
      <path d={`M${x} ${y} l${d} ${-d} h${w} v${h} l${-d} ${d} M${x + w} ${y} l${d} ${-d}`} fill="none" stroke="currentColor" strokeWidth="1" opacity="0.8" />
      <path d={`M${x + 16} ${y} v${h} M${x + w - 16} ${y} v${h}`} stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
    </g>
  );
}

function flows(fromX: number, fromY: number, toX: number, toY: number, n: number, spread: number, seed: number) {
  return Array.from({ length: n }, (_, i) => {
    const o = (i - (n - 1) / 2) * spread;
    const w = Math.sin(seed + i * 1.7) * 60;
    return `M${fromX} ${fromY + o * 0.3} C ${fromX + 180} ${fromY + o + w}, ${toX - 220} ${toY - w + o * 0.6}, ${toX} ${toY + o * 0.15}`;
  });
}

export function Pipeline({ className = "" }: { className?: string }) {
  const coreX = 660;
  const coreY = 318;
  return (
    <svg className={`pipe ${className}`} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g className="flow">
        {IN.flatMap((s, k) => flows(162, s.y + 17, coreX, coreY + 75, 7, 9, k * 3).map((d, i) => <path key={`i${k}-${i}`} d={d} />))}
        {OUT.flatMap((s, k) => flows(coreX + 100, coreY + 75, 1258, s.y + 17, 6, 4, k * 5 + 1).map((d, i) => <path key={`o${k}-${i}`} d={d} />))}
      </g>
      {IN.map((s) => (
        <g key={s.k}>
          <Cube x={98} y={s.y} />
          <text x={106} y={s.y + 58}>
            <tspan className="k">{s.k}</tspan> {s.v}
          </text>
        </g>
      ))}
      {OUT.map((s) => (
        <g key={s.k}>
          <Cube x={1258} y={s.y} />
          <text x={1266} y={s.y + 58}>
            <tspan className="k">{s.k}</tspan> {s.v}
          </text>
        </g>
      ))}
      <rect className="box" x={coreX} y={coreY} width={100} height={155} />
      <rect x={coreX + 5} y={coreY + 5} width={90} height={145} fill="currentColor" opacity="0.06" />
      <g className="core-cube" opacity="0.7">
        <path d={`M${coreX + 50} ${coreY + 40} l26 14 v30 l-26 14 l-26 -14 v-30 z M${coreX + 24} ${coreY + 54} l26 14 l26 -14 M${coreX + 50} ${coreY + 68} v30`} fill="none" stroke="currentColor" strokeWidth="1" />
      </g>
      <text x={coreX + 26} y={coreY + 185}>
        <tspan className="k">CORE</tspan> · AGENT
      </text>
    </svg>
  );
}
