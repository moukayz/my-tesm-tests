export function buildLoginUrl(nextPath?: string) {
  if (!nextPath) return "/login";
  return `/login?next=${encodeURIComponent(nextPath)}`;
}
