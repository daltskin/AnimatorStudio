const { test, expect } = require('@playwright/test');
const {
  loadApp,
  setTool,
  drawRectangle,
  ensureSelectionCount,
  getSelectionClientCenter,
  dispatchPointerEvent,
} = require('./utils');

async function dragSelectionBy(page, deltaX, deltaY, { steps = 6 } = {}) {
  const start = await getSelectionClientCenter(page);
  if (!start) throw new Error('Selection center unavailable');
  await dispatchPointerEvent(page, 'pointerdown', start.x, start.y, {});
  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    await dispatchPointerEvent(page, 'pointermove', start.x + deltaX * progress, start.y + deltaY * progress, {});
  }
  await dispatchPointerEvent(page, 'pointerup', start.x + deltaX, start.y + deltaY, {});
}

test.describe('Canvas viewport responsiveness', () => {
  test('pointer alignment remains accurate across viewport changes', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page, { width: 160, height: 110 });
    await ensureSelectionCount(page, 1);

    await expect.poll(() => page.evaluate(() => window.animatorState.tool)).toBe('select');

    const initialPosition = await page.evaluate(() => {
      const selection = window.animatorState.selection;
      if (!selection || !selection.live) return null;
      return { x: selection.live.x, y: selection.live.y };
    });
    expect(initialPosition).not.toBeNull();

    await dragSelectionBy(page, 140, 100);

    await expect.poll(() =>
      page.evaluate(() => {
        const selection = window.animatorState.selection;
        if (!selection || !selection.live) return null;
        return selection.live.x;
      }),
    ).toBeCloseTo(initialPosition.x + 140, 1);

    await expect.poll(() =>
      page.evaluate(() => {
        const selection = window.animatorState.selection;
        if (!selection || !selection.live) return null;
        return selection.live.y;
      }),
    ).toBeCloseTo(initialPosition.y + 100, 1);

    await page.setViewportSize({ width: 900, height: 720 });
    await page.waitForTimeout(100);

    const beforeNarrowPosition = await page.evaluate(() => {
      const selection = window.animatorState.selection;
      if (!selection || !selection.live) return null;
      return { x: selection.live.x, y: selection.live.y };
    });
    expect(beforeNarrowPosition).not.toBeNull();

    await dragSelectionBy(page, -80, -60);

    await expect.poll(() =>
      page.evaluate(() => {
        const selection = window.animatorState.selection;
        if (!selection || !selection.live) return null;
        return selection.live.x;
      }),
    ).toBeCloseTo(beforeNarrowPosition.x - 80, 1);

    await expect.poll(() =>
      page.evaluate(() => {
        const selection = window.animatorState.selection;
        if (!selection || !selection.live) return null;
        return selection.live.y;
      }),
    ).toBeCloseTo(beforeNarrowPosition.y - 60, 1);

    await page.setViewportSize({ width: 1680, height: 960 });
    await page.waitForTimeout(100);

    const beforeWidePosition = await page.evaluate(() => {
      const selection = window.animatorState.selection;
      if (!selection || !selection.live) return null;
      return { x: selection.live.x, y: selection.live.y };
    });
    expect(beforeWidePosition).not.toBeNull();

    await dragSelectionBy(page, 120, 75);

    await expect.poll(() =>
      page.evaluate(() => {
        const selection = window.animatorState.selection;
        if (!selection || !selection.live) return null;
        return selection.live.x;
      }),
    ).toBeCloseTo(beforeWidePosition.x + 120, 1);

    await expect.poll(() =>
      page.evaluate(() => {
        const selection = window.animatorState.selection;
        if (!selection || !selection.live) return null;
        return selection.live.y;
      }),
    ).toBeCloseTo(beforeWidePosition.y + 75, 1);
  });
});
