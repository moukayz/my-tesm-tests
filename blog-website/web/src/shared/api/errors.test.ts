import { describe, expect, it } from "vitest";
import { getFieldErrors, isErrorResponse } from "@/shared/api/errors";

describe("shared/api/errors", () => {
  it("detects ErrorResponse shape", () => {
    expect(
      isErrorResponse({
        error: { code: "validation_error", message: "x", requestId: "req1" },
      }),
    ).toBe(true);
    expect(isErrorResponse({})).toBe(false);
  });

  it("extracts fieldErrors map", () => {
    expect(
      getFieldErrors({ fieldErrors: { title: ["required"], body: ["too_long"] } }),
    ).toEqual({ title: ["required"], body: ["too_long"] });
    expect(getFieldErrors(null)).toBeNull();
  });
});
