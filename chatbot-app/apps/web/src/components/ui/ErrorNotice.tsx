import type { ErrorDetail, ErrorResponse } from "@/lib/contracts";
import { getErrorMessage, getRequestId } from "@/lib/errors";

type ErrorNoticeProps = {
  error?: ErrorResponse | ErrorDetail | null;
  title?: string;
  compact?: boolean;
};

export default function ErrorNotice({
  error,
  title = "Something went wrong",
  compact = false,
}: ErrorNoticeProps) {
  const message = getErrorMessage(error ?? null);
  const requestId = getRequestId(error ?? null);

  return (
    <div
      className={`rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-100 ${
        compact ? "text-sm" : "text-base"
      }`}
      role="alert"
      data-testid="error-notice"
    >
      <div className="font-display text-sm font-semibold uppercase tracking-wide text-amber-200">
        {title}
      </div>
      <p className="mt-1 text-sm text-amber-100/90">{message}</p>
      {requestId ? (
        <details className="mt-2 text-xs text-amber-200/80">
          <summary className="cursor-pointer">Details</summary>
          <div className="mt-1">Request ID: {requestId}</div>
        </details>
      ) : null}
    </div>
  );
}
