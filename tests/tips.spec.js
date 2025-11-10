const { test, expect } = require('@playwright/test');
const { loadApp } = require('./utils');

test.describe('Tips panel', () => {
  test('tips can be dismissed individually and removal persists', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await loadApp(page);

    // Click the tips button to show the panel
    const tipsToggle = page.locator('#tipsToggle');
    await expect(tipsToggle).toBeVisible();
    await tipsToggle.click();

    const panel = page.locator('#floatingTipsPanel');
    const tipsList = page.locator('#tipsList');
    const tips = tipsList.locator('.tip-item');
    const dismissButtons = tipsList.locator('.tip-dismiss');

    await expect(panel).toBeVisible();
    const initialCount = await tips.count();
    expect(initialCount).toBeGreaterThan(0);

    await dismissButtons.first().click();
    await expect(tips).toHaveCount(initialCount - 1);

    const storedAfterFirst = await page.evaluate(() => window.localStorage.getItem('animator.tips.dismissed.items'));
    expect(storedAfterFirst).not.toBeNull();

    while ((await dismissButtons.count()) > 0) {
      await dismissButtons.first().click();
    }

    // Panel should still be attached but show "all dismissed" message and reset button
    await expect(panel).toBeVisible();
    await expect(tipsList).toContainText('All tips dismissed');
    await expect(page.locator('#tipsReset')).toBeVisible();

    const storedAfterAll = await page.evaluate(() => window.localStorage.getItem('animator.tips.dismissed.items'));
    expect(storedAfterAll).not.toBeNull();
    const parsed = JSON.parse(storedAfterAll ?? '[]');
    expect(parsed.length).toBeGreaterThanOrEqual(initialCount);

    // Test reset functionality
    await page.locator('#tipsReset').click();
    await expect(tips).toHaveCount(initialCount); // Tips should be restored
    await expect(page.locator('#tipsReset')).not.toBeVisible(); // Reset button should be hidden

    // Close the panel
    await page.locator('#tipsClose').click();
    await expect(panel).not.toBeVisible();

    await page.reload();
    await page.waitForFunction(() => window.animatorReady === true && !!window.animatorApi);

    // Tips button should still be visible, panel should be hidden by default
    await expect(page.locator('#tipsToggle')).toBeVisible();
    await expect(page.locator('#floatingTipsPanel')).not.toBeVisible();
  });

  test('tips panel hides when clicking outside', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await loadApp(page);

    const tipsToggle = page.locator('#tipsToggle');
    const panel = page.locator('#floatingTipsPanel');

    // Open tips panel
    await tipsToggle.click();
    await expect(panel).toBeVisible();

    // Click outside the panel (on canvas) - wait a moment for click-outside handler to be attached
    await page.waitForTimeout(150);
    // Click on the right side of the canvas to avoid tips panel overlap
    await page.locator('#stage').click({ position: { x: 700, y: 300 } });
    await expect(panel).not.toBeVisible();

    // Re-open panel to test clicking on toolbar (should also close)
    await tipsToggle.click();
    await expect(panel).toBeVisible();

    // Click on toolbar area (but not on tips toggle button) - wait for handler to be attached
    await page.waitForTimeout(150);
    await page.locator('.toolbar h2').first().click();
    await expect(panel).not.toBeVisible();

    // Clicking on tips toggle button itself should not close panel when opening
    await tipsToggle.click();
    await expect(panel).toBeVisible();
  });
});
