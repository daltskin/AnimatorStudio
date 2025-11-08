import { test, expect } from "@playwright/test";

test.describe("Shape labels", () => {
  test("double-clicking a rectangle shows label editor", async ({ page }) => {
    await page.goto("http://localhost:4173");
    await page.waitForSelector("#stage");

    // Select rectangle tool
    await page.click('[data-tool="rectangle"]');

    // Draw a rectangle
    const canvas = await page.$("#stage");
    const box = await canvas.boundingBox();
    const x = box.x + 200;
    const y = box.y + 200;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 100, y + 80);
    await page.mouse.up();

    // Switch to select tool
    await page.click('[data-tool="select"]');

    // Double-click the rectangle
    await page.mouse.dblclick(x + 50, y + 40);

    // Verify label editor appears
    const labelEditor = await page.waitForSelector(".canvas-label-editor", { timeout: 2000 });
    expect(labelEditor).toBeTruthy();
  });

  test("label editor accepts text input", async ({ page }) => {
    await page.goto("http://localhost:4173");
    await page.waitForSelector("#stage");

    // Select circle tool
    await page.click('[data-tool="circle"]');

    // Draw a circle
    const canvas = await page.$("#stage");
    const box = await canvas.boundingBox();
    const x = box.x + 300;
    const y = box.y + 300;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 80, y + 80);
    await page.mouse.up();

    // Switch to select tool
    await page.click('[data-tool="select"]');

    // Double-click the circle
    await page.mouse.dblclick(x + 40, y + 40);

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
    await page.goto("http://localhost:4173");
    await page.waitForSelector("#stage");

    // Select diamond tool
    await page.click('[data-tool="diamond"]');

    // Draw a diamond
    const canvas = await page.$("#stage");
    const box = await canvas.boundingBox();
    const x = box.x + 400;
    const y = box.y + 200;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 100, y + 100);
    await page.mouse.up();

    // Switch to select tool
    await page.click('[data-tool="select"]');

    // Double-click the diamond
    await page.mouse.dblclick(x + 50, y + 50);

    // Type in the label editor
    const labelEditor = await page.waitForSelector(".canvas-label-editor");
    await labelEditor.type("Diamond");
    await page.keyboard.press("Enter");

    // Verify the shape has a label property
    const shapeData = await page.evaluate(() => {
      return window.animatorApi.getShapes()[0];
    });

    expect(shapeData.label).toBe("Diamond");
  });

  test("labels are preserved in exports", async ({ page }) => {
    await page.goto("http://localhost:4173");
    await page.waitForSelector("#stage");

    // Draw a rectangle with a label
    await page.click('[data-tool="rectangle"]');
    const canvas = await page.$("#stage");
    const box = await canvas.boundingBox();
    const x = box.x + 200;
    const y = box.y + 200;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 100, y + 80);
    await page.mouse.up();

    await page.click('[data-tool="select"]');
    await page.mouse.dblclick(x + 50, y + 40);

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
    await page.goto("http://localhost:4173");
    await page.waitForSelector("#stage");

    // Select text tool
    await page.click('[data-tool="text"]');

    // Create a text shape
    const canvas = await page.$("#stage");
    const box = await canvas.boundingBox();
    const x = box.x + 200;
    const y = box.y + 200;

    await page.mouse.click(x, y);

    // There should be a text editor, not a label editor
    const textEditor = await page.waitForSelector(".canvas-text-editor", { timeout: 2000 });
    expect(textEditor).toBeTruthy();

    const labelEditor = await page.$(".canvas-label-editor");
    expect(labelEditor).toBeNull();
  });

  test("labels work on line shapes", async ({ page }) => {
    await page.goto("http://localhost:4173");
    await page.waitForSelector("#stage");

    // Draw a line
    await page.click('[data-tool="line"]');
    const canvas = await page.$("#stage");
    const box = await canvas.boundingBox();
    const x = box.x + 200;
    const y = box.y + 200;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 150, y + 100);
    await page.mouse.up();

    // Switch to select tool and double-click the line
    await page.click('[data-tool="select"]');
    await page.mouse.dblclick(x + 75, y + 50);

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
