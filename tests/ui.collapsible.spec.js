import { test, expect } from "@playwright/test";

test.describe("Collapsible UI Elements", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:4173");
    await page.waitForSelector("#stage");
  });

  test("toolbar collapses and shows floating toggle button", async ({ page }) => {
    const toolbar = page.locator(".toolbar");
    const floatingToggle = page.locator(".floating-toolbar-menu .toolbar-toggle-floating");

    // Toolbar should be visible initially
    await expect(toolbar).toBeVisible();
    await expect(floatingToggle).not.toBeVisible();

    // Click toolbar toggle to collapse
    await page.locator(".toolbar .toolbar-toggle").first().click();
    await page.waitForTimeout(400);

    // Toolbar should be hidden, floating toggle visible
    await expect(toolbar).not.toBeVisible();
    await expect(floatingToggle).toBeVisible();

    // Click floating toggle to restore
    await floatingToggle.click();
    await page.waitForTimeout(400);

    await expect(toolbar).toBeVisible();
    await expect(floatingToggle).not.toBeVisible();
  });

  test("toolbar collapse state persists across page reload", async ({ page }) => {
    // Collapse toolbar
    await page.locator(".toolbar .toolbar-toggle").first().click();
    await page.waitForTimeout(400);

    const floatingToggle = page.locator(".floating-toolbar-menu .toolbar-toggle-floating");
    await expect(floatingToggle).toBeVisible();

    // Reload page
    await page.reload();
    await page.waitForSelector("#stage");

    // Should remain collapsed
    await expect(floatingToggle).toBeVisible();
    await expect(page.locator(".toolbar")).not.toBeVisible();
  });

  test("tool menu collapses to single button", async ({ page }) => {
    const toolMenu = page.locator(".floating-tool-menu");
    const toolMenuToggle = page.locator("[data-tool-menu-toggle]");

    // Tool menu should show all tools initially
    await expect(toolMenu).toBeVisible();
    await expect(page.locator(".tool-button[data-tool='rectangle']")).toBeVisible();

    // Collapse tool menu
    await toolMenuToggle.click();
    await page.waitForTimeout(200);

    // Tools should be hidden
    await expect(page.locator(".tool-button[data-tool='rectangle']")).not.toBeVisible();
    await expect(toolMenuToggle).toBeVisible();

    // Expand again
    await toolMenuToggle.click();
    await page.waitForTimeout(200);

    await expect(page.locator(".tool-button[data-tool='rectangle']")).toBeVisible();
  });

  test("timeline collapses and shows floating toggle button at bottom", async ({ page }) => {
    const timeline = page.locator(".timeline");
    const floatingTimelineToggle = page.locator(".floating-timeline-menu .timeline-toggle-floating");

    // Timeline visible initially
    await expect(timeline).toBeVisible();
    await expect(floatingTimelineToggle).not.toBeVisible();

    // Collapse timeline
    await page.locator(".timeline .timeline-toggle").click();
    await page.waitForTimeout(400);

    // Timeline hidden, floating toggle visible
    await expect(timeline).not.toBeVisible();
    await expect(floatingTimelineToggle).toBeVisible();

    // Restore timeline
    await floatingTimelineToggle.click();
    await page.waitForTimeout(400);

    await expect(timeline).toBeVisible();
    await expect(floatingTimelineToggle).not.toBeVisible();
  });

  test("all three floating buttons have consistent styling", async ({ page }) => {
    // Collapse all UI elements
    await page.locator(".toolbar .toolbar-toggle").first().click();
    await page.locator("[data-tool-menu-toggle]").click();
    await page.locator(".timeline .timeline-toggle").click();
    await page.waitForTimeout(500);

    const toolMenuToggle = page.locator("[data-tool-menu-toggle]");
    const toolbarToggle = page.locator(".floating-toolbar-menu .toolbar-toggle-floating");
    const timelineToggle = page.locator(".floating-timeline-menu .timeline-toggle-floating");

    // All should be visible
    await expect(toolMenuToggle).toBeVisible();
    await expect(toolbarToggle).toBeVisible();
    await expect(timelineToggle).toBeVisible();

    // Check they all have similar dimensions (circular buttons)
    const toolMenuBox = await toolMenuToggle.boundingBox();
    const toolbarBox = await toolbarToggle.boundingBox();
    const timelineBox = await timelineToggle.boundingBox();

    expect(toolMenuBox.width).toBeCloseTo(toolbarBox.width, 5);
    expect(toolMenuBox.height).toBeCloseTo(toolbarBox.height, 5);
    expect(toolMenuBox.width).toBeCloseTo(timelineBox.width, 5);
  });

  test("floating menus overlap canvas instead of pushing it", async ({ page }) => {
    const canvas = page.locator("#stage");
    const initialBox = await canvas.boundingBox();

    // Expand tool menu (if collapsed)
    const toolMenuState = await page.locator(".floating-tool-menu").getAttribute("data-collapsed");
    if (toolMenuState === "true") {
      await page.locator("[data-tool-menu-toggle]").click();
      await page.waitForTimeout(200);
    }

    const expandedBox = await canvas.boundingBox();

    // Canvas position should not change when menu expands
    expect(expandedBox.y).toBe(initialBox.y);
    expect(expandedBox.height).toBe(initialBox.height);
  });

  test("collapsing UI elements gives more canvas space", async ({ page }) => {
    const stageArea = page.locator(".stage-area");
    const initialBox = await stageArea.boundingBox();

    // Collapse toolbar
    await page.locator(".toolbar .toolbar-toggle").first().click();
    await page.waitForTimeout(400);

    const collapsedBox = await stageArea.boundingBox();

    // Stage area should get wider when toolbar collapses
    expect(collapsedBox.width).toBeGreaterThan(initialBox.width);
  });

  test("buttons have consistent hover effects", async ({ page }) => {
    // Get various buttons
    const toolButton = page.locator(".tool-button[data-tool='rectangle']");
    const ghostButton = page.locator("button.ghost").first();
    
    // Hover over tool button
    await toolButton.hover();
    await page.waitForTimeout(100);

    // Visual regression would be ideal here, but checking they don't throw errors
    const toolButtonStyle = await toolButton.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        background: computed.background,
        transform: computed.transform,
      };
    });

    expect(toolButtonStyle.transform).not.toBe("none");
  });
});
