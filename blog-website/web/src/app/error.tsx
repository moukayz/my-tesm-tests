"use client";

import { useEffect } from "react";
import { ErrorState } from "@/shared/ui/error-state";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Something went wrong"
      message={error.message}
      onRetry={() => reset()}
    />
  );
}
