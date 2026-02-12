import { test, expect } from "@playwright/test";

test("Register -> create/edit/delete own post (UI)", async ({ page }) => {
  const ts = Date.now();
  const username = `qa_pw_owner_${ts}`;
  const password = "Passw0rd!";
  const title = `E2E owner ${username}`;
  const body = "First body";
  const body2 = "Updated body";

  await page.goto("/register");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);

  const regRespPromise = page.waitForResponse((resp) => {
    return resp.url().endsWith("/v1/auth/register") && resp.request().method() === "POST";
  });

  await Promise.all([
    page.waitForURL("**/posts"),
    page.getByTestId("register-submit").click(),
  ]);

  const regResp = await regRespPromise;
  expect(regResp.status(), "UI register should succeed").toBe(201);

  const hasSessionCookie = (await page.context().cookies()).some((c) => c.name === "bw_session");
  expect(hasSessionCookie, "bw_session cookie set in browser").toBeTruthy();

  const sessionRes = await page.request.get("/v1/auth/session");
  expect(sessionRes.ok(), "session endpoint reachable from browser context").toBeTruthy();
  const sessionJson = await sessionRes.json();
  expect(sessionJson?.authenticated, "session should be authenticated after register").toBe(true);

  await expect(page.getByTestId("nav-new-post"), "logged-in nav visible").toBeVisible();

  await page.getByTestId("nav-new-post").click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Body").fill(body);

  const createRespPromise = page.waitForResponse((resp) => {
    return resp.url().endsWith("/v1/posts") && resp.request().method() === "POST";
  });

  await page.getByTestId("post-editor-submit").click();
  const createResp = await createRespPromise;
  expect(createResp.status(), `POST /v1/posts should succeed; got ${createResp.status()}`).toBe(201);

  await expect(page.getByRole("heading", { name: title }), "created post detail visible").toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: title }), "persists after refresh").toBeVisible();

  await expect(page.getByTestId("post-edit"), "owner can see edit").toBeVisible();
  await page.getByTestId("post-edit").click();

  await page.getByLabel("Body").fill(body2);
  const patchRespPromise = page.waitForResponse((resp) => {
    return resp.url().includes("/v1/posts/") && resp.request().method() === "PATCH";
  });
  await page.getByTestId("post-editor-submit").click();
  const patchResp = await patchRespPromise;
  expect(patchResp.status(), `PATCH should succeed; got ${patchResp.status()}`).toBe(200);

  await expect(page.getByText(body2), "updated body visible").toBeVisible();
  await page.reload();
  await expect(page.getByText(body2), "updated body persists after refresh").toBeVisible();

  const delRespPromise = page.waitForResponse((resp) => {
    return resp.url().includes("/v1/posts/") && resp.request().method() === "DELETE";
  });
  await page.getByTestId("post-delete").click();
  await page.getByTestId("confirm-dialog-confirm").click();
  const delResp = await delRespPromise;
  expect(delResp.status(), `DELETE should succeed; got ${delResp.status()}`).toBe(204);
  await expect(page, "redirected back to list").toHaveURL(/\/posts$/);
  await expect(page.getByRole("heading", { name: title })).toHaveCount(0);
});
