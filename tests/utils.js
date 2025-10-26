const { expect } = require('@playwright/test');

async function loadApp(page, { disablePointerEvents = false } = {}) {
  if (disablePointerEvents) {
    await page.addInitScript(() => {
      try {
        // eslint-disable-next-line no-undef
        window.PointerEvent = undefined;
      } catch (error) {
        // Ignore if property is read-only in this environment.
      }
    });
  }
  page.on('pageerror', (error) => {
    // eslint-disable-next-line no-console
    console.error('pageerror', error);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      // eslint-disable-next-line no-console
      console.error('console error', msg.text());
    }
  });
  await page.goto('/');
  await page.waitForFunction(() => window.animatorReady === true && !!window.animatorApi);
  try {
    await page.bringToFront();
  } catch (error) {
    // Some browsers may not support bringToFront; ignore to keep tests running.
  }
}

async function dispatchPointerEvent(page, type, x, y, { pointerId = 1, pointerType = 'mouse', buttons } = {}) {
  const resolvedButtons = typeof buttons === 'number' ? buttons : type === 'pointerup' ? 0 : 1;
  await page.evaluate(
    ({ type, x, y, pointerId, pointerType, buttons: btns }) => {
      const canvas = document.getElementById('stage');
      if (!canvas) throw new Error('Canvas not found');
      const event = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId,
        pointerType,
        buttons: btns,
        clientX: x,
        clientY: y,
        pageX: x,
        pageY: y,
        screenX: x,
        screenY: y,
      });
      canvas.dispatchEvent(event);
    },
    { type, x, y, pointerId, pointerType, buttons: resolvedButtons },
  );
}

async function dispatchMouseEvent(page, type, x, y, { buttons } = {}) {
  const resolvedButtons = typeof buttons === 'number' ? buttons : type === 'mouseup' ? 0 : 1;
  await page.evaluate(
    ({ type, x, y, buttons: btns }) => {
      const canvas = document.getElementById('stage');
      if (!canvas) throw new Error('Canvas missing');
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        buttons: btns,
      });
      canvas.dispatchEvent(event);
    },
    { type, x, y, buttons: resolvedButtons },
  );
}

async function pointerDrag(page, startX, startY, endX, endY, { steps = 12, pointerId = 1 } = {}) {
  await dispatchPointerEvent(page, 'pointerdown', startX, startY, { pointerId });
  for (let i = 1; i <= steps; i += 1) {
    const progress = i / steps;
    const currentX = startX + (endX - startX) * progress;
    const currentY = startY + (endY - startY) * progress;
    await dispatchPointerEvent(page, 'pointermove', currentX, currentY, { pointerId });
  }
  await dispatchPointerEvent(page, 'pointerup', endX, endY, { pointerId });
}

async function mouseDrag(page, startX, startY, endX, endY, { steps = 12 } = {}) {
  await dispatchMouseEvent(page, 'mousedown', startX, startY);
  for (let i = 1; i <= steps; i += 1) {
    const progress = i / steps;
    const currentX = startX + (endX - startX) * progress;
    const currentY = startY + (endY - startY) * progress;
    await dispatchMouseEvent(page, 'mousemove', currentX, currentY);
  }
  await dispatchMouseEvent(page, 'mouseup', endX, endY);
}

async function touchDrag(page, startX, startY, endX, endY, { steps = 12, selector = '#stage' } = {}) {
  await page.evaluate(({ startX: sx, startY: sy, endX: ex, endY: ey, steps: totalSteps, selector: targetSelector }) => {
    const target = document.querySelector(targetSelector);
    if (!target) throw new Error(`Touch target not found for selector ${targetSelector}`);

    const createTouch = (x, y, identifier) => ({
      identifier,
      clientX: x,
      clientY: y,
      pageX: x,
      pageY: y,
      screenX: x,
      screenY: y,
      target,
    });

    const toTouchList = (items) => {
      const list = {
        length: items.length,
        item(index) {
          return items[index] || null;
        },
      };
      items.forEach((item, index) => {
        list[index] = item;
      });
      return list;
    };

    const dispatch = (type, touchesArray, changedArray) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const touchesList = toTouchList(touchesArray);
      const changedList = toTouchList(changedArray);
      const targetTouches = type === 'touchend' || type === 'touchcancel' ? [] : touchesArray;
      Object.defineProperty(event, 'touches', {
        configurable: true,
        enumerable: true,
        value: type === 'touchend' ? toTouchList([]) : touchesList,
      });
      Object.defineProperty(event, 'changedTouches', {
        configurable: true,
        enumerable: true,
        value: changedList,
      });
      Object.defineProperty(event, 'targetTouches', {
        configurable: true,
        enumerable: true,
        value: type === 'touchend' ? toTouchList([]) : toTouchList(targetTouches),
      });
      Object.defineProperty(event, 'shiftKey', { configurable: true, enumerable: true, value: false });
      Object.defineProperty(event, 'ctrlKey', { configurable: true, enumerable: true, value: false });
      Object.defineProperty(event, 'metaKey', { configurable: true, enumerable: true, value: false });
      Object.defineProperty(event, 'altKey', { configurable: true, enumerable: true, value: false });
      target.dispatchEvent(event);
    };

    const identifier = Date.now() % 100000;
    let activeTouch = createTouch(sx, sy, identifier);
    dispatch('touchstart', [activeTouch], [activeTouch]);
    for (let step = 1; step <= totalSteps; step += 1) {
      const progress = step / totalSteps;
      const x = sx + (ex - sx) * progress;
      const y = sy + (ey - sy) * progress;
      activeTouch = createTouch(x, y, identifier);
      dispatch('touchmove', [activeTouch], [activeTouch]);
    }
    const endTouch = createTouch(ex, ey, identifier);
    dispatch('touchend', [], [endTouch]);
  }, { startX, startY, endX, endY, steps, selector });
}

async function getCanvasRect(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('stage');
    if (!canvas) throw new Error('Canvas not found');
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };
  });
}

async function getCanvasCenter(page) {
  const rect = await getCanvasRect(page);
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

async function setTimelineTime(page, seconds) {
  await page.evaluate((targetSeconds) => {
    const slider = document.getElementById('timelineRange');
    if (!slider) throw new Error('Timeline slider not found');
    const duration = window.animatorState?.timeline?.duration ?? 10;
    const clamped = Math.max(0, Math.min(duration, targetSeconds));
    const value = duration === 0 ? 0 : Math.round((clamped / duration) * 1000);
    slider.value = String(value);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  }, seconds);
}

async function setTool(page, tool) {
  const button = page.locator(`[data-tool="${tool}"]`);
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

async function drawRectangle(page, { offsetX = 0, offsetY = 0, width = 120, height = 80 } = {}) {
  const currentTool = await page.evaluate(() => window.animatorState?.tool ?? 'select');
  if (currentTool !== 'rectangle') {
    await setTool(page, 'rectangle');
  }
  const rect = await getCanvasRect(page);
  const startX = rect.x + rect.width / 2 - width / 2 + offsetX;
  const startY = rect.y + rect.height / 2 - height / 2 + offsetY;
  const endX = startX + width;
  const endY = startY + height;
  await pointerDrag(page, startX, startY, endX, endY, {});
}

async function drawLine(page, { startDelta = { x: -80, y: -40 }, endDelta = { x: 80, y: 40 } } = {}) {
  const center = await getCanvasCenter(page);
  const startX = center.x + startDelta.x;
  const startY = center.y + startDelta.y;
  const endX = center.x + endDelta.x;
  const endY = center.y + endDelta.y;
  await pointerDrag(page, startX, startY, endX, endY, {});
}

async function createTextShape(page, text = 'Inline Text', { offsetX = 0, offsetY = 0 } = {}) {
  const center = await getCanvasCenter(page);
  const x = center.x + offsetX;
  const y = center.y + offsetY;

  await dispatchPointerEvent(page, 'pointerdown', x, y, {});
  await dispatchPointerEvent(page, 'pointerup', x, y, {});

  const editor = page.locator('.canvas-text-editor');
  await editor.waitFor();
  await editor.fill(text);
  await editor.press('Enter');
  await expect(editor).toHaveCount(0);

  await expect.poll(() =>
    page.evaluate(() => window.animatorState.shapes.filter((shape) => shape.type === 'text').length),
  ).toBeGreaterThan(0);

  await ensureSelectionCount(page, 1);
  const snapshot = await getSelectedShapeSnapshot(page);
  expect(snapshot?.type).toBe('text');
  return snapshot;
}

async function ensureShapeCount(page, count) {
  await expect.poll(() => page.evaluate(() => window.animatorState.shapes.length)).toBe(count);
}

async function ensureSelectionCount(page, count) {
  await expect.poll(() => page.evaluate(() => window.animatorState.selectedIds.size)).toBe(count);
}

async function getSelectedShapeSnapshot(page) {
  return page.evaluate(() => {
    if (!window.animatorState) return null;
    const ids = Array.from(window.animatorState.selectedIds || []);
    if (ids.length !== 1) return null;
    const shape = window.animatorState.shapes.find((entry) => entry.id === ids[0]);
    if (!shape) return null;
    return {
      id: shape.id,
      type: shape.type,
      live: JSON.parse(JSON.stringify(shape.live)),
      style: JSON.parse(JSON.stringify(shape.style)),
    };
  });
}

async function getShapeSnapshot(page, shapeId) {
  return page.evaluate((id) => {
    const shape = window.animatorState.shapes.find((entry) => entry.id === id);
    if (!shape) return null;
    return {
      id: shape.id,
      type: shape.type,
      live: JSON.parse(JSON.stringify(shape.live)),
      style: JSON.parse(JSON.stringify(shape.style)),
    };
  }, shapeId);
}

async function getShapeBounds(page, shapeId = null) {
  return page.evaluate((id) => {
    const api = window.animatorApi;
    if (!api) return null;
    const target = id === null ? undefined : id;
    return api.getShapeBounds(target) ?? null;
  }, shapeId ?? null);
}

async function getSelectionClientCenter(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('stage');
    if (!canvas) return null;
    const selection = window.animatorState?.selection;
    if (!selection) return null;
    const bounds = window.animatorApi?.getShapeBounds(selection.id);
    if (!bounds) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + bounds.x + bounds.width / 2,
      y: rect.top + bounds.y + bounds.height / 2,
    };
  });
}

async function resizeShapeFromHandle(page, { shapeId = null, deltaX = 80, deltaY = 80, steps = 8 } = {}) {
  const info = await page.evaluate((id) => {
    const api = window.animatorApi;
    if (!api) return null;
    const target = id === null ? undefined : id;
    const handlePoint = api.getResizeHandleClientPoint(target);
    if (!handlePoint) return null;
    const shape = (() => {
      if (!window.animatorState) return null;
      if (target === undefined) {
        return window.animatorState.selection;
      }
      return window.animatorState.shapes.find((entry) => entry.id === target) || null;
    })();
    if (!shape) return null;
    const canvasElement = document.getElementById('stage');
    if (!canvasElement) return null;
    const rect = canvasElement.getBoundingClientRect();
    let centerPoint = null;
    if (shape.type === 'line' || shape.type === 'arrow') {
      const start = shape.live?.start;
      const end = shape.live?.end;
      if (!start || !end) return null;
      centerPoint = {
        x: rect.left + (start.x + end.x) / 2,
        y: rect.top + (start.y + end.y) / 2,
      };
    } else if (shape.type === 'free' && Array.isArray(shape.live?.points) && shape.live.points.length > 0) {
      const xs = shape.live.points.map((pt) => pt.x);
      const ys = shape.live.points.map((pt) => pt.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      centerPoint = {
        x: rect.left + (minX + maxX) / 2,
        y: rect.top + (minY + maxY) / 2,
      };
    } else if (typeof shape.live?.x === 'number' && typeof shape.live?.y === 'number') {
      centerPoint = {
        x: rect.left + shape.live.x + (shape.live.width || 0) / 2,
        y: rect.top + shape.live.y + (shape.live.height || 0) / 2,
      };
    } else {
      return null;
    }
    return { handle: handlePoint, center: centerPoint };
  }, shapeId ?? null);
  if (!info) throw new Error('Resize handle unavailable');

  const { handle, center } = info;
  const radialVector = { x: handle.x - center.x, y: handle.y - center.y };
  const baseLength = Math.hypot(radialVector.x, radialVector.y) || 1;
  const direction = { x: radialVector.x / baseLength, y: radialVector.y / baseLength };
  const requestedVector = { x: deltaX, y: deltaY };
  const requestedMagnitude = Math.hypot(requestedVector.x, requestedVector.y);
  const directionDot = direction.x * requestedVector.x + direction.y * requestedVector.y;
  const signedMagnitude = requestedMagnitude * (directionDot >= 0 ? 1 : -1);

  await dispatchPointerEvent(page, 'pointerdown', handle.x, handle.y, {});
  for (let i = 1; i <= steps; i += 1) {
    const progress = i / steps;
    const distance = baseLength + signedMagnitude * progress;
    const targetX = center.x + direction.x * distance;
    const targetY = center.y + direction.y * distance;
    await dispatchPointerEvent(page, 'pointermove', targetX, targetY, {});
  }

  const finalDistance = baseLength + signedMagnitude;
  const finalX = center.x + direction.x * finalDistance;
  const finalY = center.y + direction.y * finalDistance;
  await dispatchPointerEvent(page, 'pointerup', finalX, finalY, {});
}

async function getConnectorBendHandlePoint(page, shapeId = null) {
  return page.evaluate((id) => {
    const api = window.animatorApi;
    if (!api) return null;
    const target = id === null ? undefined : id;
    return api.getConnectorBendHandleClientPoint(target) ?? null;
  }, shapeId ?? null);
}

async function bendConnectorFromHandle(page, { shapeId = null, deltaX = 0, deltaY = -80, steps = 8 } = {}) {
  const handle = await getConnectorBendHandlePoint(page, shapeId);
  if (!handle) throw new Error('Connector bend handle unavailable');

  await dispatchPointerEvent(page, 'pointerdown', handle.x, handle.y, {});
  for (let i = 1; i <= steps; i += 1) {
    const progress = i / steps;
    await dispatchPointerEvent(page, 'pointermove', handle.x + deltaX * progress, handle.y + deltaY * progress, {});
  }
  await dispatchPointerEvent(page, 'pointerup', handle.x + deltaX, handle.y + deltaY, {});
}

async function getRotationHandleInfo(page, shapeId = null) {
  return page.evaluate((id) => {
    const canvas = document.getElementById('stage');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const api = window.animatorApi;
    if (!api) return null;
    const target = id === null ? undefined : id;
    const point = api.getRotationHandleClientPoint(target);
    const bounds = api.getShapeBounds(target);
    if (!point || !bounds) return null;
    const canvasRect = {
      x: rect.left,
      y: rect.top,
    };
    const center = {
      x: canvasRect.x + bounds.x + bounds.width / 2,
      y: canvasRect.y + bounds.y + bounds.height / 2,
    };
    return {
      handle: point,
      bounds,
      canvasRect,
      center,
    };
  }, shapeId ?? null);
}

async function rotateSelectionFromHandle(page, { shapeId = null, sweepDegrees = 140, radius = 120 } = {}) {
  const info = await getRotationHandleInfo(page, shapeId);
  if (!info) throw new Error('Rotation handle unavailable');
  const { handle, center } = info;
  const targetX = center.x + Math.cos((sweepDegrees * Math.PI) / 180) * radius;
  const targetY = center.y + Math.sin((sweepDegrees * Math.PI) / 180) * radius;
  await dispatchPointerEvent(page, 'pointerdown', handle.x, handle.y, {});
  await dispatchPointerEvent(page, 'pointermove', targetX, targetY, {});
  await dispatchPointerEvent(page, 'pointerup', targetX, targetY, {});
}

async function waitForExportStatus(page, matcher, { timeout = 10000 } = {}) {
  const status = page.locator('#exportStatus');
  await expect(status).toHaveText(matcher, { timeout });
  return status;
}

module.exports = {
  loadApp,
  dispatchPointerEvent,
  dispatchMouseEvent,
  pointerDrag,
  mouseDrag,
  touchDrag,
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
  getConnectorBendHandlePoint,
  bendConnectorFromHandle,
  getRotationHandleInfo,
  rotateSelectionFromHandle,
  waitForExportStatus,
};
