// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, setTool, drawRectangle, drawLine, ensureShapeCount, setTimelineTime } = require('./utils');

test.describe('Timeline Visibility', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('shape added after timeline start only appears from its first keyframe onwards', async ({ page }) => {
    // Set timeline to 0s (start)
    await setTimelineTime(page, 0);
    await page.waitForTimeout(100);

    // Draw first shape at time 0
    await setTool(page, 'rectangle');
    await drawRectangle(page, { offsetX: -100 });
    await page.waitForTimeout(100);

    // Verify we have 1 shape
    await ensureShapeCount(page, 1);

    // Log the first shape info
    const firstShapeInfo = await page.evaluate(() => {
      // @ts-ignore
      const state = window.animatorState;
      return {
        // @ts-ignore
        shapeCount: state.shapes.length,
        // @ts-ignore
        shapes: state.shapes.map((s) => ({
          type: s.type,
          id: s.id,
          // @ts-ignore
          keyframes: s.keyframes.map((kf) => ({ time: kf.time })),
        })),
        timelineCurrent: state.timeline.current,
      };
    });
    // eslint-disable-next-line no-console
    console.log('After drawing first shape:', JSON.stringify(firstShapeInfo, null, 2));

    // Move timeline to 3 seconds
    await setTimelineTime(page, 3);
    await page.waitForTimeout(200);

    // Draw second shape at time 3s
    await setTool(page, 'circle');
    await drawRectangle(page, { offsetX: 100 });
    await page.waitForTimeout(100);

    // Verify we now have 2 shapes
    await ensureShapeCount(page, 2);

    // Log the shapes info
    const twoShapesInfo = await page.evaluate(() => {
      // @ts-ignore
      const state = window.animatorState;
      return {
        // @ts-ignore
        shapeCount: state.shapes.length,
        // @ts-ignore
        shapes: state.shapes.map((s) => ({
          type: s.type,
          id: s.id,
          // @ts-ignore
          keyframes: s.keyframes.map((kf) => ({ time: kf.time })),
        })),
        timelineCurrent: state.timeline.current,
      };
    });
    // eslint-disable-next-line no-console
    console.log('After drawing second shape:', JSON.stringify(twoShapesInfo, null, 2));

    // Move timeline back to 1 second (before second shape's first keyframe)
    await setTimelineTime(page, 1);
    await page.waitForTimeout(200);

    // Check canvas to verify only first shape is visible
    // We do this by checking the rendering state
    const visibleInfo = await page.evaluate(() => {
      // @ts-ignore
      const state = window.animatorState;
      if (!state || !state.shapes) return { shapes: [], currentTime: 0 };
      
      const currentTime = state.timeline.current;
      // @ts-ignore
      const shapesInfo = state.shapes.map((shape) => ({
        type: shape.type,
        id: shape.id,
        // @ts-ignore
        keyframes: shape.keyframes.map((kf) => kf.time),
      }));
      
      // Use same logic as rendering.js to determine visibility
      // @ts-ignore
      const visible = state.shapes.filter((shape) => {
        if (shape.keyframes.length === 0) return false;
        
        // Determine the "creation time" of the shape
        let creationTime;
        if (shape.keyframes.length === 1) {
          creationTime = shape.keyframes[0].time;
        } else {
          // @ts-ignore
          const sorted = shape.keyframes.slice().sort((a, b) => a.time - b.time);
          if (Math.abs(sorted[0].time) < 0.0001 && sorted.length > 1) {
            // First keyframe is at time ~0, shape was created at second keyframe time
            creationTime = sorted[1].time;
          } else {
            creationTime = sorted[0].time;
          }
        }
        
        return currentTime >= creationTime;
      });
      return { shapes: shapesInfo, currentTime, visibleCount: visible.length, visible };
    });

    // At time 1s, only the first shape (added at 0s) should be visible
    // eslint-disable-next-line no-console
    console.log('Visibility info at time 1s:', JSON.stringify(visibleInfo, null, 2));
    expect(visibleInfo.visibleCount).toBe(1);
    expect(visibleInfo.visible[0].type).toBe('rectangle');

    // Move timeline to 3 seconds (at second shape's first keyframe)
    await setTimelineTime(page, 3);
    await page.waitForTimeout(200);

    // Both shapes should now be visible
    const visibleShapesAt3s = await page.evaluate(() => {
      // @ts-ignore
      const state = window.animatorState;
      if (!state || !state.shapes) return [];
      
      const currentTime = state.timeline.current;
      // @ts-ignore
      return state.shapes.filter((shape) => {
        if (shape.keyframes.length === 0) return false;
        
        let creationTime;
        if (shape.keyframes.length === 1) {
          creationTime = shape.keyframes[0].time;
        } else {
          // @ts-ignore
          const sorted = shape.keyframes.slice().sort((a, b) => a.time - b.time);
          if (Math.abs(sorted[0].time) < 0.0001 && sorted.length > 1) {
            creationTime = sorted[1].time;
          } else {
            creationTime = sorted[0].time;
          }
        }
        
        return currentTime >= creationTime;
      });
    });

    expect(visibleShapesAt3s.length).toBe(2);

    // Move timeline to 0 seconds (before both shapes)
    await setTimelineTime(page, 0);
    await page.waitForTimeout(200);

    // First shape should be visible at time 0, second should not
    const visibleShapesAt0s = await page.evaluate(() => {
      // @ts-ignore
      const state = window.animatorState;
      if (!state || !state.shapes) return [];
      
      const currentTime = state.timeline.current;
      // @ts-ignore
      return state.shapes.filter((shape) => {
        if (shape.keyframes.length === 0) return false;
        
        let creationTime;
        if (shape.keyframes.length === 1) {
          creationTime = shape.keyframes[0].time;
        } else {
          // @ts-ignore
          const sorted = shape.keyframes.slice().sort((a, b) => a.time - b.time);
          if (Math.abs(sorted[0].time) < 0.0001 && sorted.length > 1) {
            creationTime = sorted[1].time;
          } else {
            creationTime = sorted[0].time;
          }
        }
        
        return currentTime >= creationTime;
      });
    });

    expect(visibleShapesAt0s.length).toBe(1);
    expect(visibleShapesAt0s[0].type).toBe('rectangle');
  });

  test('shape visibility updates correctly when scrubbing timeline', async ({ page }) => {
    // Draw shape 1 at time 0
    await setTimelineTime(page, 0);
    await setTool(page, 'rectangle');
    await drawRectangle(page, { offsetX: -100 });
    await page.waitForTimeout(100);

    // Draw shape 2 at time 3s
    await setTimelineTime(page, 3);
    await setTool(page, 'circle');
    await drawRectangle(page, { offsetX: 100 });
    await page.waitForTimeout(100);

    // Test visibility at different times
    const timeTests = [
      { time: 0, expectedCount: 1, description: 'at time 0 - only shape 1' },
      { time: 1, expectedCount: 1, description: 'at time 1 - only shape 1' },
      { time: 2, expectedCount: 1, description: 'at time 2 - only shape 1' },
      { time: 3, expectedCount: 2, description: 'at time 3 - both shapes' },
      { time: 4, expectedCount: 2, description: 'at time 4 - both shapes' },
    ];

    for (const { time, expectedCount, description } of timeTests) {
      await setTimelineTime(page, time);
      await page.waitForTimeout(150);

      const visibilityInfo = await page.evaluate(() => {
        // @ts-ignore
        const state = window.animatorState;
        if (!state || !state.shapes) return { count: 0, shapes: [], currentTime: 0 };
        
        const currentTime = state.timeline.current;
        // @ts-ignore
        const shapesWithCreationTime = state.shapes.map((shape) => {
          let creationTime;
          if (shape.keyframes.length === 1) {
            creationTime = shape.keyframes[0].time;
          } else {
            // @ts-ignore
            const sorted = shape.keyframes.slice().sort((a, b) => a.time - b.time);
            if (Math.abs(sorted[0].time) < 0.0001 && sorted.length > 1) {
              creationTime = sorted[1].time;
            } else {
              creationTime = sorted[0].time;
            }
          }
          return {
            id: shape.id,
            type: shape.type,
            // @ts-ignore
            keyframeTimes: shape.keyframes.map((kf) => kf.time),
            creationTime,
            visible: currentTime >= creationTime,
          };
        });
        // @ts-ignore
        const visibleCount = shapesWithCreationTime.filter((s) => s.visible).length;
        return { count: visibleCount, shapes: shapesWithCreationTime, currentTime };
      });

      if (visibilityInfo.count !== expectedCount) {
        // eslint-disable-next-line no-console
        console.log(`FAIL ${description}:`, JSON.stringify(visibilityInfo, null, 2));
      }
      expect(visibilityInfo.count, description).toBe(expectedCount);
    }
  });

});
