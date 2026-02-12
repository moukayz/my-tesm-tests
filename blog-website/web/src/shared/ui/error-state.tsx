import { Button } from "@/shared/ui/button";

export function ErrorState({
  title,
  message,
  requestId,
  onRetry,
}: {
  title: string;
  message?: string;
  requestId?: string;
  onRetry?: () => void;
}) {
  return (
    <section className="rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]">
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
      {message ? (
        <p className="mt-2 text-sm leading-6 text-muted">{message}</p>
      ) : null}
      {requestId ? (
        <p className="mt-3 text-xs text-muted">requestId: {requestId}</p>
      ) : null}
      {onRetry ? (
        <div className="mt-4">
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
    </section>
  );
}
