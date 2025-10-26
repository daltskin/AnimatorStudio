const { test, expect } = require('@playwright/test');
const {
  loadApp,
  setTool,
  drawLine,
  ensureSelectionCount,
  dispatchPointerEvent,
  getCanvasRect,
  getSelectedShapeSnapshot,
  getShapeBounds,
  resizeShapeFromHandle,
  rotateSelectionFromHandle,
} = require('./utils');

function normalizeAngleDegrees(angle) {
  let result = angle % 360;
  if (result < 0) {
    result += 360;
  }
  return result;
}

test.describe('Arrow handles', () => {
  test('arrows can be selected, resized, and rotated', async ({ page }) => {
    await loadApp(page);
    await setTool(page, 'arrow');
    await drawLine(page);
    await ensureSelectionCount(page, 1);

    const initialSelection = await getSelectedShapeSnapshot(page);
    expect(initialSelection?.type).toBe('arrow');
    const arrowId = initialSelection.id;

    await setTool(page, 'select');

    const canvasRect = await getCanvasRect(page);
    const emptyX = canvasRect.x + 24;
    const emptyY = canvasRect.y + 24;
    await dispatchPointerEvent(page, 'pointerdown', emptyX, emptyY, {});
    await dispatchPointerEvent(page, 'pointerup', emptyX, emptyY, {});
    await ensureSelectionCount(page, 0);

    const clickPoint = await page.evaluate((shapeId) => {
      const canvas = document.getElementById('stage');
      if (!canvas) throw new Error('Canvas not found');
      const rect = canvas.getBoundingClientRect();
      const shape = window.animatorState.shapes.find((entry) => entry.id === shapeId);
      if (!shape) throw new Error('Arrow shape missing');
      const { start, end } = shape.live || {};
      if (!start || !end) throw new Error('Arrow live endpoints unavailable');
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      return {
        clientX: rect.left + midX,
        clientY: rect.top + midY,
      };
    }, arrowId);

    await dispatchPointerEvent(page, 'pointerdown', clickPoint.clientX, clickPoint.clientY, {});
    await dispatchPointerEvent(page, 'pointerup', clickPoint.clientX, clickPoint.clientY, {});
    await ensureSelectionCount(page, 1);

    const beforeBounds = await getShapeBounds(page, arrowId);
    expect(beforeBounds.width === 0 && beforeBounds.height === 0).toBeFalsy();

    const beforeMetrics = await page.evaluate(() => {
      const selection = window.animatorState.selection;
      if (!selection || !selection.live) return { length: 0, angle: 0 };
      const { start, end } = selection.live;
      if (!start || !end) return { length: 0, angle: 0 };
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
      return { length, angle };
    });
    expect(beforeMetrics.length).toBeGreaterThan(0);

    await resizeShapeFromHandle(page, { shapeId: arrowId, deltaX: 100, deltaY: 80 });

    const afterResizeMetrics = await page.evaluate(() => {
      const selection = window.animatorState.selection;
      if (!selection || !selection.live) return { length: 0, angle: 0 };
      const { start, end } = selection.live;
      if (!start || !end) return { length: 0, angle: 0 };
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
      return { length, angle };
    });
    expect(afterResizeMetrics.length).toBeGreaterThan(beforeMetrics.length + 5);

    await rotateSelectionFromHandle(page, { shapeId: arrowId, sweepDegrees: 90, radius: 140 });

    const afterRotateMetrics = await page.evaluate(() => {
      const selection = window.animatorState.selection;
      if (!selection || !selection.live) return { length: 0, angle: 0, rotationStyle: 0 };
      const { start, end } = selection.live;
      if (!start || !end) return { length: 0, angle: 0, rotationStyle: 0 };
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
      const rotationStyle = selection.style?.rotation ?? 0;
      return { length, angle, rotationStyle };
    });

    const normalizedBeforeAngle = normalizeAngleDegrees(beforeMetrics.angle);
    const normalizedAfterAngle = normalizeAngleDegrees(afterRotateMetrics.angle);
    const rawDelta = Math.abs(normalizedAfterAngle - normalizedBeforeAngle);
    const angleDelta = Math.min(rawDelta, 360 - rawDelta);
    expect(angleDelta).toBeGreaterThan(5);

    const styleAngle = normalizeAngleDegrees(afterRotateMetrics.rotationStyle ?? 0);
    const rotationStyleDelta = Math.min(
      Math.abs(styleAngle - normalizedBeforeAngle),
      360 - Math.abs(styleAngle - normalizedBeforeAngle),
    );
    expect(rotationStyleDelta).toBeGreaterThan(5);
  });
});
