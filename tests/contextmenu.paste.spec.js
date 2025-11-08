const { test, expect } = require('@playwright/test');
const { loadApp, setTool, drawRectangle } = require('./utils');

test.describe('Context menu paste', () => {
  test.beforeEach(async ({ context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('stage context menu has paste button', async ({ page }) => {
    await loadApp(page);

    // Ensure nothing is selected
    await page.evaluate(() => window.animatorState.selectedIds.clear());

    // Right-click on empty area of the stage using mouse events
    const canvas = page.locator('canvas');
    const canvasBox = await canvas.boundingBox();
    const rightClickX = canvasBox.x + 100;
    const rightClickY = canvasBox.y + 100;
    
    // Try dispatching contextmenu event directly
    await page.evaluate(({ x, y }) => {
      const canvas = document.getElementById('stage');
      const rect = canvas.getBoundingClientRect();
      const contextEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 2,
        buttons: 2
      });
      canvas.dispatchEvent(contextEvent);
    }, { x: rightClickX, y: rightClickY });

    // Check if any context menu appeared
    const contextMenus = await page.evaluate(() => {
      const stage = document.getElementById('stageContextMenu');
      const shape = document.getElementById('shapeContextMenu');
      return {
        stageHidden: stage?.hidden,
        stageExists: !!stage,
        shapeHidden: shape?.hidden,
        shapeExists: !!shape,
        stageDisplay: stage?.style.display,
        shapeDisplay: shape?.style.display
      };
    });
    console.log('Context menu status:', contextMenus);

    // Wait for context menu to appear
    await page.waitForSelector('#stageContextMenu:not([hidden])', { timeout: 1000 });

    // Check that paste button exists
    const pasteButton = page.locator('#stageContextMenu button[data-stage-action="paste"]');

    await expect(pasteButton).toBeVisible();
    await expect(pasteButton).toContainText('Paste');
  });

  test('stage context menu paste button pastes Mermaid as single image', async ({ page }) => {
    await loadApp(page);

    const mermaidCode = `graph TD
    A[Start] --> B[End]`;

    // Set clipboard text
    await page.evaluate((code) => {
      return navigator.clipboard.writeText(code);
    }, mermaidCode);

    // Right-click on the stage
    const canvas = page.locator('canvas');
    await canvas.click({ button: 'right', position: { x: 400, y: 300 } });

    // Wait for context menu to appear
    await page.waitForSelector('#stageContextMenu:not([hidden])', { timeout: 1000 });

    // Click the paste button
    const pasteButton = page.locator('#stageContextMenu button[data-stage-action="paste"]');
    await pasteButton.click();

    // Wait for Mermaid to render
    await page.waitForTimeout(3000);

    // Check that one image shape was created
    const shapeCount = await page.evaluate(() => {
      return window.animatorState.shapes.length;
    });

    expect(shapeCount).toBe(1);

    const shapeType = await page.evaluate(() => {
      return window.animatorState.shapes[0]?.type || null;
    });

    expect(shapeType).toBe('image');
  });

  test('stage context menu paste works with copied shapes', async ({ page }) => {
    await loadApp(page);

    // Draw a rectangle
    await setTool(page, 'rectangle');
    await drawRectangle(page);

    // Verify one shape exists
    let shapeCount = await page.evaluate(() => {
      return window.animatorState.shapes.length;
    });
    expect(shapeCount).toBe(1);

    // Shape should already be selected after drawing
    // Copy it (Ctrl+C)
    await page.keyboard.press('Control+c');

    await page.waitForTimeout(200);

    // Click elsewhere to deselect
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 100, y: 100 } });
    
    await page.waitForTimeout(200);

    // Right-click on empty area
    await canvas.click({ button: 'right', position: { x: 100, y: 100 } });

    // Wait for context menu
    await page.waitForSelector('#stageContextMenu:not([hidden])', { timeout: 2000 });

    // Click paste
    const pasteButton = page.locator('#stageContextMenu button[data-stage-action="paste"]');
    await pasteButton.click();

    await page.waitForTimeout(500);

    // Should have 2 shapes now
    shapeCount = await page.evaluate(() => {
      return window.animatorState.shapes.length;
    });

    expect(shapeCount).toBe(2);
  });

  test('stage context menu closes after paste', async ({ page }) => {
    await loadApp(page);

    // Set some text in clipboard
    await page.evaluate(() => {
      return navigator.clipboard.writeText('test');
    });

    // Right-click on the stage
    const canvas = page.locator('canvas');
    await canvas.click({ button: 'right', position: { x: 400, y: 300 } });

    // Wait for context menu to appear
    await page.waitForSelector('#stageContextMenu:not([hidden])', { timeout: 1000 });

    // Click paste button
    const pasteButton = page.locator('#stageContextMenu button[data-stage-action="paste"]');
    await pasteButton.click();

    // Context menu should be hidden
    const menu = page.locator('#stageContextMenu');
    await expect(menu).toBeHidden();
  });

  test('context menu has visual separator between paste and background options', async ({ page }) => {
    await loadApp(page);

    // Right-click on the stage
    const canvas = page.locator('canvas');
    await canvas.click({ button: 'right', position: { x: 400, y: 300 } });

    // Wait for context menu to appear
    await page.waitForSelector('#stageContextMenu:not([hidden])', { timeout: 1000 });

    // Check that divider exists
    const divider = page.locator('#stageContextMenu .context-menu__divider');
    await expect(divider).toBeVisible();
  });
});
