const { test, expect } = require('@playwright/test');
const {
  loadApp,
  setTool,
  drawRectangle,
  ensureSelectionCount,
  setTimelineTime,
  getShapeBounds,
  getCanvasRect,
  pointerDrag,
} = require('./utils');

test.describe('Scene export', () => {
  test('export payload includes keyframes and import restores timeline', async ({ page }) => {
    await loadApp(page);
    await setTool(page, 'rectangle');
    await drawRectangle(page, {});
    await setTool(page, 'select');
    await ensureSelectionCount(page, 1);

    await setTimelineTime(page, 2);
    const bounds = await getShapeBounds(page);
    const canvasRect = await getCanvasRect(page);
    const startX = canvasRect.x + bounds.x + bounds.width / 2;
    const startY = canvasRect.y + bounds.y + bounds.height / 2;
    await pointerDrag(page, startX, startY, startX + 140, startY + 60);

    await expect.poll(() =>
      page.evaluate(() => {
        const shape = window.animatorState.selection;
        if (!shape) return 0;
        return Array.isArray(shape.keyframes) ? shape.keyframes.length : 0;
      }),
    ).toBeGreaterThan(1);

      const initialStageSize = await page.evaluate(() => ({
        width: Math.round(window.animatorState.stage.width),
        height: Math.round(window.animatorState.stage.height),
      }));

    const payload = await page.evaluate(() => window.animatorApi.exportScenePayload());
    expect(Array.isArray(payload?.shapes)).toBeTruthy();
    expect(payload.shapes).toHaveLength(1);
    const [exportedShape] = payload.shapes;
    expect(Array.isArray(exportedShape.keyframes)).toBeTruthy();
    expect(exportedShape.keyframes.length).toBeGreaterThan(1);
    const times = exportedShape.keyframes.map((entry) => entry.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
      expect(payload.stage).toBeDefined();
      expect(payload.stage.width).toBe(initialStageSize.width);
      expect(payload.stage.height).toBe(initialStageSize.height);

    await page.evaluate(() => window.animatorApi.clearCanvas());
    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(0);

    await page.evaluate((data) => {
      window.animatorApi.importSceneFromData(data);
    }, payload);

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(1);
    await expect.poll(() =>
      page.evaluate(() => (window.animatorState.selection?.keyframes?.length ?? 0)),
    ).toBeGreaterThan(1);
    await expect.poll(() =>
      page.evaluate(() => document.querySelectorAll('.timeline-key').length),
    ).toBeGreaterThan(1);
      const importedStageSize = await page.evaluate(() => ({
        width: Math.round(window.animatorState.stage.width),
        height: Math.round(window.animatorState.stage.height),
      }));
      expect(importedStageSize.width).toBeGreaterThan(0);
      expect(importedStageSize.height).toBeGreaterThan(0);
      expect(importedStageSize.width).toBeLessThanOrEqual(initialStageSize.width);
      expect(importedStageSize.height).toBeLessThanOrEqual(initialStageSize.height);
      expect(initialStageSize.width - importedStageSize.width).toBeLessThanOrEqual(64);
      expect(initialStageSize.height - importedStageSize.height).toBeLessThanOrEqual(64);
  });
});
