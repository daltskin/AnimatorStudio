const { test, expect } = require('@playwright/test');
const {
  loadApp,
  setTool,
  drawRectangle,
  pointerDrag,
  getCanvasRect,
  getShapeBounds,
  getSelectedShapeSnapshot,
  ensureSelectionCount,
} = require('./utils');

test.describe('Grouped movement', () => {
  test('grouped shapes retain relative layout after dragging', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page, { offsetX: -140, offsetY: -40, width: 140, height: 90 });
    const firstShape = await getSelectedShapeSnapshot(page);
    expect(firstShape).not.toBeNull();
    const firstId = firstShape.id;

    await drawRectangle(page, { offsetX: 120, offsetY: 80, width: 120, height: 80 });
    const secondShape = await getSelectedShapeSnapshot(page);
    expect(secondShape).not.toBeNull();
    const secondId = secondShape.id;

    await setTool(page, 'select');

    const canvasRect = await getCanvasRect(page);
    const firstBounds = await getShapeBounds(page, firstId);
    const secondBounds = await getShapeBounds(page, secondId);
    expect(firstBounds).not.toBeNull();
    expect(secondBounds).not.toBeNull();

    const minX = Math.min(firstBounds.x, secondBounds.x) - 40;
    const minY = Math.min(firstBounds.y, secondBounds.y) - 40;
    const maxX = Math.max(firstBounds.x + firstBounds.width, secondBounds.x + secondBounds.width) + 40;
    const maxY = Math.max(firstBounds.y + firstBounds.height, secondBounds.y + secondBounds.height) + 40;

    const marqueeStartX = canvasRect.x + Math.max(16, minX);
    const marqueeStartY = canvasRect.y + Math.max(16, minY);
    const marqueeEndX = canvasRect.x + Math.min(canvasRect.width - 16, maxX);
    const marqueeEndY = canvasRect.y + Math.min(canvasRect.height - 16, maxY);

    await pointerDrag(page, marqueeStartX, marqueeStartY, marqueeEndX, marqueeEndY);

    await ensureSelectionCount(page, 2);

    await page.click('#groupShapes');
    await ensureSelectionCount(page, 2);

    const initialA = await getShapeBounds(page, firstId);
    const initialB = await getShapeBounds(page, secondId);
    const initialDiff = {
      dx: initialB.x - initialA.x,
      dy: initialB.y - initialA.y,
    };

    const dragStartX = canvasRect.x + initialA.x + initialA.width / 2;
    const dragStartY = canvasRect.y + initialA.y + initialA.height / 2;
    const delta = { x: 180, y: 160 };

    await pointerDrag(
      page,
      dragStartX,
      dragStartY,
      dragStartX + delta.x,
      dragStartY + delta.y,
    );

    await expect.poll(async () => (await getShapeBounds(page, firstId))?.x ?? 0).toBeCloseTo(
      initialA.x + delta.x,
      1,
    );
    await expect.poll(async () => (await getShapeBounds(page, firstId))?.y ?? 0).toBeCloseTo(
      initialA.y + delta.y,
      1,
    );

    const finalA = await getShapeBounds(page, firstId);
    const finalB = await getShapeBounds(page, secondId);

    expect(finalA).not.toBeNull();
    expect(finalB).not.toBeNull();

    const finalDiff = {
      dx: finalB.x - finalA.x,
      dy: finalB.y - finalA.y,
    };

    expect(finalDiff.dx).toBeCloseTo(initialDiff.dx, 0.5);
    expect(finalDiff.dy).toBeCloseTo(initialDiff.dy, 0.5);
  });
});
