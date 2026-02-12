"use client";

import Link from "next/link";
import React from "react";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";

export function PostActions({
  postId,
  onDelete,
  deleting,
}: {
  postId: string;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/posts/${postId}/edit`}
          className="inline-flex h-9 items-center justify-center rounded-[calc(var(--radius)-6px)] border border-card-border bg-card px-3 text-sm font-medium text-fg hover:bg-white"
          data-testid="post-edit"
        >
          Edit
        </Link>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setOpen(true)}
          data-testid="post-delete"
        >
          Delete
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        title="Delete this post?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        danger
        pending={deleting}
        onClose={() => setOpen(false)}
        onConfirm={onDelete}
      />
    </>
  );
}
