import React from "react";
import Link from "next/link";
import { cn } from "@/shared/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

function buttonClasses({
  variant,
  size,
  className,
}: {
  variant: Variant;
  size: Size;
  className?: string;
}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-[calc(var(--radius)-6px)] font-medium transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]",
    "disabled:opacity-50 disabled:pointer-events-none",
    size === "sm" && "h-9 px-3 text-sm",
    size === "md" && "h-11 px-4 text-sm",
    variant === "primary" &&
      "bg-brand text-[color:var(--bg)] shadow-sm hover:brightness-[1.03]",
    variant === "secondary" &&
      "bg-[color:var(--card)] text-fg border border-card-border hover:bg-white",
    variant === "ghost" &&
      "bg-transparent text-fg hover:bg-black/5 border border-transparent",
    variant === "danger" && "bg-danger text-white shadow-sm hover:brightness-[1.03]",
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
}) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, className })}>
      {children}
    </Link>
  );
}
