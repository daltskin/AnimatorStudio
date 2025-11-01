const { test, expect } = require('@playwright/test');
const { loadApp } = require('./utils');

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test.describe('SysML v2 Simple Definitions', () => {
  test('pasting SysML v2 part def without body creates an image shape', async ({ page }) => {
    await loadApp(page);

    const initialCount = await page.evaluate(() => window.animatorState.shapes.length);

    const sysmlCode = `package 'EACS System Definition'
{
    // ====================================
    // Definition of Systems
    // ====================================
    part def EACS;
    part def External_Environment;
    part def External_System;
}`;

    await page.evaluate((code) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', code);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(pasteEvent);
    }, sysmlCode);

    await page.waitForTimeout(3000);

    const finalCount = await page.evaluate(() => window.animatorState.shapes.length);
    expect(finalCount).toBe(initialCount + 1);

    const newShape = await page.evaluate(() => {
      const shapes = window.animatorState.shapes;
      return shapes[shapes.length - 1];
    });

    expect(newShape.type).toBe('image');
    expect(newShape.asset.source).toMatch(/^data:image/);
  });
});
