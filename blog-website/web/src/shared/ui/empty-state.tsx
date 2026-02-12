import { ButtonLink } from "@/shared/ui/button";

export function EmptyState({
  title,
  description,
  cta,
}: {
  title: string;
  description?: string;
  cta?: { href: string; label: string };
}) {
  return (
    <section className="rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]">
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      ) : null}
      {cta ? (
        <div className="mt-4">
          <ButtonLink href={cta.href}>{cta.label}</ButtonLink>
        </div>
      ) : null}
    </section>
  );
}
