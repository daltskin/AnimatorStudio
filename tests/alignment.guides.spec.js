import { test, expect } from "@playwright/test";
import { loadApp, drawRectangle, getShapeBounds } from "./utils.js";

test.describe("Alignment guides", () => {
  test("show vertical and horizontal guides when moving shape with CTRL held", async ({ page }) => {
    await page.goto("http://localhost:4173");
    await page.waitForSelector("canvas");

    const canvas = page.locator("canvas");
    const canvasBox = await canvas.boundingBox();

    // Draw first shape (reference)
    await page.click('[data-tool="rectangle"]');
    await drawRectangle(page, canvas, {
      offsetX: canvasBox.x + 100,
      offsetY: canvasBox.y + 100,
      width: 80,
      height: 60
    });

    // Deselect
    await page.mouse.click(canvasBox.x + 50, canvasBox.y + 50);

    // Draw second shape (will be moved)
    await page.click('[data-tool="rectangle"]');
    await drawRectangle(page, canvas, {
      offsetX: canvasBox.x + 250,
      offsetY: canvasBox.y + 100,
      width: 80,
      height: 60
    });

    // Verify both shapes exist
    const shapeCount = await page.evaluate(() => window.animatorState.shapes.length);
    expect(shapeCount).toBe(2);

    // Get the position of the second shape
    const shape2 = await page.evaluate(() => {
      const shapes = window.animatorState.shapes;
      return { x: shapes[1].live.x, y: shapes[1].live.y };
    });

    // Click on second shape to select it
    await page.mouse.click(
      canvasBox.x + shape2.x + 40,
      canvasBox.y + shape2.y + 30
    );

    // Hold CTRL first
    await page.keyboard.down("Control");
    
    // Verify CTRL is registered
    const ctrlPressed = await page.evaluate(() => window.animatorState.modifiers.ctrl);
    console.log("CTRL pressed:", ctrlPressed);

    // Start dragging
    await page.mouse.down();

    // Move towards first shape (should trigger alignment)
    await page.mouse.move(
      canvasBox.x + shape2.x - 100,
      canvasBox.y + shape2.y,
      { steps: 10 }
    );

    // Wait a bit for guides to update
    await page.waitForTimeout(200);

    // Check if guides are present while moving
    const guidesWhileMoving = await page.evaluate(() => {
      const guides = window.animatorState.alignmentGuides;
      const modifiers = window.animatorState.modifiers;
      const mode = window.animatorState.pointer.mode;
      return {
        vertical: guides.vertical.length,
        horizontal: guides.horizontal.length,
        ctrl: modifiers.ctrl,
        mode: mode
      };
    });

    console.log("Guides while moving:", guidesWhileMoving);

    // Should have at least horizontal alignment guide (top edges should align)
    expect(guidesWhileMoving.horizontal).toBeGreaterThan(0);

    // Release mouse and CTRL
    await page.mouse.up();
    await page.keyboard.up("Control");
  });

  test("no guides appear when CTRL is not held", async ({ page }) => {
    await loadApp(page);

    // Draw two rectangles
    await drawRectangle(page, { offsetX: -200, offsetY: 0, width: 120, height: 80 });
    await page.waitForTimeout(100);
    
    await page.mouse.click(100, 100);
    await page.waitForTimeout(50);
    
    await drawRectangle(page, { offsetX: 100, offsetY: 0, width: 120, height: 80 });
    await page.waitForTimeout(100);

    // Get position of second rectangle
    const pos = await page.evaluate(() => {
      const shape = window.animatorState.shapes[1];
      return { x: shape.live.x + 60, y: shape.live.y + 40 };
    });

    // Click on second rectangle to select it
    await page.mouse.click(pos.x, pos.y);
    await page.waitForTimeout(100);

    // Start dragging WITHOUT CTRL
    await page.mouse.move(pos.x, pos.y);
    await page.mouse.down();
    await page.mouse.move(pos.x - 100, pos.y, { steps: 5 });
    await page.waitForTimeout(200);

    // Check that NO alignment guides appear
    const guides = await page.evaluate(() => {
      return {
        vertical: window.animatorState.alignmentGuides.vertical.length,
        horizontal: window.animatorState.alignmentGuides.horizontal.length,
      };
    });

    expect(guides.vertical).toBe(0);
    expect(guides.horizontal).toBe(0);

    await page.mouse.up();
  });

  test("guides align centers, edges when shapes are close", async ({ page }) => {
    await loadApp(page);

    // Draw reference rectangle (offset left)
    await drawRectangle(page, { offsetX: -150, offsetY: 0, width: 100, height: 80 });
    await page.waitForTimeout(100);

    // Click on canvas to deselect
    await page.mouse.click(100, 100);
    await page.waitForTimeout(50);

    // Draw second rectangle (offset right)
    await drawRectangle(page, { offsetX: 150, offsetY: 0, width: 100, height: 80 });
    await page.waitForTimeout(100);

    // Get positions of both rectangles
    const positions = await page.evaluate(() => {
      const shapes = window.animatorState.shapes;
      return {
        first: { x: shapes[0].live.x, y: shapes[0].live.y, width: shapes[0].live.width, height: shapes[0].live.height },
        second: { x: shapes[1].live.x, y: shapes[1].live.y, width: shapes[1].live.width, height: shapes[1].live.height },
      };
    });

    // Click on second rectangle to select it
    const secondCenterX = positions.second.x + positions.second.width / 2;
    const secondCenterY = positions.second.y + positions.second.height / 2;
    await page.mouse.click(secondCenterX, secondCenterY);
    await page.waitForTimeout(100);

    await page.keyboard.down("Control");
    await page.mouse.move(secondCenterX, secondCenterY);
    await page.mouse.down();
    
    // Move towards first rectangle to trigger alignment
    const firstCenterX = positions.first.x + positions.first.width / 2;
    await page.mouse.move(firstCenterX + 3, secondCenterY, { steps: 15 });
    await page.waitForTimeout(300);

    const guides = await page.evaluate(() => {
      return {
        vertical: window.animatorState.alignmentGuides.vertical.length,
        horizontal: window.animatorState.alignmentGuides.horizontal.length,
        verticalValues: window.animatorState.alignmentGuides.vertical,
        horizontalValues: window.animatorState.alignmentGuides.horizontal,
      };
    });

    // Should have alignment guides when close to reference shape
    const hasGuides = guides.vertical > 0 || guides.horizontal > 0;
    expect(hasGuides).toBe(true);

    await page.mouse.up();
    await page.keyboard.up("Control");
  });
});
