"use client";

import { QueryProvider } from "@/shared/api/query-client";
import { ToastProvider } from "@/shared/ui/toast";

export function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <ToastProvider>{children}</ToastProvider>
    </QueryProvider>
  );
}
