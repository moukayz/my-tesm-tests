import { expect, test } from "@playwright/test";
import {
  clearBrowserStorage,
  createChat,
  openApp,
  sendMessageAndWait,
} from "./utils";

test("streaming includes thinking and answer", async ({ page }) => {
  await openApp(page);
  await createChat(page);

  const assistantMessage = await sendMessageAndWait(page, "Stream a response.");
  await expect(assistantMessage).toContainText("mock streaming response");
  await expect(
    assistantMessage.getByTestId("thinking-block")
  ).toContainText("Thinking about your request.");
});

test("edit and resubmit creates a new branch", async ({ page }) => {
  await openApp(page);
  await createChat(page);

  await sendMessageAndWait(page, "First question");

  const assistantMessages = page.locator(
    '[data-testid="message-item"][data-role="assistant"]'
  );
  const assistantCount = await assistantMessages.count();

  const firstUserMessage = page
    .locator('[data-testid="message-item"][data-role="user"]')
    .first();
  await firstUserMessage.getByTestId("edit-message").click();
  await firstUserMessage.getByTestId("edit-message-input").fill("Updated question");
  await firstUserMessage.getByTestId("resubmit-message").click();

  await expect(assistantMessages).toHaveCount(assistantCount + 1);
  await expect(assistantMessages.last()).toHaveAttribute("data-status", "complete", {
    timeout: 20000,
  });

  const branchOptions = page.getByTestId("branch-selector").locator("option");
  await expect(branchOptions).toHaveCount(2);
});

test("model list loads from config", async ({ page }) => {
  await openApp(page);
  await createChat(page);

  const modelSelector = page.getByTestId("model-selector").first();
  const modelOptions = modelSelector.locator("option");
  await expect(modelOptions).toHaveCount(2);
  await expect(modelSelector).toContainText("E2E Alpha");
  await expect(modelSelector).toContainText("E2E Beta");
});

test("friendly error message on streaming failure", async ({ page }) => {
  await openApp(page);
  await createChat(page);

  await page.getByTestId("chat-composer").fill("__E2E_STREAM_ERROR__");
  await page.getByTestId("send-message").click();

  await expect(page.getByTestId("error-notice")).toContainText(
    "The model service is unavailable. Please retry."
  );
});

test("local chat history persists after reload", async ({ page }) => {
  await openApp(page);
  await createChat(page);

  await sendMessageAndWait(page, "Remember this locally.");
  await expect(page.getByTestId("chat-list-item")).toHaveCount(1);

  await page.reload();
  await expect(page.getByTestId("chat-list-item")).toHaveCount(1);
  await expect(
    page.locator('[data-testid="message-item"][data-role="user"]').last()
  ).toContainText("Remember this locally.");
});

test("clearing storage removes local chat history", async ({ page }) => {
  await openApp(page);
  await createChat(page);
  await sendMessageAndWait(page, "Local history to clear.");
  await expect(page.getByTestId("chat-list-item")).toHaveCount(1);

  await clearBrowserStorage(page);
  await page.reload();

  await expect(page.getByTestId("chat-list-item")).toHaveCount(0);
  await expect(page.getByTestId("chat-list")).toContainText(
    "No chats yet"
  );
});
