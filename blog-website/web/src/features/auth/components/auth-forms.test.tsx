import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/render";
import { LoginForm, RegisterForm } from "@/features/auth/components/auth-forms";

describe("LoginForm", () => {
  it("shows invalid_credentials error", async () => {
    renderWithProviders(<LoginForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/username/i), "alice");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByTestId("login-submit"));

    expect(await screen.findByText(/invalid username or password/i)).toBeVisible();
  });

  it("maps server fieldErrors on validation_error", async () => {
    server.use(
      http.post("/v1/auth/login", async () => {
        return HttpResponse.json(
          {
            error: {
              code: "validation_error",
              message: "Bad input",
              requestId: "req_val",
              details: {
                fieldErrors: {
                  username: ["too_short"],
                },
              },
            },
          },
          { status: 400 },
        );
      }),
    );

    renderWithProviders(<LoginForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/username/i), "alice");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByTestId("login-submit"));

    expect(await screen.findByText("too_short")).toBeVisible();
  });

  it("shows rate limit message and disables submit", async () => {
    server.use(
      http.post("/v1/auth/login", () => {
        return HttpResponse.json(
          {
            error: {
              code: "rate_limited",
              message: "Too many attempts",
              requestId: "req_rate",
            },
          },
          { status: 429 },
        );
      }),
    );

    renderWithProviders(<LoginForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/username/i), "alice");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByTestId("login-submit"));

    expect(
      await screen.findByText(/too many attempts\. try again shortly\./i),
    ).toBeVisible();
    expect(screen.getByTestId("login-submit")).toBeDisabled();
    expect(screen.getByTestId("login-submit")).toHaveTextContent(/please wait/i);
  });
});

describe("RegisterForm", () => {
  it("shows conflict error when username is taken", async () => {
    server.use(
      http.post("/v1/auth/register", () => {
        return HttpResponse.json(
          {
            error: {
              code: "conflict",
              message: "Username already taken",
              requestId: "req_conflict",
            },
          },
          { status: 409 },
        );
      }),
    );

    renderWithProviders(<RegisterForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/username/i), "alice");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByTestId("register-submit"));

    expect(await screen.findByText(/username already taken\./i)).toBeVisible();
  });
});
