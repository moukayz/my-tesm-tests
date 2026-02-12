import { test, expect } from "@playwright/test";
import { pickCsrfToken, requireEnv } from "./_utils";

const API_ORIGIN = requireEnv("E2E_API_ORIGIN");

test("Public browse/read (after API-created post)", async ({ page, request }) => {
  const ts = Date.now();
  const username = `qa_pw_public_${ts}`;
  const password = "Passw0rd!";

  const reg = await request.post(`${API_ORIGIN}/v1/auth/register`, {
    data: { username, password },
  });
  expect(reg.status(), "register should succeed").toBe(201);

  const sess = await request.get(`${API_ORIGIN}/v1/auth/session`);
  expect(sess.ok(), "session should succeed").toBeTruthy();
  const sessJson = await sess.json();
  const csrf = pickCsrfToken(sessJson);

  const title = `E2E public browse ${username}`;
  const body = "Hello from Playwright";
  const create = await request.post(`${API_ORIGIN}/v1/posts`, {
    data: { title, body },
    headers: { "X-CSRF-Token": csrf },
  });
  expect(create.status(), "create post should succeed").toBe(201);
  const created = await create.json();
  const postId = created?.post?.id;
  expect(postId, "create response contains post.id").toBeTruthy();

  await page.goto("/posts");
  await expect(
    page.getByTestId("post-card").filter({ hasText: title }),
    "post should be visible in list",
  ).toBeVisible();

  const detailRespPromise = page.waitForResponse((resp) => {
    if (resp.request().method() !== "GET") return false;
    try {
      const u = new URL(resp.url());
      return /^\/v1\/posts\/.+/.test(u.pathname);
    } catch {
      return false;
    }
  });

  await page.getByTestId("post-card").filter({ hasText: title }).first().click();
  await expect(page, "navigates to post detail").toHaveURL(new RegExp(`/posts/${postId}$`));

  const detailResp = await detailRespPromise;
  expect(detailResp.url(), "detail request hits expected id").toContain(`/v1/posts/${postId}`);
  if (detailResp.status() !== 200) {
    throw new Error(
      `GET ${detailResp.url()} returned ${detailResp.status()}: ${await detailResp.text()}`,
    );
  }

  await expect(page.getByRole("heading", { name: title }), "detail shows title").toBeVisible();
  await expect(page.getByText(body), "detail shows body").toBeVisible();
});
