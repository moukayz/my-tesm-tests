"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { useSessionQuery } from "@/features/auth/hooks";
import { useDeletePostMutation, usePostQuery } from "@/features/posts/hooks";
import { PostDetailView } from "@/features/posts/components/post-detail";
import { PostActions } from "@/features/posts/components/post-actions";
import { ApiError } from "@/shared/api/errors";
import { ErrorState } from "@/shared/ui/error-state";
import { Skeleton } from "@/shared/ui/skeleton";
import { useToast } from "@/shared/ui/toast";

export function PostDetailPage({ postId }: { postId: string }) {
  const router = useRouter();
  const toast = useToast();
  const session = useSessionQuery();
  const post = usePostQuery(postId);
  const del = useDeletePostMutation(postId);

  if (post.isLoading) {
    return (
      <div className="space-y-3" aria-label="Loading post">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  if (post.isError) {
    const e = post.error as ApiError;
    if (e.code === "not_found") {
      return (
        <div className="rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]">
          <h1 className="font-serif text-3xl tracking-tight">Post not found</h1>
          <p className="mt-2 text-sm text-muted">
            The post may have been deleted or the link is incorrect.
          </p>
          <div className="mt-4">
            <Link href="/posts" className="text-sm font-medium text-brand hover:underline">
              Back to posts
            </Link>
          </div>
        </div>
      );
    }
    return (
      <ErrorState
        title="Could not load post"
        message={e.message}
        requestId={e.requestId}
        onRetry={() => post.refetch()}
      />
    );
  }

  const data = post.data;
  if (!data) return null;
  const user = session.data?.authenticated ? session.data.user : null;
  const isOwner = !!(user && user.id === data.post.author.id);

  return (
    <div className="space-y-4">
      {isOwner ? (
        <div className="flex justify-end">
          <PostActions
            postId={data.post.id}
            deleting={del.isPending}
            onDelete={async () => {
              try {
                await del.mutateAsync();
                toast.push({ kind: "success", title: "Post deleted" });
                router.push("/posts");
              } catch (e) {
                const err = e as ApiError;
                toast.push({
                  kind: "error",
                  title: "Delete failed",
                  description: err.message,
                  requestId: err.requestId,
                });
              }
            }}
          />
        </div>
      ) : null}
      <PostDetailView post={data.post} />
    </div>
  );
}
