import Link from "next/link";
import type { components } from "@/shared/api/openapi";
import { formatTimestamp, formatUpdatedLabel } from "@/shared/lib/format";

type PostSummary = components["schemas"]["PostSummary"];

export function PostCard({ post }: { post: PostSummary }) {
  const updated = formatUpdatedLabel(post.createdAt, post.updatedAt);
  return (
    <Link
      href={`/posts/${post.id}`}
      className="block rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:bg-white"
      data-testid="post-card"
    >
      <h3 className="font-serif text-xl leading-7 tracking-tight text-fg">
        {post.title}
      </h3>
      <p className="mt-2 text-sm text-muted">
        By <span className="font-medium text-fg">{post.author.username}</span>
        <span className="mx-2">·</span>
        <span>{formatTimestamp(post.createdAt)}</span>
        {updated ? <span className="ml-2">· {updated}</span> : null}
      </p>
    </Link>
  );
}
