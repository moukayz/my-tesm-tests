import { expect, test } from "@playwright/test";
import { openApp } from "./utils";

test("app is accessible without login", async ({ page }) => {
  let sessionCalls = 0;
  await page.route("**/api/v1/auth/session", async (route) => {
    sessionCalls += 1;
    await route.abort();
  });

  await openApp(page);

  await expect(page).toHaveURL(/\/app/);
  await expect(page.getByTestId("login-form")).toHaveCount(0);
  await expect(page.getByTestId("register-form")).toHaveCount(0);
  expect(sessionCalls).toBe(0);
});
