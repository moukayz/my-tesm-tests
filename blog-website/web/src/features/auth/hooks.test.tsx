import React from "react";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/render";
import { useLoginMutation, useLogoutMutation, useSessionQuery } from "@/features/auth/hooks";
import { getCsrfToken, setCsrfToken } from "@/shared/api/csrf";

function SessionProbe() {
  const session = useSessionQuery();
  const login = useLoginMutation();

  return (
    <div>
      <div data-testid="session-auth">
        {session.isLoading ? "loading" : String(!!session.data?.authenticated)}
      </div>
      <button
        type="button"
        onClick={() => login.mutate({ username: "alice", password: "password123" })}
      >
        login
      </button>
    </div>
  );
}

function LogoutProbe() {
  const session = useSessionQuery();
  const logout = useLogoutMutation();

  return (
    <div>
      <div data-testid="session-auth">
        {session.isLoading ? "loading" : String(!!session.data?.authenticated)}
      </div>
      <button type="button" onClick={() => logout.mutate()}>
        logout
      </button>
    </div>
  );
}

describe("auth session refresh", () => {
  it("refetches session after login even when cached as fresh", async () => {
    setCsrfToken(null);

    let sessionCalls = 0;
    server.use(
      http.post("/v1/auth/login", () => {
        return HttpResponse.json(
          {
            user: {
              id: "00000000-0000-0000-0000-000000000001",
              username: "alice",
              createdAt: "2026-02-12T00:00:00Z",
            },
          },
          { status: 200 },
        );
      }),
      http.get("/v1/auth/session", () => {
        sessionCalls += 1;
        if (sessionCalls === 1) return HttpResponse.json({ authenticated: false });
        return HttpResponse.json({
          authenticated: true,
          user: {
            id: "00000000-0000-0000-0000-000000000001",
            username: "alice",
            createdAt: "2026-02-12T00:00:00Z",
          },
          // Contract field is csrfToken; backend may return csrf_token.
          csrf_token: "csrf_123",
        });
      }),
    );

    renderWithProviders(<SessionProbe />);
    await waitFor(() =>
      expect(screen.getByTestId("session-auth")).toHaveTextContent("false"),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() =>
      expect(screen.getByTestId("session-auth")).toHaveTextContent("true"),
    );
    expect(getCsrfToken()).toBe("csrf_123");
  });
});

describe("logout", () => {
  it("clears session and csrf token on success", async () => {
    setCsrfToken(null);

    server.use(
      http.get("/v1/auth/session", () => {
        return HttpResponse.json({
          authenticated: true,
          user: {
            id: "00000000-0000-0000-0000-000000000002",
            username: "bob",
            createdAt: "2026-02-12T00:00:00Z",
          },
          csrfToken: "csrf_abc",
        });
      }),
      http.post("/v1/auth/logout", () => {
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithProviders(<LogoutProbe />);
    await waitFor(() =>
      expect(screen.getByTestId("session-auth")).toHaveTextContent("true"),
    );
    expect(getCsrfToken()).toBe("csrf_abc");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() =>
      expect(screen.getByTestId("session-auth")).toHaveTextContent("false"),
    );
    expect(getCsrfToken()).toBeNull();
  });

  it("treats 401 as logged out", async () => {
    setCsrfToken(null);

    server.use(
      http.get("/v1/auth/session", () => {
        return HttpResponse.json({
          authenticated: true,
          user: {
            id: "00000000-0000-0000-0000-000000000003",
            username: "cora",
            createdAt: "2026-02-12T00:00:00Z",
          },
          csrfToken: "csrf_401",
        });
      }),
      http.post("/v1/auth/logout", () => {
        return HttpResponse.json(
          {
            error: {
              code: "unauthenticated",
              message: "Already logged out",
              requestId: "req_401",
            },
          },
          { status: 401 },
        );
      }),
    );

    renderWithProviders(<LogoutProbe />);
    await waitFor(() =>
      expect(screen.getByTestId("session-auth")).toHaveTextContent("true"),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() =>
      expect(screen.getByTestId("session-auth")).toHaveTextContent("false"),
    );
    expect(getCsrfToken()).toBeNull();
  });

  it("refreshes session and retries on csrf failure", async () => {
    setCsrfToken(null);
    let logoutCalls = 0;
    let sessionCalls = 0;

    server.use(
      http.get("/v1/auth/session", () => {
        sessionCalls += 1;
        return HttpResponse.json({
          authenticated: true,
          user: {
            id: "00000000-0000-0000-0000-000000000004",
            username: "dora",
            createdAt: "2026-02-12T00:00:00Z",
          },
          csrfToken: sessionCalls === 1 ? "csrf_stale" : "csrf_fresh",
        });
      }),
      http.post("/v1/auth/logout", () => {
        logoutCalls += 1;
        if (logoutCalls === 1) {
          return HttpResponse.json(
            {
              error: {
                code: "forbidden",
                message: "Invalid CSRF",
                requestId: "req_403",
              },
            },
            { status: 403 },
          );
        }
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithProviders(<LogoutProbe />);
    await waitFor(() =>
      expect(screen.getByTestId("session-auth")).toHaveTextContent("true"),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() =>
      expect(screen.getByTestId("session-auth")).toHaveTextContent("false"),
    );
    expect(logoutCalls).toBe(2);
    expect(sessionCalls).toBeGreaterThanOrEqual(2);
    expect(getCsrfToken()).toBeNull();
  });
});
