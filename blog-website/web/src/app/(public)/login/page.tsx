import { Suspense } from "react";
import { LoginPage } from "@/features/auth/routes/login-page";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]">
          <div className="h-8 w-40 rounded bg-black/5" />
          <div className="mt-4 h-28 rounded bg-black/5" />
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
