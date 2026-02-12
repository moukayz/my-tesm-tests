import { test, expect } from "@playwright/test";
import { pickCsrfToken, requireEnv } from "./_utils";

const API_ORIGIN = requireEnv("E2E_API_ORIGIN");

test("Forbidden on others (UI + direct request)", async ({ page, request }) => {
  const ts = Date.now();

  // Create user A + post via API.
  const userA = `qa_pw_a_${ts}`;
  const passA = "Passw0rd!";
  const regA = await request.post(`${API_ORIGIN}/v1/auth/register`, {
    data: { username: userA, password: passA },
  });
  expect(regA.status()).toBe(201);

  const sessA = await request.get(`${API_ORIGIN}/v1/auth/session`);
  const csrfA = pickCsrfToken(await sessA.json());

  const title = `E2E forbidden ${userA}`;
  const create = await request.post(`${API_ORIGIN}/v1/posts`, {
    data: { title, body: "owner body" },
    headers: { "X-CSRF-Token": csrfA },
  });
  expect(create.status()).toBe(201);
  const postId = (await create.json())?.post?.id as string;
  expect(postId).toBeTruthy();

  // Register user B in the browser (separate from API request context).
  const userB = `qa_pw_b_${ts}`;
  const passB = "Passw0rd!";

  await page.goto("/register");
  await page.getByLabel("Username").fill(userB);
  await page.getByLabel("Password").fill(passB);
  const regBRespPromise = page.waitForResponse((resp) => {
    return resp.url().endsWith("/v1/auth/register") && resp.request().method() === "POST";
  });

  await Promise.all([page.waitForURL("**/posts"), page.getByTestId("register-submit").click()]);
  const regBResp = await regBRespPromise;
  expect(regBResp.status(), "UI register should succeed").toBe(201);

  const hasSessionCookie = (await page.context().cookies()).some((c) => c.name === "bw_session");
  expect(hasSessionCookie, "bw_session cookie set in browser").toBeTruthy();

  const detailRespPromise = page.waitForResponse((resp) => {
    if (resp.request().method() !== "GET") return false;
    try {
      const u = new URL(resp.url());
      return /^\/v1\/posts\/.+/.test(u.pathname);
    } catch {
      return false;
    }
  });

  await page.goto(`/posts/${postId}`);
  const detailResp = await detailRespPromise;
  expect(detailResp.url(), "detail request hits expected id").toContain(`/v1/posts/${postId}`);
  if (detailResp.status() !== 200) {
    throw new Error(
      `GET ${detailResp.url()} returned ${detailResp.status()}: ${await detailResp.text()}`,
    );
  }
  await expect(page.getByRole("heading", { name: title }), "post detail visible").toBeVisible();

  await expect(page.getByTestId("post-edit"), "non-owner should not see edit").toHaveCount(0);
  await expect(page.getByTestId("post-delete"), "non-owner should not see delete").toHaveCount(0);

  // Direct request from the browser context: should be rejected with 403.
  const sessB = await page.request.get(`${API_ORIGIN}/v1/auth/session`);
  expect(sessB.ok()).toBeTruthy();
  const csrfB = pickCsrfToken(await sessB.json());

  const patchB = await page.request.patch(`${API_ORIGIN}/v1/posts/${postId}`, {
    data: { body: "hacked" },
    headers: { "X-CSRF-Token": csrfB },
  });
  expect(patchB.status(), "non-owner PATCH rejected").toBe(403);

  const delB = await page.request.delete(`${API_ORIGIN}/v1/posts/${postId}`, {
    headers: { "X-CSRF-Token": csrfB },
  });
  expect(delB.status(), "non-owner DELETE rejected").toBe(403);
});
