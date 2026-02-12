"use client";

import Link from "next/link";
import { useSessionQuery } from "@/features/auth/hooks";
import { PostList } from "@/features/posts/components/post-list";

export function PostsPage() {
  const session = useSessionQuery();
  const authed = !!session.data?.authenticated;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
      <section>
        <h1 className="font-serif text-4xl leading-[1.05] tracking-tight">
          Latest posts
        </h1>
        <p className="mt-2 text-sm text-muted">
          Stories, notes, and tiny experiments.
        </p>
        <div className="mt-6">
          <PostList />
        </div>
      </section>

      <aside className="h-fit rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]">
        <h2 className="font-serif text-2xl tracking-tight">About</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          A minimal blog with cookie sessions + CSRF protection. Public reading,
          author-only edits.
        </p>
        <div className="mt-4">
          {authed ? (
            <Link
              href="/posts/new"
              className="inline-flex h-11 w-full items-center justify-center rounded-[calc(var(--radius)-6px)] bg-brand px-4 text-sm font-medium text-[color:var(--bg)] hover:brightness-[1.03]"
            >
              Write a new post
            </Link>
          ) : (
            <Link
              href="/login?next=%2Fposts%2Fnew"
              className="inline-flex h-11 w-full items-center justify-center rounded-[calc(var(--radius)-6px)] border border-card-border bg-card px-4 text-sm font-medium text-fg hover:bg-white"
            >
              Login to write
            </Link>
          )}
        </div>
        <p className="mt-4 text-xs text-muted">
          Tip: the app calls the API via relative <code>/v1/*</code> URLs. Configure
          <code>API_ORIGIN</code> so Next.js can rewrite <code>/v1/*</code> to your
          backend.
        </p>
      </aside>
    </div>
  );
}
