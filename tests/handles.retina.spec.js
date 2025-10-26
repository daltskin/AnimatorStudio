const { test, expect } = require('@playwright/test');
const {
  loadApp,
  setTool,
  drawRectangle,
  resizeShapeFromHandle,
  rotateSelectionFromHandle,
  getShapeBounds,
  dispatchPointerEvent,
} = require('./utils');

test.use({ deviceScaleFactor: 2 });

test('handles work under high deviceScaleFactor', async ({ page }) => {
  await loadApp(page);
  await setTool(page, 'rectangle');
  await drawRectangle(page);

  const initialBounds = await getShapeBounds(page);
  expect(initialBounds.width).toBeGreaterThan(0);

  await resizeShapeFromHandle(page, { deltaX: 120, deltaY: 100 });
  const resizedBounds = await getShapeBounds(page);
  expect(resizedBounds.width).toBeGreaterThan(initialBounds.width);

  const initialRotation = await page.evaluate(() => window.animatorState.selection.style.rotation ?? 0);
  await rotateSelectionFromHandle(page, {});
  const rotationAfter = await page.evaluate(() => window.animatorState.selection.style.rotation ?? 0);
  expect(Math.abs(rotationAfter - initialRotation)).toBeGreaterThan(1);
});

test('pen strokes align with pointer at high viewport resolution', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      get: () => 2,
    });
  });

  await page.setViewportSize({ width: 2496, height: 1664 });
  await loadApp(page);
  await setTool(page, 'free');

  const metrics = await page.evaluate(() => {
    const canvas = document.getElementById('stage');
    if (!canvas) throw new Error('Canvas missing');
    const rect = canvas.getBoundingClientRect();
    return {
      rectLeft: rect.left,
      rectTop: rect.top,
      rectWidth: rect.width,
      rectHeight: rect.height,
      stageWidth: window.animatorState.stage.width,
      stageHeight: window.animatorState.stage.height,
    };
  });

  const startX = metrics.rectLeft + metrics.rectWidth / 2;
  const startY = metrics.rectTop + metrics.rectHeight / 2;
  const endX = startX + 180;
  const endY = startY + 140;

  await dispatchPointerEvent(page, 'pointerdown', startX, startY, { pointerId: 12, pointerType: 'pen' });
  const steps = 8;
  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;
    const x = startX + (endX - startX) * progress;
    const y = startY + (endY - startY) * progress;
    await dispatchPointerEvent(page, 'pointermove', x, y, { pointerId: 12, pointerType: 'pen' });
  }
  await dispatchPointerEvent(page, 'pointerup', endX, endY, { pointerId: 12, pointerType: 'pen' });

  const points = await page.evaluate(() => {
    const freeShape = window.animatorState.shapes.find((shape) => shape.type === 'free');
    if (!freeShape) return null;
    return freeShape.live.points.map((point) => ({ x: point.x, y: point.y }));
  });
  expect(points).not.toBeNull();
  expect(points.length).toBeGreaterThan(1);

  const scaleX = metrics.rectWidth !== 0 ? metrics.stageWidth / metrics.rectWidth : 1;
  const scaleY = metrics.rectHeight !== 0 ? metrics.stageHeight / metrics.rectHeight : 1;

  const expectedStart = {
    x: (startX - metrics.rectLeft) * scaleX,
    y: (startY - metrics.rectTop) * scaleY,
  };
  const expectedEnd = {
    x: (endX - metrics.rectLeft) * scaleX,
    y: (endY - metrics.rectTop) * scaleY,
  };

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  expect(firstPoint.x).toBeCloseTo(expectedStart.x, 1);
  expect(firstPoint.y).toBeCloseTo(expectedStart.y, 1);
  expect(lastPoint.x).toBeCloseTo(expectedEnd.x, 1);
  expect(lastPoint.y).toBeCloseTo(expectedEnd.y, 1);
});
