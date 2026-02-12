import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { PostEditorForm } from "@/features/posts/components/post-editor-form";
import { ApiError } from "@/shared/api/errors";

describe("PostEditorForm", () => {
  it("updates preview while typing", async () => {
    const onSubmit = vi.fn(async () => {});
    renderWithProviders(
      <PostEditorForm
        mode="create"
        pending={false}
        submitLabel="Publish"
        onSubmit={onSubmit}
      />,
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/title/i), "My title");
    await user.type(screen.getByLabelText(/body/i), "Hello world");

    expect(screen.getByText("My title")).toBeVisible();
    expect(screen.getByText("Hello world")).toBeVisible();
  });

  it("maps server field errors to inputs", () => {
    const onSubmit = vi.fn(async () => {});
    const serverError = new ApiError({
      status: 400,
      code: "validation_error",
      message: "Bad input",
      requestId: "req_fields",
      details: {
        fieldErrors: {
          title: ["required"],
          body: ["too_long"],
        },
      },
    });

    renderWithProviders(
      <PostEditorForm
        mode="create"
        pending={false}
        submitLabel="Publish"
        onSubmit={onSubmit}
        serverError={serverError}
      />,
    );

    expect(screen.getByText("required")).toBeVisible();
    expect(screen.getByText("too_long")).toBeVisible();
  });

  it("disables submit while pending", () => {
    const onSubmit = vi.fn(async () => {});
    renderWithProviders(
      <PostEditorForm
        mode="create"
        pending={true}
        submitLabel="Publish"
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByTestId("post-editor-submit")).toBeDisabled();
  });
});
