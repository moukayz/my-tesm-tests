import { test, expect } from "@playwright/test";
import { requireEnv } from "./_utils";

const API_ORIGIN = requireEnv("E2E_API_ORIGIN");

test("Login -> logout (UI)", async ({ page, request }) => {
  const ts = Date.now();
  const username = `qa_pw_login_${ts}`;
  const password = "Passw0rd!";

  const reg = await request.post(`${API_ORIGIN}/v1/auth/register`, {
    data: { username, password },
  });
  expect(reg.status(), "register should succeed").toBe(201);

  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);

  const loginRespPromise = page.waitForResponse((resp) => {
    return resp.url().endsWith("/v1/auth/login") && resp.request().method() === "POST";
  });

  await Promise.all([page.waitForURL("**/posts"), page.getByTestId("login-submit").click()]);
  const loginResp = await loginRespPromise;
  expect(loginResp.status(), "login should succeed").toBe(200);

  await expect(page.getByTestId("nav-new-post"), "logged-in nav visible").toBeVisible();
  await expect(page.getByTestId("nav-logout"), "logout visible").toBeVisible();

  const logoutRespPromise = page.waitForResponse((resp) => {
    return resp.url().endsWith("/v1/auth/logout") && resp.request().method() === "POST";
  });

  await Promise.all([page.waitForURL("**/posts"), page.getByTestId("nav-logout").click()]);
  const logoutResp = await logoutRespPromise;
  expect(logoutResp.status(), "logout should succeed").toBe(204);

  await expect(page.getByTestId("nav-new-post"), "logged-out nav hidden").toHaveCount(0);
  await expect(page.getByRole("link", { name: "Login" })).toBeVisible();

  const sessionRes = await page.request.get(`${API_ORIGIN}/v1/auth/session`);
  expect(sessionRes.ok()).toBeTruthy();
  const sessionJson = await sessionRes.json();
  expect(sessionJson?.authenticated, "session should be unauthenticated after logout").toBe(false);
});
