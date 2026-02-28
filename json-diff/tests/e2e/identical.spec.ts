import { test, expect } from '@playwright/test';

// ============================================================
// AC-5: Identical JSON After Normalization
// ============================================================

test.describe('AC-5: Identical JSON After Normalization', () => {
  test('should show "No differences found" when both inputs are identical', async ({ page }) => {
    await page.goto('/');

    const leftTextarea = page.getByLabel('Left JSON input');
    const rightTextarea = page.getByLabel('Right JSON input');

    const json = '{"name":"Alice","age":30}';
    await leftTextarea.fill(json);
    await rightTextarea.fill(json);

    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    const noDiffMessage = page.getByRole('status');
    await expect(noDiffMessage).toBeVisible();
    await expect(noDiffMessage).toContainText('No differences found');

    // Diff viewer should NOT be visible
    await expect(page.getByRole('region', { name: 'Diff output' })).not.toBeVisible();
  });

  test('should show "No differences found" when inputs differ only in whitespace/formatting', async ({ page }) => {
    await page.goto('/');

    const leftTextarea = page.getByLabel('Left JSON input');
    const rightTextarea = page.getByLabel('Right JSON input');

    // Compact vs already pretty-printed
    await leftTextarea.fill('{"a":1,"b":2}');
    await rightTextarea.fill('{\n  "a": 1,\n  "b": 2\n}');

    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    const noDiffMessage = page.getByRole('status');
    await expect(noDiffMessage).toBeVisible();
    await expect(noDiffMessage).toContainText('No differences found');
  });

  test('should show "No differences found" for identical arrays', async ({ page }) => {
    await page.goto('/');

    const leftTextarea = page.getByLabel('Left JSON input');
    const rightTextarea = page.getByLabel('Right JSON input');

    await leftTextarea.fill('[1, 2, 3]');
    await rightTextarea.fill('[1,2,3]');

    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    const noDiffMessage = page.getByRole('status');
    await expect(noDiffMessage).toBeVisible();
    await expect(noDiffMessage).toContainText('No differences found');
  });

  test('should show "No differences found" for identical primitives', async ({ page }) => {
    await page.goto('/');

    const leftTextarea = page.getByLabel('Left JSON input');
    const rightTextarea = page.getByLabel('Right JSON input');

    await leftTextarea.fill('"hello world"');
    await rightTextarea.fill('"hello world"');

    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    const noDiffMessage = page.getByRole('status');
    await expect(noDiffMessage).toBeVisible();
    await expect(noDiffMessage).toContainText('No differences found');
  });
});
