"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSessionQuery } from "@/features/auth/hooks";
import { buildLoginUrl } from "@/shared/lib/routes";
import { Skeleton } from "@/shared/ui/skeleton";

export function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSessionQuery();

  React.useEffect(() => {
    if (session.isLoading) return;
    if (!session.data?.authenticated) {
      router.replace(buildLoginUrl(pathname));
    }
  }, [pathname, router, session.data?.authenticated, session.isLoading]);

  if (session.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (!session.data?.authenticated) return null;
  return <>{children}</>;
}
