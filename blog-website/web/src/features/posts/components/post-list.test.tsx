import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/render";
import { PostList } from "@/features/posts/components/post-list";

describe("PostList", () => {
  it("renders empty state", async () => {
    renderWithProviders(<PostList />);
    expect(await screen.findByText(/no posts yet/i)).toBeVisible();
  });

  it("renders list items", async () => {
    server.use(
      http.get("/v1/posts", () => {
        return HttpResponse.json({
          items: [
            {
              id: "00000000-0000-0000-0000-000000000010",
              title: "Hello",
              author: { id: "00000000-0000-0000-0000-000000000001", username: "alice" },
              createdAt: "2026-02-12T00:00:00Z",
              updatedAt: "2026-02-12T00:00:00Z",
            },
          ],
          nextCursor: null,
        });
      }),
    );

    renderWithProviders(<PostList />);
    expect(await screen.findAllByTestId("post-card")).toHaveLength(1);
    expect(screen.getByText("Hello")).toBeVisible();
  });

  it("builds detail href from the item id", async () => {
    server.use(
      http.get("/v1/posts", () => {
        // Compatibility: backend may return postId instead of id.
        return HttpResponse.json({
          items: [
            {
              postId: "00000000-0000-0000-0000-000000000011",
              title: "Hello 2",
              author: { id: "00000000-0000-0000-0000-000000000001", username: "alice" },
              createdAt: "2026-02-12T00:00:00Z",
              updatedAt: "2026-02-12T00:00:00Z",
            },
          ],
          nextCursor: null,
        });
      }),
    );

    renderWithProviders(<PostList />);
    const cards = await screen.findAllByTestId("post-card");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveAttribute(
      "href",
      "/posts/00000000-0000-0000-0000-000000000011",
    );
  });
});
