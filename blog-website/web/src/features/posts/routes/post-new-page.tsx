"use client";

import { useRouter } from "next/navigation";
import { useCreatePostMutation } from "@/features/posts/hooks";
import { PostEditorForm } from "@/features/posts/components/post-editor-form";
import { ApiError } from "@/shared/api/errors";
import { useToast } from "@/shared/ui/toast";
import { buildLoginUrl } from "@/shared/lib/routes";

export function PostNewPage() {
  const router = useRouter();
  const toast = useToast();
  const create = useCreatePostMutation();

  return (
    <PostEditorForm
      mode="create"
      pending={create.isPending}
      serverError={create.error}
      submitLabel="Publish"
      onSubmit={async (values) => {
        try {
          const res = await create.mutateAsync(values);
          toast.push({ kind: "success", title: "Post published" });
          router.push(`/posts/${res.post.id}`);
        } catch (e) {
          if (e instanceof ApiError && e.code === "unauthenticated") {
            router.replace(buildLoginUrl("/posts/new"));
            return;
          }
          throw e;
        }
      }}
    />
  );
}
