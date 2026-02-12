"use client";

import React from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { components } from "@/shared/api/openapi";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { ApiError, getFieldErrors } from "@/shared/api/errors";

type PostDetail = components["schemas"]["PostDetail"];

const postSchema = z.object({
  title: z.string().min(1, "required").max(200, "too_long"),
  body: z.string().min(1, "required").max(50_000, "too_long"),
});

type PostValues = z.infer<typeof postSchema>;

export function PostEditorForm({
  mode,
  initialPost,
  onSubmit,
  submitLabel,
  pending,
  serverError,
}: {
  mode: "create" | "edit";
  initialPost?: Pick<PostDetail, "title" | "body">;
  onSubmit: (values: PostValues) => Promise<void>;
  submitLabel: string;
  pending: boolean;
  serverError?: unknown;
}) {
  const [redirecting, setRedirecting] = React.useState(false);

  const initialTitle = initialPost?.title;
  const initialBody = initialPost?.body;

  const form = useForm<PostValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: initialTitle ?? "",
      body: initialBody ?? "",
    },
  });

  React.useEffect(() => {
    if (initialTitle !== undefined && initialBody !== undefined) {
      form.reset({ title: initialTitle, body: initialBody });
    }
  }, [form, initialBody, initialTitle]);

  React.useEffect(() => {
    if (!(serverError instanceof ApiError)) return;
    if (serverError.code !== "validation_error") return;

    const fe = getFieldErrors(serverError.details);
    if (fe?.title?.[0]) form.setError("title", { message: fe.title[0] });
    if (fe?.body?.[0]) form.setError("body", { message: fe.body[0] });
    if (!fe) form.setError("root", { message: serverError.message });
  }, [form, serverError]);

  const title = useWatch({ control: form.control, name: "title" }) ?? "";
  const body = useWatch({ control: form.control, name: "body" }) ?? "";

  if (redirecting) {
    return (
      <div className="space-y-3" aria-label="Saving post">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
      <form
        className="rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]"
        onSubmit={form.handleSubmit(async (values) => {
          form.clearErrors();
          setRedirecting(true);
          try {
            await onSubmit(values);
          } catch (e) {
            setRedirecting(false);
            throw e;
          }
        })}
      >
        <h1 className="font-serif text-3xl tracking-tight">
          {mode === "create" ? "New post" : "Edit post"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Plain text only — no Markdown, no embeds.
        </p>

        {form.formState.errors.root?.message ? (
          <div className="mt-4 rounded border border-danger/20 bg-white/60 px-3 py-2 text-sm text-fg">
            {form.formState.errors.root.message}
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-fg" htmlFor="title">
              Title
            </label>
            <div className="mt-1">
              <Input
                id="title"
                {...form.register("title")}
                hasError={!!form.formState.errors.title}
              />
            </div>
            {form.formState.errors.title?.message ? (
              <p className="mt-1 text-xs text-danger" role="alert">
                {form.formState.errors.title.message}
              </p>
            ) : null}
          </div>
          <div>
            <label className="block text-sm font-medium text-fg" htmlFor="body">
              Body
            </label>
            <div className="mt-1">
              <Textarea
                id="body"
                rows={12}
                {...form.register("body")}
                hasError={!!form.formState.errors.body}
              />
            </div>
            {form.formState.errors.body?.message ? (
              <p className="mt-1 text-xs text-danger" role="alert">
                {form.formState.errors.body.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6">
          <Button
            type="submit"
            disabled={pending}
            className="w-full"
            data-testid="post-editor-submit"
          >
            {pending ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>

      <aside className="rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]">
        <h2 className="font-serif text-xl tracking-tight">Preview</h2>
        <p className="mt-2 text-sm text-muted">What readers will see.</p>
        <div className="mt-6">
          <p className="font-serif text-2xl leading-8 tracking-tight">
            {title || "Untitled"}
          </p>
          <div className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-fg">
            {body || "Start writing..."}
          </div>
        </div>
      </aside>
    </div>
  );
}
