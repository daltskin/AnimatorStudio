const { test, expect } = require("@playwright/test");
const { loadApp, drawRectangle, drawCircle, drawLine, pointerDrag, setTool } = require("./utils.js");

test.describe("Drawing over shapes", () => {
  test("can draw a rectangle on top of an existing rectangle", async ({ page }) => {
    await loadApp(page);
    
    // Draw first rectangle using proper drawing utility
    await drawRectangle(page, { offsetX: -100, offsetY: -50, width: 100, height: 80 });
    
    // Verify first rectangle exists
    let shapeCount = await page.evaluate(() => window.animatorState.shapes.length);
    expect(shapeCount).toBe(1);
    
    // Draw second rectangle overlapping the first
    await drawRectangle(page, { offsetX: 50, offsetY: 20, width: 100, height: 80 });
    
    // Should now have 2 rectangles
    shapeCount = await page.evaluate(() => window.animatorState.shapes.length);
    expect(shapeCount).toBe(2);
    
    // Verify both are rectangles
    const shapes = await page.evaluate(() => {
      return window.animatorState.shapes.map(s => ({ type: s.type, id: s.id }));
    });
    expect(shapes).toHaveLength(2);
    expect(shapes[0].type).toBe("rectangle");
    expect(shapes[1].type).toBe("rectangle");
  });

  test("can draw a circle on top of an existing shape", async ({ page }) => {
    await loadApp(page);
    
    // Draw a rectangle first
    await drawRectangle(page, { offsetX: -50, offsetY: -40, width: 100, height: 80 });
    
    // Draw a circle on top
    await page.click('[data-tool="circle"]');
    const rect = await page.evaluate(() => {
      const canvas = document.getElementById('stage');
      return canvas.getBoundingClientRect();
    });
    const centerX = rect.x + rect.width / 2 + 10;
    const centerY = rect.y + rect.height / 2 + 10;
    await pointerDrag(page, centerX - 30, centerY - 30, centerX + 30, centerY + 30);
    
    const shapes = await page.evaluate(() => {
      return window.animatorState.shapes.map(s => s.type);
    });
    
    expect(shapes).toEqual(["rectangle", "circle"]);
  });

  test("can draw a line through existing shapes", async ({ page }) => {
    await loadApp(page);
    
    // Draw two rectangles
    await drawRectangle(page, { offsetX: -120, offsetY: -35, width: 70, height: 70 });
    await drawRectangle(page, { offsetX: 50, offsetY: -35, width: 70, height: 70 });
    
    // Draw a line that goes through both rectangles
    await setTool(page, 'line');
    await drawLine(page, { startDelta: { x: -100, y: 0 }, endDelta: { x: 100, y: 0 } });
    
    const shapes = await page.evaluate(() => {
      return window.animatorState.shapes.map(s => s.type);
    });
    
    expect(shapes).toEqual(["rectangle", "rectangle", "line"]);
  });

  test("can draw with pen tool over existing shapes", async ({ page }) => {
    await loadApp(page);
    
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    
    // Draw a rectangle first
    await drawRectangle(page, { offsetX: -50, offsetY: -40, width: 100, height: 80 });
    
    // Draw with pen over the rectangle
    await page.click('[data-tool="free"]');
    const rect = await page.evaluate(() => {
      const canvas = document.getElementById('stage');
      return canvas.getBoundingClientRect();
    });
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    await pointerDrag(page, centerX - 20, centerY - 10, centerX + 20, centerY + 10, { steps: 5 });
    
    const shapes = await page.evaluate(() => {
      return window.animatorState.shapes.map(s => s.type);
    });
    
    expect(shapes).toEqual(["rectangle", "free"]);
  });

  test("select tool still selects existing shapes instead of drawing", async ({ page }) => {
    await loadApp(page);
    
    // Draw a rectangle
    await drawRectangle(page, { offsetX: -50, offsetY: -40, width: 100, height: 80 });
    
    // Switch to select tool and click on the rectangle
    await page.click('[data-tool="select"]');
    const rect = await page.evaluate(() => {
      const canvas = document.getElementById('stage');
      return canvas.getBoundingClientRect();
    });
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    await page.mouse.click(centerX, centerY);
    
    // Should still have only 1 shape (the rectangle)
    const shapeCount = await page.evaluate(() => window.animatorState.shapes.length);
    expect(shapeCount).toBe(1);
    
    // The rectangle should be selected
    const selectedCount = await page.evaluate(() => window.animatorState.selectedIds.size);
    expect(selectedCount).toBe(1);
  });
});
