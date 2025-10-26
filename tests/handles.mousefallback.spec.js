const { test, expect } = require('@playwright/test');
const {
  loadApp,
  setTool,
  mouseDrag,
  dispatchMouseEvent,
  getShapeBounds,
  getCanvasRect,
} = require('./utils');

async function prepareMouseCounters(page) {
  await page.evaluate(() => {
    const canvas = document.getElementById('stage');
    window.__mouseCounters = { down: 0, move: 0, up: 0 };
    if (!canvas) return;
    canvas.addEventListener('mousedown', () => {
      window.__mouseCounters.down += 1;
    });
    canvas.addEventListener('mousemove', () => {
      window.__mouseCounters.move += 1;
    });
    canvas.addEventListener('mouseup', () => {
      window.__mouseCounters.up += 1;
    });
  });
}

async function getPointerSnapshot(page) {
  return page.evaluate(() => ({
    down: window.animatorState.pointer.down,
    mode: window.animatorState.pointer.mode,
    tool: window.animatorState.tool,
    shapes: window.animatorState.shapes.length,
    counters: window.__mouseCounters,
  }));
}

async function resizeFromHandleWithMouse(page, deltaX, deltaY) {
  const handle = await page.evaluate(() => window.animatorApi.getResizeHandleClientPoint());
  if (!handle) throw new Error('Resize handle unavailable');
  await dispatchMouseEvent(page, 'mousedown', handle.x, handle.y, { buttons: 1 });
  const steps = 6;
  for (let i = 1; i <= steps; i += 1) {
    const progress = i / steps;
    await dispatchMouseEvent(page, 'mousemove', handle.x + deltaX * progress, handle.y + deltaY * progress, { buttons: 1 });
  }
  await dispatchMouseEvent(page, 'mouseup', handle.x + deltaX, handle.y + deltaY, { buttons: 0 });
}

async function rotateFromHandleWithMouse(page) {
  const info = await page.evaluate(() => {
    const rotation = window.animatorApi.getRotationHandleClientPoint();
    const bounds = window.animatorApi.getShapeBounds();
    if (!rotation || !bounds) return null;
    return { rotation, bounds };
  });
  if (!info) throw new Error('Rotation handle unavailable');
  const {
    rotation: { x, y },
    bounds,
  } = info;
  const targetX = x - 140;
  const targetY = y + bounds.height + 80;
  await dispatchMouseEvent(page, 'mousedown', x, y, { buttons: 1 });
  const steps = 8;
  for (let i = 1; i <= steps; i += 1) {
    const progress = i / steps;
    await dispatchMouseEvent(page, 'mousemove', x - 140 * progress, targetY, { buttons: 1 });
  }
  await dispatchMouseEvent(page, 'mouseup', targetX, targetY, { buttons: 0 });
}

test('resize and rotate work without PointerEvent support', async ({ page }) => {
  await loadApp(page, { disablePointerEvents: true });
  await prepareMouseCounters(page);
  await setTool(page, 'rectangle');
  const rect = await getCanvasRect(page);
  const startX = rect.x + rect.width / 2 - 60;
  const startY = rect.y + rect.height / 2 - 40;
  const endX = startX + 120;
  const endY = startY + 80;
  await mouseDrag(page, startX, startY, endX, endY);
  const afterDraw = await getPointerSnapshot(page);
  expect(afterDraw.shapes).toBe(1);
  expect(afterDraw.counters.down).toBeGreaterThan(0);

  await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBeGreaterThan(0);

  const beforeBounds = await getShapeBounds(page);
  expect(beforeBounds.width).toBeGreaterThan(0);

  await resizeFromHandleWithMouse(page, 160, 140);
  const afterResize = await getPointerSnapshot(page);
  expect(afterResize.counters.down).toBeGreaterThan(afterDraw.counters.down);

  const afterBounds = await getShapeBounds(page);
  expect(afterBounds.width).toBeGreaterThan(beforeBounds.width);

  const initialRotation = await page.evaluate(() => window.animatorState.selection.style.rotation ?? 0);
  await rotateFromHandleWithMouse(page);
  const afterRotate = await getPointerSnapshot(page);
  expect(afterRotate.counters.down).toBeGreaterThan(afterResize.counters.down);
  const rotationAfter = await page.evaluate(() => window.animatorState.selection.style.rotation ?? 0);
  expect(Math.abs(rotationAfter - initialRotation)).toBeGreaterThan(1);
});
