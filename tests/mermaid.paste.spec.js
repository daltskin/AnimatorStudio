const { test, expect } = require('@playwright/test');
const { loadApp, ensureSelectionCount } = require('./utils');

test.describe('Mermaid diagram paste', () => {
  test('pasting flowchart Mermaid syntax creates an image shape', async ({ page }) => {
    await loadApp(page);

    const mermaidCode = `graph TD
    A[Start] --> B{Is it?}
    B -->|Yes| C[OK]
    B -->|No| D[End]`;

    await page.evaluate((code) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', code);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(pasteEvent);
    }, mermaidCode);

    // Wait for the async Mermaid rendering and shape creation + image load
    await page.waitForTimeout(3000);

    const shapeCount = await page.evaluate(() => {
      return window.animatorState.shapes.length;
    });

    expect(shapeCount).toBe(1);

    const shapeType = await page.evaluate(() => {
      return window.animatorState.shapes[0]?.type || null;
    });

    expect(shapeType).toBe('image');
  });

  test('pasting sequence diagram Mermaid syntax creates an image shape', async ({ page }) => {
    await loadApp(page);

    const mermaidCode = `sequenceDiagram
    Alice->>Bob: Hello Bob, how are you?
    Bob-->>Alice: Great!`;

    await page.evaluate((code) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', code);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(pasteEvent);
    }, mermaidCode);

    // Wait for the async Mermaid rendering and shape creation + image load
    await page.waitForTimeout(3000);

    const shapeCount = await page.evaluate(() => {
      return window.animatorState.shapes.length;
    });

    expect(shapeCount).toBe(1);

    const shapeType = await page.evaluate(() => {
      return window.animatorState.shapes[0]?.type || null;
    });

    expect(shapeType).toBe('image');
  });

  test('pasting class diagram Mermaid syntax creates an image shape', async ({ page }) => {
    await loadApp(page);

    const mermaidCode = `classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal : +int age
    Animal : +String gender`;

    await page.evaluate((code) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', code);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(pasteEvent);
    }, mermaidCode);

    // Wait for the async Mermaid rendering and shape creation + image load
    await page.waitForTimeout(3000);

    const shapeCount = await page.evaluate(() => {
      return window.animatorState.shapes.length;
    });

    expect(shapeCount).toBe(1);

    const shapeType = await page.evaluate(() => {
      return window.animatorState.shapes[0]?.type || null;
    });

    expect(shapeType).toBe('image');
  });

  test('pasting non-Mermaid text does not create shapes', async ({ page }) => {
    await loadApp(page);

    const plainText = 'This is just regular text, not a Mermaid diagram';

    await page.evaluate((code) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', code);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(pasteEvent);
    }, plainText);

    await page.waitForTimeout(500);

    const shapeCount = await page.evaluate(() => {
      return window.animatorState.shapes.length;
    });

    expect(shapeCount).toBe(0);
  });

  test('pasting pie chart Mermaid syntax creates an image shape', async ({ page }) => {
    await loadApp(page);

    const mermaidCode = `pie title Pets adopted by volunteers
    "Dogs" : 386
    "Cats" : 85
    "Rats" : 15`;

    await page.evaluate((code) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', code);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(pasteEvent);
    }, mermaidCode);

    await page.waitForTimeout(3000);

    const shapeCount = await page.evaluate(() => {
      return window.animatorState.shapes.length;
    });

    expect(shapeCount).toBe(1);

    const shapeType = await page.evaluate(() => {
      return window.animatorState.shapes[0]?.type || null;
    });

    expect(shapeType).toBe('image');
  });

  test('pasting state diagram Mermaid syntax creates an image shape', async ({ page }) => {
    await loadApp(page);

    const mermaidCode = `stateDiagram-v2
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]`;

    await page.evaluate((code) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', code);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(pasteEvent);
    }, mermaidCode);

    await page.waitForTimeout(3000);

    const shapeCount = await page.evaluate(() => {
      return window.animatorState.shapes.length;
    });

    expect(shapeCount).toBe(1);

    const shapeType = await page.evaluate(() => {
      return window.animatorState.shapes[0]?.type || null;
    });

    expect(shapeType).toBe('image');
  });

  test('pasting ER diagram Mermaid syntax creates an image shape', async ({ page }) => {
    await loadApp(page);

    const mermaidCode = `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses`;

    await page.evaluate((code) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', code);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(pasteEvent);
    }, mermaidCode);

    await page.waitForTimeout(3000);

    const shapeCount = await page.evaluate(() => {
      return window.animatorState.shapes.length;
    });

    expect(shapeCount).toBe(1);

    const shapeType = await page.evaluate(() => {
      return window.animatorState.shapes[0]?.type || null;
    });

    expect(shapeType).toBe('image');
  });

  test('pasting Gantt chart Mermaid syntax creates an image shape', async ({ page }) => {
    await loadApp(page);

    const mermaidCode = `gantt
    title A Gantt Diagram
    dateFormat YYYY-MM-DD
    section Section
    A task :a1, 2024-01-01, 30d
    Another task :after a1, 20d`;

    await page.evaluate((code) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', code);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(pasteEvent);
    }, mermaidCode);

    await page.waitForTimeout(3000);

    const shapeCount = await page.evaluate(() => {
      return window.animatorState.shapes.length;
    });

    expect(shapeCount).toBe(1);

    const shapeType = await page.evaluate(() => {
      return window.animatorState.shapes[0]?.type || null;
    });

    expect(shapeType).toBe('image');
  });

  test('multiple Mermaid pastes create multiple image shapes', async ({ page }) => {
    await loadApp(page);

    const mermaidCode1 = `graph LR
    A --> B`;

    const mermaidCode2 = `pie title Fruits
    "Apples" : 42
    "Oranges" : 58`;

    // Paste first diagram
    await page.evaluate((code) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', code);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(pasteEvent);
    }, mermaidCode1);

    await page.waitForTimeout(3000);

    // Paste second diagram
    await page.evaluate((code) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', code);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(pasteEvent);
    }, mermaidCode2);

    await page.waitForTimeout(3000);

    const shapeCount = await page.evaluate(() => {
      return window.animatorState.shapes.length;
    });

    expect(shapeCount).toBe(2);

    const shapeTypes = await page.evaluate(() => {
      return window.animatorState.shapes.map(s => s.type);
    });

    expect(shapeTypes).toEqual(['image', 'image']);
  });

  test('Mermaid image shape has keyframes and can be selected', async ({ page }) => {
    await loadApp(page);

    const mermaidCode = `graph TD
    A[Test] --> B[Node]`;

    await page.evaluate((code) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', code);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(pasteEvent);
    }, mermaidCode);

    await page.waitForTimeout(3000);

    const shapeInfo = await page.evaluate(() => {
      const shape = window.animatorState.shapes[0];
      return {
        hasKeyframes: Array.isArray(shape?.keyframes),
        keyframeCount: shape?.keyframes?.length || 0,
        isVisible: shape?.isVisible,
        hasAsset: !!shape?.asset?.source,
        type: shape?.type
      };
    });

    expect(shapeInfo.type).toBe('image');
    expect(shapeInfo.hasKeyframes).toBe(true);
    expect(shapeInfo.keyframeCount).toBeGreaterThanOrEqual(1);
    expect(shapeInfo.isVisible).toBe(true);
    expect(shapeInfo.hasAsset).toBe(true);
  });

  test('pasting flowchart with LR direction creates an image shape', async ({ page }) => {
    await loadApp(page);

    const mermaidCode = `flowchart LR
    A[Client] --> B[Load Balancer]
    B --> C[Server1]
    B --> D[Server2]`;

    await page.evaluate((code) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', code);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(pasteEvent);
    }, mermaidCode);

    await page.waitForTimeout(3000);

    const shapeCount = await page.evaluate(() => {
      return window.animatorState.shapes.length;
    });

    expect(shapeCount).toBe(1);

    const shapeType = await page.evaluate(() => {
      return window.animatorState.shapes[0]?.type || null;
    });

    expect(shapeType).toBe('image');
  });
});
