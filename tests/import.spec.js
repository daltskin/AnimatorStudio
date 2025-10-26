const { test, expect } = require('@playwright/test');
const { loadApp } = require('./utils');

test.describe('Scene import', () => {
  test('imports a saved scene and hydrates timeline', async ({ page }) => {
    await loadApp(page);

    const scene = {
      version: 1,
      duration: 6,
      shapes: [
        {
          id: 10,
          type: 'rectangle',
          style: {
            fill: '#ffcc00',
            stroke: '#000000',
            strokeWidth: 4,
            rotation: 15,
          },
          live: {
            x: 240,
            y: 160,
            width: 240,
            height: 160,
          },
          keyframes: [
            {
              time: 0,
              snapshot: {
                type: 'rectangle',
                style: {
                  fill: '#ffcc00',
                  stroke: '#000000',
                  strokeWidth: 4,
                  rotation: 15,
                },
                live: {
                  x: 240,
                  y: 160,
                  width: 240,
                  height: 160,
                },
              },
            },
            {
              time: 2,
              snapshot: {
                type: 'rectangle',
                style: {
                  fill: '#00ffaa',
                  stroke: '#000000',
                  strokeWidth: 4,
                  rotation: 45,
                },
                live: {
                  x: 520,
                  y: 320,
                  width: 200,
                  height: 120,
                },
              },
            },
          ],
        },
        {
          id: 11,
          type: 'connector',
          style: {
            stroke: '#1f2937',
            strokeWidth: 3,
            arrowEnd: true,
          },
          live: {
            start: { x: 260, y: 220 },
            end: { x: 640, y: 360 },
          },
          bindings: {
            start: { shapeId: 10, ratioX: 0.3, ratioY: 0.4 },
          },
          keyframes: [
            {
              time: 0,
              snapshot: {
                type: 'connector',
                style: {
                  stroke: '#1f2937',
                  strokeWidth: 3,
                  arrowEnd: true,
                },
                live: {
                  start: { x: 260, y: 220 },
                  end: { x: 640, y: 360 },
                },
                bindings: {
                  start: { shapeId: 10, ratioX: 0.3, ratioY: 0.4 },
                },
              },
            },
          ],
        },
      ],
    };

    await page.setInputFiles('#importSceneInput', {
      name: 'scene.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(scene), 'utf-8'),
    });

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(2);

    await expect.poll(() => page.evaluate(() => window.animatorState.timeline.duration)).toBe(6);

    const rectangleSnapshot = await page.evaluate(() => {
      const shape = window.animatorState.shapes.find((entry) => entry.id === 10);
      if (!shape) return null;
      return {
        type: shape.type,
        fill: shape.style.fill,
        rotation: shape.style.rotation,
        keyframes: shape.keyframes.map((kf) => ({
          time: kf.time,
          fill: kf.snapshot?.style?.fill || null,
        })),
      };
    });
    expect(rectangleSnapshot).not.toBeNull();
    if (!rectangleSnapshot) throw new Error('Rectangle shape missing after import');
    expect(rectangleSnapshot.type).toBe('rectangle');
    expect(rectangleSnapshot.fill?.toLowerCase()).toBe('#ffcc00');
    expect(Math.round(rectangleSnapshot.rotation)).toBe(15);
    const secondKeyframe = rectangleSnapshot.keyframes.find((entry) => entry.time === 2);
    expect(secondKeyframe?.fill?.toLowerCase()).toBe('#00ffaa');

    const connectorSnapshot = await page.evaluate(() => {
      const shape = window.animatorState.shapes.find((entry) => entry.id === 11);
      if (!shape) return null;
      return {
        type: shape.type,
        start: { ...shape.live.start },
        end: { ...shape.live.end },
        arrowStart: Boolean(shape.style.arrowStart),
        arrowEnd: Boolean(shape.style.arrowEnd),
        hasBindings: Boolean(shape.bindings),
      };
    });
    expect(connectorSnapshot).toEqual({
      type: 'arrow',
      start: { x: 260, y: 220 },
      end: { x: 640, y: 360 },
      arrowStart: false,
      arrowEnd: true,
      hasBindings: false,
    });

    await expect.poll(() => page.evaluate(() => window.animatorState.timeline.current)).toBe(0);
    await expect.poll(() => page.evaluate(() => window.animatorState.selectedIds.size)).toBe(1);
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.timeline-key').length)).toBeGreaterThan(0);

    const status = page.locator('#exportStatus');
    await expect(status).toHaveText(/Scene imported!/i);
  });

  test('repositions imported shapes that start outside the stage bounds', async ({ page }) => {
    await loadApp(page);

    const scene = {
      version: 1,
      duration: 4,
      stage: {
        width: 420,
        height: 320,
      },
      shapes: [
        {
          id: 21,
          type: 'rectangle',
          style: {
            fill: '#06b6d4',
            stroke: '#0f172a',
            strokeWidth: 2,
          },
          live: {
            x: -180,
            y: 260,
            width: 260,
            height: 140,
          },
          keyframes: [
            {
              time: 0,
              snapshot: {
                type: 'rectangle',
                style: {
                  fill: '#06b6d4',
                  stroke: '#0f172a',
                  strokeWidth: 2,
                },
                live: {
                  x: -180,
                  y: 260,
                  width: 260,
                  height: 140,
                },
              },
            },
            {
              time: 2,
              snapshot: {
                type: 'rectangle',
                style: {
                  fill: '#0ea5e9',
                  stroke: '#0f172a',
                  strokeWidth: 2,
                },
                live: {
                  x: 390,
                  y: -120,
                  width: 260,
                  height: 140,
                },
              },
            },
          ],
        },
        {
          id: 22,
          type: 'connector',
          style: {
            stroke: '#1f2937',
            strokeWidth: 4,
          },
          live: {
            start: { x: -40, y: 500 },
            end: { x: 900, y: -200 },
          },
          keyframes: [
            {
              time: 0,
              snapshot: {
                type: 'connector',
                style: {
                  stroke: '#1f2937',
                  strokeWidth: 4,
                },
                live: {
                  start: { x: -40, y: 500 },
                  end: { x: 900, y: -200 },
                },
              },
            },
            {
              time: 1.5,
              snapshot: {
                type: 'connector',
                style: {
                  stroke: '#1f2937',
                  strokeWidth: 4,
                },
                live: {
                  start: { x: 700, y: 600 },
                  end: { x: -300, y: -320 },
                },
              },
            },
          ],
        },
      ],
    };

    await page.setInputFiles('#importSceneInput', {
      name: 'out-of-bounds.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(scene), 'utf-8'),
    });

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(2);

    const evaluation = await page.evaluate(() => {
      const stage = { width: window.animatorState.stage.width, height: window.animatorState.stage.height };
      const rectangle = window.animatorState.shapes.find((entry) => entry.id === 21);
      const connector = window.animatorState.shapes.find((entry) => entry.id === 22);
      return {
        stage,
        rectangle: rectangle
          ? {
              live: { ...rectangle.live },
              keyframes: rectangle.keyframes.map((kf) => ({ time: kf.time, live: { ...kf.snapshot.live } })),
            }
          : null,
        connector: connector
          ? {
              live: {
                start: { ...connector.live.start },
                end: { ...connector.live.end },
              },
              keyframes: connector.keyframes.map((kf) => ({
                time: kf.time,
                live: {
                  start: { ...kf.snapshot.live.start },
                  end: { ...kf.snapshot.live.end },
                },
              })),
            }
          : null,
      };
    });

    const epsilon = 0.001;
    expect(evaluation.stage.width).toBeGreaterThan(0);
    expect(evaluation.stage.height).toBeGreaterThan(0);

    if (!evaluation.rectangle) {
      throw new Error('Rectangle shape missing after import');
    }
    const rectLive = evaluation.rectangle.live;
    expect(rectLive.x).toBeGreaterThanOrEqual(-epsilon);
    expect(rectLive.y).toBeGreaterThanOrEqual(-epsilon);
    expect(rectLive.x + rectLive.width).toBeLessThanOrEqual(evaluation.stage.width + epsilon);
    expect(rectLive.y + rectLive.height).toBeLessThanOrEqual(evaluation.stage.height + epsilon);
    evaluation.rectangle.keyframes.forEach((entry) => {
      const { live } = entry;
      expect(live.x).toBeGreaterThanOrEqual(-epsilon);
      expect(live.y).toBeGreaterThanOrEqual(-epsilon);
      expect(live.x + live.width).toBeLessThanOrEqual(evaluation.stage.width + epsilon);
      expect(live.y + live.height).toBeLessThanOrEqual(evaluation.stage.height + epsilon);
    });

    if (!evaluation.connector) {
      throw new Error('Connector shape missing after import');
    }
    const connectorLive = evaluation.connector.live;
    expect(connectorLive.start.x).toBeGreaterThanOrEqual(-epsilon);
    expect(connectorLive.start.y).toBeGreaterThanOrEqual(-epsilon);
    expect(connectorLive.end.x).toBeGreaterThanOrEqual(-epsilon);
    expect(connectorLive.end.y).toBeGreaterThanOrEqual(-epsilon);
    expect(connectorLive.start.x).toBeLessThanOrEqual(evaluation.stage.width + epsilon);
    expect(connectorLive.start.y).toBeLessThanOrEqual(evaluation.stage.height + epsilon);
    expect(connectorLive.end.x).toBeLessThanOrEqual(evaluation.stage.width + epsilon);
    expect(connectorLive.end.y).toBeLessThanOrEqual(evaluation.stage.height + epsilon);
    evaluation.connector.keyframes.forEach((entry) => {
      const { start, end } = entry.live;
      expect(start.x).toBeGreaterThanOrEqual(-epsilon);
      expect(start.y).toBeGreaterThanOrEqual(-epsilon);
      expect(end.x).toBeGreaterThanOrEqual(-epsilon);
      expect(end.y).toBeGreaterThanOrEqual(-epsilon);
      expect(start.x).toBeLessThanOrEqual(evaluation.stage.width + epsilon);
      expect(start.y).toBeLessThanOrEqual(evaluation.stage.height + epsilon);
      expect(end.x).toBeLessThanOrEqual(evaluation.stage.width + epsilon);
      expect(end.y).toBeLessThanOrEqual(evaluation.stage.height + epsilon);
    });
  });

  test('alerts on invalid JSON scene import', async ({ page }) => {
    await loadApp(page);

    const dialogMessagePromise = new Promise((resolve) => {
      page.once('dialog', (dialog) => {
        const message = dialog.message();
        dialog.dismiss().catch(() => {});
        resolve(message);
      });
    });

    await page.setInputFiles('#importSceneInput', {
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{', 'utf-8'),
    });

    const message = await dialogMessagePromise;
    expect(message).toMatch(/unable to import scene/i);

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(0);

    const status = page.locator('#exportStatus');
    await expect(status).toHaveText(/Scene import failed/i);
  });
});
