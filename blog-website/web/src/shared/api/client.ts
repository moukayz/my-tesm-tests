import { getCsrfToken } from "@/shared/api/csrf";
import { parseApiError } from "@/shared/api/errors";

type JsonInit = Omit<RequestInit, "body"> & { body?: unknown };

function isMutating(method: string) {
  const m = method.toUpperCase();
  return m === "POST" || m === "PATCH" || m === "DELETE";
}

export async function apiFetch(input: string, init: JsonInit = {}) {
  const headers = new Headers(init.headers);
  const method = init.method ?? "GET";

  if (init.body !== undefined) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  if (isMutating(method)) {
    const token = getCsrfToken();
    if (token) headers.set("X-CSRF-Token", token);
  }

  const res = await fetch(input, {
    ...init,
    method,
    headers,
    credentials: "include",
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  if (!res.ok) throw await parseApiError(res);
  return res;
}

export async function apiFetchJson<T>(input: string, init: JsonInit = {}) {
  const res = await apiFetch(input, init);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
