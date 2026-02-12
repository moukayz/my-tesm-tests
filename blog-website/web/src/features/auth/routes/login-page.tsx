"use client";

import Link from "next/link";
import { LoginForm } from "@/features/auth/components/auth-forms";

export function LoginPage() {
  return (
    <div className="mx-auto grid w-full max-w-md gap-4">
      <LoginForm />
      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
