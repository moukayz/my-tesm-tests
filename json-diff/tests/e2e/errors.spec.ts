import { test, expect } from '@playwright/test';

// ============================================================
// AC-3: Invalid JSON Error Handling
// AC-4: Empty Input Validation
// ============================================================

test.describe('AC-3: Invalid JSON Error Handling', () => {
  test('should show error near the left panel when left input is invalid JSON', async ({ page }) => {
    await page.goto('/');

    const leftTextarea = page.getByLabel('Left JSON input');
    const rightTextarea = page.getByLabel('Right JSON input');

    await leftTextarea.fill('{foo: bar}');
    await rightTextarea.fill('{"a": 1}');

    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    // Error should be shown for the left panel
    const leftError = page.locator('#panel-left-error');
    await expect(leftError).toBeVisible();
    await expect(leftError).toContainText('Invalid JSON');
    await expect(leftError).toHaveAttribute('role', 'alert');

    // Right panel should NOT have an error
    await expect(page.locator('#panel-right-error')).not.toBeVisible();

    // No diff should be rendered
    await expect(page.getByRole('region', { name: 'Diff output' })).not.toBeVisible();
    await expect(page.getByRole('status')).not.toBeVisible();
  });

  test('should show error near the right panel when right input is invalid JSON', async ({ page }) => {
    await page.goto('/');

    const leftTextarea = page.getByLabel('Left JSON input');
    const rightTextarea = page.getByLabel('Right JSON input');

    await leftTextarea.fill('{"a": 1}');
    await rightTextarea.fill('not json at all');

    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    // Error should be shown for the right panel
    const rightError = page.locator('#panel-right-error');
    await expect(rightError).toBeVisible();
    await expect(rightError).toContainText('Invalid JSON');

    // Left panel should NOT have an error
    await expect(page.locator('#panel-left-error')).not.toBeVisible();

    // No diff should be rendered
    await expect(page.getByRole('region', { name: 'Diff output' })).not.toBeVisible();
  });

  test('should show errors on both panels when both inputs are invalid JSON', async ({ page }) => {
    await page.goto('/');

    const leftTextarea = page.getByLabel('Left JSON input');
    const rightTextarea = page.getByLabel('Right JSON input');

    await leftTextarea.fill('{broken');
    await rightTextarea.fill('[also broken');

    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    const leftError = page.locator('#panel-left-error');
    const rightError = page.locator('#panel-right-error');

    await expect(leftError).toBeVisible();
    await expect(leftError).toContainText('Invalid JSON');

    await expect(rightError).toBeVisible();
    await expect(rightError).toContainText('Invalid JSON');
  });

  test('should mark textarea as aria-invalid when there is an error', async ({ page }) => {
    await page.goto('/');

    const leftTextarea = page.getByLabel('Left JSON input');
    const rightTextarea = page.getByLabel('Right JSON input');

    await leftTextarea.fill('{foo: bar}');
    await rightTextarea.fill('{"a": 1}');

    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    // Left textarea should be marked as invalid
    await expect(leftTextarea).toHaveAttribute('aria-invalid', 'true');

    // Right textarea should NOT be marked as invalid
    // aria-invalid is either not set or not "true"
    const rightInvalid = await rightTextarea.getAttribute('aria-invalid');
    expect(rightInvalid).toBeNull();
  });
});

test.describe('AC-4: Empty Input Validation', () => {
  test('should show validation error when left input is empty', async ({ page }) => {
    await page.goto('/');

    const rightTextarea = page.getByLabel('Right JSON input');
    await rightTextarea.fill('{"a": 1}');

    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    const leftError = page.locator('#panel-left-error');
    await expect(leftError).toBeVisible();
    await expect(leftError).toContainText('empty');

    // Right should not have an error
    await expect(page.locator('#panel-right-error')).not.toBeVisible();

    // No diff rendered
    await expect(page.getByRole('region', { name: 'Diff output' })).not.toBeVisible();
  });

  test('should show validation error when right input is empty', async ({ page }) => {
    await page.goto('/');

    const leftTextarea = page.getByLabel('Left JSON input');
    await leftTextarea.fill('{"a": 1}');

    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    const rightError = page.locator('#panel-right-error');
    await expect(rightError).toBeVisible();
    await expect(rightError).toContainText('empty');

    // Left should not have an error
    await expect(page.locator('#panel-left-error')).not.toBeVisible();
  });

  test('should show validation errors on both panels when both are empty', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    const leftError = page.locator('#panel-left-error');
    const rightError = page.locator('#panel-right-error');

    await expect(leftError).toBeVisible();
    await expect(leftError).toContainText('empty');

    await expect(rightError).toBeVisible();
    await expect(rightError).toContainText('empty');

    // No diff rendered
    await expect(page.getByRole('region', { name: 'Diff output' })).not.toBeVisible();
  });

  test('should show validation error when input is whitespace only', async ({ page }) => {
    await page.goto('/');

    const leftTextarea = page.getByLabel('Left JSON input');
    const rightTextarea = page.getByLabel('Right JSON input');

    await leftTextarea.fill('   ');
    await rightTextarea.fill('  \n  ');

    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    const leftError = page.locator('#panel-left-error');
    const rightError = page.locator('#panel-right-error');

    await expect(leftError).toBeVisible();
    await expect(rightError).toBeVisible();
  });
});
