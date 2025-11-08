import { test, expect, devices } from "@playwright/test";

test.describe("Mobile Responsive Design", () => {
  test("toolbar auto-collapses on mobile viewport", async ({ browser }) => {
    const mobileContext = await browser.newContext({
      ...devices['iPhone 12'],
    });
    const page = await mobileContext.newPage();
    
    await page.goto("http://localhost:4173");
    await page.waitForSelector("#stage");

    const toolbar = page.locator(".toolbar");
    const appShell = page.locator(".app-shell");

    // On mobile, toolbar should be static positioned (not floating)
    const toolbarStyle = await toolbar.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return computed.position;
    });

    expect(toolbarStyle).toBe("static");
    await mobileContext.close();
  });

  test("floating menus are touch-friendly on mobile", async ({ browser }) => {
    const mobileContext = await browser.newContext({
      ...devices['iPhone 12'],
    });
    const page = await mobileContext.newPage();
    
    await page.goto("http://localhost:4173");
    await page.waitForSelector("#stage");

    // Tool buttons should meet minimum touch target size (44px)
    const toolButton = page.locator(".tool-button[data-tool='rectangle']");
    const box = await toolButton.boundingBox();

    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);

    await mobileContext.close();
  });

  test("tablet viewport shows proper layout", async ({ browser }) => {
    const tabletContext = await browser.newContext({
      ...devices['iPad (gen 7)'],
    });
    const page = await tabletContext.newPage();
    
    await page.goto("http://localhost:4173");
    await page.waitForSelector("#stage");

    const stageArea = page.locator(".stage-area");
    await expect(stageArea).toBeVisible();

    // Canvas should be visible and centered
    const canvas = page.locator("#stage");
    await expect(canvas).toBeVisible();

    await tabletContext.close();
  });

  test("landscape mobile optimizes layout", async ({ browser }) => {
    const landscapeContext = await browser.newContext({
      viewport: { width: 812, height: 375 }, // iPhone 12 landscape
    });
    const page = await landscapeContext.newPage();
    
    await page.goto("http://localhost:4173");
    await page.waitForSelector("#stage");

    const workspace = page.locator(".workspace");
    const workspaceStyle = await workspace.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return computed.display;
    });

    // Landscape should use flex layout
    expect(workspaceStyle).toContain("flex");

    await landscapeContext.close();
  });

  test("zoom controls don't overlap timeline toggle on mobile", async ({ browser }) => {
    const mobileContext = await browser.newContext({
      ...devices['iPhone 12'],
    });
    const page = await mobileContext.newPage();
    
    await page.goto("http://localhost:4173");
    await page.waitForSelector("#stage");

    // Collapse timeline to show floating button
    await page.locator(".timeline .timeline-toggle").click();
    await page.waitForTimeout(400);

    const timelineToggle = page.locator(".floating-timeline-menu");
    const zoomControls = page.locator(".zoom-controls");

    const timelineBox = await timelineToggle.boundingBox();
    const zoomBox = await zoomControls.boundingBox();

    // Ensure no overlap
    const timelineBottom = timelineBox.y + timelineBox.height;
    const zoomTop = zoomBox.y;

    expect(zoomTop).toBeGreaterThan(timelineBottom);

    await mobileContext.close();
  });

  test("touch targets are properly sized", async ({ browser }) => {
    const mobileContext = await browser.newContext({
      ...devices['iPhone 12'],
      hasTouch: true,
    });
    const page = await mobileContext.newPage();
    
    await page.goto("http://localhost:4173");
    await page.waitForSelector("#stage");

    // Collapse toolbar to show toggle
    await page.locator(".toolbar .toolbar-toggle").first().click();
    await page.waitForTimeout(400);

    const floatingToggle = page.locator(".floating-toolbar-menu .toolbar-toggle-floating");
    const box = await floatingToggle.boundingBox();

    // Should meet 44x44 minimum touch target
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);

    await mobileContext.close();
  });

  test("small screen stacks timeline controls", async ({ browser }) => {
    const smallContext = await browser.newContext({
      viewport: { width: 375, height: 667 }, // iPhone SE
    });
    const page = await smallContext.newPage();
    
    await page.goto("http://localhost:4173");
    await page.waitForSelector("#stage");

    const timelineInfo = page.locator(".timeline-info");

    // Timeline info should wrap on small screens
    const infoStyle = await timelineInfo.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return computed.flexWrap;
    });

    expect(infoStyle).toBe("wrap");

    await smallContext.close();
  });

  test("canvas remains functional on mobile", async ({ browser }) => {
    const mobileContext = await browser.newContext({
      ...devices['iPhone 12'],
      hasTouch: true,
    });
    const page = await mobileContext.newPage();
    
    await page.goto("http://localhost:4173");
    await page.waitForSelector("#stage");

    // Select rectangle tool
    await page.locator(".tool-button[data-tool='rectangle']").tap();

    // Draw a rectangle with touch
    const canvas = page.locator("#stage");
    const canvasBox = await canvas.boundingBox();
    
    const startX = canvasBox.x + 100;
    const startY = canvasBox.y + 100;
    const endX = canvasBox.x + 200;
    const endY = canvasBox.y + 200;

    await page.touchscreen.touchStart(startX, startY);
    await page.waitForTimeout(50);
    await page.touchscreen.touchMove(endX, endY);
    await page.waitForTimeout(50);
    await page.touchscreen.touchEnd();

    // Check if shape was created
    const shapeCount = await page.evaluate(() => {
      return window.state?.shapes?.length || 0;
    });

    expect(shapeCount).toBeGreaterThan(0);

    await mobileContext.close();
  });
});
