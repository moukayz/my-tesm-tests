import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Composer from "@/components/chat/Composer";

const models = [
  { id: "alpha", label: "Alpha", supports_streaming: true },
];

describe("Composer", () => {
  it("disables send while streaming", () => {
    render(
      <Composer
        value="Hello"
        onChange={() => {}}
        onSend={vi.fn()}
        disabled={false}
        isStreaming
        models={models}
        selectedModelId="alpha"
        onModelChange={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });
});
