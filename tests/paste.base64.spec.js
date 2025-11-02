const { test, expect } = require('@playwright/test');
const { loadApp } = require('./utils');

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test.describe('Base64 Paste Protection', () => {
  test('pasting base64 data does not trigger Mermaid or SysML rendering', async ({ page }) => {
    await loadApp(page);

    const initialCount = await page.evaluate(() => window.animatorState.shapes.length);

    // Simulate a large base64 string (typical of image data)
    const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='.repeat(100);

    await page.evaluate((data) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', data);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(pasteEvent);
    }, base64Data);

    await page.waitForTimeout(1000);

    const finalCount = await page.evaluate(() => window.animatorState.shapes.length);
    expect(finalCount).toBe(initialCount);
  });

  test('pasting data URL does not trigger Mermaid or SysML rendering', async ({ page }) => {
    await loadApp(page);

    const initialCount = await page.evaluate(() => window.animatorState.shapes.length);

    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    await page.evaluate((data) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', data);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(pasteEvent);
    }, dataUrl);

    await page.waitForTimeout(1000);

    const finalCount = await page.evaluate(() => window.animatorState.shapes.length);
    // Data URLs should be handled by the image paste handler, creating one shape
    expect(finalCount).toBe(initialCount + 1);
  });

  test('pasting excessively long text does not trigger Mermaid or SysML rendering', async ({ page }) => {
    await loadApp(page);

    const initialCount = await page.evaluate(() => window.animatorState.shapes.length);

    // Create a very long string that might accidentally contain keywords
    const longText = 'package test part def requirement '.repeat(2000); // ~70KB

    await page.evaluate((data) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', data);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(pasteEvent);
    }, longText);

    await page.waitForTimeout(1000);

    const finalCount = await page.evaluate(() => window.animatorState.shapes.length);
    expect(finalCount).toBe(initialCount);
  });
});
