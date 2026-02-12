import { describe, expect, it } from "vitest";
import { formatUpdatedLabel } from "@/shared/lib/format";

describe("shared/lib/format", () => {
  it("hides updated label when timestamps match", () => {
    expect(
      formatUpdatedLabel("2026-02-12T00:00:00Z", "2026-02-12T00:00:00Z"),
    ).toBeNull();
  });

  it("shows updated label when changed", () => {
    expect(
      formatUpdatedLabel("2026-02-12T00:00:00Z", "2026-02-13T00:00:00Z"),
    ).toContain("Updated");
  });
});
