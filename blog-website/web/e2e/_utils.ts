export function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function pickCsrfToken(sessionJson: unknown): string {
  const j = sessionJson as { csrfToken?: unknown; csrf_token?: unknown } | null | undefined;
  const token = j?.csrfToken ?? j?.csrf_token;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error(`Missing csrf token field in session response: ${JSON.stringify(sessionJson)}`);
  }
  return token;
}
