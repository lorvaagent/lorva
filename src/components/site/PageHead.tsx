/* Title band for inner pages in the reference's language: a mono caption over a giant uppercase headline, lede on the right. */
export function PageHead({ eyebrow, title, children, actions }: { eyebrow: string; title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="edge pb-10 pt-12">
      <p className="cap" data-reveal="">
        {eyebrow}
      </p>
      <div className="mt-6 grid gap-6 min-[901px]:grid-cols-[1fr_minmax(0,430px)] min-[901px]:items-end">
        <h1 className="display d-sec" data-reveal="">
          {title}
        </h1>
        {children ? (
          <div className="lede" data-reveal="">
            {children}
          </div>
        ) : null}
      </div>
      {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
      <div className="rule mt-10" />
    </section>
  );
}

export function StatusBadge({ status }: { status: "Prototype" | "Concept" }) {
  return (
    <span className={`badge ${status === "Prototype" ? "proto" : "concept"}`}>
      <i aria-hidden="true" />
      {status}
    </span>
  );
}
export function SampleBadge({ label = "Sample data" }: { label?: string }) {
  return <span className="badge sample">{label}</span>;
}
export function LiveBadge({ label = "Live from chain" }: { label?: string }) {
  return (
    <span className="badge live">
      <i aria-hidden="true" />
      {label}
    </span>
  );
}
