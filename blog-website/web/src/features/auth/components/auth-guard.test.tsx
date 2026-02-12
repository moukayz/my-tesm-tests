import { describe, expect, it, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/render";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { buildLoginUrl } from "@/shared/lib/routes";

type RouterMock = {
  replace: ((path: string) => void) & { mockClear: () => void };
};

function setPathname(path: string) {
  (globalThis as unknown as { __setPathname?: (p: string) => void }).__setPathname?.(
    path,
  );
}

function getRouterMock() {
  return (globalThis as unknown as { __routerMock?: RouterMock }).__routerMock;
}

describe("AuthGuard", () => {
  beforeEach(() => {
    const router = getRouterMock();
    router?.replace.mockClear();
  });

  it("redirects unauthenticated users to login", async () => {
    setPathname("/posts/new");
    server.use(
      http.get("/v1/auth/session", () => {
        return HttpResponse.json({ authenticated: false });
      }),
    );

    renderWithProviders(
      <AuthGuard>
        <div>Protected</div>
      </AuthGuard>,
    );

    await waitFor(() => {
      const router = getRouterMock();
      expect(router?.replace).toHaveBeenCalledWith(buildLoginUrl("/posts/new"));
    });
    expect(screen.queryByText("Protected")).toBeNull();
  });

  it("encodes the edit route in the login redirect", async () => {
    setPathname("/posts/123/edit");
    server.use(
      http.get("/v1/auth/session", () => {
        return HttpResponse.json({ authenticated: false });
      }),
    );

    renderWithProviders(
      <AuthGuard>
        <div>Protected</div>
      </AuthGuard>,
    );

    await waitFor(() => {
      const router = getRouterMock();
      expect(router?.replace).toHaveBeenCalledWith(buildLoginUrl("/posts/123/edit"));
    });
  });

  it("renders children when authenticated", async () => {
    setPathname("/posts/new");
    server.use(
      http.get("/v1/auth/session", () => {
        return HttpResponse.json({
          authenticated: true,
          user: {
            id: "00000000-0000-0000-0000-000000000010",
            username: "alice",
            createdAt: "2026-02-12T00:00:00Z",
          },
          csrfToken: "csrf_1",
        });
      }),
    );

    renderWithProviders(
      <AuthGuard>
        <div>Protected</div>
      </AuthGuard>,
    );

    expect(await screen.findByText("Protected")).toBeVisible();
    const router = getRouterMock();
    expect(router?.replace).not.toHaveBeenCalled();
  });
});
