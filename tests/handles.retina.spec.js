const { test, expect } = require('@playwright/test');
const {
  loadApp,
  setTool,
  drawRectangle,
  resizeShapeFromHandle,
  rotateSelectionFromHandle,
  getShapeBounds,
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
