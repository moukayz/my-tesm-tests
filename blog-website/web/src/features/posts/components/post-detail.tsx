import type { components } from "@/shared/api/openapi";
import { formatTimestamp, formatUpdatedLabel } from "@/shared/lib/format";

type PostDetail = components["schemas"]["PostDetail"];

export function PostDetailView({ post }: { post: PostDetail }) {
  const updated = formatUpdatedLabel(post.createdAt, post.updatedAt);
  return (
    <article className="rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]">
      <h1 className="font-serif text-3xl leading-9 tracking-tight">{post.title}</h1>
      <p className="mt-2 text-sm text-muted">
        By <span className="font-medium text-fg">{post.author.username}</span>
        <span className="mx-2">·</span>
        <span>{formatTimestamp(post.createdAt)}</span>
        {updated ? <span className="ml-2">· {updated}</span> : null}
      </p>
      <div className="mt-6 whitespace-pre-wrap text-[15px] leading-7 text-fg">
        {post.body}
      </div>
    </article>
  );
}
