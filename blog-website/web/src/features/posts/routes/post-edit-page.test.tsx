import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/render";
import { PostEditPage } from "@/features/posts/routes/post-edit-page";

describe("PostEditPage", () => {
  it("renders no-access state for non-owners", async () => {
    const postId = "00000000-0000-0000-0000-000000000200";
    server.use(
      http.get("/v1/auth/session", () => {
        return HttpResponse.json({
          authenticated: true,
          user: {
            id: "00000000-0000-0000-0000-000000000201",
            username: "bob",
            createdAt: "2026-02-12T00:00:00Z",
          },
          csrfToken: "csrf_edit",
        });
      }),
      http.get(`/v1/posts/${postId}`, () => {
        return HttpResponse.json({
          post: {
            id: postId,
            title: "Other post",
            body: "Hello",
            author: { id: "00000000-0000-0000-0000-000000000999", username: "alice" },
            createdAt: "2026-02-12T00:00:00Z",
            updatedAt: "2026-02-12T00:00:00Z",
          },
        });
      }),
    );

    renderWithProviders(<PostEditPage postId={postId} />);
    expect(await screen.findByRole("heading", { name: /no access/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /back to post/i })).toBeVisible();
  });
});
