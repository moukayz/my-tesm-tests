import { cn } from "@/shared/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[calc(var(--radius)-6px)] bg-black/5",
        className,
      )}
    />
  );
}
