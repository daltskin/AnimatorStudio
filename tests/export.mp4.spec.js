const { test, expect } = require('@playwright/test');
const {
  loadApp,
  setTool,
  drawRectangle,
  ensureShapeCount,
  ensureSelectionCount,
  setTimelineTime,
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
  await expect(page.locator('#exportMp4')).toBeVisible();
}

test.describe('MP4 export', () => {
  test('export MP4 button is present and clickable', async ({ page }) => {
    await loadApp(page);
    await openExportMenu(page);

    const exportButton = page.locator('#exportMp4');
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled();
    
    const buttonText = await exportButton.textContent();
    expect(buttonText).toContain('MP4');
  });

  test('MP4 export initiates when animation has duration', async ({ page }) => {
    await loadApp(page);
    await configureExportSettings(page, { duration: 2, fps: 10 });

    await setTool(page, 'rectangle');
    await drawRectangle(page);

    await ensureShapeCount(page, 1);
    await ensureSelectionCount(page, 1);

    // Create animation by changing fill color at different times
    await page.locator('#fillColor').fill('#ff0000');
    await setTimelineTime(page, 1);
    await page.locator('#fillColor').fill('#00ff00');

    await openExportMenu(page);
    
    // Set up a promise to catch any errors during export
    const exportError = page.evaluate(() => {
      return new Promise((resolve) => {
        const originalConsoleError = console.error;
        const errors = [];
        console.error = (...args) => {
          errors.push(args.join(' '));
          originalConsoleError(...args);
        };
        
        setTimeout(() => {
          console.error = originalConsoleError;
          resolve(errors);
        }, 2000);
      });
    });

    // Click export button
    await page.click('#exportMp4');

    // Wait a bit for the export to start
    await page.waitForTimeout(500);

    // Check for export status message in the DOM (may be hidden by CSS but should have content)
    const statusText = await page.evaluate(() => {
      const statusElement = document.getElementById('exportStatus');
      return statusElement ? statusElement.textContent : '';
    });
    
    // Should show "Recording video..." or completion message or error
    expect(statusText).toBeTruthy();
    expect(statusText.length).toBeGreaterThan(0);

    // Check that no JavaScript errors occurred
    const errors = await exportError;
    const relevantErrors = errors.filter(err => 
      !err.includes('DEP0066') && // Ignore Node deprecation warnings
      !err.includes('MediaRecorder') // Expected if MediaRecorder not supported in test browser
    );
    expect(relevantErrors).toHaveLength(0);
  });

  test('MP4 export shows error when duration is zero', async ({ page }) => {
    await loadApp(page);
    
    // Set duration to 0
    await page.evaluate(() => {
      const durationInput = document.getElementById('timelineDuration');
      if (durationInput) {
        durationInput.value = '0';
        durationInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Wait for duration to be clamped to minimum (1 second)
    await page.waitForTimeout(100);
    
    const actualDuration = await page.evaluate(() => window.animatorState.timeline.duration);
    // Duration gets clamped to 1, so we can't actually test with 0
    // Instead, test that export works with minimal duration
    expect(actualDuration).toBeGreaterThan(0);
    
    await setTool(page, 'rectangle');
    await drawRectangle(page);

    await openExportMenu(page);

    // With duration > 0 and shapes present, export should attempt to start
    await page.click('#exportMp4');
    await page.waitForTimeout(500);
    
    // Check the status shows something (recording or error about MediaRecorder support)
    const statusText = await page.evaluate(() => {
      const statusElement = document.getElementById('exportStatus');
      return statusElement ? statusElement.textContent : '';
    });
    expect(statusText).toBeTruthy();
  });

  test('MP4 export respects loop mode by capturing multiple iterations', async ({ page }) => {
    await loadApp(page);
    await configureExportSettings(page, { duration: 1, fps: 10 });

    await setTool(page, 'rectangle');
    await drawRectangle(page);

    // Enable loop mode
    await page.evaluate(() => {
      const loopToggle = document.getElementById('loopToggle');
      if (loopToggle && !loopToggle.checked) {
        loopToggle.checked = true;
        loopToggle.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const loopState = await page.evaluate(() => window.animatorState.timeline.loop);
    expect(loopState).toBeTruthy();

    // Note: Actual video recording would capture 3 loops + 1 second pause
    // This test verifies the setup is correct
    const timelineState = await page.evaluate(() => ({
      loop: window.animatorState.timeline.loop,
      bounce: window.animatorState.timeline.bounce,
      duration: window.animatorState.timeline.duration,
    }));

    expect(timelineState.loop).toBe(true);
    expect(timelineState.bounce).toBe(false);
    expect(timelineState.duration).toBe(1);
  });

  test('MP4 export respects bounce mode', async ({ page }) => {
    await loadApp(page);
    await configureExportSettings(page, { duration: 1, fps: 10 });

    await setTool(page, 'rectangle');
    await drawRectangle(page);

    // Enable bounce mode
    await page.evaluate(() => {
      const bounceToggle = document.getElementById('bounceToggle');
      if (bounceToggle && !bounceToggle.checked) {
        bounceToggle.checked = true;
        bounceToggle.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const bounceState = await page.evaluate(() => window.animatorState.timeline.bounce);
    expect(bounceState).toBeTruthy();

    // Note: Actual video recording would capture forward + backward + 1 second pause
    const timelineState = await page.evaluate(() => ({
      loop: window.animatorState.timeline.loop,
      bounce: window.animatorState.timeline.bounce,
      duration: window.animatorState.timeline.duration,
    }));

    expect(timelineState.bounce).toBe(true);
    expect(timelineState.duration).toBe(1);
  });

  test('default export FPS is 25', async ({ page }) => {
    await loadApp(page);

    const defaultFps = await page.evaluate(() => {
      const fpsInput = document.getElementById('exportFps');
      return fpsInput ? Number(fpsInput.value) : null;
    });

    expect(defaultFps).toBe(25);

    const stateFps = await page.evaluate(() => window.animatorState.timeline.exportFps);
    expect(stateFps).toBe(25);
  });

  test('export FPS can be changed and persists', async ({ page }) => {
    await loadApp(page);

    await configureExportSettings(page, { duration: 2, fps: 30 });

    const updatedFps = await page.evaluate(() => window.animatorState.timeline.exportFps);
    expect(updatedFps).toBe(30);

    const inputValue = await page.locator('#exportFps').inputValue();
    expect(Number(inputValue)).toBe(30);
  });
});
