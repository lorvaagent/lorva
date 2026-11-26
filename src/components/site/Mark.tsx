/*
 * Lorva Agent's mark (AI placeholder until the owner's logo arrives; referensi/tools/apply-owner-assets.mjs swaps the files): a
 * wireframe cube, the "core" box of the pipeline diagram, drawn in currentColor.
 */
export function MarkGlyph({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" data-testid="brand-mark" className={`shrink-0 ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M12 2.5 21 7.5v9L12 21.5 3 16.5v-9z" />
      <path d="M3 7.5 12 12.5l9-5M12 12.5v9" />
    </svg>
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
