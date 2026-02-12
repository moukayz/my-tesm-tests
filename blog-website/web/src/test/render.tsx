import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryProvider } from "@/shared/api/query-client";
import { ToastProvider } from "@/shared/ui/toast";

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryProvider>
        <ToastProvider>{children}</ToastProvider>
      </QueryProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...options });
}
