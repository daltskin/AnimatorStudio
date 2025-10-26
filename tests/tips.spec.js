const { test, expect } = require('@playwright/test');
const { loadApp } = require('./utils');

test.describe('Tips panel', () => {
  test('tips can be dismissed individually and removal persists', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await loadApp(page);

    const panel = page.locator('[data-tips]');
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

    await expect(panel).not.toBeAttached();

    const storedAfterAll = await page.evaluate(() => window.localStorage.getItem('animator.tips.dismissed.items'));
    expect(storedAfterAll).not.toBeNull();
    const parsed = JSON.parse(storedAfterAll ?? '[]');
    expect(parsed.length).toBeGreaterThanOrEqual(initialCount);

    await page.reload();
    await page.waitForFunction(() => window.animatorReady === true && !!window.animatorApi);

    await expect(page.locator('[data-tips]')).toHaveCount(0);
  });
});
