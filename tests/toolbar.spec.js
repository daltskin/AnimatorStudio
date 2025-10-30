const { test, expect } = require('@playwright/test');
const {
  loadApp,
  dispatchPointerEvent,
  pointerDrag,
  getCanvasRect,
  getCanvasCenter,
  setTimelineTime,
  setTool,
  drawRectangle,
  drawDiamond,
  drawLine,
  createTextShape,
  ensureShapeCount,
  ensureSelectionCount,
  getSelectedShapeSnapshot,
  getShapeSnapshot,
  getShapeBounds,
  getSelectionClientCenter,
  resizeShapeFromHandle,
  getRotationHandleInfo,
  rotateSelectionFromHandle,
  pressShortcut,
} = require('./utils');

const DUMMY_IMAGE_SRC =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

async function waitForClipboardItems(page, count) {
  await expect.poll(() => page.evaluate(() => window.animatorState.clipboard?.items?.length ?? 0)).toBe(count);
}

test.describe('Toolbar interactions', () => {
  test('toolbar toggle hides controls and updates button state', async ({ page }) => {
    await loadApp(page);

    const toggles = page.locator('[data-toolbar-toggle]');
    const inlineToggle = toggles.nth(0);
    const floatingToggle = page.locator('.toolbar-toggle-floating');
    const toolbar = page.locator('.toolbar');
    const shell = page.locator('.app-shell');

    await expect(inlineToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(inlineToggle).toHaveAttribute('aria-label', /Hide the toolbar/i);
    await expect(toolbar).toBeVisible();
    await expect(shell).not.toHaveClass(/toolbar-collapsed/);

    await inlineToggle.click();

    await expect(inlineToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(inlineToggle).toHaveAttribute('aria-label', /Show the toolbar/i);
    await expect(toolbar).toBeHidden();
    await expect(shell).toHaveClass(/toolbar-collapsed/);
    await expect(floatingToggle).toBeVisible();
    await expect(floatingToggle).toHaveAttribute('aria-label', /Show the toolbar/i);

    await floatingToggle.click();

    await expect(inlineToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(inlineToggle).toHaveAttribute('aria-label', /Hide the toolbar/i);
    await expect(toolbar).toBeVisible();
    await expect(shell).not.toHaveClass(/toolbar-collapsed/);
    await expect(floatingToggle).not.toBeVisible();
  });

  test('toolbar collapse preference persists across reloads', async ({ page }) => {
    await loadApp(page);

    const inlineToggle = page.locator('.toolbar [data-toolbar-toggle]');
    const shell = page.locator('.app-shell');

    await inlineToggle.click();
    await expect(shell).toHaveClass(/toolbar-collapsed/);

    await loadApp(page);

    await expect(shell).toHaveClass(/toolbar-collapsed/);
    await expect(inlineToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(inlineToggle).toHaveAttribute('aria-label', /Show the toolbar/i);
    await expect(page.locator('.toolbar-toggle-floating')).toBeVisible();
  });

  test('floating tool menu toggle collapses the menu', async ({ page }) => {
    await loadApp(page);

    const toggle = page.locator('[data-tool-menu-toggle]');
    const wrapper = page.locator('.canvas-wrapper');
    const menu = page.locator('.floating-tool-menu');

    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(toggle).toHaveAttribute('aria-label', /Hide canvas tools/i);
    await expect(wrapper).not.toHaveClass(/tool-menu-collapsed/);
  await expect(menu).toHaveAttribute('data-collapsed', 'false');

    await toggle.click();

    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toHaveAttribute('aria-label', /Show canvas tools/i);
    await expect(wrapper).toHaveClass(/tool-menu-collapsed/);
  await expect(menu).toHaveAttribute('data-collapsed', 'true');
  });

  test('floating tool menu collapse preference persists across reloads', async ({ page }) => {
    await loadApp(page);

    const toggle = page.locator('[data-tool-menu-toggle]');
    const wrapper = page.locator('.canvas-wrapper');
    const menu = page.locator('.floating-tool-menu');

    await toggle.click();
    await expect(wrapper).toHaveClass(/tool-menu-collapsed/);
  await expect(menu).toHaveAttribute('data-collapsed', 'true');

    await loadApp(page);

    await expect(wrapper).toHaveClass(/tool-menu-collapsed/);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toHaveAttribute('aria-label', /Show canvas tools/i);
  await expect(menu).toHaveAttribute('data-collapsed', 'true');
  });

  test('stroke style controls update selection and defaults', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page);
    await ensureSelectionCount(page, 1);

    const dashedButton = page.locator('[data-stroke-style="dashed"]');
    const dottedButton = page.locator('[data-stroke-style="dotted"]');

    await dashedButton.click();

    await expect(dashedButton).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.evaluate(() => window.animatorState.selection?.style?.strokeStyle)).toBe('dashed');
    await expect.poll(() => page.evaluate(() => window.animatorState.style.strokeStyle)).toBe('dashed');

    await dottedButton.click();

    await expect(dottedButton).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.evaluate(() => window.animatorState.selection?.style?.strokeStyle)).toBe('dotted');
    await expect.poll(() => page.evaluate(() => window.animatorState.style.strokeStyle)).toBe('dotted');
  });

  test('irrelevant controls hide when switching tools', async ({ page }) => {
    await loadApp(page);

    const fillStyleControl = page.locator('#fillStyleControl');
    const edgeStyleControl = page.locator('#edgeStyleControl');
    const sketchControl = page.locator('#sketchControl');
    const fontControl = page.locator('label:has(#fontFamily)');

    await expect(fillStyleControl).toBeVisible();
    await expect(edgeStyleControl).toBeVisible();
    await expect(sketchControl).toBeVisible();
    await expect(fontControl).toBeHidden();

    await setTool(page, 'line');

    await expect(fillStyleControl).toBeHidden();
    await expect(edgeStyleControl).toBeHidden();
    await expect(sketchControl).toBeHidden();
    await expect(fontControl).toBeHidden();

    await setTool(page, 'text');

    await expect(fontControl).toBeVisible();
    await expect(fillStyleControl).toBeHidden();
    await expect(edgeStyleControl).toBeHidden();
    await expect(sketchControl).toBeVisible();

    await setTool(page, 'rectangle');

    await expect(fillStyleControl).toBeVisible();
    await expect(edgeStyleControl).toBeVisible();
    await expect(sketchControl).toBeVisible();
    await expect(fontControl).toBeHidden();
  });

  test('clicking a tool highlights it and deselects others', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');

    const activeLocator = page.locator('.tool-button.selected');
    await expect(activeLocator).toHaveCount(1);
    await expect(activeLocator).toHaveAttribute('data-tool', 'rectangle');

    const buttons = page.locator('.tool-button[data-tool]');
    const total = await buttons.count();
    expect(total).toBeGreaterThan(0);
    for (let index = 0; index < total; index += 1) {
      const button = buttons.nth(index);
      const tool = await button.getAttribute('data-tool');
      const ariaPressed = await button.getAttribute('aria-pressed');
      if (tool === 'rectangle') {
        expect(ariaPressed).toBe('true');
      } else {
        await expect(button).not.toHaveClass(/selected/);
        expect(ariaPressed === 'false' || ariaPressed === null).toBe(true);
      }
    }
  });

  test('pen tool expands stroke width range', async ({ page }) => {
    await loadApp(page);

    const slider = page.locator('#strokeWidth');

    await expect(slider).toHaveAttribute('min', '1');
    await expect(slider).toHaveAttribute('max', '12');

    await setTool(page, 'free');

    await expect(slider).toHaveAttribute('min', '1');
    await expect(slider).toHaveAttribute('max', '24');

    await setTool(page, 'rectangle');

    await expect(slider).toHaveAttribute('min', '1');
    await expect(slider).toHaveAttribute('max', '12');
  });

  test('free draw retains 24px stroke after deselection', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'free');

    const slider = page.locator('#strokeWidth');
    await slider.evaluate((input) => {
      input.value = '24';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const center = await getCanvasCenter(page);
    await pointerDrag(page, center.x - 80, center.y, center.x + 80, center.y + 20, { steps: 12 });

    await ensureShapeCount(page, 1);

    await setTool(page, 'select');

    const canvasRect = await getCanvasRect(page);
    const offX = canvasRect.x + canvasRect.width - 10;
    const offY = canvasRect.y + canvasRect.height - 10;
    await dispatchPointerEvent(page, 'pointerdown', offX, offY);
    await dispatchPointerEvent(page, 'pointerup', offX, offY);

    await expect.poll(() => page.evaluate(() => window.animatorState.selectedIds.size)).toBe(0);
    await expect.poll(() => page.evaluate(() => window.animatorState.shapes[0]?.style.strokeWidth)).toBe(24);
  });

  test('drawing after selecting rectangle enables keyframe button', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page);

    await ensureShapeCount(page, 1);

    const addKeyframeButton = page.locator('#addKeyframe');
    await expect(addKeyframeButton).toBeEnabled();
  });

  test('newly drawn shape switches to select tool automatically', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page);

    await ensureShapeCount(page, 1);

    await expect.poll(() => page.evaluate(() => window.animatorState.tool)).toBe('select');

    const selectButton = page.locator('[data-tool="select"]');
    await expect(selectButton).toHaveAttribute('aria-pressed', 'true');
    await expect(selectButton).toHaveClass(/selected/);

    const rectangleButton = page.locator('[data-tool="rectangle"]');
    await expect(rectangleButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('freshly drawn rectangles stay selected and can rotate and resize immediately', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page);

    await ensureShapeCount(page, 1);
    await ensureSelectionCount(page, 1);

    const initialSnapshot = await getSelectedShapeSnapshot(page);
    expect(initialSnapshot).not.toBeNull();
    if (!initialSnapshot) throw new Error('Rectangle was not selected after drawing');

  const rotationInfo = await getRotationHandleInfo(page, initialSnapshot.id);
  expect(rotationInfo).not.toBeNull();
  if (!rotationInfo) throw new Error('Rotation handle unavailable for new rectangle');

  const { handle, center } = rotationInfo;
  await dispatchPointerEvent(page, 'pointerdown', handle.x, handle.y);
  await dispatchPointerEvent(page, 'pointermove', center.x - 140, center.y);
  await dispatchPointerEvent(page, 'pointerup', center.x - 140, center.y);

    await expect.poll(async () => {
      const snapshot = await getShapeSnapshot(page, initialSnapshot.id);
      if (!snapshot) return 0;
      const before = initialSnapshot.style.rotation ?? 0;
      const after = snapshot.style.rotation ?? 0;
      return Math.abs(after - before);
    }).toBeGreaterThan(1);

    const beforeBounds = await getShapeBounds(page, initialSnapshot.id);
    expect(beforeBounds).not.toBeNull();
    if (!beforeBounds) throw new Error('Missing bounds for rectangle before resize');

  await resizeShapeFromHandle(page, { shapeId: initialSnapshot.id, deltaX: 120, deltaY: 100 });

    await expect.poll(async () => (await getShapeBounds(page, initialSnapshot.id)).width).toBeGreaterThan(
      beforeBounds.width,
    );
    await expect.poll(async () => (await getShapeBounds(page, initialSnapshot.id)).height).toBeGreaterThan(
      beforeBounds.height,
    );
  });

  test('delete key removes the active selection', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page);

    await ensureShapeCount(page, 1);
    await ensureSelectionCount(page, 1);

    await page.keyboard.press('Delete');

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(0);
    await expect.poll(() => page.evaluate(() => window.animatorState.selectedIds.size)).toBe(0);
  });

  test('select tool marquee selects multiple shapes', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page, { offsetX: -180, offsetY: -120 });
    await drawRectangle(page, { offsetX: 160, offsetY: 140 });

    await ensureShapeCount(page, 2);

    await setTool(page, 'select');

    const canvasRect = await getCanvasRect(page);
    const metrics = await page.evaluate(() => {
      const shapes = window.animatorState.shapes;
      if (!Array.isArray(shapes) || shapes.length === 0) return null;
      const xs = [];
      const ys = [];
      shapes.forEach((shape) => {
        if (!shape?.live) return;
        const width = Number(shape.live.width) || 0;
        const height = Number(shape.live.height) || 0;
        const x = Number(shape.live.x) || 0;
        const y = Number(shape.live.y) || 0;
        xs.push(x, x + width);
        ys.push(y, y + height);
      });
      if (xs.length === 0 || ys.length === 0) return null;
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      };
    });

    expect(metrics).not.toBeNull();
    if (!metrics) throw new Error('Unable to compute marquee metrics');

    const padding = 24;
    const startX = canvasRect.x + metrics.minX - padding;
    const startY = canvasRect.y + metrics.minY - padding;
    const endX = canvasRect.x + metrics.maxX + padding;
    const endY = canvasRect.y + metrics.maxY + padding;

    await pointerDrag(page, startX, startY, endX, endY);

    await ensureSelectionCount(page, 2);

    // Verify multiple shapes are selected by checking the group button is enabled
    const groupButton = page.locator('#groupShapes');
    await expect(groupButton).toBeEnabled();

    await page.evaluate(() => {
      const details = Array.from(document.querySelectorAll('details.action-group')).find((node) =>
        node.querySelector('#groupShapes'),
      );
      if (details) {
        details.open = true;
      }
    });

    await groupButton.click();

    await expect.poll(() =>
      page.evaluate(() => {
        const group = window.animatorState?.activeGroup;
        if (!group) return 0;
        const ids = group.ids ? Array.from(group.ids) : [];
        return ids.length;
      }),
    ).toBe(2);

    const marqueeOverlay = page.locator('#marqueeOverlay');
    await expect(marqueeOverlay).toBeHidden();
  });

  test('shift-click adds shapes to selection', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page, { offsetX: -140, offsetY: -100 });
    await drawRectangle(page, { offsetX: 160, offsetY: 120 });

    await ensureShapeCount(page, 2);
    await ensureSelectionCount(page, 1);

    await setTool(page, 'select');

    const canvasRect = await getCanvasRect(page);
    const shapeSummaries = await page.evaluate(() =>
      window.animatorState.shapes.map((shape) => ({
        id: shape.id,
        centerX: shape.live.x + shape.live.width / 2,
        centerY: shape.live.y + shape.live.height / 2,
      })),
    );

    expect(shapeSummaries.length).toBeGreaterThanOrEqual(2);
    const [first, second] = shapeSummaries;

    // Ensure the second shape is the active selection before adding another via shift-click.
    const secondCenterX = canvasRect.x + second.centerX;
    const secondCenterY = canvasRect.y + second.centerY;
    await dispatchPointerEvent(page, 'pointerdown', secondCenterX, secondCenterY);
    await dispatchPointerEvent(page, 'pointerup', secondCenterX, secondCenterY);
    await ensureSelectionCount(page, 1);

    // Hold shift and click the first shape to add it to the selection.
    const firstCenterX = canvasRect.x + first.centerX;
    const firstCenterY = canvasRect.y + first.centerY;
    await page.keyboard.down('Shift');
    await dispatchPointerEvent(page, 'pointerdown', firstCenterX, firstCenterY, { buttons: 1, shiftKey: true });
    await expect.poll(() => page.evaluate(() => window.animatorState.selectedIds.size)).toBe(2);
    await dispatchPointerEvent(page, 'pointerup', firstCenterX, firstCenterY, { buttons: 0, shiftKey: true });
    await page.keyboard.up('Shift');

    await expect.poll(() => page.evaluate(() => window.animatorState.selectedIds.size)).toBe(2);
  });

  test('shift-click adds shapes to selection with native mouse events', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page, { offsetX: -120, offsetY: -80 });
    await drawRectangle(page, { offsetX: 140, offsetY: 110 });

    await ensureShapeCount(page, 2);
    await ensureSelectionCount(page, 1);

    await setTool(page, 'select');

    const canvasRect = await getCanvasRect(page);
    const [first, second] = await page.evaluate(() =>
      window.animatorState.shapes.map((shape) => ({
        id: shape.id,
        centerX: shape.live.x + shape.live.width / 2,
        centerY: shape.live.y + shape.live.height / 2,
      })),
    );

    const secondCenterX = canvasRect.x + second.centerX;
    const secondCenterY = canvasRect.y + second.centerY;
    await page.mouse.move(secondCenterX, secondCenterY);
    await page.mouse.down();
    await page.mouse.up();
    await ensureSelectionCount(page, 1);

    const firstCenterX = canvasRect.x + first.centerX;
    const firstCenterY = canvasRect.y + first.centerY;
    await page.keyboard.down('Shift');
    await page.mouse.move(firstCenterX, firstCenterY);
    await page.mouse.down();
    await page.mouse.up();
    await page.keyboard.up('Shift');

    await expect.poll(() => page.evaluate(() => window.animatorState.selectedIds.size)).toBe(2);
  });

  test('ctrl-click toggles shapes into selection', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page, { offsetX: -160, offsetY: -120 });
    await drawRectangle(page, { offsetX: 140, offsetY: 100 });

    await ensureShapeCount(page, 2);
    await ensureSelectionCount(page, 1);

    await setTool(page, 'select');

    const canvasRect = await getCanvasRect(page);
    const shapeSummaries = await page.evaluate(() =>
      window.animatorState.shapes.map((shape) => ({
        id: shape.id,
        centerX: shape.live.x + shape.live.width / 2,
        centerY: shape.live.y + shape.live.height / 2,
      })),
    );

    const [first, second] = shapeSummaries;
    const modifierKey = await page.evaluate(() => (/mac/i.test(navigator.platform || '') ? 'Meta' : 'Control'));

    const secondCenterX = canvasRect.x + second.centerX;
    const secondCenterY = canvasRect.y + second.centerY;
    await page.mouse.move(secondCenterX, secondCenterY);
    await page.mouse.down();
    await page.mouse.up();
    await ensureSelectionCount(page, 1);

    const firstCenterX = canvasRect.x + first.centerX;
    const firstCenterY = canvasRect.y + first.centerY;
    await page.keyboard.down(modifierKey);
    await page.mouse.move(firstCenterX, firstCenterY);
    await page.mouse.down();
    await page.mouse.up();
    await page.keyboard.up(modifierKey);

    await expect.poll(() => page.evaluate(() => window.animatorState.selectedIds.size)).toBe(2);
  });

  test('keyboard shortcuts select, group, and ungroup shapes', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page, { offsetX: -160, offsetY: -100 });
    await drawRectangle(page, { offsetX: 40, offsetY: 20 });
    await drawRectangle(page, { offsetX: 180, offsetY: 140 });

    await ensureShapeCount(page, 3);
    await ensureSelectionCount(page, 1);

    await pressShortcut(page, 'a');
    await expect.poll(() => page.evaluate(() => window.animatorState.selectedIds.size)).toBe(3);

    const groupButton = page.locator('#groupShapes');
    await expect(groupButton).toBeEnabled();

    await pressShortcut(page, 'g');
    await expect.poll(() =>
      page.evaluate(() => {
        const active = window.animatorState?.activeGroup;
        if (!active) return 0;
        const ids = active.ids instanceof Set ? Array.from(active.ids) : active.ids;
        if (Array.isArray(ids)) return ids.length;
        if (typeof active.ids?.size === 'number') return active.ids.size;
        return 0;
      }),
    ).toBe(3);

    await pressShortcut(page, 'g', { shift: true });
    await expect.poll(() => page.evaluate(() => (window.animatorState?.activeGroup ?? null))).toBeNull();
    await expect.poll(() => page.evaluate(() => window.animatorState.selectedIds.size)).toBe(3);

    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => window.animatorState.selectedIds.size)).toBe(0);
  });

  test('text tool edits inline and responds to styling controls', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'text');
    const textSnapshot = await createTextShape(page, 'Inline Text');

    const textInfoBefore = await page.evaluate((id) => {
      const shape = window.animatorState.shapes.find((entry) => entry.id === id);
      if (!shape) return null;
      return {
        id: shape.id,
        text: shape.live.text,
        fontSize: shape.style.fontSize,
        fontFamily: shape.style.fontFamily,
        fill: shape.style.fill,
        rotation: shape.style.rotation ?? 0,
      };
    }, textSnapshot.id);

    expect(textInfoBefore).not.toBeNull();
    expect(textInfoBefore?.text).toBe('Inline Text');

    const fontFamilySelect = page.locator('#fontFamily');
    await fontFamilySelect.selectOption('Poppins');

    await expect.poll(() =>
      page.evaluate((id) => {
        const shape = window.animatorState.shapes.find((entry) => entry.id === id);
        return shape?.style.fontFamily ?? null;
      }, textSnapshot.id),
    ).toBe('Poppins');

    const newFill = '#00ff99';
    await page.locator('#fillColor').fill(newFill);

    await expect.poll(() =>
      page.evaluate((id) => {
        const shape = window.animatorState.shapes.find((entry) => entry.id === id);
        return shape?.style.fill?.toLowerCase() ?? null;
      }, textSnapshot.id),
    ).toBe(newFill);

    const rotationInfo = await getRotationHandleInfo(page, textSnapshot.id);
    expect(rotationInfo).not.toBeNull();
    if (!rotationInfo) throw new Error('Missing rotation handle data');

    const rotationBefore = textInfoBefore?.rotation ?? 0;

    await rotateSelectionFromHandle(page, { shapeId: textSnapshot.id, sweepDegrees: 160 });

    const rotationAfter = await page.evaluate((id) => {
      const shape = window.animatorState.shapes.find((entry) => entry.id === id);
      return shape?.style.rotation ?? 0;
    }, textSnapshot.id);

    expect(Math.abs(rotationAfter - rotationBefore)).toBeGreaterThan(1);
  });

  test('copy and paste duplicates shapes using clipboard helpers', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page);

    await ensureShapeCount(page, 1);
    await ensureSelectionCount(page, 1);

    const copyResult = await page.evaluate(() => window.animatorApi.copySelection());
    expect(copyResult).toBeTruthy();

    await waitForClipboardItems(page, 1);

    const pasteResult = await page.evaluate(() => window.animatorApi.pasteFromClipboard());
    expect(pasteResult).toBeTruthy();

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(2);
    await ensureSelectionCount(page, 1);

    const positions = await page.evaluate(() =>
      window.animatorState.shapes.map((shape) => ({
        id: shape.id,
        x: shape.live.x,
        y: shape.live.y,
      })),
    );

    expect(positions.length).toBe(2);
    const deltaX = Math.abs(positions[0].x - positions[1].x);
    const deltaY = Math.abs(positions[0].y - positions[1].y);
    expect(deltaX).toBeGreaterThanOrEqual(30);
    expect(deltaY).toBeGreaterThanOrEqual(30);
  });

  test('copy and paste duplicates shapes using keyboard shortcut', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page);

    await ensureShapeCount(page, 1);
    await ensureSelectionCount(page, 1);

    await pressShortcut(page, 'c');

    await waitForClipboardItems(page, 1);

    await pressShortcut(page, 'v');

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(2);
    await ensureSelectionCount(page, 1);

    const positions = await page.evaluate(() =>
      window.animatorState.shapes.map((shape) => ({
        id: shape.id,
        x: shape.live.x,
        y: shape.live.y,
      })),
    );

    expect(positions.length).toBe(2);
    const deltaX = Math.abs(positions[0].x - positions[1].x);
    const deltaY = Math.abs(positions[0].y - positions[1].y);
    expect(deltaX).toBeGreaterThanOrEqual(30);
    expect(deltaY).toBeGreaterThanOrEqual(30);

  });

  test('paste still works when stage context menu and color input have focus', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page);

    await ensureShapeCount(page, 1);
    await ensureSelectionCount(page, 1);

    await pressShortcut(page, 'c');
    await waitForClipboardItems(page, 1);

    const stage = page.locator('#stage');
    await stage.click({ position: { x: 10, y: 10 } });
    await ensureSelectionCount(page, 0);

    await stage.click({ button: 'right', position: { x: 20, y: 20 } });

    await pressShortcut(page, 'v');

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(2);
    await ensureSelectionCount(page, 1);
  });

  test('pasting multi-element SVG content creates separate image shapes', async ({ page }) => {
    await loadApp(page);

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(0);

    const multiMarkup = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="72" viewBox="0 0 96 72">
  <rect x="4" y="4" width="88" height="40" rx="6" ry="6" fill="#4ade80" stroke="#047857" stroke-width="4" opacity="0.3" />
  <circle cx="28" cy="56" r="12" fill="#fb7185" stroke="#be123c" stroke-width="4" opacity="0.6" />
  <circle cx="68" cy="56" r="12" fill="#38bdf8" stroke="#0ea5e9" stroke-width="4" opacity="0.85" />
</svg>`;

    await page.evaluate((markup) => {
      const file = new File([markup], 'pasted.svg', { type: 'image/svg+xml' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const event = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'clipboardData', {
        value: dataTransfer,
        enumerable: true,
      });
      window.dispatchEvent(event);
    }, multiMarkup);

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(3);

    const summary = await page.evaluate(() => {
      const identifyFragment = (src) => {
        if (typeof src !== 'string' || !src.includes(',')) return 'unknown';
        try {
          const decoded = decodeURIComponent(src.slice(src.indexOf(',') + 1));
          if (decoded.includes('#4ade80')) return 'green-rect';
          if (decoded.includes('#fb7185')) return 'pink-circle';
          if (decoded.includes('#38bdf8')) return 'blue-circle';
          return 'unknown';
        } catch (error) {
          return 'unknown';
        }
      };

      return {
        types: window.animatorState.shapes.map((shape) => shape.type),
        sources: window.animatorState.shapes.map((shape) => shape.asset?.source ?? ''),
        fragmentOrder: window.animatorState.shapes.map((shape) => identifyFragment(shape.asset?.source ?? '')),
        rects: window.animatorState.shapes.map((shape) => ({
          id: shape.id,
          x: shape.live.x,
          y: shape.live.y,
          width: shape.live.width,
          height: shape.live.height,
        })),
        opacities: window.animatorState.shapes.map((shape) => shape.style?.opacity ?? 1),
        selectedIds: Array.from(window.animatorState.selectedIds || []),
        primarySelectionId: window.animatorState.selection?.id ?? null,
        stage: {
          width: window.animatorState.stage.width,
          height: window.animatorState.stage.height,
        },
      };
    });

    expect(summary.types.every((type) => type === 'image')).toBeTruthy();
    expect(summary.sources.every((src) => src.startsWith('data:image/svg+xml'))).toBeTruthy();
    expect(summary.selectedIds.length).toBe(summary.types.length);
    if (summary.primarySelectionId !== null) {
      expect(summary.selectedIds).toContain(summary.primarySelectionId);
    }

    expect(summary.fragmentOrder).toEqual(['green-rect', 'pink-circle', 'blue-circle']);

  expect(summary.opacities.length).toBe(3);
  expect(summary.opacities[0]).toBeCloseTo(0.3, 2);
  expect(summary.opacities[1]).toBeCloseTo(0.6, 2);
  expect(summary.opacities[2]).toBeCloseTo(0.85, 2);

    summary.rects.forEach((rect) => {
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(summary.stage.width + 0.5);
      expect(rect.y + rect.height).toBeLessThanOrEqual(summary.stage.height + 0.5);
      expect(rect.x).toBeGreaterThanOrEqual(-0.5);
      expect(rect.y).toBeGreaterThanOrEqual(-0.5);
    });
  });

  test('pasting grouped SVG content keeps composite shapes intact', async ({ page }) => {
    await loadApp(page);

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(0);

    const groupedMarkup = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120">
  <g>
    <g transform="translate(20 20)">
      <path d="M0 0H100V70H0Z" fill="#fef08a"/>
      <path d="M0 0H100V70H0Z" fill="none" stroke="#f97316" stroke-width="8" stroke-linejoin="round"/>
    </g>
    <g transform="translate(140 20)">
      <path d="M0 0H80V60H0Z" fill="#bbf7d0"/>
      <path d="M0 0H80V60H0Z" fill="none" stroke="#22c55e" stroke-width="6" stroke-linejoin="round" stroke-dasharray="10 6"/>
    </g>
  </g>
</svg>`;

    await page.evaluate((markup) => {
      const file = new File([markup], 'grouped.svg', { type: 'image/svg+xml' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const event = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'clipboardData', {
        value: dataTransfer,
        enumerable: true,
      });
      window.dispatchEvent(event);
    }, groupedMarkup);

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(2);

    const groupedSummary = await page.evaluate(() => ({
      types: window.animatorState.shapes.map((shape) => shape.type),
      sources: window.animatorState.shapes.map((shape) => shape.asset?.source ?? ''),
      widths: window.animatorState.shapes.map((shape) => shape.live?.width ?? 0),
      heights: window.animatorState.shapes.map((shape) => shape.live?.height ?? 0),
      selectedCount: window.animatorState.selectedIds?.size ?? 0,
    }));

    expect(groupedSummary.types.every((type) => type === 'image')).toBeTruthy();
    expect(groupedSummary.sources.every((src) => src.startsWith('data:image/svg+xml'))).toBeTruthy();
    groupedSummary.widths.forEach((width) => expect(width).toBeGreaterThan(0));
    groupedSummary.heights.forEach((height) => expect(height).toBeGreaterThan(0));
    expect(groupedSummary.selectedCount).toBe(2);
  });

  test('pasting Excalidraw clipboard content creates editable shapes', async ({ page }) => {
    await loadApp(page);

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(0);

    const excalidrawPayload = `{"type":"excalidraw/clipboard","elements":[{"id":"EiOMPbECI0QLCKuZ1504O","type":"rectangle","x":-8783.580044080441,"y":-12922.170759910341,"width":1454.166259765625,"height":691.6666412353516,"angle":0,"strokeColor":"#1971c2","backgroundColor":"#ffec99","fillStyle":"solid","strokeWidth":2,"strokeStyle":"solid","roughness":1,"opacity":50,"groupIds":[],"frameId":null,"index":"b1p","roundness":{"type":3},"seed":1945412050,"version":31,"versionNonce":1125283474,"isDeleted":false,"boundElements":[{"type":"text","id":"cXqALHa9OwHHnTO35_x6Y"}],"updated":1761661884185,"link":null,"locked":false},{"id":"cXqALHa9OwHHnTO35_x6Y","type":"text","x":-8079.146892835324,"y":-12588.837439292665,"width":45.299957275390625,"height":25,"angle":0,"strokeColor":"#1971c2","backgroundColor":"#ffec99","fillStyle":"solid","strokeWidth":2,"strokeStyle":"solid","roughness":1,"opacity":50,"groupIds":[],"frameId":null,"index":"b1pV","roundness":null,"seed":1757302094,"version":6,"versionNonce":616790734,"isDeleted":false,"boundElements":null,"updated":1761661884367,"link":null,"locked":false,"text":"adsf","fontSize":20,"fontFamily":1,"textAlign":"center","verticalAlign":"middle","containerId":"EiOMPbECI0QLCKuZ1504O","originalText":"adsf","autoResize":true,"lineHeight":1.25},{"id":"ey-DzSDDpaAvv1fZih_Pn","type":"diamond","x":-8741.913784314816,"y":-12009.670836204286,"width":1537.5,"height":958.3332824707031,"angle":0,"strokeColor":"#1971c2","backgroundColor":"#ffec99","fillStyle":"solid","strokeWidth":2,"strokeStyle":"solid","roughness":1,"opacity":50,"groupIds":[],"frameId":null,"index":"b1q","roundness":{"type":2},"seed":1434071954,"version":35,"versionNonce":98608078,"isDeleted":false,"boundElements":[{"type":"text","id":"do9AlPQZZYZeg_DhlE1v5"}],"updated":1761661885747,"link":null,"locked":false},{"id":"do9AlPQZZYZeg_DhlE1v5","type":"text","x":-7995.688762952512,"y":-11543.08751558661,"width":45.299957275390625,"height":25,"angle":0,"strokeColor":"#1971c2","backgroundColor":"#ffec99","fillStyle":"solid","strokeWidth":2,"strokeStyle":"solid","roughness":1,"opacity":50,"groupIds":[],"frameId":null,"index":"b1r","roundness":null,"seed":1626530386,"version":7,"versionNonce":1963594386,"isDeleted":false,"boundElements":null,"updated":1761661886010,"link":null,"locked":false,"text":"asdf","fontSize":20,"fontFamily":1,"textAlign":"center","verticalAlign":"middle","containerId":"ey-DzSDDpaAvv1fZih_Pn","originalText":"asdf","autoResize":true,"lineHeight":1.25}],"files":{}}`;

    await page.evaluate((payload) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', payload);
      const event = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'clipboardData', {
        value: dataTransfer,
        enumerable: true,
      });
      window.dispatchEvent(event);
    }, excalidrawPayload);

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(4);

    const excalidrawSummary = await page.evaluate(() => ({
      types: window.animatorState.shapes.map((shape) => shape.type),
      fills: window.animatorState.shapes.map((shape) => shape.style?.fill ?? null),
      fillStyles: window.animatorState.shapes.map((shape) => shape.style?.fillStyle ?? null),
      strokes: window.animatorState.shapes.map((shape) => shape.style?.stroke ?? null),
      sketchLevels: window.animatorState.shapes.map((shape) => shape.style?.sketchLevel ?? null),
      opacities: window.animatorState.shapes.map((shape) => shape.style?.opacity ?? 1),
      bounds: window.animatorState.shapes.map((shape) => ({
        x: shape.live?.x ?? 0,
        y: shape.live?.y ?? 0,
        width: shape.live?.width ?? 0,
        height: shape.live?.height ?? 0,
      })),
      rotation: window.animatorState.shapes.map((shape) => shape.style?.rotation ?? 0),
      selectionSize: window.animatorState.selectedIds?.size ?? 0,
      stage: {
        width: window.animatorState.stage.width,
        height: window.animatorState.stage.height,
      },
    }));

    expect(excalidrawSummary.types.length).toBe(4);
    expect(excalidrawSummary.selectionSize).toBe(4);
    expect(excalidrawSummary.types).toEqual(['rectangle', 'text', 'diamond', 'text']);
  expect(excalidrawSummary.fillStyles[0]).toBe('solid');
  expect(excalidrawSummary.fillStyles[2]).toBe('solid');
  expect(excalidrawSummary.sketchLevels[0]).toBe(1);
  expect(excalidrawSummary.sketchLevels[2]).toBe(1);
    expect(excalidrawSummary.types).not.toContain('image');
    expect(excalidrawSummary.fills).toContain('#ffec99');
    excalidrawSummary.opacities.forEach((value) => {
      expect(value).toBeCloseTo(0.5, 2);
    });
    excalidrawSummary.bounds.forEach((rect) => {
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
      expect(rect.x).toBeGreaterThanOrEqual(-0.5);
      expect(rect.y).toBeGreaterThanOrEqual(-0.5);
      expect(rect.x + rect.width).toBeLessThanOrEqual(excalidrawSummary.stage.width + 0.5);
      expect(rect.y + rect.height).toBeLessThanOrEqual(excalidrawSummary.stage.height + 0.5);
    });
  });

  test('pasting Excalidraw line content creates a line shape', async ({ page }) => {
    await loadApp(page);

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(0);

    const excalidrawLine = `{"type":"excalidraw/clipboard","elements":[{"id":"-n8mRoMV4U4JZ9sZAm17h","type":"line","x":10957.03026047494,"y":8728.684864198905,"width":650,"height":270,"angle":0,"strokeColor":"#1971c2","backgroundColor":"#ffec99","fillStyle":"solid","strokeWidth":4,"strokeStyle":"solid","roughness":1,"opacity":100,"groupIds":[],"frameId":null,"index":"c0Pb","roundness":{"type":2},"seed":430728823,"version":45,"versionNonce":933143415,"isDeleted":false,"boundElements":null,"updated":1761664731742,"link":null,"locked":false,"points":[[0,0],[650,270]],"lastCommittedPoint":null,"startBinding":null,"endBinding":null,"startArrowhead":null,"endArrowhead":null,"polygon":false}],"files":{}}`;

    await page.evaluate((payload) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', payload);
      const event = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'clipboardData', {
        value: dataTransfer,
        enumerable: true,
      });
      window.dispatchEvent(event);
    }, excalidrawLine);

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(1);

    const lineSummary = await page.evaluate(() => {
      const [shape] = window.animatorState.shapes;
      return {
        type: shape?.type ?? null,
        start: shape?.live?.start ?? null,
        end: shape?.live?.end ?? null,
        strokeWidth: shape?.style?.strokeWidth ?? null,
        arrowStart: shape?.style?.arrowStart ?? null,
        arrowEnd: shape?.style?.arrowEnd ?? null,
        selectionSize: window.animatorState.selectedIds?.size ?? 0,
        stage: {
          width: window.animatorState.stage.width,
          height: window.animatorState.stage.height,
        },
      };
    });

    expect(lineSummary.type).toBe('line');
    expect(lineSummary.selectionSize).toBe(1);
    expect(lineSummary.start).not.toBeNull();
    expect(lineSummary.end).not.toBeNull();
    expect(Math.abs(lineSummary.end.x - lineSummary.start.x)).toBeGreaterThan(1);
    expect(Math.abs(lineSummary.end.y - lineSummary.start.y)).toBeGreaterThan(1);
    expect(lineSummary.strokeWidth).toBeGreaterThan(0);
    expect(lineSummary.arrowStart).toBeFalsy();
    expect(lineSummary.arrowEnd).toBeFalsy();
    expect(lineSummary.start.x).toBeGreaterThanOrEqual(-0.5);
    expect(lineSummary.start.y).toBeGreaterThanOrEqual(-0.5);
    expect(lineSummary.end.x).toBeGreaterThanOrEqual(-0.5);
    expect(lineSummary.end.y).toBeGreaterThanOrEqual(-0.5);
    expect(lineSummary.start.x).toBeLessThanOrEqual(lineSummary.stage.width + 0.5);
    expect(lineSummary.start.y).toBeLessThanOrEqual(lineSummary.stage.height + 0.5);
    expect(lineSummary.end.x).toBeLessThanOrEqual(lineSummary.stage.width + 0.5);
    expect(lineSummary.end.y).toBeLessThanOrEqual(lineSummary.stage.height + 0.5);
  });

  test('pasting Excalidraw freedraw content creates free shapes', async ({ page }) => {
    await loadApp(page);

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(0);

    const excalidrawFreedraw = `{"type":"excalidraw/clipboard","elements":[{"id":"8_0VgJFx4oAa0XiEBGBq2","type":"freedraw","x":7333.3729551742545,"y":938.7328054467425,"width":703.3333333333339,"height":393.33333333333326,"angle":0,"strokeColor":"#9c36b5","backgroundColor":"#ffec99","fillStyle":"solid","strokeWidth":2,"strokeStyle":"solid","roughness":1,"opacity":100,"groupIds":[],"frameId":null,"index":"bQk","roundness":null,"seed":310421130,"version":34,"versionNonce":950432074,"isDeleted":false,"boundElements":null,"updated":1761667030388,"link":null,"locked":false,"points":[[0,0],[0,3.3333333333332575],[0,13.333333333333258],[0,40],[0,90],[0,193.33333333333326],[13.33333333333394,253.33333333333326],[73.33333333333394,320],[186.66666666666606,376.66666666666674],[346.66666666666606,393.33333333333326],[536.6666666666661,356.66666666666674],[656.6666666666661,290],[696.6666666666661,246.66666666666674],[703.3333333333339,183.33333333333326],[626.6666666666661,96.66666666666674],[513.3333333333339,53.33333333333326],[433.33333333333394,43.33333333333326],[346.66666666666606,43.33333333333326],[293.33333333333394,70],[273.33333333333394,96.66666666666674],[266.66666666666606,130],[266.66666666666606,156.66666666666674],[266.66666666666606,186.66666666666674],[293.33333333333394,236.66666666666674],[333.33333333333394,246.66666666666674],[363.33333333333394,250],[420,240],[476.66666666666606,183.33333333333326],[456.66666666666606,120],[406.66666666666606,100],[350,100],[330,100],[330,100]],"pressures":[],"simulatePressure":true,"lastCommittedPoint":[330,100]},{"id":"uojs3T57j2SYDi59B-EN4","type":"freedraw","x":7566.706288507588,"y":1462.0661387800758,"width":870,"height":433.3333333333335,"angle":0,"strokeColor":"#9c36b5","backgroundColor":"#ffec99","fillStyle":"solid","strokeWidth":2,"strokeStyle":"solid","roughness":1,"opacity":100,"groupIds":[],"frameId":null,"index":"bQl","roundness":null,"seed":1103177110,"version":55,"versionNonce":565241098,"isDeleted":false,"boundElements":null,"updated":1761667031748,"link":null,"locked":false,"points":[[0,0],[0,-16.666666666666515],[-6.666666666667879,-30],[-26.66666666666788,-46.666666666666515],[-50,-50],[-73.33333333333394,-50],[-96.66666666666788,-43.33333333333326],[-126.66666666666788,6.6666666666667425],[-130,56.66666666666674],[-120,106.66666666666674],[-56.66666666666788,156.66666666666674],[56.66666666666606,186.66666666666674],[223.33333333333212,193.33333333333348],[390,166.66666666666674],[473.3333333333321,130],[516.6666666666661,70],[483.3333333333321,-10],[436.66666666666606,-36.666666666666515],[366.66666666666606,-43.33333333333326],[296.66666666666606,-30],[233.33333333333212,13.333333333333485],[153.33333333333212,100],[113.33333333333212,180],[96.66666666666606,250],[96.66666666666606,280],[143.33333333333212,326.66666666666674],[283.3333333333321,373.3333333333335],[406.66666666666606,376.66666666666674],[466.66666666666606,370],[506.66666666666606,353.3333333333335],[506.66666666666606,336.66666666666674],[413.3333333333321,323.3333333333335],[220,330],[16.66666666666606,370],[-116.66666666666788,376.66666666666674],[-190,366.66666666666674],[-260,333.3333333333335],[-303.33333333333394,303.3333333333335],[-340,256.66666666666674],[-353.33333333333394,210],[-353.33333333333394,180],[-333.33333333333394,153.33333333333348],[-266.6666666666679,120],[-133.33333333333394,86.66666666666674],[-66.66666666666788,83.33333333333348],[23.33333333333212,83.33333333333348],[110,113.33333333333348],[150,140],[153.33333333333212,216.66666666666674],[63.33333333333212,280],[-76.66666666666788,356.66666666666674],[-133.33333333333394,376.66666666666674],[-163.33333333333394,383.3333333333335],[-163.33333333333394,383.3333333333335]],"pressures":[],"simulatePressure":true,"lastCommittedPoint":[-163.33333333333394,383.3333333333335]}],"files":{}}`;

    await page.evaluate((payload) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', payload);
      const event = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'clipboardData', {
        value: dataTransfer,
        enumerable: true,
      });
      window.dispatchEvent(event);
    }, excalidrawFreedraw);

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(2);

    const freedrawSummary = await page.evaluate(() => {
      const shapes = window.animatorState.shapes;
      const stage = window.animatorState.stage;
      const bounds = shapes.map((shape) => {
        if (shape.type !== 'free' || !Array.isArray(shape.live?.points) || shape.live.points.length === 0) return null;
        const xs = shape.live.points.map((pt) => pt.x);
        const ys = shape.live.points.map((pt) => pt.y);
        return {
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minY: Math.min(...ys),
          maxY: Math.max(...ys),
        };
      });
      return {
        types: shapes.map((shape) => shape.type),
        pointCounts: shapes.map((shape) => Array.isArray(shape.live?.points) ? shape.live.points.length : 0),
        strokeColors: shapes.map((shape) => shape.style?.stroke ?? null),
        selectionSize: window.animatorState.selectedIds?.size ?? 0,
        bounds,
        stage: {
          width: stage.width,
          height: stage.height,
        },
      };
    });

    expect(freedrawSummary.types.every((type) => type === 'free')).toBeTruthy();
    expect(freedrawSummary.selectionSize).toBe(2);
    freedrawSummary.pointCounts.forEach((count) => expect(count).toBeGreaterThan(10));
    expect(freedrawSummary.strokeColors.every((color) => color === '#9c36b5')).toBeTruthy();
    freedrawSummary.bounds.forEach((rect) => {
      expect(rect).not.toBeNull();
      if (!rect) return;
      expect(rect.minX).toBeGreaterThanOrEqual(-0.5);
      expect(rect.minY).toBeGreaterThanOrEqual(-0.5);
      expect(rect.maxX).toBeLessThanOrEqual(freedrawSummary.stage.width + 0.5);
      expect(rect.maxY).toBeLessThanOrEqual(freedrawSummary.stage.height + 0.5);
    });
  });

  test('pasting single-element SVG content creates one image shape', async ({ page }) => {
    await loadApp(page);

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(0);

    const singleMarkup = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="8" y="8" width="48" height="48" rx="12" ry="12" fill="#a855f7" stroke="#6d28d9" stroke-width="6" />
</svg>`;

    await page.evaluate((markup) => {
      const file = new File([markup], 'single.svg', { type: 'image/svg+xml' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const event = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'clipboardData', {
        value: dataTransfer,
        enumerable: true,
      });
      window.dispatchEvent(event);
    }, singleMarkup);

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(1);

    const singleSummary = await page.evaluate(() => {
      const [shape] = window.animatorState.shapes;
      return {
        type: shape?.type ?? null,
        source: shape?.asset?.source ?? '',
        width: shape?.live?.width ?? 0,
        height: shape?.live?.height ?? 0,
        selectedCount: window.animatorState.selectedIds?.size ?? 0,
        selectionId: window.animatorState.selection?.id ?? null,
      };
    });

    expect(singleSummary.type).toBe('image');
    expect(singleSummary.source.startsWith('data:image/svg+xml')).toBeTruthy();
    expect(singleSummary.width).toBeGreaterThan(0);
    expect(singleSummary.height).toBeGreaterThan(0);
    expect(singleSummary.selectedCount).toBe(1);
    expect(singleSummary.selectionId).not.toBeNull();
  });

  test('pasted image behaves like other shapes', async ({ page }) => {
    await loadApp(page);

    await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(0);

    const base64Pixel =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

    await page.evaluate((dataUrl) => {
      const binary = atob(dataUrl);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      const blob = new Blob([bytes], { type: 'image/png' });
      const file = new File([blob], 'pasted.png', { type: 'image/png' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const event = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'clipboardData', {
        value: dataTransfer,
        enumerable: true,
      });
      window.dispatchEvent(event);
    }, base64Pixel);

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.shapes.filter((shape) => shape.type === 'image').length),
    ).toBe(1);

    await expect.poll(() => page.evaluate(() => window.animatorState.selectedIds.size)).toBe(1);

    const imageBounds = await getShapeBounds(page);
    expect(imageBounds).not.toBeNull();
    if (!imageBounds) throw new Error('Image bounds unavailable');
    expect(imageBounds.width).toBeGreaterThan(0);
    expect(imageBounds.height).toBeGreaterThan(0);

    await setTool(page, 'select');

    const imageId = await page.evaluate(() => window.animatorState.selection?.id ?? null);
    expect(imageId).not.toBeNull();
    if (!imageId) throw new Error('Missing pasted image selection');

    const selectionMeta = await page.evaluate(() => {
      const selection = window.animatorState.selection;
      if (!selection) return null;
      return {
        type: selection.type,
        width: selection.live?.width ?? null,
        height: selection.live?.height ?? null,
        rotation: selection.live?.rotation ?? null,
      };
    });
    expect(selectionMeta).not.toBeNull();
    if (!selectionMeta) throw new Error('Missing selection meta');
    expect(selectionMeta.type).toBe('image');

    const initialRotationHandle = await page.evaluate((id) => {
      return window.animatorApi?.getRotationHandleData(id) ?? null;
    }, imageId);
    expect(initialRotationHandle).not.toBeNull();

    const initialPosition = await page.evaluate((id) => {
      const shape = window.animatorState.shapes.find((entry) => entry.id === id);
      if (!shape) return null;
      return { x: shape.live.x, y: shape.live.y };
    }, imageId);
    expect(initialPosition).not.toBeNull();
    if (!initialPosition) throw new Error('Initial position unavailable');

    const selectionCenter = await getSelectionClientCenter(page);
    expect(selectionCenter).not.toBeNull();
    if (!selectionCenter) throw new Error('Selection center unavailable');

    await page.mouse.move(selectionCenter.x, selectionCenter.y);
    await page.mouse.down();

    const pointerState = await page.evaluate(() => ({
      down: window.animatorState.pointer?.down ?? false,
      mode: window.animatorState.pointer?.mode ?? null,
    }));
    expect(pointerState.down).toBeTruthy();
    expect(pointerState.mode).toBe('moving');

    await page.mouse.move(selectionCenter.x + 80, selectionCenter.y + 50, { steps: 12 });

    const movedDuringDrag = await page.evaluate((id) => {
      const shape = window.animatorState.shapes.find((entry) => entry.id === id);
      if (!shape) return null;
      return { x: shape.live.x, y: shape.live.y };
    }, imageId);
    expect(movedDuringDrag).not.toBeNull();
    if (!movedDuringDrag) throw new Error('Image position unavailable during drag');
    expect(Math.abs(movedDuringDrag.x - initialPosition.x)).toBeGreaterThanOrEqual(40);
    expect(Math.abs(movedDuringDrag.y - initialPosition.y)).toBeGreaterThanOrEqual(25);

    await page.mouse.up();
    await page.waitForTimeout(50);

    const movedPosition = await page.evaluate((id) => {
      const shape = window.animatorState.shapes.find((entry) => entry.id === id);
      if (!shape) return null;
      return { x: shape.live.x, y: shape.live.y };
    }, imageId);
    expect(movedPosition).not.toBeNull();
    if (!movedPosition) throw new Error('Image position unavailable');
    expect(Math.abs(movedPosition.x - initialPosition.x)).toBeGreaterThanOrEqual(40);
    expect(Math.abs(movedPosition.y - initialPosition.y)).toBeGreaterThanOrEqual(25);

    const boundsBeforeResize = await getShapeBounds(page, imageId);
    await resizeShapeFromHandle(page, { shapeId: imageId, deltaX: 120, deltaY: 80 });
    await expect.poll(async () => (await getShapeBounds(page, imageId)).width).toBeGreaterThan(boundsBeforeResize.width);
    await expect.poll(async () => (await getShapeBounds(page, imageId)).height).toBeGreaterThan(boundsBeforeResize.height);

    const rotationBefore = await page.evaluate((id) => {
      const shape = window.animatorState.shapes.find((entry) => entry.id === id);
      return shape?.style?.rotation ?? 0;
    }, imageId);

    await rotateSelectionFromHandle(page, { shapeId: imageId, sweepDegrees: 90, radius: 140 });

    const rotationAfter = await page.evaluate((id) => {
      const shape = window.animatorState.shapes.find((entry) => entry.id === id);
      return shape?.style?.rotation ?? 0;
    }, imageId);

    expect(Math.abs(rotationAfter - rotationBefore)).toBeGreaterThan(5);
  });

  test('image shapes resize via the golden handle', async ({ page }) => {
    await loadApp(page);

    const imageId = await page.evaluate((src) => {
      const shape = window.animatorApi.createImageShapeFromSource(src);
      return shape?.id ?? null;
    }, DUMMY_IMAGE_SRC);

    expect(imageId).not.toBeNull();
    if (!imageId) throw new Error('Image shape was not created');

    await ensureSelectionCount(page, 1);

    const initialBounds = await getShapeBounds(page, imageId);
    expect(initialBounds).not.toBeNull();

    await resizeShapeFromHandle(page, { shapeId: imageId, deltaX: 140, deltaY: 120 });

    await expect.poll(async () => (await getShapeBounds(page, imageId)).width).toBeGreaterThan(initialBounds.width);
    await expect.poll(async () => (await getShapeBounds(page, imageId)).height).toBeGreaterThan(initialBounds.height);
  });

  test('arrow endings toggle with icon buttons', async ({ page }) => {
    await loadApp(page);

    const control = page.locator('#arrowEndingControl');
    const startToggle = page.locator('[data-arrow-toggle="start"]');
    const endToggle = page.locator('[data-arrow-toggle="end"]');

    await expect(control).toBeHidden();

    await setTool(page, 'arrow');

    await expect(control).toBeVisible();
    await expect(startToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(endToggle).toHaveAttribute('aria-pressed', 'true');

    await startToggle.click();
    await expect(startToggle).toHaveAttribute('aria-pressed', 'true');

    await drawLine(page);
    await ensureSelectionCount(page, 1);

    await expect.poll(async () =>
      page.evaluate(() => {
        const shape = window.animatorState.selection;
        if (!shape) return null;
        return { start: Boolean(shape.style?.arrowStart), end: Boolean(shape.style?.arrowEnd) };
      }),
    ).toEqual({ start: true, end: true });

    await endToggle.click();
    await expect(endToggle).toHaveAttribute('aria-pressed', 'false');

    await expect.poll(async () =>
      page.evaluate(() => {
        const shape = window.animatorState.selection;
        return shape ? Boolean(shape.style?.arrowEnd) : null;
      }),
    ).toBe(false);

    await setTool(page, 'select');
    await setTool(page, 'arrow');

    await drawLine(page, {
      startDelta: { x: -160, y: -40 },
      endDelta: { x: 110, y: 120 },
    });

    await ensureSelectionCount(page, 1);

    await expect.poll(async () =>
      page.evaluate(() => {
        const shape = window.animatorState.selection;
        if (!shape) return null;
        return { start: Boolean(shape.style?.arrowStart), end: Boolean(shape.style?.arrowEnd) };
      }),
    ).toEqual({ start: true, end: false });
  });

  test('sketchiness options update selected shape style', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page);
    await ensureSelectionCount(page, 1);

    const clean = page.locator('[data-sketch-level="0"]');
    const casual = page.locator('[data-sketch-level="1"]');
    const messy = page.locator('[data-sketch-level="2"]');

    await expect(clean).toHaveAttribute('aria-pressed', 'true');
    await expect(casual).toHaveAttribute('aria-pressed', 'false');
    await expect(messy).toHaveAttribute('aria-pressed', 'false');

    await expect.poll(async () =>
      page.evaluate(() => window.animatorState.selection?.style?.sketchLevel ?? null),
    ).toBe(0);

    await casual.click();

    await expect.poll(async () =>
      page.evaluate(() => window.animatorState.selection?.style?.sketchLevel ?? null),
    ).toBe(1);

    await expect(clean).toHaveAttribute('aria-pressed', 'false');
    await expect(casual).toHaveAttribute('aria-pressed', 'true');

    await clean.click();

    await expect(clean).toHaveAttribute('aria-pressed', 'true');
    await expect(casual).toHaveAttribute('aria-pressed', 'false');

    await expect.poll(async () =>
      page.evaluate(() => window.animatorState.selection?.style?.sketchLevel ?? null),
    ).toBe(0);

    await messy.click();
    await expect(messy).toHaveAttribute('aria-pressed', 'true');

    await expect.poll(async () =>
      page.evaluate(() => window.animatorState.selection?.style?.sketchLevel ?? null),
    ).toBe(2);

    await setTool(page, 'select');
    await setTool(page, 'rectangle');
    await drawRectangle(page, { offsetX: 160, offsetY: -120 });
    await ensureSelectionCount(page, 1);

    await expect.poll(async () =>
      page.evaluate(() => window.animatorState.selection?.style?.sketchLevel ?? null),
    ).toBe(2);
  });

  test('fill style toggles default to cross-hatch and update selection', async ({ page }) => {
    await loadApp(page);

    const solid = page.locator('[data-fill-style="solid"]');
    const crossHatch = page.locator('[data-fill-style="cross-hatch"]');
    const hachure = page.locator('[data-fill-style="hachure"]');

    await expect(crossHatch).toHaveAttribute('aria-pressed', 'true');
    await expect(solid).toHaveAttribute('aria-pressed', 'false');
    await expect(hachure).toHaveAttribute('aria-pressed', 'false');

    await setTool(page, 'rectangle');
    await drawRectangle(page);
    await ensureSelectionCount(page, 1);

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.style?.fillStyle ?? null),
    ).toBe('cross-hatch');
    await expect.poll(() => page.evaluate(() => window.animatorState.style.fillStyle ?? null)).toBe('cross-hatch');

    await solid.click();

    await expect(solid).toHaveAttribute('aria-pressed', 'true');
    await expect(crossHatch).toHaveAttribute('aria-pressed', 'false');
    await expect(hachure).toHaveAttribute('aria-pressed', 'false');

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.style?.fillStyle ?? null),
    ).toBe('solid');
    await expect.poll(() => page.evaluate(() => window.animatorState.style.fillStyle ?? null)).toBe('solid');

    await hachure.click();

    await expect(hachure).toHaveAttribute('aria-pressed', 'true');
    await expect(solid).toHaveAttribute('aria-pressed', 'false');
    await expect(crossHatch).toHaveAttribute('aria-pressed', 'false');

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.style?.fillStyle ?? null),
    ).toBe('hachure');
    await expect.poll(() => page.evaluate(() => window.animatorState.style.fillStyle ?? null)).toBe('hachure');

    await setTool(page, 'rectangle');
    await drawRectangle(page, { offsetX: 180, offsetY: -140 });
    await ensureShapeCount(page, 2);
    await ensureSelectionCount(page, 1);

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.style?.fillStyle ?? null),
    ).toBe('hachure');
  });

  test('edge style toggles default to round and update rectangles and diamonds', async ({ page }) => {
    await loadApp(page);

    const round = page.locator('[data-edge-style="round"]');
    const sharp = page.locator('[data-edge-style="sharp"]');

    await expect(round).toHaveAttribute('aria-pressed', 'true');
    await expect(sharp).toHaveAttribute('aria-pressed', 'false');

    await setTool(page, 'rectangle');
    await drawRectangle(page);
    await ensureSelectionCount(page, 1);

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.style?.edgeStyle ?? null),
    ).toBe('round');

    await sharp.click();

    await expect(sharp).toHaveAttribute('aria-pressed', 'true');
    await expect(round).toHaveAttribute('aria-pressed', 'false');

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.style?.edgeStyle ?? null),
    ).toBe('sharp');
    await expect.poll(() => page.evaluate(() => window.animatorState.style.edgeStyle ?? null)).toBe('sharp');

    await setTool(page, 'rectangle');
    await drawRectangle(page, { offsetX: 180, offsetY: 140 });
    await ensureSelectionCount(page, 1);

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.style?.edgeStyle ?? null),
    ).toBe('sharp');

    await round.click();

    await expect(round).toHaveAttribute('aria-pressed', 'true');
    await expect(sharp).toHaveAttribute('aria-pressed', 'false');

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.style?.edgeStyle ?? null),
    ).toBe('round');
    await expect.poll(() => page.evaluate(() => window.animatorState.style.edgeStyle ?? null)).toBe('round');

    await setTool(page, 'diamond');
    await drawDiamond(page, { offsetX: -160, offsetY: -120 });
    await ensureShapeCount(page, 3);
    await ensureSelectionCount(page, 1);

    await expect(page.locator('#edgeStyleControl')).toBeVisible();

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.style?.edgeStyle ?? null),
    ).toBe('round');

    await sharp.click();

    await expect(sharp).toHaveAttribute('aria-pressed', 'true');
    await expect(round).toHaveAttribute('aria-pressed', 'false');

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.style?.edgeStyle ?? null),
    ).toBe('sharp');
    await expect.poll(() => page.evaluate(() => window.animatorState.style.edgeStyle ?? null)).toBe('sharp');

    await round.click();

    await expect(round).toHaveAttribute('aria-pressed', 'true');
    await expect(sharp).toHaveAttribute('aria-pressed', 'false');

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.style?.edgeStyle ?? null),
    ).toBe('round');
    await expect.poll(() => page.evaluate(() => window.animatorState.style.edgeStyle ?? null)).toBe('round');
  });

  test('opacity slider updates shape style and display', async ({ page }) => {
    await loadApp(page);

    const slider = page.locator('#opacity');
    const valueDisplay = page.locator('#opacityValue');

    await expect(slider).toHaveValue('100');
    await expect(valueDisplay).toHaveText('100%');

    await setTool(page, 'rectangle');
    await drawRectangle(page);
    await ensureShapeCount(page, 1);
    await ensureSelectionCount(page, 1);

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.style?.opacity ?? null),
    ).toBe(1);

    await slider.evaluate((input) => {
      input.value = '60';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await expect(slider).toHaveValue('60');
    await expect(valueDisplay).toHaveText('60%');

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.style?.opacity ?? null),
    ).toBeCloseTo(0.6, 2);
    await expect.poll(() => page.evaluate(() => window.animatorState.style.opacity ?? null)).toBeCloseTo(0.6, 2);

    await setTool(page, 'rectangle');
    await drawRectangle(page, { offsetX: 200, offsetY: 120 });
    await ensureShapeCount(page, 2);
    await ensureSelectionCount(page, 1);

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.style?.opacity ?? null),
    ).toBeCloseTo(0.6, 2);
    await expect(slider).toHaveValue('60');
    await expect(valueDisplay).toHaveText('60%');
  });

  test('stage resize handle updates dimensions label', async ({ page }) => {
    await loadApp(page);

    const label = page.locator('#stageDimensions');
    const initialText = (await label.textContent())?.trim() ?? '';
    expect(initialText).toMatch(/×/);

    const initialWidth = await page.evaluate(() => Math.round(window.animatorState.stage.width));

    await page.evaluate(({ pointerId, steps, deltaX, deltaY }) => {
      const handleEl = document.getElementById('stageResizeHandle');
      if (!handleEl) {
        throw new Error('Stage resize handle not found');
      }
      const rect = handleEl.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;
      const dispatch = (type, buttons, x, y) => {
        const event = new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: 'mouse',
          buttons,
          clientX: x,
          clientY: y,
        });
        if (type === 'pointerdown') {
          handleEl.dispatchEvent(event);
        } else {
          window.dispatchEvent(event);
        }
      };
      dispatch('pointerdown', 1, startX, startY);
      for (let step = 1; step <= steps; step += 1) {
        const progress = step / steps;
        const x = startX + deltaX * progress;
        const y = startY + deltaY * progress;
        dispatch('pointermove', 1, x, y);
      }
      dispatch('pointerup', 0, startX + deltaX, startY + deltaY);
    }, { pointerId: 21, steps: 10, deltaX: 140, deltaY: 110 });

    await expect.poll(async () =>
      page.evaluate(() => Math.round(window.animatorState.stage.width)),
    ).toBeGreaterThan(initialWidth);

    const updatedText = (await label.textContent())?.trim() ?? '';
    expect(updatedText).not.toBe(initialText);
    expect(updatedText).toMatch(/px$/);

    const storedSize = await page.evaluate(() => window.localStorage.getItem('animator.stage.size'));
    expect(storedSize).not.toBeNull();
  });

  test('text keyframes persist through playback', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'text');
    await createTextShape(page, 'Timeline Text');

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.keyframes?.length ?? 0),
    ).toBe(1);

    await setTimelineTime(page, 5);

    const highlightFill = '#ff3399';
    await page.locator('#fillColor').fill(highlightFill);

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.keyframes?.length ?? 0),
    ).toBe(2);

    await page.click('#playToggle');
    await page.waitForTimeout(1200);
    await page.click('#stopPlayback');
    await page.waitForTimeout(200); // Wait for timeline to update

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.keyframes?.length ?? 0),
    ).toBe(2);
    // Check timeline markers exist (keyframe chips have been removed)
    // Timeline markers now show for all shapes regardless of selection
    await expect.poll(() => page.locator('.timeline-key').count()).toBeGreaterThanOrEqual(2);

    await setTimelineTime(page, 0);

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selection?.live?.text ?? ''),
    ).toBe('Timeline Text');
  });


  test('text shapes resize via the golden handle increases font size', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'text');
    const textShape = await createTextShape(page, 'Resizable Text');

    const initialFont = textShape.style.fontSize;
    expect(initialFont).toBeGreaterThan(0);

    const initialBounds = await getShapeBounds(page, textShape.id);
    expect(initialBounds).not.toBeNull();

    await resizeShapeFromHandle(page, { shapeId: textShape.id, deltaX: 200, deltaY: 160 });

    await expect.poll(async () => {
      const snapshot = await getShapeSnapshot(page, textShape.id);
      return snapshot?.style.fontSize ?? 0;
    }).toBeGreaterThan(initialFont);

    await expect.poll(async () => (await getShapeBounds(page, textShape.id)).width).toBeGreaterThan(initialBounds.width);
  });

  test('clear canvas removes all shapes and resets timeline', async ({ page }) => {
    await loadApp(page);

    await setTool(page, 'rectangle');
    await drawRectangle(page);

    await setTool(page, 'text');
    await createTextShape(page, 'To be cleared', { offsetY: -180 });

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.shapes.length),
    ).toBeGreaterThan(1);

    await page.click('#clearCanvas');

    await expect.poll(() =>
      page.evaluate(() => window.animatorState.shapes.length),
    ).toBe(0);
    await expect.poll(() =>
      page.evaluate(() => window.animatorState.selectedIds.size),
    ).toBe(0);
  // Verify add keyframe button is disabled when nothing is selected
  await expect(page.locator('#addKeyframe')).toBeDisabled();
    await expect.poll(() =>
      page.evaluate(() => window.animatorState.timeline.current),
    ).toBe(0);
    await expect.poll(() =>
      page.evaluate(() => window.animatorState.timeline.isPlaying),
    ).toBe(false);
    await expect(page.locator('#timelineRange')).toHaveValue('0');
  });
});
