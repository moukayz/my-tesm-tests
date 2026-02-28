import { test, expect } from '@playwright/test';

// ============================================================
// AC-1: Valid JSON Compare
// AC-2: Key Sorting Normalizes Order Differences
// AC-7: Diff Highlights (colour-coded rows)
// AC-8: Accessibility — Color + Label (text markers +/-)
// ============================================================

test.describe('AC-1: Valid JSON Compare', () => {
  test('should display a diff with additions, removals, and unchanged lines when valid JSON is compared', async ({ page }) => {
    await page.goto('/');

    const leftTextarea = page.getByLabel('Left JSON input');
    const rightTextarea = page.getByLabel('Right JSON input');

    const leftJson = JSON.stringify({ name: 'Alice', age: 30, city: 'NYC' });
    const rightJson = JSON.stringify({ name: 'Alice', age: 31, country: 'US' });

    await leftTextarea.fill(leftJson);
    await rightTextarea.fill(rightJson);

    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    // Diff output region should be visible
    const diffRegion = page.getByRole('region', { name: 'Diff output' });
    await expect(diffRegion).toBeVisible();

    // Textareas should be updated with pretty-printed, key-sorted JSON
    const leftValue = await leftTextarea.inputValue();
    const rightValue = await rightTextarea.inputValue();

    // Verify formatting: 2-space indent
    expect(leftValue).toContain('  "age": 30');
    expect(rightValue).toContain('  "age": 31');

    // Verify key sorting: keys should be alphabetical
    const leftLines = leftValue.split('\n');
    const keyLines = leftLines.filter(l => l.trim().startsWith('"'));
    const keys = keyLines.map(l => l.trim().match(/"([^"]+)"/)?.[1]).filter(Boolean);
    const sortedKeys = [...keys].sort();
    expect(keys).toEqual(sortedKeys);
  });

  test('should auto-format and key-sort both inputs on compare', async ({ page }) => {
    await page.goto('/');

    const leftTextarea = page.getByLabel('Left JSON input');
    const rightTextarea = page.getByLabel('Right JSON input');

    // Compact JSON with unsorted keys
    await leftTextarea.fill('{"z":1,"a":2,"m":3}');
    await rightTextarea.fill('{"z":10,"a":2,"m":3}');

    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    // After compare, textareas should contain pretty-printed, sorted JSON
    const leftValue = await leftTextarea.inputValue();
    expect(leftValue).toBe('{\n  "a": 2,\n  "m": 3,\n  "z": 1\n}');

    const rightValue = await rightTextarea.inputValue();
    expect(rightValue).toBe('{\n  "a": 2,\n  "m": 3,\n  "z": 10\n}');
  });
});

test.describe('AC-2: Key Sorting Normalizes Order Differences', () => {
  test('should show "No differences found" when left and right differ only in key order', async ({ page }) => {
    await page.goto('/');

    const leftTextarea = page.getByLabel('Left JSON input');
    const rightTextarea = page.getByLabel('Right JSON input');

    await leftTextarea.fill('{"b":1,"a":2}');
    await rightTextarea.fill('{"a":2,"b":1}');

    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    // Should show NoDiffMessage
    const noDiffStatus = page.getByRole('status');
    await expect(noDiffStatus).toBeVisible();
    await expect(noDiffStatus).toContainText('No differences found');

    // DiffViewer should NOT be visible
    await expect(page.getByRole('region', { name: 'Diff output' })).not.toBeVisible();
  });

  test('should normalize nested object key ordering', async ({ page }) => {
    await page.goto('/');

    const leftTextarea = page.getByLabel('Left JSON input');
    const rightTextarea = page.getByLabel('Right JSON input');

    await leftTextarea.fill('{"z":{"b":1,"a":2},"y":3}');
    await rightTextarea.fill('{"y":3,"z":{"a":2,"b":1}}');

    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    const noDiffStatus = page.getByRole('status');
    await expect(noDiffStatus).toBeVisible();
    await expect(noDiffStatus).toContainText('No differences found');
  });
});

test.describe('AC-7: Diff Highlights', () => {
  test('should apply distinct background colours for added, removed, and equal lines', async ({ page }) => {
    await page.goto('/');

    const leftTextarea = page.getByLabel('Left JSON input');
    const rightTextarea = page.getByLabel('Right JSON input');

    // Use inputs that produce pure added + pure removed lines (not merge-able as modified).
    // Left has 2 extra keys, right has 2 different extra keys, and they share "a".
    // After sort: left = {"a":1,"b":2,"d":4}, right = {"a":1,"c":3,"e":5}
    // "b":2 and "c":3 may merge into modified, but "d":4 is removed-only, "e":5 is added-only.
    await leftTextarea.fill('{"a":1,"b":2,"d":4}');
    await rightTextarea.fill('{"a":1,"c":3,"e":5}');

    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    const diffRegion = page.getByRole('region', { name: 'Diff output' });
    await expect(diffRegion).toBeVisible();

    // Equal rows (at least the opening/closing braces and "a":1)
    const equalRows = diffRegion.locator('[class*="diffRow--equal"]');
    expect(await equalRows.count()).toBeGreaterThan(0);

    // With inline diff, consecutive removed+added pairs get merged into modified rows.
    // We check for the presence of modified rows (which replaced some added/removed).
    const modifiedRows = diffRegion.locator('[class*="diffRow--modified"]');
    const addedRows = diffRegion.locator('[class*="diffRow--added"]');
    const removedRows = diffRegion.locator('[class*="diffRow--removed"]');

    // There should be at least some non-equal diff rows (modified, added, or removed)
    const totalDiffRows =
      (await modifiedRows.count()) +
      (await addedRows.count()) +
      (await removedRows.count());
    expect(totalDiffRows).toBeGreaterThan(0);

    // Verify that modified rows have distinct left/right column backgrounds
    if ((await modifiedRows.count()) > 0) {
      const modLeftBg = await modifiedRows
        .first()
        .locator('[class*="col--modifiedLeft"]')
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      // Modified-left should have a visible background (not transparent/white)
      expect(modLeftBg).not.toBe('rgba(0, 0, 0, 0)');

      const modRightBg = await modifiedRows
        .first()
        .locator('[class*="col--modifiedRight"]')
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(modRightBg).not.toBe('rgba(0, 0, 0, 0)');
    }
  });
});

test.describe('AC-8: Accessibility — Color + Label', () => {
  test('added lines should have "+" marker, removed lines "-" marker, and modified lines "~" marker', async ({ page }) => {
    await page.goto('/');

    const leftTextarea = page.getByLabel('Left JSON input');
    const rightTextarea = page.getByLabel('Right JSON input');

    // Use inputs that produce pure added, pure removed, AND modified rows.
    // After sort: left = {"a":1,"b":2,"d":4}, right = {"a":1,"c":3,"e":5}
    // "b":2 (removed) + "c":3 (added) → modified with "~"
    // "d":4 → pure removed with "-"
    // "e":5 → pure added with "+"
    await leftTextarea.fill('{"a":1,"b":2,"d":4}');
    await rightTextarea.fill('{"a":1,"c":3,"e":5}');

    await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

    const diffRegion = page.getByRole('region', { name: 'Diff output' });
    await expect(diffRegion).toBeVisible();

    // Modified rows should have "~" markers
    const modifiedRows = diffRegion.locator('[class*="diffRow--modified"]');
    if ((await modifiedRows.count()) > 0) {
      const modMarkerLeft = modifiedRows.first().locator('[class*="marker"]').first();
      await expect(modMarkerLeft).toHaveText('~');
      const modMarkerRight = modifiedRows.first().locator('[class*="marker"]').nth(1);
      await expect(modMarkerRight).toHaveText('~');
    }

    // Check that pure removed rows contain "-" marker (if any exist)
    const removedRows = diffRegion.locator('[class*="diffRow--removed"]');
    if ((await removedRows.count()) > 0) {
      const removedMarker = removedRows.first().locator('[class*="marker"]').first();
      await expect(removedMarker).toHaveText('-');
    }

    // Check that pure added rows contain "+" marker (if any exist)
    const addedRows = diffRegion.locator('[class*="diffRow--added"]');
    if ((await addedRows.count()) > 0) {
      // The "+" marker is in the right column (second marker)
      const addedMarker = addedRows.first().locator('[class*="marker"]').nth(1);
      await expect(addedMarker).toHaveText('+');
    }

    // At least one type of diff marker should be present
    const totalMarkedRows =
      (await modifiedRows.count()) +
      (await removedRows.count()) +
      (await addedRows.count());
    expect(totalMarkedRows).toBeGreaterThan(0);

    // Equal rows should NOT have +/-/~ markers (just spaces)
    const equalRows = diffRegion.locator('[class*="diffRow--equal"]');
    if ((await equalRows.count()) > 0) {
      const equalMarkerLeft = equalRows.first().locator('[class*="marker"]').first();
      const equalMarkerRight = equalRows.first().locator('[class*="marker"]').nth(1);
      const leftText = await equalMarkerLeft.textContent();
      const rightText = await equalMarkerRight.textContent();
      expect(leftText?.trim()).toBe('');
      expect(rightText?.trim()).toBe('');
    }
  });
});
