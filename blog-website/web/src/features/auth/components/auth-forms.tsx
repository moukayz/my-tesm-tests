"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError, getFieldErrors } from "@/shared/api/errors";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useLoginMutation, useRegisterMutation } from "@/features/auth/hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/shared/ui/toast";

const authSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(8).max(72),
});

type AuthValues = z.infer<typeof authSchema>;

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = React.useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
      </label>
      <div className="mt-1">{children(id)}</div>
      {error ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const toast = useToast();
  const next = search.get("next") ?? "/posts";
  const mutation = useLoginMutation();

  const [cooldown, setCooldown] = React.useState(false);

  const form = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { username: "", password: "" },
  });

  React.useEffect(() => {
    if (!cooldown) return;
    const t = window.setTimeout(() => setCooldown(false), 2500);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        form.clearErrors();
        try {
          await mutation.mutateAsync(values);
          toast.push({ kind: "success", title: "Welcome back" });
          router.push(next);
        } catch (e) {
          if (e instanceof ApiError) {
            if (e.code === "validation_error") {
              const fe = getFieldErrors(e.details);
              if (fe?.username?.[0]) form.setError("username", { message: fe.username[0] });
              if (fe?.password?.[0]) form.setError("password", { message: fe.password[0] });
              if (!fe) form.setError("root", { message: e.message });
              return;
            }
            if (e.code === "invalid_credentials") {
              form.setError("root", { message: "Invalid username or password." });
              return;
            }
            if (e.code === "rate_limited") {
              setCooldown(true);
              form.setError("root", { message: "Too many attempts. Try again shortly." });
              return;
            }
            form.setError("root", { message: e.message });
            return;
          }
          form.setError("root", { message: "Something went wrong." });
        }
      })}
    >
      <div className="rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]">
        <h1 className="font-serif text-3xl tracking-tight">Login</h1>
        <p className="mt-2 text-sm text-muted">
          Sign in to publish and manage your posts.
        </p>

        {form.formState.errors.root?.message ? (
          <div className="mt-4 rounded border border-danger/20 bg-white/60 px-3 py-2 text-sm text-fg">
            {form.formState.errors.root.message}
          </div>
        ) : null}

        <div className="mt-5 space-y-4">
          <Field label="Username" error={form.formState.errors.username?.message}>
            {(id) => (
              <Input
                id={id}
                {...form.register("username")}
                autoComplete="username"
                hasError={!!form.formState.errors.username}
              />
            )}
          </Field>
          <Field label="Password" error={form.formState.errors.password?.message}>
            {(id) => (
              <Input
                id={id}
                {...form.register("password")}
                type="password"
                autoComplete="current-password"
                hasError={!!form.formState.errors.password}
              />
            )}
          </Field>
        </div>

        <div className="mt-6">
          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending || cooldown}
            data-testid="login-submit"
          >
            {mutation.isPending
              ? "Signing in..."
              : cooldown
                ? "Please wait..."
                : "Login"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const search = useSearchParams();
  const toast = useToast();
  const next = search.get("next") ?? "/posts";
  const mutation = useRegisterMutation();

  const form = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { username: "", password: "" },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        form.clearErrors();
        try {
          await mutation.mutateAsync(values);
          toast.push({ kind: "success", title: "Account created" });
          router.push(next);
        } catch (e) {
          if (e instanceof ApiError) {
            if (e.code === "validation_error") {
              const fe = getFieldErrors(e.details);
              if (fe?.username?.[0]) form.setError("username", { message: fe.username[0] });
              if (fe?.password?.[0]) form.setError("password", { message: fe.password[0] });
              if (!fe) form.setError("root", { message: e.message });
              return;
            }
            if (e.code === "conflict") {
              form.setError("username", { message: "Username already taken." });
              return;
            }
            form.setError("root", { message: e.message });
            return;
          }
          form.setError("root", { message: "Something went wrong." });
        }
      })}
    >
      <div className="rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]">
        <h1 className="font-serif text-3xl tracking-tight">Register</h1>
        <p className="mt-2 text-sm text-muted">Create an account in under a minute.</p>

        {form.formState.errors.root?.message ? (
          <div className="mt-4 rounded border border-danger/20 bg-white/60 px-3 py-2 text-sm text-fg">
            {form.formState.errors.root.message}
          </div>
        ) : null}

        <div className="mt-5 space-y-4">
          <Field label="Username" error={form.formState.errors.username?.message}>
            {(id) => (
              <Input
                id={id}
                {...form.register("username")}
                autoComplete="username"
                hasError={!!form.formState.errors.username}
              />
            )}
          </Field>
          <Field label="Password" error={form.formState.errors.password?.message}>
            {(id) => (
              <Input
                id={id}
                {...form.register("password")}
                type="password"
                autoComplete="new-password"
                hasError={!!form.formState.errors.password}
              />
            )}
          </Field>
        </div>

        <div className="mt-6">
          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending}
            data-testid="register-submit"
          >
            {mutation.isPending ? "Creating..." : "Register"}
          </Button>
        </div>
      </div>
    </form>
  );
}
