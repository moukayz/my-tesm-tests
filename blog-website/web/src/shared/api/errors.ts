import type { components } from "@/shared/api/openapi";

export type ErrorResponse = components["schemas"]["ErrorResponse"];

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string;
  readonly details?: unknown;

  constructor(args: {
    status: number;
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  }) {
    super(args.message);
    this.name = "ApiError";
    this.status = args.status;
    this.code = args.code;
    this.requestId = args.requestId;
    this.details = args.details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isErrorResponse(value: unknown): value is ErrorResponse {
  if (!isRecord(value)) return false;
  if (!("error" in value)) return false;
  const err = (value as { error?: unknown }).error;
  if (!isRecord(err)) return false;
  return (
    typeof err.code === "string" &&
    typeof err.message === "string" &&
    typeof err.requestId === "string"
  );
}

export function getFieldErrors(details: unknown): FieldErrors | null {
  if (!isRecord(details)) return null;
  const fieldErrors = details.fieldErrors;
  if (!isRecord(fieldErrors)) return null;

  const out: FieldErrors = {};
  for (const [k, v] of Object.entries(fieldErrors)) {
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      out[k] = v;
    }
  }

  return Object.keys(out).length ? out : null;
}

export async function parseApiError(res: Response): Promise<ApiError> {
  const status = res.status;

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (isErrorResponse(json)) {
    const { code, message, requestId, details } = json.error;
    return new ApiError({
      status,
      code,
      message,
      requestId,
      details: details ?? undefined,
    });
  }

  return new ApiError({
    status,
    code: "internal",
    message: `Request failed (${status})`,
    requestId: "unknown",
  });
}
