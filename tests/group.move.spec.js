const { test, expect } = require('@playwright/test');
const {
  loadApp,
  setTool,
  drawRectangle,
  pointerDrag,
  getCanvasRect,
  getShapeBounds,
  getSelectedShapeSnapshot,
  ensureSelectionCount,
  getGroupHandleClientPoints,
} = require('./utils');

async function setupGroupedRectangles(page) {
  await loadApp(page);

  await setTool(page, 'rectangle');
  await drawRectangle(page, { offsetX: -140, offsetY: -40, width: 140, height: 90 });
  const firstShape = await getSelectedShapeSnapshot(page);
  if (!firstShape) throw new Error('First shape snapshot unavailable');
  const firstId = firstShape.id;

  await drawRectangle(page, { offsetX: 120, offsetY: 80, width: 120, height: 80 });
  const secondShape = await getSelectedShapeSnapshot(page);
  if (!secondShape) throw new Error('Second shape snapshot unavailable');
  const secondId = secondShape.id;

  await setTool(page, 'select');

  const canvasRect = await getCanvasRect(page);
  const firstBounds = await getShapeBounds(page, firstId);
  const secondBounds = await getShapeBounds(page, secondId);
  if (!firstBounds || !secondBounds) {
    throw new Error('Unable to retrieve initial bounds for grouped rectangles');
  }

  const margin = 40;
  const minX = Math.min(firstBounds.x, secondBounds.x) - margin;
  const minY = Math.min(firstBounds.y, secondBounds.y) - margin;
  const maxX = Math.max(firstBounds.x + firstBounds.width, secondBounds.x + secondBounds.width) + margin;
  const maxY = Math.max(firstBounds.y + firstBounds.height, secondBounds.y + secondBounds.height) + margin;

  const marqueeStartX = canvasRect.x + Math.max(16, minX);
  const marqueeStartY = canvasRect.y + Math.max(16, minY);
  const marqueeEndX = canvasRect.x + Math.min(canvasRect.width - 16, maxX);
  const marqueeEndY = canvasRect.y + Math.min(canvasRect.height - 16, maxY);

  await pointerDrag(page, marqueeStartX, marqueeStartY, marqueeEndX, marqueeEndY);
  await ensureSelectionCount(page, 2);

  await page.click('#groupShapes');
  await ensureSelectionCount(page, 2);

  return {
    firstId,
    secondId,
    canvasRect,
    firstBounds,
    secondBounds,
  };
}

test.describe('Grouped movement', () => {
  test('grouped shapes retain relative layout after dragging', async ({ page }) => {
    const { firstId, secondId, canvasRect } = await setupGroupedRectangles(page);

    const initialA = await getShapeBounds(page, firstId);
    const initialB = await getShapeBounds(page, secondId);
    expect(initialA).not.toBeNull();
    expect(initialB).not.toBeNull();
    const initialDiff = {
      dx: initialB.x - initialA.x,
      dy: initialB.y - initialA.y,
    };

    const dragStartX = canvasRect.x + initialA.x + initialA.width / 2;
    const dragStartY = canvasRect.y + initialA.y + initialA.height / 2;
    const delta = { x: 180, y: 160 };

    await pointerDrag(
      page,
      dragStartX,
      dragStartY,
      dragStartX + delta.x,
      dragStartY + delta.y,
    );

    await expect.poll(async () => (await getShapeBounds(page, firstId))?.x ?? 0).toBeCloseTo(
      initialA.x + delta.x,
      1,
    );
    await expect.poll(async () => (await getShapeBounds(page, firstId))?.y ?? 0).toBeCloseTo(
      initialA.y + delta.y,
      1,
    );

    const finalA = await getShapeBounds(page, firstId);
    const finalB = await getShapeBounds(page, secondId);

    expect(finalA).not.toBeNull();
    expect(finalB).not.toBeNull();

    const finalDiff = {
      dx: finalB.x - finalA.x,
      dy: finalB.y - finalA.y,
    };

    expect(finalDiff.dx).toBeCloseTo(initialDiff.dx, 0.5);
    expect(finalDiff.dy).toBeCloseTo(initialDiff.dy, 0.5);
  });

  test('grouped shapes resize together via shared handle', async ({ page }) => {
    const { firstId, secondId } = await setupGroupedRectangles(page);

    const groupInfoBefore = await getGroupHandleClientPoints(page);
    expect(groupInfoBefore).not.toBeNull();
    const { bounds: beforeBounds, resizeHandle, scaleX, scaleY } = groupInfoBefore;

    const firstBefore = await getShapeBounds(page, firstId);
    const secondBefore = await getShapeBounds(page, secondId);
    expect(firstBefore).not.toBeNull();
    expect(secondBefore).not.toBeNull();

    const deltaClient = { x: 120, y: 90 };
    await pointerDrag(
      page,
      resizeHandle.x,
      resizeHandle.y,
      resizeHandle.x + deltaClient.x,
      resizeHandle.y + deltaClient.y,
      { steps: 18 },
    );

    await ensureSelectionCount(page, 2);

    const groupInfoAfter = await getGroupHandleClientPoints(page);
    expect(groupInfoAfter).not.toBeNull();

    const stageScaleX = scaleX || 1;
    const stageScaleY = scaleY || 1;
    const deltaStageX = deltaClient.x / stageScaleX;
    const deltaStageY = deltaClient.y / stageScaleY;
    const expectedWidth = beforeBounds.width + 2 * deltaStageX;
    const expectedHeight = beforeBounds.height + 2 * deltaStageY;

    expect(groupInfoAfter.bounds.width).toBeCloseTo(expectedWidth, 1);
    expect(groupInfoAfter.bounds.height).toBeCloseTo(expectedHeight, 1);

    const firstAfter = await getShapeBounds(page, firstId);
    const secondAfter = await getShapeBounds(page, secondId);
    expect(firstAfter).not.toBeNull();
    expect(secondAfter).not.toBeNull();

    const scaleXFactor = expectedWidth / beforeBounds.width;
    const scaleYFactor = expectedHeight / beforeBounds.height;

    expect(firstAfter.width).toBeCloseTo(firstBefore.width * scaleXFactor, 1);
    expect(firstAfter.height).toBeCloseTo(firstBefore.height * scaleYFactor, 1);
    expect(secondAfter.width).toBeCloseTo(secondBefore.width * scaleXFactor, 1);
    expect(secondAfter.height).toBeCloseTo(secondBefore.height * scaleYFactor, 1);
  });

  test('grouped shapes rotate together via shared handle', async ({ page }) => {
    const { firstId, secondId, firstBounds, secondBounds } = await setupGroupedRectangles(page);

    const groupInfoBefore = await getGroupHandleClientPoints(page);
    expect(groupInfoBefore).not.toBeNull();

    const radius = Math.abs(groupInfoBefore.rotationHandle.y - groupInfoBefore.center.y);
    expect(radius).toBeGreaterThan(4);

    const targetX = groupInfoBefore.center.x + radius;
    const targetY = groupInfoBefore.center.y;

    await pointerDrag(
      page,
      groupInfoBefore.rotationHandle.x,
      groupInfoBefore.rotationHandle.y,
      targetX,
      targetY,
      { steps: 20 },
    );

    await ensureSelectionCount(page, 2);

    const groupInfoAfter = await getGroupHandleClientPoints(page);
    expect(groupInfoAfter).not.toBeNull();

    const firstAfter = await getShapeBounds(page, firstId);
    const secondAfter = await getShapeBounds(page, secondId);
    expect(firstAfter).not.toBeNull();
    expect(secondAfter).not.toBeNull();

    const rotations = await page.evaluate((ids) => {
      return ids.map((id) => {
        const shape = window.animatorState.shapes.find((entry) => entry.id === id);
        return shape?.live?.rotation ?? 0;
      });
    }, [firstId, secondId]);

    const expectedRotation = Math.PI / 2;
    rotations.forEach((angle) => {
      expect(angle).toBeCloseTo(expectedRotation, 0.25);
    });

    const angleDelta = (beforeVector, afterVector) => {
      const cross = beforeVector.x * afterVector.y - beforeVector.y * afterVector.x;
      const dot = beforeVector.x * afterVector.x + beforeVector.y * afterVector.y;
      return Math.atan2(cross, dot);
    };

    const centerBefore = groupInfoBefore.stageCenter;
    const centerAfter = groupInfoAfter.stageCenter;

    const firstVectorBefore = {
      x: firstBounds.x + firstBounds.width / 2 - centerBefore.x,
      y: firstBounds.y + firstBounds.height / 2 - centerBefore.y,
    };
    const firstVectorAfter = {
      x: firstAfter.x + firstAfter.width / 2 - centerAfter.x,
      y: firstAfter.y + firstAfter.height / 2 - centerAfter.y,
    };
    const secondVectorBefore = {
      x: secondBounds.x + secondBounds.width / 2 - centerBefore.x,
      y: secondBounds.y + secondBounds.height / 2 - centerBefore.y,
    };
    const secondVectorAfter = {
      x: secondAfter.x + secondAfter.width / 2 - centerAfter.x,
      y: secondAfter.y + secondAfter.height / 2 - centerAfter.y,
    };

    expect(angleDelta(firstVectorBefore, firstVectorAfter)).toBeCloseTo(expectedRotation, 0.3);
    expect(angleDelta(secondVectorBefore, secondVectorAfter)).toBeCloseTo(expectedRotation, 0.3);
  });
});
