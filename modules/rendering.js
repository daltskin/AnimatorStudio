import { canvas, ctx } from "./dom.js";
import {
  state,
  getSelectedShapes,
  getSelectionBounds,
  canRotateShape,
  getShapeCenter,
  getShapeBounds,
  isConnectorShape,
} from "./state.js";
import { ROTATION_HANDLE_OFFSET, ROTATION_HANDLE_RADIUS } from "./constants.js";
import {
  clamp,
  distance,
  distanceToSegment,
  normalizeDegrees,
  degreesToRadians,
} from "./math.js";

const measureCanvas = document.createElement("canvas");
const measureCtx = measureCanvas.getContext("2d");
const CONNECTOR_BEND_HANDLE_RADIUS = 8;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function renderStage() {
  const ratio = window.devicePixelRatio || 1;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.save();
  ctx.scale(ratio, ratio);
  drawShapes(ctx);
  drawSelectionBounds(ctx);
  drawMarqueeSelection(ctx);
  ctx.restore();
}

function drawShapes(context) {
  state.shapes.forEach((shape) => {
    // Only draw shapes if timeline is at or after their creation time
    if (shape.keyframes.length > 0) {
      // Determine the "creation time" of the shape
      let creationTime;
      if (shape.keyframes.length === 1) {
        // Single keyframe - use that time
        creationTime = shape.keyframes[0].time;
      } else {
        // Multiple keyframes - check if first is a base keyframe at time 0
        const sorted = shape.keyframes.slice().sort((a, b) => a.time - b.time);
        if (Math.abs(sorted[0].time) < 0.0001 && sorted.length > 1) {
          // First keyframe is at time ~0, shape was created at second keyframe time
          creationTime = sorted[1].time;
        } else {
          // Use the earliest keyframe time
          creationTime = sorted[0].time;
        }
      }
      
      if (state.timeline.current < creationTime) {
        return; // Skip drawing this shape
      }
    }
    drawShape(context, shape);
  });
}

function drawShape(context, shape) {
  const style = shape.style || {};
  const strokeWidth = Number(style.strokeWidth) || 0;
  context.save();
  context.lineWidth = strokeWidth;
  context.strokeStyle = style.stroke || state.style.stroke;
  context.fillStyle = style.fill || state.style.fill;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.globalAlpha = clamp(typeof style.opacity === "number" ? style.opacity : state.style.opacity ?? 1, 0, 1);
  applyStrokePattern(context, style, strokeWidth);

  const shouldRotateContext = canRotateShape(shape) && !isConnectorShape(shape);
  const rotationDegrees = shouldRotateContext
    ? normalizeDegrees(typeof style.rotation === "number" ? style.rotation : state.style.rotation ?? 0)
    : 0;
  if (rotationDegrees !== 0) {
    const center = getShapeCenter(shape);
    if (center) {
      context.translate(center.x, center.y);
      context.rotate(degreesToRadians(rotationDegrees));
      context.translate(-center.x, -center.y);
    }
  }

  switch (shape.type) {
    case "rectangle":
    case "square":
      drawRectangleShape(context, shape, strokeWidth);
      break;
    case "circle":
      drawCircleShape(context, shape, strokeWidth);
      break;
    case "text":
      drawTextShape(context, shape, strokeWidth);
      break;
    case "image":
      drawImageShape(context, shape, strokeWidth);
      break;
    case "line":
    case "connector":
    case "arrow":
      drawConnectorShape(context, shape, strokeWidth);
      break;
    case "free":
      drawFreeShape(context, shape);
      break;
    default:
      break;
  }

  context.restore();
}

function drawRectangleShape(context, shape, strokeWidth) {
  const { live, style = {} } = shape;
  const edgeStyle = style.edgeStyle || state.style.edgeStyle || "curved";
  const radius = edgeStyle === "curved" ? 12 : 0;

  context.beginPath();
  if (radius > 0 && typeof context.roundRect === "function") {
    context.roundRect(live.x, live.y, live.width, live.height, radius);
  } else if (radius > 0) {
    traceRoundedRectPath(context, live.x, live.y, live.width, live.height, radius);
    context.closePath();
  } else {
    context.rect(live.x, live.y, live.width, live.height);
  }

  context.fill();
  if (strokeWidth > 0) {
    context.stroke();
    drawSloppyOutline(
      context,
      [
        { x: live.x, y: live.y },
        { x: live.x + live.width, y: live.y },
        { x: live.x + live.width, y: live.y + live.height },
        { x: live.x, y: live.y + live.height },
      ],
      style,
      shape.id,
      true,
    );
  }
}

function drawCircleShape(context, shape, strokeWidth) {
  const { live, style = {} } = shape;
  const radiusX = Math.abs(live.width) / 2;
  const radiusY = Math.abs(live.height) / 2;
  const centerX = live.x + Math.sign(live.width || 1) * radiusX;
  const centerY = live.y + Math.sign(live.height || 1) * radiusY;

  context.beginPath();
  context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.fill();
  if (strokeWidth > 0) {
    context.stroke();
    drawSloppyEllipse(context, centerX, centerY, radiusX, radiusY, style, shape.id);
  }
}

function drawTextShape(context, shape, strokeWidth) {
  const { live, style = {} } = shape;
  const { fontString } = getFontSettings(style);
  const text = live.text;

  if (!text) return;

  context.save();
  context.setLineDash([]);
  context.font = fontString;
  context.textBaseline = "top";
  context.fillText(text, live.x, live.y);
  if (strokeWidth > 0) {
    context.lineWidth = strokeWidth;
    context.strokeText(text, live.x, live.y);
  }
  context.restore();
}

function drawImageShape(context, shape) {
  const { live = {}, style = {}, asset = {} } = shape;
  const opacity = clamp(typeof style.opacity === "number" ? style.opacity : state.style.opacity ?? 1, 0, 1);
  context.save();
  context.globalAlpha = opacity;
  if (asset.image instanceof Image) {
    context.drawImage(asset.image, live.x, live.y, live.width, live.height);
  } else {
    context.fillStyle = "rgba(148, 163, 184, 0.25)";
    context.strokeStyle = "rgba(148, 163, 184, 0.6)";
    context.lineWidth = 2;
    context.beginPath();
    context.rect(live.x, live.y, live.width, live.height);
    context.fill();
    context.stroke();
    context.font = "14px Inter, sans-serif";
    context.fillStyle = "rgba(148, 163, 184, 0.9)";
    context.fillText("Image loading…", live.x + 12, live.y + 24);
  }
  context.restore();
}

function drawConnectorShape(context, shape, strokeWidth) {
  const { live, style = {} } = shape;
  const start = applyJitter(live.start, style, `${shape.id}:start`);
  const end = applyJitter(live.end, style, `${shape.id}:end`);
  const sloppinessAmplitude = getSloppinessAmplitude(style);
  const bend = clamp(typeof style.bend === "number" ? style.bend : state.style.bend || 0, -100, 100);
  const edgeStyle = style.edgeStyle || state.style.edgeStyle || "curved";
  const useCurved = edgeStyle === "curved" || Math.abs(bend) > 0.1;

  context.beginPath();
  context.moveTo(start.x, start.y);
  let control = null;

  if (useCurved) {
    const geometry = computeConnectorControlData(start, end, style, shape.id, bend);
    control = geometry?.control || null;
    if (control) {
      context.quadraticCurveTo(control.x, control.y, end.x, end.y);
    } else {
      context.lineTo(end.x, end.y);
    }
  } else {
    context.lineTo(end.x, end.y);
  }

  context.stroke();

  if (sloppinessAmplitude > 0) {
    const samples = control ? sampleQuadraticPoints(start, control, end, 12) : [start, end];
    drawSloppyOutline(context, samples, style, `${shape.id}:connector`, false);
  }

  const resolveArrowFlag = (value, fallback) => {
    if (typeof value === "boolean") return value;
    return fallback;
  };

  const legacyType = shape.type || "connector";
  const arrowStartEnabled = resolveArrowFlag(style.arrowStart, legacyType === "arrow" ? false : false);
  const arrowEndEnabled = resolveArrowFlag(style.arrowEnd, legacyType === "arrow" || legacyType === "connector");

  const getSegmentPoint = (t) => {
    if (useCurved && control) {
      return getQuadraticPoint(start, control, end, clamp(t, 0, 1));
    }
    return {
      x: start.x + (end.x - start.x) * clamp(t, 0, 1),
      y: start.y + (end.y - start.y) * clamp(t, 0, 1),
    };
  };

  const arrowSize = Math.max(8, strokeWidth * 3);
  if (arrowStartEnabled) {
    const tip = getSegmentPoint(0.02);
    const base = getSegmentPoint(0.18);
    if (distance(base, tip) > 0.5) {
      drawArrowHead(context, base, tip, arrowSize);
    }
  }
  if (arrowEndEnabled) {
    const base = getSegmentPoint(0.82);
    const tip = getSegmentPoint(0.98);
    if (distance(base, tip) > 0.5) {
      drawArrowHead(context, base, tip, arrowSize);
    }
  }

  const hasBindings = Boolean(shape.bindings && (shape.bindings.start || shape.bindings.end));
  if (hasBindings) {
    drawConnectorEndpoints(context, start, end, strokeWidth);
  }
}

function drawFreeShape(context, shape) {
  const points = shape?.live?.points || [];
  if (points.length < 2) return;
  const style = shape.style || {};
  const jittered = jitterPoints(points, getSloppinessAmplitude(style), `${shape.id}:free`);
  context.beginPath();
  context.moveTo(jittered[0].x, jittered[0].y);
  for (let i = 1; i < jittered.length; i += 1) {
    context.lineTo(jittered[i].x, jittered[i].y);
  }
  context.stroke();
}

function applyStrokePattern(context, style, strokeWidth) {
  const strokeStyle = style.strokeStyle || state.style.strokeStyle || "solid";
  if (strokeStyle === "dashed") {
    const dashSize = Math.max(4, strokeWidth * 2);
    context.setLineDash([dashSize, dashSize]);
  } else if (strokeStyle === "dotted") {
    const gap = Math.max(2, strokeWidth * 1.5);
    context.setLineDash([0, gap]);
    context.lineCap = "round";
  } else {
    context.setLineDash([]);
  }
}

function drawSloppyOutline(context, points, style, seed, closed = false) {
  const amplitude = getSloppinessAmplitude(style);
  if (amplitude <= 0) return;
  const working = closed ? [...points, points[0]] : points;
  const jittered = jitterPoints(working, amplitude, `${seed}:outline`);
  context.save();
  context.beginPath();
  context.moveTo(jittered[0].x, jittered[0].y);
  for (let i = 1; i < jittered.length; i += 1) {
    context.lineTo(jittered[i].x, jittered[i].y);
  }
  if (closed) context.closePath();
  context.stroke();
  context.restore();
}

function drawSloppyEllipse(context, cx, cy, rx, ry, style, seed) {
  const amplitude = getSloppinessAmplitude(style);
  if (amplitude <= 0) return;
  const points = [];
  const segments = 32;
  for (let i = 0; i <= segments; i += 1) {
    const theta = (i / segments) * Math.PI * 2;
    points.push({
      x: cx + Math.cos(theta) * rx,
      y: cy + Math.sin(theta) * ry,
    });
  }

  drawSloppyOutline(context, points, style, `${seed}:ellipse`, true);
}

function traceRoundedRectPath(context, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2));
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
}

function applyJitter(point, style, seed) {
  const amplitude = getSloppinessAmplitude(style);
  if (amplitude <= 0 || !point) return point;
  return {
    x: point.x + jitterValue(`${seed}:x`, amplitude),
    y: point.y + jitterValue(`${seed}:y`, amplitude),
  };
}

function jitterPoints(points, amplitude, seedBase) {
  if (!amplitude || amplitude <= 0) return points.slice();
  return points.map((point, index) => ({
    x: point.x + jitterValue(`${seedBase}:${index}:x`, amplitude),
    y: point.y + jitterValue(`${seedBase}:${index}:y`, amplitude),
  }));
}

function jitterValue(seed, amplitude) {
  return (seededRandom(seed) - 0.5) * 2 * amplitude;
}

function seededRandom(seed) {
  let hash = 2166136261;
  const str = String(seed);
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) & 0xffffffff) / 4294967296;
}

function getSloppinessAmplitude(style = {}) {
  const value = style.sloppiness || state.style.sloppiness || "neat";
  switch (value) {
    case "arty":
      return 2.5;
    case "sketch":
      return 5;
    default:
      return 0;
  }
}

function computeConnectorControlData(start, end, style = {}, seed, overrideBend = null) {
  if (!start || !end) return null;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length < 0.001) {
    return null;
  }

  const mid = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const normal = {
    x: -dy / length,
    y: dx / length,
  };

  const fallbackBend = state.style?.bend ?? 0;
  const bendSource = overrideBend ?? style?.bend ?? fallbackBend;
  const bendValue = clamp(typeof bendSource === "number" ? bendSource : fallbackBend, -100, 100);
  const bendNormalized = bendValue / 100;

  const edgeStyle = style?.edgeStyle || state.style.edgeStyle || "curved";
  const baseFactor = edgeStyle === "curved" ? 0.2 : 0;
  const baseOffset = length * baseFactor;

  const sloppiness = getSloppinessAmplitude(style) * 1.5;
  const jitterAmplitude = edgeStyle === "curved" ? length * 0.05 + sloppiness * 0.6 : 0;
  const jitter = jitterAmplitude !== 0 ? jitterValue(`${seed}:bend`, jitterAmplitude) : 0;

  const bendOffset = bendNormalized * length * 0.6;
  const offset = baseOffset + bendOffset + jitter;
  const control = {
    x: mid.x + normal.x * offset,
    y: mid.y + normal.y * offset,
  };

  return {
    start,
    end,
    mid,
    normal,
    length,
    edgeStyle,
    bend: bendValue,
    bendNormalized,
    baseOffset,
    bendOffset,
    jitter,
    offset,
    control,
  };
}

function getConnectorControlPoint(start, end, style, seed, bend = 0) {
  const geometry = computeConnectorControlData(start, end, style, seed, bend);
  return geometry?.control || null;
}

function getQuadraticPoint(p0, p1, p2, t) {
  const oneMinusT = 1 - t;
  const x = oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x;
  const y = oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y;
  return { x, y };
}

function sampleQuadraticPoints(p0, p1, p2, segments = 8) {
  const points = [];
  const steps = Math.max(2, segments);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    points.push(getQuadraticPoint(p0, p1, p2, t));
  }
  return points;
}

function drawConnectorEndpoints(context, start, end, strokeWidth) {
  context.save();
  context.setLineDash([]);
  context.fillStyle = context.strokeStyle;
  const radius = Math.max(2, strokeWidth * 1.5);
  context.beginPath();
  context.arc(start.x, start.y, radius, 0, Math.PI * 2);
  context.arc(end.x, end.y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawArrowHead(context, start, end, size) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const headLength = Math.max(8, size);
  const leftX = end.x - headLength * Math.cos(angle - Math.PI / 6);
  const leftY = end.y - headLength * Math.sin(angle - Math.PI / 6);
  const rightX = end.x - headLength * Math.cos(angle + Math.PI / 6);
  const rightY = end.y - headLength * Math.sin(angle + Math.PI / 6);

  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(leftX, leftY);
  context.lineTo(rightX, rightY);
  context.closePath();
  context.fillStyle = context.strokeStyle;
  context.fill();
}

function drawSelectionBounds(context) {
  const selected = getSelectedShapes();
  if (selected.length === 0) return;

  context.save();
  context.setLineDash([8, 5]);
  context.strokeStyle = "#60a5fa";
  context.lineWidth = 2.5;
  context.shadowColor = "rgba(96, 165, 250, 0.6)";
  context.shadowBlur = 8;

  if (selected.length === 1) {
    const shape = selected[0];
    const bounds = getShapeBounds(shape);
    if (isConnectorShape(shape)) {
      context.beginPath();
      context.moveTo(shape.live.start.x, shape.live.start.y);
      context.lineTo(shape.live.end.x, shape.live.end.y);
      context.stroke();
      if (bounds.width > 0 || bounds.height > 0) {
        context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      }
    } else {
      context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }

    if (bounds.width > 0 || bounds.height > 0) {
      drawResizeHandle(context, bounds.x + bounds.width, bounds.y + bounds.height);
    }

    if (isConnectorShape(shape)) {
      drawConnectorBendHandle(context, shape);
    }

    if (canRotateShape(shape)) {
      drawRotationHandle(context, shape, bounds);
    }
  } else {
    const bounds = getSelectionBounds(selected);
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  }

  context.restore();
}

function drawMarqueeSelection(context) {
  const marquee = state.pointer?.marquee;
  if (!marquee || !marquee.rect) return;
  const { rect } = marquee;
  if (!Number.isFinite(rect.x) || !Number.isFinite(rect.y)) return;
  if (rect.width < 1 && rect.height < 1) return;

  context.save();
  context.setLineDash([6, 4]);
  context.strokeStyle = "rgba(99, 102, 241, 0.9)";
  context.fillStyle = "rgba(99, 102, 241, 0.15)";
  context.lineWidth = 1;
  context.beginPath();
  context.rect(rect.x, rect.y, rect.width, rect.height);
  context.fill();
  context.stroke();
  context.restore();
}

function drawResizeHandle(context, x, y) {
  const size = 10;
  context.save();
  context.setLineDash([]);
  context.fillStyle = "#facc15";
  context.strokeStyle = "#111827";
  context.lineWidth = 1;
  context.beginPath();
  context.rect(x - size / 2, y - size / 2, size, size);
  context.fill();
  context.stroke();
  context.restore();
}

function drawConnectorBendHandle(context, shape) {
  const geometry = getConnectorBendGeometry(shape);
  if (!geometry || !geometry.control) return;
  context.save();
  context.setLineDash([]);
  context.fillStyle = "#facc15";
  context.strokeStyle = "#111827";
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(geometry.control.x, geometry.control.y, CONNECTOR_BEND_HANDLE_RADIUS, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function getConnectorBendGeometry(shape) {
  if (!shape || !isConnectorShape(shape)) return null;
  const live = shape.live || {};
  const start = live.start || shape.start;
  const end = live.end || shape.end;
  if (!start || !end) return null;
  if (!Number.isFinite(start.x) || !Number.isFinite(start.y) || !Number.isFinite(end.x) || !Number.isFinite(end.y)) {
    return null;
  }
  const style = shape.style || {};
  const seed = shape.id ?? `${start.x}:${start.y}:${end.x}:${end.y}`;
  return computeConnectorControlData(start, end, style, seed, style?.bend ?? null);
}

function hitConnectorBendHandle(shape, point) {
  if (!shape || !point || !isConnectorShape(shape)) return false;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  const geometry = getConnectorBendGeometry(shape);
  if (!geometry || !geometry.control) return false;
  const radius = CONNECTOR_BEND_HANDLE_RADIUS + 6;
  return distance(point, geometry.control) <= radius;
}

function drawRotationHandle(context, shape, bounds) {
  const handle = getRotationHandleCenter(shape, bounds);
  if (!handle) return;
  context.save();
  context.setLineDash([]);
  context.strokeStyle = "#facc15";
  context.fillStyle = "#facc15";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(handle.x, bounds.y);
  context.lineTo(handle.x, handle.y - ROTATION_HANDLE_RADIUS);
  context.stroke();

  context.beginPath();
  context.arc(handle.x, handle.y, ROTATION_HANDLE_RADIUS, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#111827";
  context.lineWidth = 1.5;
  context.stroke();
  context.restore();
}

function getFontSettings(style = {}) {
  const fallbackSize = Number(state?.style?.fontSize) || 32;
  const fallbackFamily = state?.style?.fontFamily || "Inter";
  const fontSize = Math.max(8, Math.min(200, Number(style.fontSize) || fallbackSize));
  const fontFamily = style.fontFamily || fallbackFamily;
  return {
    fontSize,
    fontFamily,
    fontString: `${fontSize}px ${fontFamily}`,
  };
}

function measureTextDimensions(style = {}, text = "") {
  const { fontString, fontSize } = getFontSettings(style);
  measureCtx.font = fontString;
  measureCtx.textBaseline = "top";
  const metrics = measureCtx.measureText(text || " ");
  const width = metrics.width || fontSize * 0.6;
  const height =
    (metrics.actualBoundingBoxAscent || fontSize * 0.8) +
    (metrics.actualBoundingBoxDescent || fontSize * 0.2);
  return { width, height, fontSize, fontString };
}

function hitResizeHandle(shape, point) {
  if (!shape || !point) return false;
  const bounds = getShapeBounds(shape);
  if (!Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)) return false;
  const handleSize = 12;
  const handleX = bounds.x + bounds.width;
  const handleY = bounds.y + bounds.height;
  const half = handleSize / 2;
  const handle = {
    x: handleX - half,
    y: handleY - half,
    width: handleSize,
    height: handleSize,
  };
  return (
    point.x >= handle.x &&
    point.x <= handle.x + handle.width &&
    point.y >= handle.y &&
    point.y <= handle.y + handle.height
  );
}

function getRotationHandleCenter(shape, bounds = null) {
  if (!canRotateShape(shape)) return null;
  const workingBounds = bounds || getShapeBounds(shape);
  if (!workingBounds) return null;
  return {
    x: workingBounds.x + workingBounds.width / 2,
    y: workingBounds.y - ROTATION_HANDLE_OFFSET,
  };
}

function hitRotationHandle(shape, point) {
  if (!shape || !canRotateShape(shape)) return false;
  const bounds = getShapeBounds(shape);
  const center = getRotationHandleCenter(shape, bounds);
  if (!center) return false;
  const radius = ROTATION_HANDLE_RADIUS + 4;
  return distance(point, center) <= radius;
}

function renderSceneToContext(targetCtx, { pixelRatio } = {}) {
  if (!targetCtx || !targetCtx.canvas) return;
  const ratioCandidate = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : window.devicePixelRatio || 1;
  targetCtx.save();
  targetCtx.setTransform(1, 0, 0, 1, 0, 0);
  targetCtx.fillStyle = state.stage.background || "#ffffff";
  targetCtx.fillRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
  targetCtx.restore();

  targetCtx.save();
  targetCtx.scale(ratioCandidate, ratioCandidate);
  drawShapes(targetCtx);
  targetCtx.restore();
}

export {
  resizeCanvas,
  renderStage,
  hitResizeHandle,
  hitRotationHandle,
  hitConnectorBendHandle,
  getRotationHandleCenter,
  getConnectorBendGeometry,
  renderSceneToContext,
  measureTextDimensions,
};
