import type { ErrorDetail, ErrorResponse } from "@/lib/contracts";

const codeMessages: Record<string, string> = {
  MODEL_NOT_AVAILABLE: "That model is not available right now.",
  VALIDATION_ERROR: "Please double-check the request and try again.",
  VALIDATION_FAILED: "Please double-check the request and try again.",
};

export const getErrorMessage = (error?: ErrorResponse | ErrorDetail | null) => {
  if (!error) {
    return "Something went wrong. Please try again.";
  }

  const detail = "error" in error ? error.error : error;
  return codeMessages[detail.code] ?? detail.message ?? "Something went wrong.";
};

export const getRequestId = (error?: ErrorResponse | ErrorDetail | null) => {
  if (!error) {
    return undefined;
  }

  const detail = "error" in error ? error.error : error;
  return detail.request_id;
};
