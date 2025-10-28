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

    await casual.click();

    await expect(casual).toHaveAttribute('aria-pressed', 'true');
    await expect(clean).toHaveAttribute('aria-pressed', 'false');

    await expect.poll(async () =>
      page.evaluate(() => window.animatorState.selection?.style?.sketchLevel ?? null),
    ).toBe(1);

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
