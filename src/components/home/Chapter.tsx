import Link from "next/link";

/* "END OF CHAPTER · 01/04  NEXT → …" chapter link with the running packet (MOTION.txt 8). */
export function Chapter({ n, of, title, href }: { n: number; of: number; title: string; href: string }) {
  return (
    <Link href={href} className="group block py-14" data-reveal="">
      <p className="cap">
        End of chapter · {String(n).padStart(2, "0")}/{String(of).padStart(2, "0")}
      </p>
      <div className="chapter mt-12">
        <div>
          <p className="cap">Next →</p>
          <p className="display d-chapter mt-2 transition-colors group-hover:!text-[var(--ink)]">{title}</p>
        </div>
        <div className="wire" aria-hidden="true">
          <i />
        </div>
      </div>
    </Link>
  );
}
