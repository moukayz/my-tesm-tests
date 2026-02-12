"use client";

import Link from "next/link";
import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSessionQuery, useLogoutMutation } from "@/features/auth/hooks";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";
import { buildLoginUrl } from "@/shared/lib/routes";
import { useToast } from "@/shared/ui/toast";

function useOnlineStatus() {
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const online = useOnlineStatus();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  const session = useSessionQuery();
  const logout = useLogoutMutation();

  const user = session.data?.authenticated ? session.data.user : null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-card-border bg-[color:var(--bg)]/80 backdrop-blur">
        {!online ? (
          <div className="border-b border-card-border bg-[color:var(--brand)] text-[color:var(--bg)]">
            <div className="mx-auto w-full max-w-6xl px-4 py-2 text-sm">
              You appear offline. Showing cached content when available.
            </div>
          </div>
        ) : null}

        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/posts" className="group flex items-baseline gap-2">
            <span className="font-serif text-xl tracking-tight">Ink & Cedar</span>
            <span className="hidden text-xs text-muted sm:inline">a tiny blog</span>
          </Link>

          <nav className="flex items-center gap-2">
            {session.isLoading ? (
              <div className="h-9 w-40 rounded bg-black/5" />
            ) : user ? (
              <>
                <Link
                  href="/posts/new"
                  className={cn(
                    "hidden sm:inline-flex",
                    "h-9 items-center justify-center rounded-[calc(var(--radius)-6px)] border border-card-border bg-card px-3 text-sm font-medium text-fg",
                    "hover:bg-white",
                  )}
                  data-testid="nav-new-post"
                >
                  New post
                </Link>
                <span className="hidden text-sm text-muted sm:inline">
                  @{user.username}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      await logout.mutateAsync();
                      toast.push({ kind: "success", title: "Logged out" });
                      router.push("/posts");
                    } catch (e) {
                      const err = e as { message?: string; requestId?: string };
                      toast.push({
                        kind: "error",
                        title: "Logout failed",
                        description: err.message ?? "Please try again.",
                        requestId: err.requestId,
                      });
                    }
                  }}
                  disabled={logout.isPending}
                  data-testid="nav-logout"
                >
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link
                  href={buildLoginUrl(pathname)}
                  className={cn(
                    "h-9 items-center justify-center rounded-[calc(var(--radius)-6px)] border border-card-border bg-card px-3 text-sm font-medium text-fg",
                    "hover:bg-white",
                  )}
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className={cn(
                    "h-9 items-center justify-center rounded-[calc(var(--radius)-6px)] bg-brand px-3 text-sm font-medium text-[color:var(--bg)]",
                    "hover:brightness-[1.03]",
                  )}
                >
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="page-enter">{children}</div>
      </main>
    </div>
  );
}
