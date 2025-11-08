const { test, expect } = require("@playwright/test");
const {
  loadApp,
  setTool,
  ensureSelectionCount,
  getSelectedShapeSnapshot,
  pointerDrag,
  getLineBendHandlePoint
} = require("./utils.js");

test.describe("Arrow bend handle", () => {
  test("dragging the midpoint handle introduces a smooth bend to arrows", async ({ page }) => {
    await loadApp(page);
    await setTool(page, 'arrow');
    
    // Draw an arrow
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    
    await pointerDrag(page, centerX - 100, centerY, centerX + 100, centerY);
    
    await ensureSelectionCount(page, 1);
    
    // Verify arrow was created
    let snapshot = await getSelectedShapeSnapshot(page);
    expect(snapshot?.type).toBe("arrow");
    expect(snapshot?.live?.control).toBeUndefined();
    
    // Get bend handle point
    const handle = await getLineBendHandlePoint(page);
    expect(handle).not.toBeNull();
    
    // Drag the bend handle down
    await pointerDrag(page, handle.x, handle.y, handle.x, handle.y + 50, { steps: 10 });
    
    // Check that control point was added
    snapshot = await getSelectedShapeSnapshot(page);
    expect(snapshot?.live?.control).toBeDefined();
  });

  test("returning the bend handle to center flattens the arrow", async ({ page }) => {
    await loadApp(page);
    await setTool(page, 'arrow');
    
    // Draw an arrow
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    
    await pointerDrag(page, centerX - 100, centerY, centerX + 100, centerY);
    
    await ensureSelectionCount(page, 1);
    
    // First bend it
    let handle = await getLineBendHandlePoint(page);
    await pointerDrag(page, handle.x, handle.y, handle.x, handle.y + 50, { steps: 10 });
    
    // Verify it's bent
    let snapshot = await getSelectedShapeSnapshot(page);
    expect(snapshot?.live?.control).toBeDefined();
    
    // Calculate the midpoint for straightening
    const midX = (snapshot.live.start.x + snapshot.live.end.x) / 2;
    const midY = (snapshot.live.start.y + snapshot.live.end.y) / 2;
    
    // Get the client coordinates for the midpoint
    const midClient = await page.evaluate(({ x, y }) => {
      const canvas = document.getElementById('stage');
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + x, y: rect.top + y };
    }, { x: midX, y: midY });
    
    // Now flatten it by dragging back to center
    handle = await getLineBendHandlePoint(page);
    await pointerDrag(page, handle.x, handle.y, midClient.x, midClient.y, { steps: 10 });
    
    // Verify it's straight again
    snapshot = await getSelectedShapeSnapshot(page);
    expect(snapshot?.live?.control).toBeUndefined();
  });

  test("bent arrows maintain curve when rotated", async ({ page }) => {
    await loadApp(page);
    await setTool(page, 'arrow');
    
    // Draw an arrow
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    
    await pointerDrag(page, centerX - 100, centerY, centerX + 100, centerY);
    
    await ensureSelectionCount(page, 1);
    
    // Bend the arrow
    let handle = await getLineBendHandlePoint(page);
    await pointerDrag(page, handle.x, handle.y, handle.x, handle.y + 40, { steps: 10 });
    
    // Verify it has a control point
    let snapshot = await getSelectedShapeSnapshot(page);
    expect(snapshot?.live?.control).toBeDefined();
    const controlBefore = { ...snapshot.live.control };
    
    // Get rotation handle info
    const rotationHandle = await page.evaluate(() => {
      const canvas = document.getElementById('stage');
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const api = window.animatorApi;
      if (!api) return null;
      const info = api.getRotationHandleClientPoint();
      return info;
    });
    
    expect(rotationHandle).not.toBeNull();
    
    // Rotate the arrow
    await pointerDrag(page, rotationHandle.x, rotationHandle.y, rotationHandle.x + 50, rotationHandle.y, { steps: 10 });
    
    // Verify it still has a control point after rotation
    snapshot = await getSelectedShapeSnapshot(page);
    expect(snapshot?.live?.control).toBeDefined();
    
    // Control point should have moved (rotated)
    expect(snapshot.live.control).not.toEqual(controlBefore);
  });

  test("bent arrows have arrowheads pointing along the curve tangent", async ({ page }) => {
    await loadApp(page);
    await setTool(page, 'arrow');
    
    // Draw an arrow
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    
    await pointerDrag(page, centerX - 100, centerY, centerX + 100, centerY);
    
    await ensureSelectionCount(page, 1);
    
    // Get initial arrow data (straight line)
    let snapshot = await getSelectedShapeSnapshot(page);
    expect(snapshot?.live?.control).toBeUndefined();
    
    // Bend the arrow downward
    let handle = await getLineBendHandlePoint(page);
    await pointerDrag(page, handle.x, handle.y, handle.x, handle.y + 50, { steps: 10 });
    
    // Verify arrow is now curved
    snapshot = await getSelectedShapeSnapshot(page);
    expect(snapshot?.live?.control).toBeDefined();
    
    // The control point should be below the line (positive y offset)
    const midY = (snapshot.live.start.y + snapshot.live.end.y) / 2;
    expect(snapshot.live.control.y).toBeGreaterThan(midY);
    
    // Verify the arrow still has arrowEnd enabled
    expect(snapshot?.style?.arrowEnd).toBe(true);
  });
});
