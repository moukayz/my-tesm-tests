export function formatTimestamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export function formatUpdatedLabel(createdAt: string, updatedAt: string) {
  if (createdAt === updatedAt) return null;
  return `Updated ${formatTimestamp(updatedAt)}`;
}
