const { test, expect } = require('@playwright/test');
const {
  loadApp,
  setTool,
  getCanvasRect,
  touchDrag,
  ensureShapeCount,
  ensureSelectionCount,
  getSelectedShapeSnapshot,
  getSelectionClientCenter,
} = require('./utils');

test.describe('Touch interactions', () => {
  test('touch drag draws a rectangle without PointerEvent support', async ({ page }) => {
    await loadApp(page, { disablePointerEvents: true });
    await setTool(page, 'rectangle');

    const rect = await getCanvasRect(page);
    const startX = rect.x + rect.width / 2 - 60;
    const startY = rect.y + rect.height / 2 - 40;
    const endX = startX + 120;
    const endY = startY + 80;
    await touchDrag(page, startX, startY, endX, endY);

    await ensureShapeCount(page, 1);
    await ensureSelectionCount(page, 1);
  });

  test('touch drag moves a selected shape', async ({ page }) => {
    await loadApp(page, { disablePointerEvents: true });
    await setTool(page, 'rectangle');

    const rect = await getCanvasRect(page);
    const startX = rect.x + rect.width / 2 - 50;
    const startY = rect.y + rect.height / 2 - 50;
    const endX = startX + 100;
    const endY = startY + 100;
    await touchDrag(page, startX, startY, endX, endY);

    await ensureSelectionCount(page, 1);
    await setTool(page, 'select');

    const initialSnapshot = await getSelectedShapeSnapshot(page);
    expect(initialSnapshot?.live?.x).toBeDefined();
    expect(initialSnapshot?.live?.y).toBeDefined();

    const center = await getSelectionClientCenter(page);
    if (!center) throw new Error('Selection center unavailable');

    const targetX = center.x + 80;
    const targetY = center.y + 40;
    await touchDrag(page, center.x, center.y, targetX, targetY);

    const movedSnapshot = await getSelectedShapeSnapshot(page);
    expect(movedSnapshot?.live?.x).toBeGreaterThan(initialSnapshot.live.x);
    expect(movedSnapshot?.live?.y).toBeGreaterThan(initialSnapshot.live.y);
  });

  test('stage resizing works with touch input', async ({ page }) => {
    await loadApp(page, { disablePointerEvents: true });

    const beforeSize = await page.evaluate(() => ({
      width: window.animatorState.stage.width,
      height: window.animatorState.stage.height,
    }));

    const handlePoint = await page.evaluate(() => {
      const handle = document.querySelector('[data-stage-resize="corner"]');
      if (!handle) return null;
      const rect = handle.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    });
    if (!handlePoint) throw new Error('Stage resize handle not found');

    await touchDrag(
      page,
      handlePoint.x,
      handlePoint.y,
      handlePoint.x + 160,
      handlePoint.y + 100,
      { selector: '[data-stage-resize="corner"]' },
    );

    const afterSize = await page.evaluate(() => ({
      width: window.animatorState.stage.width,
      height: window.animatorState.stage.height,
    }));

    expect(afterSize.width).toBeGreaterThan(beforeSize.width + 40);
    expect(afterSize.height).toBeGreaterThan(beforeSize.height + 40);
  });
});
