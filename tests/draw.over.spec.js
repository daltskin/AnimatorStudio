const { test, expect } = require("@playwright/test");
const { loadApp } = require("./utils.js");

test.describe("Drawing over shapes", () => {
  test("can draw a rectangle on top of an existing rectangle", async ({ page }) => {
    await loadApp(page);
    
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    
    // Draw first rectangle
    await page.click('[data-tool="rectangle"]');
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 180);
    await page.mouse.up();
    
    // Verify first rectangle exists
    let shapeCount = await page.evaluate(() => window.animatorState.shapes.length);
    expect(shapeCount).toBe(1);
    
    // Draw second rectangle overlapping the first
    await page.click('[data-tool="rectangle"]');
    await page.mouse.move(box.x + 150, box.y + 120); // Over the first rectangle
    await page.mouse.down();
    await page.mouse.move(box.x + 250, box.y + 200);
    await page.mouse.up();
    
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
    
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    
    // Draw a rectangle first
    await page.click('[data-tool="rectangle"]');
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 180);
    await page.mouse.up();
    
    // Draw a circle on top
    await page.click('[data-tool="circle"]');
    await page.mouse.move(box.x + 140, box.y + 130); // Inside the rectangle
    await page.mouse.down();
    await page.mouse.move(box.x + 180, box.y + 170);
    await page.mouse.up();
    
    const shapes = await page.evaluate(() => {
      return window.animatorState.shapes.map(s => s.type);
    });
    
    expect(shapes).toEqual(["rectangle", "circle"]);
  });

  test("can draw a line through existing shapes", async ({ page }) => {
    await loadApp(page);
    
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    
    // Draw two rectangles
    await page.click('[data-tool="rectangle"]');
    await page.mouse.move(box.x + 80, box.y + 80);
    await page.mouse.down();
    await page.mouse.move(box.x + 150, box.y + 150);
    await page.mouse.up();
    
    await page.click('[data-tool="rectangle"]');
    await page.mouse.move(box.x + 200, box.y + 80);
    await page.mouse.down();
    await page.mouse.move(box.x + 270, box.y + 150);
    await page.mouse.up();
    
    // Draw a line that goes through both rectangles
    await page.click('[data-tool="line"]');
    await page.mouse.move(box.x + 100, box.y + 100); // Inside first rectangle
    await page.mouse.down();
    await page.mouse.move(box.x + 250, box.y + 130); // Inside second rectangle
    await page.mouse.up();
    
    const shapes = await page.evaluate(() => {
      return window.animatorState.shapes.map(s => s.type);
    });
    
    expect(shapes).toEqual(["rectangle", "rectangle", "line"]);
  });

  test("can draw with pen tool over existing shapes", async ({ page }) => {
    await loadApp(page);
    
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    
    // Draw a rectangle
    await page.click('[data-tool="rectangle"]');
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 180);
    await page.mouse.up();
    
    // Draw with pen over the rectangle
    await page.click('[data-tool="free"]');
    await page.mouse.move(box.x + 120, box.y + 120);
    await page.mouse.down();
    await page.mouse.move(box.x + 140, box.y + 130, { steps: 3 });
    await page.mouse.move(box.x + 160, box.y + 140, { steps: 3 });
    await page.mouse.up();
    
    const shapes = await page.evaluate(() => {
      return window.animatorState.shapes.map(s => s.type);
    });
    
    expect(shapes).toEqual(["rectangle", "free"]);
  });

  test("select tool still selects existing shapes instead of drawing", async ({ page }) => {
    await loadApp(page);
    
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    
    // Draw a rectangle
    await page.click('[data-tool="rectangle"]');
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 180);
    await page.mouse.up();
    
    // Switch to select tool and click on the rectangle
    await page.click('[data-tool="select"]');
    await page.mouse.click(box.x + 150, box.y + 140);
    
    // Should still have only 1 shape (the rectangle)
    const shapeCount = await page.evaluate(() => window.animatorState.shapes.length);
    expect(shapeCount).toBe(1);
    
    // The rectangle should be selected
    const selectedCount = await page.evaluate(() => window.animatorState.selectedIds.size);
    expect(selectedCount).toBe(1);
  });
});
