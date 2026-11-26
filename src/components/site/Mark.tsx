/*
 * Lorva Agent's mark: the owner's logo (public/brand/mark.webp, built by referensi/tools/apply-owner-assets.mjs) used as a CSS mask
 * filled with currentColor, so it follows the light and dark themes.
 */
const MARK_URL = "url(/brand/mark.webp?v=263422b0)";

export function MarkGlyph({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-testid="brand-mark"
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        width: size,
        height: size,
        WebkitMaskImage: MARK_URL,
        maskImage: MARK_URL,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5 text-[16px] tracking-[-0.01em]">
      <MarkGlyph size={18} />
      <span>Lorva Agent</span>
      <span className="sq blink" aria-hidden="true" />
    </span>
  );
}
