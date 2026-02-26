import { expect, Page } from "@playwright/test";

export const openApp = async (page: Page) => {
  await page.goto("/app");
  await expect(page.getByTestId("new-chat-button")).toBeVisible();
};

export const createChat = async (page: Page) => {
  const newChatButton = page.getByTestId("new-chat-button");
  await expect(newChatButton).toBeEnabled();
  await newChatButton.click();
  await page.waitForURL(/\/app\/chat\//);
};

export const sendMessageAndWait = async (page: Page, content: string) => {
  await page.getByTestId("chat-composer").fill(content);
  await page.getByTestId("send-message").click();

  const assistantMessage = page
    .locator('[data-testid="message-item"][data-role="assistant"]')
    .last();
  await expect(assistantMessage).toHaveAttribute("data-status", "complete", {
    timeout: 20000,
  });
  return assistantMessage;
};

export const clearBrowserStorage = async (page: Page) => {
  await page.evaluate(async () => {
    localStorage.clear();
    if (typeof indexedDB.databases === "function") {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases
          .map((db) => db.name)
          .filter((name): name is string => Boolean(name))
          .map(
            (name) =>
              new Promise<void>((resolve) => {
                const request = indexedDB.deleteDatabase(name);
                request.onsuccess = () => resolve();
                request.onerror = () => resolve();
                request.onblocked = () => resolve();
              })
          )
      );
    }
  });
};
