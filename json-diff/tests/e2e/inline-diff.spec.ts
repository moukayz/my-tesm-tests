import { test, expect } from '@playwright/test';

// ============================================================
// AC-9:  Inline Diff for Modified Object Key Values
// AC-10: Inline Diff for Changed Array Items
// ============================================================

/**
 * Helper: fill both panels, click Compare, and wait for the diff region.
 */
async function compareJson(
  page: import('@playwright/test').Page,
  leftJson: string,
  rightJson: string,
) {
  await page.goto('/');

  const leftTextarea = page.getByLabel('Left JSON input');
  const rightTextarea = page.getByLabel('Right JSON input');

  await leftTextarea.fill(leftJson);
  await rightTextarea.fill(rightJson);

  await page.getByRole('button', { name: 'Compare JSON inputs' }).click();

  const diffRegion = page.getByRole('region', { name: 'Diff output' });
  await expect(diffRegion).toBeVisible();

  return diffRegion;
}

test.describe('AC-9: Inline Diff for Modified Object Key Values', () => {
  test('should render a single paired (modified) row for changed object value, not separate add+remove rows', async ({
    page,
  }) => {
    const diffRegion = await compareJson(
      page,
      '{"key": "hello"}',
      '{"key": "world"}',
    );

    // There should be modified rows (type=modified → class contains diffRow--modified)
    const modifiedRows = diffRegion.locator('[class*="diffRow--modified"]');
    // The value line `"key": "hello"` → `"key": "world"` should produce at least one modified row
    expect(await modifiedRows.count()).toBeGreaterThan(0);

    // There should be NO separate added or removed rows for this diff
    // (only the opening/closing braces are equal)
    const addedRows = diffRegion.locator('[class*="diffRow--added"]');
    const removedRows = diffRegion.locator('[class*="diffRow--removed"]');
    expect(await addedRows.count()).toBe(0);
    expect(await removedRows.count()).toBe(0);
  });

  test('modified row should show left value and right value side by side', async ({
    page,
  }) => {
    const diffRegion = await compareJson(
      page,
      '{"key": "hello"}',
      '{"key": "world"}',
    );

    const modifiedRows = diffRegion.locator('[class*="diffRow--modified"]');
    // Find the modified row containing the key line
    const keyRow = modifiedRows.filter({ hasText: '"key"' });
    await expect(keyRow).toHaveCount(1);

    // Left column should contain the old value
    const leftCol = keyRow.locator('[class*="col--modifiedLeft"]');
    await expect(leftCol).toContainText('"key": "hello"');

    // Right column should contain the new value
    const rightCol = keyRow.locator('[class*="col--modifiedRight"]');
    await expect(rightCol).toContainText('"key": "world"');
  });

  test('differing characters should be highlighted inline with <mark> elements', async ({
    page,
  }) => {
    const diffRegion = await compareJson(
      page,
      '{"key": "hello"}',
      '{"key": "world"}',
    );

    const modifiedRows = diffRegion.locator('[class*="diffRow--modified"]');
    const keyRow = modifiedRows.filter({ hasText: '"key"' });

    // Left side should have inline highlights (mark elements)
    const leftMarks = keyRow
      .locator('[class*="col--modifiedLeft"]')
      .locator('mark');
    expect(await leftMarks.count()).toBeGreaterThan(0);

    // Right side should have inline highlights (mark elements)
    const rightMarks = keyRow
      .locator('[class*="col--modifiedRight"]')
      .locator('mark');
    expect(await rightMarks.count()).toBeGreaterThan(0);

    // The highlighted (changed) characters on the left come from diffChars("hello","world").
    // diffChars finds shared chars (e.g. "l") so the highlighted portions are the
    // characters unique to the left side (e.g. "he" + "lo" = "helo").
    // We just verify highlights are non-empty and contain only characters from "hello".
    const leftHighlightedTexts = await leftMarks.allTextContents();
    const leftHighlightedJoined = leftHighlightedTexts.join('');
    expect(leftHighlightedJoined.length).toBeGreaterThan(0);
    // Every highlighted char on the left must come from the original value "hello"
    for (const ch of leftHighlightedJoined) {
      expect('hello'.includes(ch)).toBe(true);
    }

    // Similarly for the right side — highlighted chars come from "world"
    const rightHighlightedTexts = await rightMarks.allTextContents();
    const rightHighlightedJoined = rightHighlightedTexts.join('');
    expect(rightHighlightedJoined.length).toBeGreaterThan(0);
    for (const ch of rightHighlightedJoined) {
      expect('world'.includes(ch)).toBe(true);
    }
  });

  test('modified row should use "~" marker instead of "+" or "-"', async ({
    page,
  }) => {
    const diffRegion = await compareJson(
      page,
      '{"key": "hello"}',
      '{"key": "world"}',
    );

    const modifiedRows = diffRegion.locator('[class*="diffRow--modified"]');
    const keyRow = modifiedRows.filter({ hasText: '"key"' });

    // Both markers in a modified row should be "~"
    const markers = keyRow.locator('[class*="marker"]');
    const markerTexts = await markers.allTextContents();
    for (const text of markerTexts) {
      expect(text.trim()).toBe('~');
    }
  });
});

test.describe('AC-10: Inline Diff for Changed Array Items', () => {
  test('should render a single paired (modified) row for changed array item, not separate add+remove rows', async ({
    page,
  }) => {
    const diffRegion = await compareJson(
      page,
      '["apple", "banana"]',
      '["apple", "mango"]',
    );

    // There should be modified rows for the changed array element
    const modifiedRows = diffRegion.locator('[class*="diffRow--modified"]');
    expect(await modifiedRows.count()).toBeGreaterThan(0);

    // There should be NO separate added or removed rows
    const addedRows = diffRegion.locator('[class*="diffRow--added"]');
    const removedRows = diffRegion.locator('[class*="diffRow--removed"]');
    expect(await addedRows.count()).toBe(0);
    expect(await removedRows.count()).toBe(0);
  });

  test('modified row should show "banana" on left and "mango" on right', async ({
    page,
  }) => {
    const diffRegion = await compareJson(
      page,
      '["apple", "banana"]',
      '["apple", "mango"]',
    );

    const modifiedRows = diffRegion.locator('[class*="diffRow--modified"]');
    // The modified row should contain the changed array items
    expect(await modifiedRows.count()).toBeGreaterThanOrEqual(1);

    // Left column of the modified row should show "banana"
    const leftCol = modifiedRows.first().locator('[class*="col--modifiedLeft"]');
    await expect(leftCol).toContainText('"banana"');

    // Right column of the modified row should show "mango"
    const rightCol = modifiedRows.first().locator('[class*="col--modifiedRight"]');
    await expect(rightCol).toContainText('"mango"');
  });

  test('differing characters in array items should be highlighted inline', async ({
    page,
  }) => {
    const diffRegion = await compareJson(
      page,
      '["apple", "banana"]',
      '["apple", "mango"]',
    );

    const modifiedRows = diffRegion.locator('[class*="diffRow--modified"]');
    const changedRow = modifiedRows.first();

    // Left side should have inline highlights
    const leftMarks = changedRow
      .locator('[class*="col--modifiedLeft"]')
      .locator('mark');
    expect(await leftMarks.count()).toBeGreaterThan(0);

    // Right side should have inline highlights
    const rightMarks = changedRow
      .locator('[class*="col--modifiedRight"]')
      .locator('mark');
    expect(await rightMarks.count()).toBeGreaterThan(0);

    // The highlighted portion on the left should contain the differing characters from "banana"
    const leftHighlightedTexts = await leftMarks.allTextContents();
    const leftHighlighted = leftHighlightedTexts.join('');
    // "banana" vs "mango" — the highlighted part should include the differing characters
    expect(leftHighlighted.length).toBeGreaterThan(0);

    // The highlighted portion on the right should contain the differing characters from "mango"
    const rightHighlightedTexts = await rightMarks.allTextContents();
    const rightHighlighted = rightHighlightedTexts.join('');
    expect(rightHighlighted.length).toBeGreaterThan(0);
  });

  test('modified row for changed array item should use "~" marker', async ({
    page,
  }) => {
    const diffRegion = await compareJson(
      page,
      '["apple", "banana"]',
      '["apple", "mango"]',
    );

    const modifiedRows = diffRegion.locator('[class*="diffRow--modified"]');
    const changedRow = modifiedRows.first();

    // Both markers should be "~"
    const markers = changedRow.locator('[class*="marker"]');
    const markerTexts = await markers.allTextContents();
    for (const text of markerTexts) {
      expect(text.trim()).toBe('~');
    }
  });
});
