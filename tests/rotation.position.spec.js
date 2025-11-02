const { test, expect } = require('@playwright/test');
const {
  loadApp,
  drawRectangle,
  rotateSelectionFromHandle,
} = require('./utils');

test.describe('Rotation preserves position', () => {
  test('rotating a shape multiple times maintains its center position', async ({ page }) => {
    await loadApp(page);
    
    // Draw a rectangle
    await drawRectangle(page, { width: 100, height: 100 });
    
    // Get initial position
    const initial = await page.evaluate(() => {
      const shape = window.animatorState.shapes[0];
      return {
        x: shape.live.x,
        y: shape.live.y,
        centerX: shape.live.x + shape.live.width / 2,
        centerY: shape.live.y + shape.live.height / 2,
        rotation: shape.live.rotation || 0,
      };
    });
    
    // Rotate once
    await rotateSelectionFromHandle(page, { sweepDegrees: 45, radius: 120 });
    
    const afterFirstRotation = await page.evaluate(() => {
      const shape = window.animatorState.shapes[0];
      return {
        x: shape.live.x,
        y: shape.live.y,
        centerX: shape.live.x + shape.live.width / 2,
        centerY: shape.live.y + shape.live.height / 2,
        rotation: shape.live.rotation || 0,
      };
    });
    
    // Center should remain the same
    expect(afterFirstRotation.centerX).toBeCloseTo(initial.centerX, 1);
    expect(afterFirstRotation.centerY).toBeCloseTo(initial.centerY, 1);
    
    // Rotation should have changed
    expect(Math.abs(afterFirstRotation.rotation - initial.rotation)).toBeGreaterThan(0.1);
    
    // Rotate again
    await rotateSelectionFromHandle(page, { sweepDegrees: 45, radius: 120 });
    
    const afterSecondRotation = await page.evaluate(() => {
      const shape = window.animatorState.shapes[0];
      return {
        x: shape.live.x,
        y: shape.live.y,
        centerX: shape.live.x + shape.live.width / 2,
        centerY: shape.live.y + shape.live.height / 2,
        rotation: shape.live.rotation || 0,
      };
    });
    
    // Center should still remain the same as initial
    expect(afterSecondRotation.centerX).toBeCloseTo(initial.centerX, 1);
    expect(afterSecondRotation.centerY).toBeCloseTo(initial.centerY, 1);
    
    // Center should be the same as after first rotation
    expect(afterSecondRotation.centerX).toBeCloseTo(afterFirstRotation.centerX, 1);
    expect(afterSecondRotation.centerY).toBeCloseTo(afterFirstRotation.centerY, 1);
    
    // Rotation should have increased
    expect(Math.abs(afterSecondRotation.rotation - afterFirstRotation.rotation)).toBeGreaterThan(0.1);
  });

  test('rotating an image shape multiple times maintains its center position', async ({ page }) => {
    await loadApp(page);
    
    // Create an image shape
    await page.evaluate(() => {
      const state = window.animatorState;
      const testDataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      const img = new Image();
      img.src = testDataURL;
      
      const shape = {
        id: window.shapeIdCounter++,
        type: "image",
        style: {
          fill: "#ff6b6b",
          stroke: "#1f2937",
          strokeWidth: 3,
          opacity: 1,
          rotation: 0,
        },
        live: {
          x: 300,
          y: 200,
          width: 200,
          height: 100,
          rotation: 0,
        },
        keyframes: [],
        birthTime: state.timeline.current || 0,
        isVisible: true,
        asset: {
          source: testDataURL,
          image: img,
        },
      };
      
      state.shapes.push(shape);
      state.selectedIds = new Set([shape.id]);
      state.selection = shape;
    });
    
    await page.waitForTimeout(100);
    
    // Get initial position
    const initial = await page.evaluate(() => {
      const shape = window.animatorState.shapes[0];
      return {
        x: shape.live.x,
        y: shape.live.y,
        centerX: shape.live.x + shape.live.width / 2,
        centerY: shape.live.y + shape.live.height / 2,
        rotation: shape.live.rotation || 0,
      };
    });
    
    console.log('Initial:', initial);
    
    // Rotate once
    await rotateSelectionFromHandle(page, { sweepDegrees: 45, radius: 120 });
    
    const afterFirstRotation = await page.evaluate(() => {
      const shape = window.animatorState.shapes[0];
      return {
        x: shape.live.x,
        y: shape.live.y,
        centerX: shape.live.x + shape.live.width / 2,
        centerY: shape.live.y + shape.live.height / 2,
        rotation: shape.live.rotation || 0,
      };
    });
    
    console.log('After first rotation:', afterFirstRotation);
    
    // Center should remain the same
    expect(afterFirstRotation.centerX).toBeCloseTo(initial.centerX, 1);
    expect(afterFirstRotation.centerY).toBeCloseTo(initial.centerY, 1);
    
    // Rotation should have changed
    expect(Math.abs(afterFirstRotation.rotation - initial.rotation)).toBeGreaterThan(0.1);
    
    // Rotate again
    await rotateSelectionFromHandle(page, { sweepDegrees: 45, radius: 120 });
    
    const afterSecondRotation = await page.evaluate(() => {
      const shape = window.animatorState.shapes[0];
      return {
        x: shape.live.x,
        y: shape.live.y,
        centerX: shape.live.x + shape.live.width / 2,
        centerY: shape.live.y + shape.live.height / 2,
        rotation: shape.live.rotation || 0,
      };
    });
    
    console.log('After second rotation:', afterSecondRotation);
    
    // Center should still remain the same as initial
    expect(afterSecondRotation.centerX).toBeCloseTo(initial.centerX, 1);
    expect(afterSecondRotation.centerY).toBeCloseTo(initial.centerY, 1);
    
    // Center should be the same as after first rotation
    expect(afterSecondRotation.centerX).toBeCloseTo(afterFirstRotation.centerX, 1);
    expect(afterSecondRotation.centerY).toBeCloseTo(afterFirstRotation.centerY, 1);
    
    // Rotation should have increased
    expect(Math.abs(afterSecondRotation.rotation - afterFirstRotation.rotation)).toBeGreaterThan(0.1);
  });
});
