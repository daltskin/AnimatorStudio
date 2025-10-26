const { test, expect } = require('@playwright/test');
const {
  loadApp,
  setTool,
  drawRectangle,
  setTimelineTime,
  ensureSelectionCount,
  dispatchPointerEvent,
} = require('./utils');

test.describe('Timeline interactions', () => {
  test('timeline duration input adjusts the timeline length and clamps values', async ({ page }) => {
    await loadApp(page);

  const initialDuration = await page.evaluate(() => window.animatorState.timeline.duration);
  expect(initialDuration).toBeGreaterThan(0);
  expect(initialDuration).toBe(5);

    const setDuration = async (value) => {
      await page.evaluate((nextValue) => {
        const input = document.getElementById('timelineDuration');
        if (!input) throw new Error('Timeline duration input missing');
        input.value = String(nextValue);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, value);
    };

    await setDuration(25);
    await expect.poll(() => page.evaluate(() => window.animatorState.timeline.duration)).toBe(25);
    const afterIncrease = await page.evaluate(() => window.animatorState.timeline.duration);
    expect(afterIncrease).toBe(25);
    const increasedInputValue = Number(await page.locator('#timelineDuration').inputValue());
    expect(increasedInputValue).toBe(25);

    await setDuration(3);
    await expect.poll(() => page.evaluate(() => window.animatorState.timeline.duration)).toBe(3);
    const afterDecrease = await page.evaluate(() => window.animatorState.timeline.duration);
    expect(afterDecrease).toBe(3);
    const decreasedInputValue = Number(await page.locator('#timelineDuration').inputValue());
    expect(decreasedInputValue).toBe(3);
    const currentTime = await page.evaluate(() => window.animatorState.timeline.current);
    expect(currentTime).toBeLessThanOrEqual(afterDecrease);

    await setDuration(999);
    const clampedHigh = await page.evaluate(() => window.animatorState.timeline.duration);
    expect(clampedHigh).toBe(120);
    const highInputValue = Number(await page.locator('#timelineDuration').inputValue());
    expect(highInputValue).toBe(120);

    await setDuration(0);
    const clampedLow = await page.evaluate(() => window.animatorState.timeline.duration);
    expect(clampedLow).toBe(1);
    const lowInputValue = Number(await page.locator('#timelineDuration').inputValue());
    expect(lowInputValue).toBe(1);
  });

  test('keyboard controls on the duration input adjust timeline length', async ({ page }) => {
    await loadApp(page);

    const durationInput = page.locator('#timelineDuration');
    await durationInput.focus();

    const startDuration = await page.evaluate(() => window.animatorState.timeline.duration);

    await page.keyboard.press('ArrowUp');
    const afterArrowRight = await page.evaluate(() => window.animatorState.timeline.duration);
    expect(afterArrowRight).toBe(startDuration + 1);

    await page.keyboard.press('Shift+ArrowUp');
    const afterShiftRight = await page.evaluate(() => window.animatorState.timeline.duration);
    expect(afterShiftRight).toBe(afterArrowRight + 5);

    await page.keyboard.press('End');
    const afterEnd = await page.evaluate(() => window.animatorState.timeline.duration);
    expect(afterEnd).toBe(120);

    await page.keyboard.press('Home');
    const afterHome = await page.evaluate(() => window.animatorState.timeline.duration);
    expect(afterHome).toBe(1);
    const inputValue = Number(await durationInput.inputValue());
    expect(inputValue).toBe(afterHome);
  });

  test('timeline slider clamps within the duration bounds', async ({ page }) => {
    await loadApp(page);

    await page.evaluate(() => {
      const slider = document.getElementById('timelineRange');
      if (!slider) throw new Error('Timeline slider missing');
      slider.value = '1500';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await expect.poll(() =>
      page.evaluate(() => {
        const timeline = window.animatorState.timeline;
        return timeline.current <= timeline.duration + 0.0001;
      }),
    ).toBeTruthy();

    await page.evaluate(() => {
      const slider = document.getElementById('timelineRange');
      if (slider) {
        slider.value = '1000';
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const durationInput = document.getElementById('timelineDuration');
      if (durationInput) {
        durationInput.value = '3';
        durationInput.dispatchEvent(new Event('input', { bubbles: true }));
        durationInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const clampState = await page.evaluate(() => {
      const slider = document.getElementById('timelineRange');
      if (!slider) throw new Error('Timeline slider missing');
      const sliderValue = Number(slider.value);
      const timeline = window.animatorState.timeline;
      const expectedSlider = timeline.duration === 0
        ? 0
        : Math.round((Math.max(0, Math.min(timeline.duration, timeline.current)) / timeline.duration) * 1000);
      return {
        current: timeline.current,
        duration: timeline.duration,
        sliderValue,
        expectedSlider,
      };
    });

    expect(clampState.current).toBeLessThanOrEqual(clampState.duration + 0.0001);
    expect(clampState.sliderValue).toBeGreaterThanOrEqual(0);
    expect(clampState.sliderValue).toBeLessThanOrEqual(1000);
    expect(clampState.sliderValue).toBe(clampState.expectedSlider);
  });

  test('bounce playback reverses direction at the edges', async ({ page }) => {
    await loadApp(page);

    await page.evaluate(() => {
      const durationInput = document.getElementById('timelineDuration');
      if (durationInput) {
        durationInput.value = '2';
        durationInput.dispatchEvent(new Event('input', { bubbles: true }));
        durationInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const bounceToggleLabel = page.locator('#bounceToggleLabel');
    const bounceToggleInput = page.locator('#bounceToggle');
    await bounceToggleLabel.click();
    await expect(bounceToggleInput).toBeChecked();

    await page.click('#playToggle');
    await expect(page.locator('#playToggle')).toHaveAttribute('aria-pressed', 'true');

    await page.evaluate(() => window.animatorApi.advanceTimelineForTest(2.2));

    const towardsEnd = await page.evaluate(() => {
      const { current, duration, direction } = window.animatorState.timeline;
      return { current, duration, direction };
    });

    expect(towardsEnd.current).toBeGreaterThanOrEqual(Math.max(0, towardsEnd.duration - 0.2));
    expect(towardsEnd.direction).toBe(-1);

    await page.evaluate(() => window.animatorApi.advanceTimelineForTest(1.2));

    const reversing = await page.evaluate(() => {
      const { current, direction, duration } = window.animatorState.timeline;
      return { current, direction, duration };
    });

    expect(reversing.direction).toBe(-1);
    expect(reversing.current).toBeLessThanOrEqual(Math.max(0, reversing.duration - 0.75));

    await page.click('#stopPlayback');
    await expect.poll(() => page.evaluate(() => window.animatorState.timeline.isPlaying)).toBeFalsy();
    await expect.poll(() => page.evaluate(() => window.animatorState.timeline.direction)).toBe(1);
  });

  test('loop toggle controls whether playback wraps or stops', async ({ page }) => {
    await loadApp(page);

    await page.evaluate(() => {
      const durationInput = document.getElementById('timelineDuration');
      if (durationInput) {
        durationInput.value = '1';
        durationInput.dispatchEvent(new Event('input', { bubbles: true }));
        durationInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const loopToggleLabel = page.locator('#loopToggleLabel');
    const loopToggleInput = page.locator('#loopToggle');
    await expect(loopToggleInput).toBeChecked();

    await page.click('#playToggle');
    await expect(page.locator('#playToggle')).toHaveAttribute('aria-pressed', 'true');

    const firstPass = await page.evaluate(() => {
      window.animatorApi.advanceTimelineForTest(0.7);
      return window.animatorState.timeline.current;
    });
    expect(firstPass).toBeGreaterThan(0.6);

    const wrappedState = await page.evaluate(() => {
      window.animatorApi.advanceTimelineForTest(0.5);
      return {
        current: window.animatorState.timeline.current,
        isPlaying: window.animatorState.timeline.isPlaying,
      };
    });

    expect(wrappedState.isPlaying).toBeTruthy();
    expect(wrappedState.current).toBeLessThan(0.3);

    await page.click('#playToggle');
    await expect.poll(() => page.evaluate(() => window.animatorState.timeline.isPlaying)).toBeFalsy();

    await loopToggleLabel.click();
    await expect(loopToggleInput).not.toBeChecked();

    await page.evaluate(() => {
      const slider = document.getElementById('timelineRange');
      if (!slider) throw new Error('Timeline slider missing');
      slider.value = '900';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.click('#playToggle');
    await expect(page.locator('#playToggle')).toHaveAttribute('aria-pressed', 'true');

    await page.evaluate(() => window.animatorApi.advanceTimelineForTest(0.3));

    const postStop = await page.evaluate(() => ({
      isPlaying: window.animatorState.timeline.isPlaying,
      current: window.animatorState.timeline.current,
      duration: window.animatorState.timeline.duration,
      loop: window.animatorState.timeline.loop,
    }));

    expect(postStop.isPlaying).toBeFalsy();

    expect(postStop.loop).toBe(false);
    expect(postStop.current).toBeCloseTo(postStop.duration, 5);
  });

  test('timeline displays markers for all keyframes', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page, {});
    await ensureSelectionCount(page, 1);

    const shapeId = await page.evaluate(() => window.animatorState.selection?.id ?? null);
    expect(shapeId).not.toBeNull();

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.keyframes?.length ?? 0),
    ).toBeGreaterThan(0);

    await page.evaluate(() => {
      if (window.animatorState?.timeline) {
        window.animatorState.timeline.current = Number.NaN;
      }
    });

    await page.click('#addKeyframe');

    const keyframesAfterNaN = await page.evaluate(() => window.animatorState.selection?.keyframes?.length ?? 0);
    expect(keyframesAfterNaN).toBeGreaterThan(0);

  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.timeline-key').length)).toBeGreaterThan(0);

    // Check timeline markers display correct times (not NaN)
    const markerTimes = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.timeline-key')).map((el) => el.getAttribute('data-time') ?? ''),
    );
    expect(markerTimes.every((time) => !time.startsWith('NaN') && !time.includes('NaN'))).toBeTruthy();

    await setTimelineTime(page, 2.5);
    await page.click('#addKeyframe');

    const keyframeCount = await page.evaluate(() => window.animatorState.selection?.keyframes?.length ?? 0);
    expect(keyframeCount).toBeGreaterThanOrEqual(2);

    // Timeline markers now show for all shapes, not just the selected one
    await expect.poll(() =>
      page.evaluate(() => document.querySelectorAll('.timeline-key').length),
    ).toBeGreaterThanOrEqual(keyframeCount);

    await expect.poll(() =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('.timeline-key')).every((el) => {
          const value = el.style.left;
          return typeof value === 'string' && value.endsWith('%');
        }),
      ),
    ).toBeTruthy();

    const canvasRect = await page.evaluate(() => {
      const canvas = document.getElementById('stage');
      if (!canvas) throw new Error('Canvas not found');
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    });

    await dispatchPointerEvent(page, 'pointerdown', canvasRect.x + 5, canvasRect.y + 5, {});
    await dispatchPointerEvent(page, 'pointerup', canvasRect.x + 5, canvasRect.y + 5, {});

    await expect.poll(() => page.evaluate(() => window.animatorState.selectedIds.size)).toBe(0);
    await expect.poll(() =>
      page.evaluate(() => document.querySelectorAll('.timeline-key').length),
    ).toBeGreaterThanOrEqual(keyframeCount);

    const shapeCenter = await page.evaluate((id) => {
      const api = window.animatorApi;
      const canvas = document.getElementById('stage');
      if (!api || !canvas) return null;
      const bounds = api.getShapeBounds(id);
      if (!bounds) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.left + bounds.x + bounds.width / 2,
        y: rect.top + bounds.y + bounds.height / 2,
      };
    }, shapeId);

    expect(shapeCenter).not.toBeNull();

    await dispatchPointerEvent(page, 'pointerdown', shapeCenter.x, shapeCenter.y, {});
    await dispatchPointerEvent(page, 'pointerup', shapeCenter.x, shapeCenter.y, {});

    await ensureSelectionCount(page, 1);
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.timeline-key').length)).toBe(keyframeCount);
  });

  test('shapes are hidden before their first keyframe', async ({ page }) => {
    await loadApp(page);

    await setTimelineTime(page, 3);
    await setTool(page, 'rectangle');
    await drawRectangle(page);
    await ensureSelectionCount(page, 1);

    const shapeId = await page.evaluate(() => window.animatorState.selection?.id ?? null);
    expect(shapeId).not.toBeNull();

    const initialSnapshot = await page.evaluate((id) => {
      const shape = window.animatorState.shapes.find((entry) => entry.id === id);
      if (!shape) return null;
      return {
        width: shape.live.width,
        height: shape.live.height,
        visible: shape.isVisible,
      };
    }, shapeId);
    expect(initialSnapshot).not.toBeNull();
    expect(initialSnapshot.visible).toBeTruthy();
    expect(initialSnapshot.width).toBeGreaterThan(0);
    expect(initialSnapshot.height).toBeGreaterThan(0);

    await setTimelineTime(page, 0);

    const beforeKeyframeSnapshot = await page.evaluate((id) => {
      const shape = window.animatorState.shapes.find((entry) => entry.id === id);
      if (!shape) return null;
      return {
        width: shape.live.width,
        height: shape.live.height,
        visible: shape.isVisible,
      };
    }, shapeId);

    expect(beforeKeyframeSnapshot).not.toBeNull();
    expect(beforeKeyframeSnapshot.visible).toBeFalsy();
    expect(beforeKeyframeSnapshot.width).toBeGreaterThan(0);
    expect(beforeKeyframeSnapshot.height).toBeGreaterThan(0);
  });

  test('adding keyframes at new times accumulates unique entries', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page);
    await ensureSelectionCount(page, 1);

    const initialCount = await page.evaluate(() => window.animatorState.selection?.keyframes?.length ?? 0);
    expect(initialCount).toBeGreaterThan(0);

    const keyframeTimes = [1, 2.5, 4];

    for (let index = 0; index < keyframeTimes.length; index += 1) {
      const target = keyframeTimes[index];
      await setTimelineTime(page, target);
      await page.click('#addKeyframe');
      await expect.poll(() =>
        page.evaluate(() => window.animatorState.selection?.keyframes?.length ?? 0),
      ).toBe(initialCount + index + 1);
    }

    const expectedCount = initialCount + keyframeTimes.length;

    const summary = await page.evaluate(() => {
      const keyframes = window.animatorState.selection?.keyframes ?? [];
      const times = keyframes.map((kf) => Number(kf.time) || 0);
      const unique = new Set(times.map((value) => value.toFixed(3))).size;
      const sorted = times.every((value, index, array) => index === 0 || array[index - 1] <= value);
      return { count: keyframes.length, unique, sorted };
    });

    expect(summary.count).toBe(expectedCount);
    expect(summary.unique).toBe(expectedCount);
    expect(summary.sorted).toBe(true);

    await expect.poll(() => page.locator('.keyframe-chip').count()).toBe(expectedCount);
    await expect.poll(() => page.locator('.timeline-key').count()).toBe(expectedCount);

    await setTimelineTime(page, keyframeTimes[1]);
    await page.click('#addKeyframe');

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.keyframes?.length ?? 0),
    ).toBe(expectedCount);

    const deduped = await page.evaluate(() => {
      const keyframes = window.animatorState.selection?.keyframes ?? [];
      const times = keyframes.map((kf) => Number(kf.time) || 0);
      return {
        count: keyframes.length,
        unique: new Set(times.map((value) => value.toFixed(3))).size,
      };
    });

    expect(deduped.count).toBe(expectedCount);
    expect(deduped.unique).toBe(expectedCount);
  });

  test('keyframe chips support keyboard retiming', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page);
    await ensureSelectionCount(page, 1);

    await setTimelineTime(page, 2);
    await page.click('#addKeyframe');

    const chips = page.locator('.keyframe-chip');
    await expect(chips).toHaveCount(2);

    const secondChip = chips.nth(1);
    await secondChip.focus();

    await expect.poll(async () =>
      page.evaluate(() => Number(window.animatorState.timeline.selectedKeyframeTime ?? Number.NaN)),
    ).toBeCloseTo(2, 5);

    await page.keyboard.press('Shift+ArrowRight');

    await expect.poll(async () =>
      page.evaluate(() => {
        const keyframes = window.animatorState.selection?.keyframes ?? [];
        return keyframes.some((kf) => Math.abs(kf.time - 3) < 0.001);
      }),
    ).toBeTruthy();

    await expect.poll(async () =>
      page.evaluate(() => Number(window.animatorState.timeline.selectedKeyframeTime ?? Number.NaN)),
    ).toBeCloseTo(3, 5);

    await expect.poll(async () => page.locator('.timeline-key[data-time="3"]').count()).toBeGreaterThan(0);

    await chips.nth(1).focus();
    await page.keyboard.press('Shift+ArrowLeft');

    await expect.poll(async () =>
      page.evaluate(() => {
        const keyframes = window.animatorState.selection?.keyframes ?? [];
        return keyframes.some((kf) => Math.abs(kf.time - 2) < 0.001);
      }),
    ).toBeTruthy();

    await chips.nth(1).focus();
    await page.keyboard.press('End');

    const expectedDuration = await page.evaluate(() => window.animatorState.timeline.duration);

    await expect.poll(async () =>
      page.evaluate(() => Number(window.animatorState.timeline.selectedKeyframeTime ?? Number.NaN)),
    ).toBeCloseTo(expectedDuration, 5);

    await expect.poll(async () =>
      page.evaluate((target) => {
        const keyframes = window.animatorState.selection?.keyframes ?? [];
        return keyframes.some((kf) => Math.abs(kf.time - target) < 0.001);
      }, expectedDuration),
    ).toBeTruthy();
  });

  test('keyframe chips can be selected and deleted via keyboard', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page);
    await ensureSelectionCount(page, 1);

    await expect.poll(() => page.locator('.keyframe-chip').count()).toBeGreaterThan(0);

    await setTimelineTime(page, 2);
    await page.click('#addKeyframe');

    const chips = page.locator('.keyframe-chip');
    await expect(chips).toHaveCount(2);

    const secondChip = chips.nth(1);
    await secondChip.click();

    await expect.poll(() =>
      page.evaluate(() => Number(window.animatorState.timeline.selectedKeyframeTime ?? Number.NaN)),
    ).toBeCloseTo(2, 5);

    await page.keyboard.press('Delete');

    await expect(chips).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => window.animatorState.selection?.keyframes?.length ?? 0)).toBe(1);
    await expect.poll(() =>
      page.evaluate(() => Number(window.animatorState.timeline.selectedKeyframeTime ?? 0)),
    ).toBeCloseTo(0, 5);
  });

});
