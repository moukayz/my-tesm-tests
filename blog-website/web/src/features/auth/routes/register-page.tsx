"use client";

import Link from "next/link";
import { RegisterForm } from "@/features/auth/components/auth-forms";

export function RegisterPage() {
  return (
    <div className="mx-auto grid w-full max-w-md gap-4">
      <RegisterForm />
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Login
        </Link>
      </p>
    </div>
  );
}
