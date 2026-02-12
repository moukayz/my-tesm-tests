import { apiFetchJson, apiFetch } from "@/shared/api/client";
import type { components } from "@/shared/api/openapi";

export type SessionResponse = components["schemas"]["SessionResponse"];
export type AuthResponse = components["schemas"]["AuthResponse"];
export type MeResponse = components["schemas"]["MeResponse"];

type User = components["schemas"]["User"];

export type RegisterRequest = components["schemas"]["RegisterRequest"];
export type LoginRequest = components["schemas"]["LoginRequest"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function normalizeSessionResponse(raw: unknown): SessionResponse {
  if (!isRecord(raw)) throw new Error("Invalid session response");
  const authenticated = raw.authenticated;

  if (authenticated === false) {
    return { authenticated: false };
  }

  if (authenticated === true) {
    const user = raw.user;
    const token = raw.csrfToken ?? raw.csrf_token;
    if (!token || typeof token !== "string") {
      throw new Error("Missing csrf token in session response");
    }
    return {
      authenticated: true,
      user: user as User,
      csrfToken: token,
    };
  }

  throw new Error("Invalid authenticated field in session response");
}

export async function getSession(): Promise<SessionResponse> {
  const raw = await apiFetchJson<unknown>("/v1/auth/session");
  return normalizeSessionResponse(raw);
}

export async function register(body: RegisterRequest) {
  return await apiFetchJson<AuthResponse>("/v1/auth/register", {
    method: "POST",
    body,
  });
}

export async function login(body: LoginRequest) {
  return await apiFetchJson<AuthResponse>("/v1/auth/login", {
    method: "POST",
    body,
  });
}

export async function logout() {
  await apiFetch("/v1/auth/logout", {
    method: "POST",
  });
}

export async function me() {
  return await apiFetchJson<MeResponse>("/v1/users/me");
}
