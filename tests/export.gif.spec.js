const { test, expect } = require('@playwright/test');
const {
  loadApp,
  setTool,
  drawRectangle,
  ensureShapeCount,
  ensureSelectionCount,
  setTimelineTime,
  waitForExportStatus,
} = require('./utils');

async function configureExportSettings(page, { duration = 1, fps = 5 } = {}) {
  await page.evaluate(({ durationValue, fpsValue }) => {
    const durationInput = document.getElementById('timelineDuration');
    if (durationInput) {
      durationInput.value = String(durationValue);
      durationInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const fpsInput = document.getElementById('exportFps');
    if (fpsInput) {
      fpsInput.value = String(fpsValue);
      fpsInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, { durationValue: duration, fpsValue: fps });
}

async function openExportMenu(page) {
  await page.evaluate(() => {
    const details = document.querySelector('.action-group');
    if (details && !details.open) {
      details.open = true;
    }
  });
  await expect(page.locator('#exportGif')).toBeVisible();
}

test.describe('GIF export', () => {
  test('produces a downloadable GIF when animation frames differ', async ({ page }) => {
    await loadApp(page);
    await configureExportSettings(page, { duration: 1, fps: 5 });

    await setTool(page, 'rectangle');
    await drawRectangle(page);

    await ensureShapeCount(page, 1);
    await ensureSelectionCount(page, 1);

    const initialFill = '#ff0000';
    await page.locator('#fillColor').fill(initialFill);
    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.style?.fill?.toLowerCase() ?? null),
    ).toBe(initialFill);

    await setTimelineTime(page, 0.8);

    const updatedFill = '#00ff88';
    await page.locator('#fillColor').fill(updatedFill);
    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.style?.fill?.toLowerCase() ?? null),
    ).toBe(updatedFill);
    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.keyframes?.length ?? 0),
    ).toBe(2);

    await openExportMenu(page);

    const downloadPromise = page.waitForEvent('download');
    await page.click('#exportGif');
    const download = await downloadPromise;
    expect(await download.failure()).toBeNull();
    expect(await download.path()).not.toBeNull();

    const status = await waitForExportStatus(page, /gif download ready/i);
    await expect(status).toHaveAttribute('data-variant', 'success');
  });

  test('warns when export only captures a static frame', async ({ page }) => {
    await loadApp(page);
    await configureExportSettings(page, { duration: 1, fps: 4 });

    await page.evaluate(() => {
      if (window.animatorState?.timeline) {
        window.animatorState.timeline.duration = 0;
        const durationInput = document.getElementById('timelineDuration');
        if (durationInput) {
          durationInput.value = '0';
        }
      }
    });

    await page.evaluate(() => {
      window.__alertMessages = [];
      window.__originalAlert = window.alert;
      window.alert = (message) => {
        window.__alertMessages.push(String(message));
      };
    });

    await openExportMenu(page);

    await page.click('#exportGif');

    const status = await waitForExportStatus(page, /single static frame/i);
    await expect(status).toHaveAttribute('data-variant', 'error');

    const alerts = await page.evaluate(() => window.__alertMessages || []);
    expect(alerts.some((message) => /single static frame/i.test(message))).toBe(true);

    await page.evaluate(() => {
      if (window.__originalAlert) {
        window.alert = window.__originalAlert;
        delete window.__originalAlert;
      }
    });
  });

  test('capture frames follow bounce playback order', async ({ page }) => {
    await loadApp(page);
    await configureExportSettings(page, { duration: 2, fps: 4 });

    await setTool(page, 'rectangle');
    await drawRectangle(page);

    await ensureShapeCount(page, 1);
    await ensureSelectionCount(page, 1);

    const startFill = '#ff3366';
    await page.locator('#fillColor').fill(startFill);
    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.style?.fill?.toLowerCase() ?? null),
    ).toBe(startFill);

    await setTimelineTime(page, 1.6);

    const endFill = '#33d9ff';
    await page.locator('#fillColor').fill(endFill);
    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.style?.fill?.toLowerCase() ?? null),
    ).toBe(endFill);
    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.keyframes?.length ?? 0),
    ).toBe(2);

  const bounceToggleLabel = page.locator('#bounceToggleLabel');
  const bounceToggleInput = page.locator('#bounceToggle');
  await bounceToggleLabel.click();
  await expect(bounceToggleInput).toBeChecked();

    const captureSummary = await page.evaluate(async () => {
      const capture = await window.animatorApi.captureTimelineFrames({
        fps: 4,
        maxFrames: 24,
        onFrame: () => window.animatorState.timeline.current,
      });
      return {
        times: capture.results,
        totalFrames: capture.totalFrames,
      };
    });

    expect(captureSummary.times.length).toBeGreaterThan(3);
    expect(captureSummary.totalFrames).toBe(captureSummary.times.length);

    const maxTime = Math.max(...captureSummary.times);
    const minTime = Math.min(...captureSummary.times);
    expect(minTime).toBeGreaterThanOrEqual(0);
    expect(maxTime).toBeGreaterThan(1.5);
    expect(captureSummary.times[captureSummary.times.length - 1]).toBeLessThan(0.1);

    const peakIndex = captureSummary.times.indexOf(maxTime);
    expect(peakIndex).toBeGreaterThan(0);
    expect(peakIndex).toBeLessThan(captureSummary.times.length - 1);

    const descendingAfterPeak = captureSummary.times
      .slice(peakIndex + 1)
      .some((value, index, array) => index > 0 && value < array[index - 1] - 0.01);
    expect(descendingAfterPeak).toBe(true);
  });
});
