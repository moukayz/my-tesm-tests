import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ModelSelector from "@/components/chat/ModelSelector";

const models = [
  { id: "alpha", label: "Alpha", supports_streaming: true },
  { id: "beta", label: "Beta", supports_streaming: true },
];

describe("ModelSelector", () => {
  it("renders model options", () => {
    render(
      <ModelSelector
        models={models}
        selectedId="alpha"
        onChange={() => {}}
      />
    );

    expect(screen.getByLabelText("Model selector")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("disables selection when disabled", () => {
    render(
      <ModelSelector
        models={models}
        selectedId="alpha"
        onChange={() => {}}
        disabled
      />
    );

    expect(screen.getByLabelText("Model selector")).toBeDisabled();
  });
});
