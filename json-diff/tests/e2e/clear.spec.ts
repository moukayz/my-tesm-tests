import { test, expect } from '@playwright/test';

// ============================================================
// AC-6: Clear / Reset
// ============================================================

test.describe('AC-6: Clear / Reset', () => {
  test('should clear both inputs and diff output when Clear is clicked after a diff', async ({ page }) => {
    await page.goto('/');

    const leftTextarea = page.getByLabel('Left JSON input');
    const rightTextarea = page.getByLabel('Right JSON input');

    // Enter JSON and compare
    await leftTextarea.fill('{"a":1}');
    await rightTextarea.fill('{"a":2}');

    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    // Verify diff is visible
    const diffRegion = page.getByRole('region', { name: 'Diff output' });
    await expect(diffRegion).toBeVisible();

    // Click Clear
    await page.getByRole('button', { name: 'Clear all inputs and results' }).click();

    // Both textareas should be empty
    await expect(leftTextarea).toHaveValue('');
    await expect(rightTextarea).toHaveValue('');

    // Diff output should be gone
    await expect(page.getByRole('region', { name: 'Diff output' })).not.toBeVisible();
    await expect(page.getByRole('status')).not.toBeVisible();
  });

  test('should clear both inputs and "No differences found" message when Clear is clicked after identical diff', async ({ page }) => {
    await page.goto('/');

    const leftTextarea = page.getByLabel('Left JSON input');
    const rightTextarea = page.getByLabel('Right JSON input');

    await leftTextarea.fill('{"a":1}');
    await rightTextarea.fill('{"a":1}');

    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    // Verify NoDiffMessage is visible
    await expect(page.getByRole('status')).toBeVisible();

    // Click Clear
    await page.getByRole('button', { name: 'Clear all inputs and results' }).click();

    await expect(leftTextarea).toHaveValue('');
    await expect(rightTextarea).toHaveValue('');
    await expect(page.getByRole('status')).not.toBeVisible();
  });

  test('should clear error messages when Clear is clicked after validation error', async ({ page }) => {
    await page.goto('/');

    // Trigger validation errors
    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    // Verify errors are shown
    await expect(page.locator('#panel-left-error')).toBeVisible();
    await expect(page.locator('#panel-right-error')).toBeVisible();

    // Click Clear
    await page.getByRole('button', { name: 'Clear all inputs and results' }).click();

    // Errors should be gone
    await expect(page.locator('#panel-left-error')).not.toBeVisible();
    await expect(page.locator('#panel-right-error')).not.toBeVisible();
  });

  test('Clear button should work even when inputs are already empty (safe no-op)', async ({ page }) => {
    await page.goto('/');

    // Click Clear when nothing has been entered
    await page.getByRole('button', { name: 'Clear all inputs and results' }).click();

    // Inputs should remain empty
    const leftTextarea = page.getByLabel('Left JSON input');
    const rightTextarea = page.getByLabel('Right JSON input');
    await expect(leftTextarea).toHaveValue('');
    await expect(rightTextarea).toHaveValue('');

    // No errors or diff
    await expect(page.locator('#panel-left-error')).not.toBeVisible();
    await expect(page.locator('#panel-right-error')).not.toBeVisible();
    await expect(page.getByRole('region', { name: 'Diff output' })).not.toBeVisible();
  });
});
