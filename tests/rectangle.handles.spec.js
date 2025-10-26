const { test, expect } = require('@playwright/test');
const {
  loadApp,
  setTool,
  drawRectangle,
  ensureSelectionCount,
  getShapeBounds,
  resizeShapeFromHandle,
  rotateSelectionFromHandle,
} = require('./utils');

test.describe('Rectangle handles', () => {
  test('rectangles remain resizable and rotatable', async ({ page }) => {
    await loadApp(page);
    await setTool(page, 'rectangle');
    await drawRectangle(page, {});
    await setTool(page, 'select');
    await ensureSelectionCount(page, 1);

    const beforeBounds = await getShapeBounds(page);
    expect(beforeBounds.width).toBeGreaterThan(0);
    expect(beforeBounds.height).toBeGreaterThan(0);

    await resizeShapeFromHandle(page, { deltaX: 60, deltaY: 40 });
    const afterResize = await getShapeBounds(page);
    expect(afterResize.width).toBeGreaterThan(beforeBounds.width);
    expect(afterResize.height).toBeGreaterThan(beforeBounds.height);

    const rotationBefore = await page.evaluate(() => window.animatorState.selection?.style?.rotation ?? 0);
    await rotateSelectionFromHandle(page, { sweepDegrees: 75, radius: 120 });
    const rotationAfter = await page.evaluate(() => window.animatorState.selection?.style?.rotation ?? 0);
    expect(Math.abs(rotationAfter - rotationBefore)).toBeGreaterThan(5);
  });
});
