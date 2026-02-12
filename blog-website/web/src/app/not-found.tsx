import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]">
      <h1 className="font-serif text-3xl tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted">That route does not exist.</p>
      <div className="mt-4">
        <Link href="/posts" className="text-sm font-medium text-brand hover:underline">
          Back to posts
        </Link>
      </div>
    </div>
  );
}
