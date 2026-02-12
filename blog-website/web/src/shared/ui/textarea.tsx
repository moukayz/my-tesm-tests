import React from "react";
import { cn } from "@/shared/lib/cn";

export function Textarea({
  className,
  hasError,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { hasError?: boolean }) {
  return (
    <textarea
      className={cn(
        "w-full rounded-[calc(var(--radius)-6px)] bg-white/70 px-3 py-2.5 text-sm text-fg",
        "border border-card-border shadow-[0_1px_0_rgba(0,0,0,0.02)]",
        "placeholder:text-muted/70",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:border-transparent",
        hasError && "border-danger/50 focus-visible:ring-[color:rgba(180,58,45,0.28)]",
        className,
      )}
      {...props}
    />
  );
}
