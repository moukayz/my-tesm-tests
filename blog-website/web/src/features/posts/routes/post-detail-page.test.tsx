import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/render";
import { PostDetailPage } from "@/features/posts/routes/post-detail-page";

const postId = "00000000-0000-0000-0000-000000000100";

function mockPost(authorId: string) {
  server.use(
    http.get("/v1/auth/session", () => {
      return HttpResponse.json({
        authenticated: true,
        user: {
          id: authorId,
          username: "alice",
          createdAt: "2026-02-12T00:00:00Z",
        },
        csrfToken: "csrf_1",
      });
    }),
    http.get(`/v1/posts/${postId}`, () => {
      return HttpResponse.json({
        post: {
          id: postId,
          title: "Owned post",
          body: "Hello",
          author: { id: authorId, username: "alice" },
          createdAt: "2026-02-12T00:00:00Z",
          updatedAt: "2026-02-12T00:00:00Z",
        },
      });
    }),
  );
}

describe("PostDetailPage", () => {
  it("shows owner actions when viewing own post", async () => {
    mockPost("00000000-0000-0000-0000-000000000111");

    renderWithProviders(<PostDetailPage postId={postId} />);
    expect(await screen.findByRole("heading", { name: "Owned post" })).toBeVisible();
    expect(screen.getByTestId("post-edit")).toBeVisible();
    expect(screen.getByTestId("post-delete")).toBeVisible();
  });

  it("hides owner actions for non-owners", async () => {
    const authorId = "00000000-0000-0000-0000-000000000222";
    server.use(
      http.get("/v1/auth/session", () => {
        return HttpResponse.json({
          authenticated: true,
          user: {
            id: "00000000-0000-0000-0000-000000000333",
            username: "bob",
            createdAt: "2026-02-12T00:00:00Z",
          },
          csrfToken: "csrf_2",
        });
      }),
      http.get(`/v1/posts/${postId}`, () => {
        return HttpResponse.json({
          post: {
            id: postId,
            title: "Other post",
            body: "Hello",
            author: { id: authorId, username: "alice" },
            createdAt: "2026-02-12T00:00:00Z",
            updatedAt: "2026-02-12T00:00:00Z",
          },
        });
      }),
    );

    renderWithProviders(<PostDetailPage postId={postId} />);
    expect(await screen.findByRole("heading", { name: "Other post" })).toBeVisible();
    expect(screen.queryByTestId("post-edit")).toBeNull();
    expect(screen.queryByTestId("post-delete")).toBeNull();
  });
});
