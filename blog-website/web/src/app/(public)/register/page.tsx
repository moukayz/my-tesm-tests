import { Suspense } from "react";
import { RegisterPage } from "@/features/auth/routes/register-page";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]">
          <div className="h-8 w-48 rounded bg-black/5" />
          <div className="mt-4 h-28 rounded bg-black/5" />
        </div>
      }
    >
      <RegisterPage />
    </Suspense>
  );
}
