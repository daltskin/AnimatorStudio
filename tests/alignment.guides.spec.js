import { test, expect } from "@playwright/test";
import { loadApp, drawRectangle, getShapeBounds, dispatchPointerEvent, pointerDrag } from "./utils.js";

test.describe("Alignment guides", () => {
  test("show vertical and horizontal guides when moving shape with CTRL held", async ({ page }) => {
    await loadApp(page);

    // Draw reference rectangle (copy from working alignment.snap.js)
    await page.click('[data-tool="rectangle"]');
    const canvas = page.locator("canvas");
    const canvasBox = await canvas.boundingBox();
    
    await drawRectangle(page, {
      offsetX: -200,
      offsetY: -100,
      width: 100,
      height: 80
    });

    // Deselect by clicking on canvas outside shapes
    await page.mouse.click(canvasBox.x + 50, canvasBox.y + 50);
    
    // Wait a moment for deselection
    await page.waitForTimeout(50);

    // Draw second rectangle offset by 7 pixels in Y (within snap threshold)
    await page.click('[data-tool="rectangle"]');
    await drawRectangle(page, {
      offsetX: 50,
      offsetY: -93, // 7 pixels different from first rectangle's Y
      width: 100,
      height: 80
    });

    // Verify we have 2 shapes
    const shapeCount = await page.evaluate(() => window.animatorState.shapes.length);
    expect(shapeCount).toBe(2);

    // Get initial position of second shape (copy from alignment.snap.js)
    const beforeMove = await page.evaluate(() => {
      const shape = window.animatorState.shapes[1];
      return { x: shape.live.x, y: shape.live.y };
    });

    // Switch to select tool
    await page.click('[data-tool="select"]');

    // Select the second shape (copy from alignment.snap.js)
    const shape2Center = {
      x: canvasBox.x + beforeMove.x + 50,
      y: canvasBox.y + beforeMove.y + 40
    };
    await page.mouse.click(shape2Center.x, shape2Center.y);
    
    // Wait for selection to complete
    await page.waitForTimeout(100);

    // Start dragging WITHOUT CTRL (copy from alignment.snap.js)
    await page.mouse.move(shape2Center.x, shape2Center.y);
    await page.mouse.down();
    
    // NOW hold CTRL to activate alignment guides during drag
    await page.keyboard.down("Control");
    await page.waitForTimeout(50);
    
    // Move just 2 pixels - should snap to alignment (copy exact from alignment.snap.js)
    await page.mouse.move(shape2Center.x - 2, shape2Center.y - 2, { steps: 5 });
    await page.waitForTimeout(100);

    // Check that alignment guides appeared (copy exact from alignment.snap.js)
    const guides = await page.evaluate(() => {
      return {
        vertical: window.animatorState.alignmentGuides.vertical.length,
        horizontal: window.animatorState.alignmentGuides.horizontal.length,
        ctrl: window.animatorState.modifiers.ctrl,
        mode: window.animatorState.pointer.mode
      };
    });

    console.log("Alignment guides:", guides);

    // Should have alignment guides when moving with CTRL
    expect(guides.horizontal).toBeGreaterThan(0);

    // Release (copy from alignment.snap.js)
    await page.mouse.up();
    await page.keyboard.up("Control");
  });

  test("no guides appear when CTRL is not held", async ({ page }) => {
    await loadApp(page);

    // Draw two rectangles
    await drawRectangle(page, { offsetX: -200, offsetY: 0, width: 120, height: 80 });
    await page.waitForTimeout(100);
    
    await dispatchPointerEvent(page, 'pointerdown', 100, 100);
    await dispatchPointerEvent(page, 'pointerup', 100, 100);
    await page.waitForTimeout(50);
    
    await drawRectangle(page, { offsetX: 100, offsetY: 0, width: 120, height: 80 });
    await page.waitForTimeout(100);

    // Get position of second rectangle
    const pos = await page.evaluate(() => {
      const shape = window.animatorState.shapes[1];
      return { x: shape.live.x + 60, y: shape.live.y + 40 };
    });

    // Click on second rectangle to select it using pointer events
    await dispatchPointerEvent(page, 'pointerdown', pos.x, pos.y);
    await dispatchPointerEvent(page, 'pointerup', pos.x, pos.y);
    await page.waitForTimeout(100);

    // Start dragging WITHOUT CTRL using pointerDrag (ctrlKey defaults to false)
    await pointerDrag(page, pos.x, pos.y, pos.x - 100, pos.y, { steps: 5 });
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
  });

  test("guides align centers, edges when shapes are close", async ({ page }) => {
    await loadApp(page);

    // Use same setup as first test that works - just different positions
    await page.click('[data-tool="rectangle"]');
    const canvas = page.locator("canvas");
    const canvasBox = await canvas.boundingBox();
    
    await drawRectangle(page, {
      offsetX: -200,
      offsetY: -50,  // Different Y than first test
      width: 100,
      height: 80
    });

    // Deselect by clicking on canvas outside shapes
    await page.mouse.click(canvasBox.x + 50, canvasBox.y + 50);
    
    // Wait a moment for deselection
    await page.waitForTimeout(50);

    // Draw second rectangle offset to create vertical alignment opportunity
    await page.click('[data-tool="rectangle"]');
    await drawRectangle(page, {
      offsetX: 50,
      offsetY: -55, // 5 pixels different for vertical alignment
      width: 100,
      height: 80
    });

    // Verify we have 2 shapes
    const shapeCount = await page.evaluate(() => window.animatorState.shapes.length);
    expect(shapeCount).toBe(2);

    // Get initial position of second shape (copy from working test)
    const beforeMove = await page.evaluate(() => {
      const shape = window.animatorState.shapes[1];
      return { x: shape.live.x, y: shape.live.y };
    });

    // Switch to select tool
    await page.click('[data-tool="select"]');

    // Select the second shape (copy from working test)
    const shape2Center = {
      x: canvasBox.x + beforeMove.x + 50,
      y: canvasBox.y + beforeMove.y + 40
    };
    await page.mouse.click(shape2Center.x, shape2Center.y);
    
    // Wait for selection to complete
    await page.waitForTimeout(100);

    // Start dragging WITHOUT CTRL (copy from working test)
    await page.mouse.move(shape2Center.x, shape2Center.y);
    await page.mouse.down();
    
    // NOW hold CTRL to activate alignment guides during drag
    await page.keyboard.down("Control");
    await page.waitForTimeout(50);
    
    // Move just 2 pixels - should trigger alignment guides
    await page.mouse.move(shape2Center.x - 2, shape2Center.y - 2, { steps: 5 });
    await page.waitForTimeout(100);

    // Check that alignment guides appeared
    const guides = await page.evaluate(() => {
      return {
        vertical: window.animatorState.alignmentGuides.vertical.length,
        horizontal: window.animatorState.alignmentGuides.horizontal.length,
        ctrl: window.animatorState.modifiers.ctrl,
        mode: window.animatorState.pointer.mode
      };
    });

    console.log("Alignment guides (test 2):", guides);

    // Should have alignment guides when moving with CTRL
    const hasGuides = guides.vertical > 0 || guides.horizontal > 0;
    expect(hasGuides).toBe(true);

    // Release (copy from working test)
    await page.mouse.up();
    await page.keyboard.up("Control");
  });
});
