const { test, expect } = require('@playwright/test');
const {
  loadApp,
  setTool,
  drawRectangle,
  ensureShapeCount,
  ensureSelectionCount,
  getCanvasRect,
  getShapeBounds,
} = require('./utils');

test.describe('context menu z-order', () => {
  test('context menu actions reorder selected shapes', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
  await drawRectangle(page, { offsetX: -220, offsetY: -160 });
  await ensureShapeCount(page, 1);

  await drawRectangle(page, { offsetX: 180, offsetY: -40 });
  await ensureShapeCount(page, 2);

  await drawRectangle(page, { offsetX: -160, offsetY: 180 });
  await ensureShapeCount(page, 3);

    const shapeIds = await page.evaluate(() => window.animatorState.shapes.map((shape) => shape.id));
    expect(shapeIds).toHaveLength(3);
    const [firstId, secondId, thirdId] = shapeIds;

    await setTool(page, 'select');

    const selectBounds = await getShapeBounds(page, secondId);
    if (!selectBounds) throw new Error('Unable to resolve bounds for selection target');
    const canvasRect = await getCanvasRect(page);
    const selectX = canvasRect.x + selectBounds.x + selectBounds.width / 2;
    const selectY = canvasRect.y + selectBounds.y + selectBounds.height / 2;

    await page.mouse.click(selectX, selectY);
    await ensureSelectionCount(page, 1);
    await expect.poll(() => page.evaluate(() => window.animatorState.selection?.id ?? null)).toBe(secondId);

    const readShapeOrder = async () =>
      page.evaluate(() => window.animatorState.shapes.map((shape) => shape.id));

    const openContextMenuForSelection = async (action) => {
      const selectionId = await page.evaluate(() => window.animatorState.selection?.id ?? null);
      if (!selectionId) throw new Error('No active selection for context menu action');
      const bounds = await getShapeBounds(page, selectionId);
      if (!bounds) throw new Error('Missing bounds for selected shape');
      const rect = await getCanvasRect(page);
      const centerX = rect.x + bounds.x + bounds.width / 2;
      const centerY = rect.y + bounds.y + bounds.height / 2;

      await page.mouse.click(centerX, centerY, { button: 'right' });
      const menu = page.locator('#shapeContextMenu');
      await expect(menu).toBeVisible();
      await menu.locator(`button[data-z-action="${action}"]`).click();
      await expect(menu).toBeHidden();
    };

    await expect.poll(readShapeOrder).toEqual([firstId, secondId, thirdId]);

    await openContextMenuForSelection('bring-to-front');
    await expect.poll(readShapeOrder).toEqual([firstId, thirdId, secondId]);
    await expect.poll(() => page.evaluate(() => window.animatorState.selection?.id ?? null)).toBe(secondId);

    await openContextMenuForSelection('send-backward');
    await expect.poll(readShapeOrder).toEqual([firstId, secondId, thirdId]);

    await openContextMenuForSelection('send-to-back');
    await expect.poll(readShapeOrder).toEqual([secondId, firstId, thirdId]);

    await openContextMenuForSelection('bring-forward');
    await expect.poll(readShapeOrder).toEqual([firstId, secondId, thirdId]);
  });
});
