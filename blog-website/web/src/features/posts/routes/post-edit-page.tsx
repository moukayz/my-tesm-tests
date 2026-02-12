"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { useSessionQuery } from "@/features/auth/hooks";
import { usePostQuery, useUpdatePostMutation } from "@/features/posts/hooks";
import { PostEditorForm } from "@/features/posts/components/post-editor-form";
import { ApiError } from "@/shared/api/errors";
import { ErrorState } from "@/shared/ui/error-state";
import { Skeleton } from "@/shared/ui/skeleton";
import { useToast } from "@/shared/ui/toast";
import { buildLoginUrl } from "@/shared/lib/routes";

export function PostEditPage({ postId }: { postId: string }) {
  const router = useRouter();
  const toast = useToast();
  const session = useSessionQuery();
  const post = usePostQuery(postId);
  const update = useUpdatePostMutation(postId);

  if (post.isLoading) {
    return (
      <div className="space-y-3" aria-label="Loading post">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-56" />
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
            The post may have been deleted.
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

  if (!isOwner) {
    return (
      <div className="rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]">
        <h1 className="font-serif text-3xl tracking-tight">No access</h1>
        <p className="mt-2 text-sm text-muted">
          You can only edit posts you created.
        </p>
        <div className="mt-4">
          <Link
            href={`/posts/${postId}`}
            className="text-sm font-medium text-brand hover:underline"
          >
            Back to post
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PostEditorForm
      mode="edit"
      initialPost={{ title: data.post.title, body: data.post.body }}
      pending={update.isPending}
      serverError={update.error}
      submitLabel="Save changes"
      onSubmit={async (values) => {
        try {
          const res = await update.mutateAsync(values);
          toast.push({ kind: "success", title: "Post updated" });
          router.push(`/posts/${res.post.id}`);
        } catch (e) {
          if (e instanceof ApiError && e.code === "unauthenticated") {
            router.replace(buildLoginUrl(`/posts/${postId}/edit`));
            return;
          }
          if (e instanceof ApiError && e.code === "forbidden") {
            toast.push({ kind: "error", title: "No permission", description: e.message, requestId: e.requestId });
            router.push(`/posts/${postId}`);
            return;
          }
          throw e;
        }
      }}
    />
  );
}
