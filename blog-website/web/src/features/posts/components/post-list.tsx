"use client";

import React from "react";
import { usePostsInfiniteQuery } from "@/features/posts/hooks";
import { PostCard } from "@/features/posts/components/post-card";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState } from "@/shared/ui/empty-state";
import { ErrorState } from "@/shared/ui/error-state";
import { Button } from "@/shared/ui/button";
import { ApiError } from "@/shared/api/errors";
import { useSessionQuery } from "@/features/auth/hooks";
import { buildLoginUrl } from "@/shared/lib/routes";

export function PostList({ limit = 20 }: { limit?: number }) {
  const session = useSessionQuery();
  const posts = usePostsInfiniteQuery({ limit });

  if (posts.isLoading) {
    return (
      <div className="space-y-3" aria-label="Loading posts">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  if (posts.isError) {
    const e = posts.error as ApiError;
    return (
      <ErrorState
        title="Could not load posts"
        message={e.message}
        requestId={e.requestId}
        onRetry={() => posts.refetch()}
      />
    );
  }

  if (!posts.data) {
    return null;
  }

  const items = posts.data.pages.flatMap((p) => p.items);
  const isAuthed = !!session.data?.authenticated;

  if (!items.length) {
    return (
      <EmptyState
        title="No posts yet."
        description={
          isAuthed
            ? "Start the feed with a short hello."
            : "Login to write the first post."
        }
        cta={
          isAuthed
            ? { href: "/posts/new", label: "Write the first post" }
            : { href: buildLoginUrl("/posts/new"), label: "Login to write" }
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((post, idx) => (
        <div
          key={post.id}
          style={{
            animationDelay: `${Math.min(idx, 10) * 35}ms`,
          }}
          className="page-enter"
        >
          <PostCard post={post} />
        </div>
      ))}

      <div className="pt-2">
        {posts.hasNextPage ? (
          <Button
            variant="secondary"
            onClick={() => posts.fetchNextPage()}
            disabled={posts.isFetchingNextPage}
          >
            {posts.isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        ) : (
          <p className="text-xs text-muted">You reached the end.</p>
        )}
      </div>
    </div>
  );
}
