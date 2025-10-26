const { test, expect } = require('@playwright/test');
const {
  loadApp,
  setTool,
  createTextShape,
  resizeShapeFromHandle,
  rotateSelectionFromHandle,
  getShapeBounds,
  ensureSelectionCount,
  getRotationHandleInfo,
  getCanvasRect,
  dispatchPointerEvent,
} = require('./utils');

test('text shapes can resize and rotate via handles', async ({ page }) => {
  await loadApp(page);
  await setTool(page, 'text');
  await createTextShape(page, 'Hello world');
  await setTool(page, 'select');

  const initial = await page.evaluate(() => ({
    bounds: window.animatorApi.getShapeBounds(),
    rotation: window.animatorState.selection?.style?.rotation ?? 0,
  }));
  expect(initial.bounds.width).toBeGreaterThan(0);
  expect(initial.bounds.height).toBeGreaterThan(0);

  await resizeShapeFromHandle(page, { deltaX: 80, deltaY: 60 });
  const resized = await getShapeBounds(page);
  expect(resized.width).toBeGreaterThan(initial.bounds.width);
  expect(resized.height).toBeGreaterThan(initial.bounds.height);

  await rotateSelectionFromHandle(page, {});
  const finalRotation = await page.evaluate(() => window.animatorState.selection?.style?.rotation ?? 0);
  expect(Math.abs(finalRotation - initial.rotation)).toBeGreaterThan(5);
});

test('text shapes stay selectable and rotatable after inline edits', async ({ page }) => {
  await loadApp(page);
  await setTool(page, 'text');
  const shape = await createTextShape(page, 'First phrase');
  await setTool(page, 'select');

  const { center: initialCenter } = await getRotationHandleInfo(page, shape.id);
  await page.evaluate(({ x, y }) => {
    const canvas = document.getElementById('stage');
    if (!canvas) throw new Error('Canvas missing');
    const event = new MouseEvent('dblclick', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    });
    canvas.dispatchEvent(event);
  }, { x: initialCenter.x, y: initialCenter.y });

  const editor = page.locator('.canvas-text-editor');
  await editor.waitFor();
  await editor.fill('Edited headline');
  await editor.press('Enter');
  await expect(editor).toHaveCount(0);

  const selectedIds = await page.evaluate(() => Array.from(window.animatorState?.selectedIds ?? []));
  expect(selectedIds).toEqual([shape.id]);

  const { center } = await getRotationHandleInfo(page, shape.id);

  const rotationBefore = await page.evaluate(() => window.animatorState.selection?.style?.rotation ?? 0);
  await rotateSelectionFromHandle(page, { shapeId: shape.id, sweepDegrees: 60, radius: 90 });
  const rotationAfter = await page.evaluate(() => window.animatorState.selection?.style?.rotation ?? 0);
  expect(Math.abs(rotationAfter - rotationBefore)).toBeGreaterThan(5);

  const canvasRect = await getCanvasRect(page);
  const outsideX = canvasRect.x + 5;
  const outsideY = canvasRect.y + 5;
  await dispatchPointerEvent(page, 'pointerdown', outsideX, outsideY, {});
  await dispatchPointerEvent(page, 'pointerup', outsideX, outsideY, {});
  await ensureSelectionCount(page, 0);

  await dispatchPointerEvent(page, 'pointerdown', center.x, center.y, {});
  await dispatchPointerEvent(page, 'pointerup', center.x, center.y, {});
  await ensureSelectionCount(page, 1);
});
