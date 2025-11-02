const { test, expect } = require('@playwright/test');
const {
  loadApp,
  setTool,
  drawRectangle,
  dispatchPointerEvent,
  resizeShapeFromHandle,
} = require('./utils');

test.describe('SHIFT+Resize maintains aspect ratio', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('Rectangle with SHIFT maintains aspect ratio', async ({ page }) => {
    // Create a rectangle with 2:1 aspect ratio
    await drawRectangle(page, { width: 200, height: 100 });

    // Get initial dimensions
    const initialShape = await page.evaluate(() => {
      const state = window.animatorState;
      return state.shapes[state.shapes.length - 1].live;
    });
    const initialAspect = initialShape.width / initialShape.height;

    // Resize with SHIFT held - use SE handle to drag outward
    await resizeShapeFromHandle(page, { 
      deltaX: 100, 
      deltaY: 50,
      shiftKey: true 
    });

    // Get final dimensions
    const finalShape = await page.evaluate(() => {
      const state = window.animatorState;
      return state.shapes[state.shapes.length - 1].live;
    });
    const finalAspect = finalShape.width / finalShape.height;

    // Aspect ratio should be maintained (within tolerance)
    expect(Math.abs(finalAspect - initialAspect)).toBeLessThan(0.01);
  });

  test('Rectangle without SHIFT allows free resize', async ({ page }) => {
    // Create a rectangle with 2:1 aspect ratio
    await drawRectangle(page, { width: 200, height: 100 });

    // Get initial dimensions
    const initialShape = await page.evaluate(() => {
      const state = window.animatorState;
      return state.shapes[state.shapes.length - 1].live;
    });
    const initialAspect = initialShape.width / initialShape.height;

    // Get the SE handle position and manually drag it asymmetrically
    const handleInfo = await page.evaluate(() => {
      const state = window.animatorState;
      const shape = state.shapes[state.shapes.length - 1];
      const canvas = document.getElementById('stage');
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.left + shape.live.x + shape.live.width,
        y: rect.top + shape.live.y + shape.live.height,
      };
    });

    // Drag handle more in Y direction than X to change aspect ratio
    await dispatchPointerEvent(page, 'pointerdown', handleInfo.x, handleInfo.y);
    await dispatchPointerEvent(page, 'pointermove', handleInfo.x + 20, handleInfo.y + 100);
    await dispatchPointerEvent(page, 'pointerup', handleInfo.x + 20, handleInfo.y + 100);

    // Get final dimensions
    const finalShape = await page.evaluate(() => {
      const state = window.animatorState;
      return state.shapes[state.shapes.length - 1].live;
    });
    const finalAspect = finalShape.width / finalShape.height;

    // Aspect ratio should change (should be less than initial, closer to square)
    expect(finalAspect).toBeLessThan(initialAspect * 0.9);
  });

  test('Image with SHIFT maintains aspect ratio', async ({ page }) => {
    // Create an image shape directly by simulating a paste
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
      
      // Properly update selection using the window function
      if (typeof window.updateSelection === 'function') {
        window.updateSelection(shape);
      } else {
        state.selectedIds = new Set([shape.id]);
        state.selection = shape;
      }
    });

    await page.waitForTimeout(200);

    // Get initial dimensions
    const initialShape = await page.evaluate(() => {
      const state = window.animatorState;
      return state.shapes[state.shapes.length - 1].live;
    });
    const initialAspect = initialShape.width / initialShape.height;

    // Resize with SHIFT held
    await resizeShapeFromHandle(page, { 
      deltaX: 80, 
      deltaY: 40,
      shiftKey: true 
    });

    // Get final dimensions
    const finalShape = await page.evaluate(() => {
      const state = window.animatorState;
      return state.shapes[state.shapes.length - 1].live;
    });
    const finalAspect = finalShape.width / finalShape.height;

    // Aspect ratio should be maintained
    expect(Math.abs(finalAspect - initialAspect)).toBeLessThan(0.01);
  });

  test('Square maintains 1:1 regardless of SHIFT', async ({ page }) => {
    // Create a square
    await setTool(page, 'square');
    await drawRectangle(page, { width: 150, height: 150 });

    // Resize WITHOUT SHIFT - should still maintain 1:1
    await resizeShapeFromHandle(page, { 
      deltaX: 100, 
      deltaY: 50,
      shiftKey: false 
    });

    const finalShape = await page.evaluate(() => {
      const state = window.animatorState;
      return state.shapes[state.shapes.length - 1].live;
    });

    // Square should always be 1:1
    expect(Math.abs(finalShape.width - finalShape.height)).toBeLessThan(0.1);
  });

  test('Grouped shapes with SHIFT maintain aspect ratio', async ({ page }) => {
    // Create two rectangles
    await drawRectangle(page, { offsetX: -100, width: 100, height: 50 });
    await drawRectangle(page, { offsetX: 100, width: 100, height: 50 });

    // Select both shapes and group them
    await page.evaluate(() => {
      const state = window.animatorState;
      const allIds = state.shapes.map(s => s.id);
      state.selectedIds = new Set(allIds);
    });

    // Group the shapes via keyboard shortcut
    await page.keyboard.press('Control+g');
    await page.waitForTimeout(100);

    // Get initial group bounds by computing from all selected shapes
    const initialBounds = await page.evaluate(() => {
      const state = window.animatorState;
      const selectedShapes = Array.from(state.selectedIds)
        .map(id => state.shapes.find(s => s.id === id))
        .filter(Boolean);
      
      if (selectedShapes.length === 0) throw new Error('No shapes selected');
      
      const minX = Math.min(...selectedShapes.map(s => s.live.x));
      const minY = Math.min(...selectedShapes.map(s => s.live.y));
      const maxX = Math.max(...selectedShapes.map(s => s.live.x + s.live.width));
      const maxY = Math.max(...selectedShapes.map(s => s.live.y + s.live.height));
      
      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      };
    });
    const initialAspect = initialBounds.width / initialBounds.height;

    // Resize group with SHIFT
    await resizeShapeFromHandle(page, { 
      deltaX: 100, 
      deltaY: 50,
      shiftKey: true 
    });

    // Get final group bounds
    const finalBounds = await page.evaluate(() => {
      const state = window.animatorState;
      const selectedShapes = Array.from(state.selectedIds)
        .map(id => state.shapes.find(s => s.id === id))
        .filter(Boolean);
      
      const minX = Math.min(...selectedShapes.map(s => s.live.x));
      const minY = Math.min(...selectedShapes.map(s => s.live.y));
      const maxX = Math.max(...selectedShapes.map(s => s.live.x + s.live.width));
      const maxY = Math.max(...selectedShapes.map(s => s.live.y + s.live.height));
      
      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      };
    });
    const finalAspect = finalBounds.width / finalBounds.height;

    // Aspect ratio should be maintained
    expect(Math.abs(finalAspect - initialAspect)).toBeLessThan(0.01);
  });
});
