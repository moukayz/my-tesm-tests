import { apiFetchJson, apiFetch } from "@/shared/api/client";
import type { components } from "@/shared/api/openapi";

export type ListPostsResponse = components["schemas"]["ListPostsResponse"];
export type PostResponse = components["schemas"]["PostResponse"];
export type CreatePostRequest = components["schemas"]["CreatePostRequest"];
export type UpdatePostRequest = components["schemas"]["UpdatePostRequest"];

type PostSummary = components["schemas"]["PostSummary"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length) return v;
  }
  return undefined;
}

function normalizePostSummaryId(raw: unknown): PostSummary {
  if (!isRecord(raw)) throw new Error("Invalid post list item");
  const id =
    pickString(raw, ["id", "postId", "post_id"]) ??
    (isRecord(raw.post) ? pickString(raw.post, ["id", "postId", "post_id"]) : undefined);
  if (!id) throw new Error("Missing post id in list item");
  return { ...(raw as PostSummary), id };
}

function normalizeListPostsResponse(raw: unknown): ListPostsResponse {
  if (!isRecord(raw)) throw new Error("Invalid list posts response");
  const itemsRaw = raw.items;
  const items = Array.isArray(itemsRaw) ? itemsRaw.map(normalizePostSummaryId) : [];
  const nextCursor =
    (typeof raw.nextCursor === "string" ? raw.nextCursor : undefined) ??
    (typeof raw.next_cursor === "string" ? raw.next_cursor : null);
  return { items, nextCursor };
}

export async function listPosts(args: { limit?: number; cursor?: string | null }) {
  const params = new URLSearchParams();
  if (args.limit) params.set("limit", String(args.limit));
  if (args.cursor) params.set("cursor", args.cursor);
  const qs = params.toString();
  const raw = await apiFetchJson<unknown>(`/v1/posts${qs ? `?${qs}` : ""}`);
  return normalizeListPostsResponse(raw);
}

export async function getPost(postId: string) {
  return await apiFetchJson<PostResponse>(`/v1/posts/${postId}`);
}

export async function createPost(body: CreatePostRequest) {
  return await apiFetchJson<PostResponse>("/v1/posts", {
    method: "POST",
    body,
  });
}

export async function updatePost(postId: string, body: UpdatePostRequest) {
  return await apiFetchJson<PostResponse>(`/v1/posts/${postId}`, {
    method: "PATCH",
    body,
  });
}

export async function deletePost(postId: string) {
  await apiFetch(`/v1/posts/${postId}`, {
    method: "DELETE",
  });
}
