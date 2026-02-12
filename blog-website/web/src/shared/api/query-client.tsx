"use client";

import {
  QueryClient,
  QueryClientProvider,
  type DefaultOptions,
} from "@tanstack/react-query";
import React from "react";

const defaultOptions: DefaultOptions = {
  queries: {
    retry: (failureCount, error) => {
      const e = error as { status?: number } | undefined;
      if (e?.status && e.status >= 400 && e.status < 500) return false;
      return failureCount < 2;
    },
    refetchOnWindowFocus: true,
  },
};

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions,
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
