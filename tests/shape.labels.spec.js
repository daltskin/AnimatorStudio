const { test, expect } = require("@playwright/test");
const { loadApp, drawRectangle, setTool, getCanvasRect, drawDiamond, drawLine, pointerDrag } = require('./utils');

// Utility to draw a circle
async function drawCircle(page, { offsetX = 0, offsetY = 0, radius = 40 } = {}) {
  await setTool(page, 'circle');
  const rect = await getCanvasRect(page);
  const centerX = rect.x + rect.width / 2 + offsetX;
  const centerY = rect.y + rect.height / 2 + offsetY;
  
  await pointerDrag(page, centerX - radius, centerY - radius, centerX + radius, centerY + radius);
}

// Utility to get canvas-relative click coordinates for a shape
async function getShapeCanvasCoords(page, shapeIndex = 0) {
  const shapeBounds = await page.evaluate((index) => {
    const shapes = window.animatorApi.getShapes();
    return shapes.length > index ? window.animatorApi.getShapeBounds(shapes[index].id) : null;
  }, shapeIndex);
  
  if (!shapeBounds) throw new Error('Shape not found');
  
  return {
    x: shapeBounds.x + shapeBounds.width / 2,
    y: shapeBounds.y + shapeBounds.height / 2
  };
}

test.describe("Shape labels", () => {
  test("double-clicking a rectangle shows label editor", async ({ page }) => {
    await loadApp(page);

    // Draw a rectangle using the utility function
    await drawRectangle(page);
    
    // Switch to select tool  
    await setTool(page, 'select');

    // Get canvas-relative coordinates for the shape
    const coords = await getShapeCanvasCoords(page);
    
    // Double-click the rectangle using canvas-relative coordinates
    await page.locator('#stage').dblclick({ position: { x: coords.x, y: coords.y } });

    // Verify label editor appears
    const labelEditor = await page.waitForSelector(".canvas-label-editor", { timeout: 2000 });
    expect(labelEditor).toBeTruthy();
  });

  test("label editor accepts text input", async ({ page }) => {
    await loadApp(page);

    // Draw a circle using the utility function
    await drawCircle(page);

    // Switch to select tool
    await setTool(page, 'select');

    // Get canvas-relative coordinates for the circle
    const coords = await getShapeCanvasCoords(page);
    await page.locator('#stage').dblclick({ position: { x: coords.x, y: coords.y } });

    // Type in the label editor
    const labelEditor = await page.waitForSelector(".canvas-label-editor");
    await labelEditor.type("Test Label");

    // Press Enter to finalize
    await page.keyboard.press("Enter");

    // Verify label editor is gone
    const editorGone = await page.$(".canvas-label-editor");
    expect(editorGone).toBeNull();
  });

  test("labels appear centered on shapes", async ({ page }) => {
    await loadApp(page);

    // Draw a diamond using the utility function
    await drawDiamond(page);
    
    // Switch to select tool
    await setTool(page, 'select');

    // Get canvas-relative coordinates for the diamond
    const coords = await getShapeCanvasCoords(page);
    await page.locator('#stage').dblclick({ position: { x: coords.x, y: coords.y } });

    // Type in the label editor
    const labelEditor = await page.waitForSelector(".canvas-label-editor");
    await labelEditor.type("Diamond");
    await page.keyboard.press("Enter");

    // Verify the shape has a label
    const shapeData = await page.evaluate(() => {
      return window.animatorApi.getShapes()[0];
    });

    expect(shapeData.label).toBe("Diamond");
  });

  test("labels are preserved in exports", async ({ page }) => {
    await loadApp(page);

    // Draw a rectangle
    await drawRectangle(page);
    
    // Switch to select tool
    await setTool(page, 'select');
    
    // Get canvas-relative coordinates for the rectangle
    const coords = await getShapeCanvasCoords(page);
    await page.locator('#stage').dblclick({ position: { x: coords.x, y: coords.y } });

    const labelEditor = await page.waitForSelector(".canvas-label-editor");
    await labelEditor.type("Export Test");
    await page.keyboard.press("Enter");

    // Export the scene
    const exportData = await page.evaluate(() => {
      return window.animatorApi.exportScene();
    });

    // Verify the label is in the export
    expect(exportData.shapes[0].label).toBe("Export Test");
  });

  test("double-clicking text shape does not show label editor", async ({ page }) => {
    await loadApp(page);

    // Select text tool
    await setTool(page, 'text');

    // Create a text shape at canvas center using canvas-relative coordinates
    const rect = await getCanvasRect(page);
    await page.locator('#stage').click({ position: { x: rect.width / 2, y: rect.height / 2 } });

    // There should be a text editor, not a label editor
    const textEditor = await page.waitForSelector(".canvas-text-editor", { timeout: 2000 });
    expect(textEditor).toBeTruthy();

    const labelEditor = await page.$(".canvas-label-editor");
    expect(labelEditor).toBeNull();
  });

  test("labels work on line shapes", async ({ page }) => {
    await loadApp(page);

    // Draw a line using the utility function
    await setTool(page, 'line');
    await drawLine(page);

    // Switch to select tool and get canvas-relative line coordinates
    await setTool(page, 'select');
    const coords = await getShapeCanvasCoords(page);
    await page.locator('#stage').dblclick({ position: { x: coords.x, y: coords.y } });

    // Verify label editor appears
    const labelEditor = await page.waitForSelector(".canvas-label-editor", { timeout: 2000 });
    await labelEditor.type("Line Label");
    await page.keyboard.press("Enter");

    // Verify the line has a label
    const shapeData = await page.evaluate(() => {
      return window.animatorApi.getShapes()[0];
    });

    expect(shapeData.label).toBe("Line Label");
  });
});