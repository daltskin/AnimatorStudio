const { test, expect } = require("@playwright/test");
const { loadApp } = require("./utils");

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test.describe("Excalidraw image paste", () => {
  test("pasting Excalidraw JSON with image elements creates image shapes", async ({ page }) => {
    await loadApp(page);

    // Create an Excalidraw payload with an image element referencing a file
    const smallBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const excalidrawPayload = {
      type: "excalidraw/clipboard",
      elements: [
        {
          id: "image-1",
          type: "image",
          x: 100,
          y: 100,
          width: 200,
          height: 150,
          angle: 0,
          strokeColor: "transparent",
          backgroundColor: "#a5d8ff",
          fillStyle: "solid",
          strokeWidth: 2,
          opacity: 100,
          fileId: "test-file-id-1"
        }
      ],
      files: {
        "test-file-id-1": {
          mimeType: "image/png",
          id: "test-file-id-1",
          dataURL: `data:image/png;base64,${smallBase64}`,
          created: Date.now()
        }
      }
    };

    const clipboardText = JSON.stringify(excalidrawPayload);
    
    await page.evaluate((data) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', data);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(pasteEvent);
    }, clipboardText);

    await page.waitForTimeout(1000);

    // Should create 1 image shape
    const shapeCount = await page.evaluate(() => window.animatorState.shapes.length);
    expect(shapeCount).toBe(1);

    const shape = await page.evaluate(() => window.animatorState.shapes[0]);
    expect(shape.type).toBe("image");
    expect(shape.asset).toBeDefined();
    expect(shape.asset.source).toContain("data:image/png;base64,");
  });

  test("pasting Excalidraw JSON with multiple image elements creates multiple image shapes", async ({ page }) => {
    await loadApp(page);

    const smallBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const excalidrawPayload = {
      type: "excalidraw/clipboard",
      elements: [
        {
          id: "rect-1",
          type: "rectangle",
          x: 50,
          y: 50,
          width: 100,
          height: 80,
          angle: 0,
          strokeColor: "#1971c2",
          backgroundColor: "#ffec99",
          fillStyle: "solid",
          strokeWidth: 2,
          opacity: 100
        },
        {
          id: "image-1",
          type: "image",
          x: 200,
          y: 100,
          width: 150,
          height: 120,
          angle: 0,
          strokeColor: "transparent",
          backgroundColor: "#a5d8ff",
          fillStyle: "solid",
          strokeWidth: 2,
          opacity: 100,
          fileId: "file-1"
        },
        {
          id: "image-2",
          type: "image",
          x: 400,
          y: 100,
          width: 150,
          height: 120,
          angle: 0,
          strokeColor: "transparent",
          backgroundColor: "#ffc9c9",
          fillStyle: "solid",
          strokeWidth: 2,
          opacity: 50,
          fileId: "file-2"
        }
      ],
      files: {
        "file-1": {
          mimeType: "image/png",
          id: "file-1",
          dataURL: `data:image/png;base64,${smallBase64}`,
          created: Date.now()
        },
        "file-2": {
          mimeType: "image/png",
          id: "file-2",
          dataURL: `data:image/png;base64,${smallBase64}`,
          created: Date.now()
        }
      }
    };

    const clipboardText = JSON.stringify(excalidrawPayload);
    
    await page.evaluate((data) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', data);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(pasteEvent);
    }, clipboardText);

    await page.waitForTimeout(1000);

    // Should create 3 shapes: 1 rectangle + 2 images
    const shapeCount = await page.evaluate(() => window.animatorState.shapes.length);
    expect(shapeCount).toBe(3);

    const shapes = await page.evaluate(() => window.animatorState.shapes);
    const types = shapes.map(s => s.type);
    expect(types).toEqual(['rectangle', 'image', 'image']);
    
    // Verify images have data sources
    const images = shapes.filter(s => s.type === 'image');
    images.forEach(img => {
      expect(img.asset).toBeDefined();
      expect(img.asset.source).toContain("data:image/png;base64,");
    });
  });

  test("pasting Excalidraw JSON with image having custom opacity applies it correctly", async ({ page }) => {
    await loadApp(page);

    const smallBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const excalidrawPayload = {
      type: "excalidraw/clipboard",
      elements: [
        {
          id: "image-1",
          type: "image",
          x: 100,
          y: 100,
          width: 200,
          height: 150,
          angle: 0,
          strokeColor: "transparent",
          backgroundColor: "#a5d8ff",
          fillStyle: "solid",
          strokeWidth: 2,
          opacity: 50, // 50% opacity
          fileId: "test-file-id-1"
        }
      ],
      files: {
        "test-file-id-1": {
          mimeType: "image/png",
          id: "test-file-id-1",
          dataURL: `data:image/png;base64,${smallBase64}`,
          created: Date.now()
        }
      }
    };

    const clipboardText = JSON.stringify(excalidrawPayload);
    
    await page.evaluate((data) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', data);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(pasteEvent);
    }, clipboardText);

    await page.waitForTimeout(1000);

    const shape = await page.evaluate(() => window.animatorState.shapes[0]);
    expect(shape.type).toBe("image");
    expect(shape.style.opacity).toBe(0.5); // 50/100 = 0.5
  });

  test("pasting Excalidraw JSON with image elements without fileId is ignored", async ({ page }) => {
    await loadApp(page);

    const excalidrawPayload = {
      type: "excalidraw/clipboard",
      elements: [
        {
          id: "rect-1",
          type: "rectangle",
          x: 50,
          y: 50,
          width: 100,
          height: 80,
          angle: 0,
          strokeColor: "#1971c2",
          backgroundColor: "#ffec99",
          fillStyle: "solid",
          strokeWidth: 2,
          opacity: 100
        },
        {
          id: "image-1",
          type: "image",
          x: 200,
          y: 100,
          width: 150,
          height: 120,
          angle: 0,
          strokeColor: "transparent",
          backgroundColor: "#a5d8ff",
          fillStyle: "solid",
          strokeWidth: 2,
          opacity: 100
          // No fileId - should be ignored
        }
      ],
      files: {}
    };

    const clipboardText = JSON.stringify(excalidrawPayload);
    
    await page.evaluate((data) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', data);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(pasteEvent);
    }, clipboardText);

    await page.waitForTimeout(1000);

    // Should only create the rectangle, not the image without fileId
    const shapeCount = await page.evaluate(() => window.animatorState.shapes.length);
    expect(shapeCount).toBe(1);

    const shape = await page.evaluate(() => window.animatorState.shapes[0]);
    expect(shape.type).toBe("rectangle");
  });

  test("pasting Excalidraw JSON with mixed shapes and images preserves creation order", async ({ page }) => {
    await loadApp(page);

    const smallBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const excalidrawPayload = {
      type: "excalidraw/clipboard",
      elements: [
        {
          id: "rect-1",
          type: "rectangle",
          x: 50,
          y: 50,
          width: 100,
          height: 80,
          angle: 0,
          strokeColor: "#1971c2",
          backgroundColor: "#ffec99",
          fillStyle: "solid",
          strokeWidth: 2,
          opacity: 100
        },
        {
          id: "image-1",
          type: "image",
          x: 200,
          y: 100,
          width: 150,
          height: 120,
          angle: 0,
          opacity: 100,
          fileId: "file-1"
        },
        {
          id: "ellipse-1",
          type: "ellipse",
          x: 400,
          y: 50,
          width: 120,
          height: 80,
          angle: 0,
          strokeColor: "#e03131",
          backgroundColor: "#ffc9c9",
          fillStyle: "solid",
          strokeWidth: 2,
          opacity: 100
        },
        {
          id: "text-1",
          type: "text",
          x: 50,
          y: 200,
          width: 200,
          height: 40,
          angle: 0,
          strokeColor: "#1971c2",
          backgroundColor: "transparent",
          opacity: 100,
          text: "Test Text",
          fontSize: 20
        }
      ],
      files: {
        "file-1": {
          mimeType: "image/png",
          id: "file-1",
          dataURL: `data:image/png;base64,${smallBase64}`,
          created: Date.now()
        }
      }
    };

    const clipboardText = JSON.stringify(excalidrawPayload);
    
    await page.evaluate((data) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', data);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(pasteEvent);
    }, clipboardText);

    await page.waitForTimeout(1000);

    const shapes = await page.evaluate(() => window.animatorState.shapes);
    expect(shapes.length).toBe(4);

    // Verify the order is preserved: rectangle, image, circle (from ellipse), text
    const types = shapes.map(s => s.type);
    expect(types).toEqual(['rectangle', 'image', 'circle', 'text']);
  });
});
