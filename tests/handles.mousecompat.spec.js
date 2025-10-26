const { test, expect } = require('@playwright/test');
const {
  loadApp,
  setTool,
  dispatchMouseEvent,
  mouseDrag,
  getCanvasRect,
} = require('./utils');

async function trackMouseCounters(page) {
  await page.evaluate(() => {
    window.__compatCounters = { down: 0, move: 0, up: 0 };
    const canvas = document.getElementById('stage');
    if (!canvas) return;
    const track = (type) => () => {
      window.__compatCounters[type] += 1;
    };
    canvas.addEventListener('mousedown', track('down'));
    canvas.addEventListener('mousemove', track('move'));
    canvas.addEventListener('mouseup', track('up'));
  });
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

test('mouse events rotate when PointerEvent exists', async ({ page }) => {
  await loadApp(page);
  await trackMouseCounters(page);
  await setTool(page, 'rectangle');
  const rect = await getCanvasRect(page);
  const startX = rect.x + rect.width / 2 - 60;
  const startY = rect.y + rect.height / 2 - 40;
  const endX = startX + 120;
  const endY = startY + 80;
  await mouseDrag(page, startX, startY, endX, endY);

  const counters = await page.evaluate(() => window.__compatCounters);
  expect(counters.down).toBeGreaterThan(0);

  const beforeRotation = await page.evaluate(() => window.animatorState.selection?.style?.rotation ?? 0);
  await rotateFromHandleWithMouse(page);
  const afterRotation = await page.evaluate(() => window.animatorState.selection?.style?.rotation ?? 0);

  expect(Math.abs(afterRotation - beforeRotation)).toBeGreaterThan(1);
});
