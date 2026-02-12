import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/v1/auth/session", () => {
    return HttpResponse.json({ authenticated: false });
  }),
  http.post("/v1/auth/login", () => {
    return HttpResponse.json(
      {
        error: {
          code: "invalid_credentials",
          message: "Invalid credentials",
          requestId: "req_test",
          details: null,
        },
      },
      { status: 401 },
    );
  }),
  http.post("/v1/auth/register", () => {
    return HttpResponse.json(
      {
        user: { id: "00000000-0000-0000-0000-000000000001", username: "u", createdAt: "2026-02-12T00:00:00Z" },
      },
      { status: 201 },
    );
  }),
  http.post("/v1/auth/logout", () => {
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("/v1/posts", () => {
    return HttpResponse.json({ items: [], nextCursor: null });
  }),
];
