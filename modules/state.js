import { canvas, defaultTool, elements, getInitialOption } from "./dom.js";
import { DEFAULT_TIMELINE_DURATION } from "./constants.js";
import { normalizeDegrees, degreesToRadians, rotatePointAround } from "./math.js";

const DEFAULT_STAGE_WIDTH = canvas ? Number(canvas.getAttribute("width")) || 1280 : 1280;
const DEFAULT_STAGE_HEIGHT = canvas ? Number(canvas.getAttribute("height")) || 720 : 720;
const MIN_STAGE_WIDTH = 320;
const MIN_STAGE_HEIGHT = 240;
const MAX_STAGE_WIDTH = 4096;
const MAX_STAGE_HEIGHT = 3072;

const state = {
  tool: defaultTool,
  shapes: [],
  selection: null,
  selectedIds: new Set(),
  hoverHandle: null,
  stage: {
    width: DEFAULT_STAGE_WIDTH,
    height: DEFAULT_STAGE_HEIGHT,
    minWidth: MIN_STAGE_WIDTH,
    minHeight: MIN_STAGE_HEIGHT,
    maxWidth: MAX_STAGE_WIDTH,
    maxHeight: MAX_STAGE_HEIGHT,
    autoFit: true,
  },
  style: {
    fill: elements.fillColor.value,
    fillStyle: getInitialOption(elements.fillStyleButtons, "fillStyle", "cross-hatch"),
    stroke: elements.strokeColor.value,
    strokeWidth: Number(elements.strokeWidth.value),
    fontFamily: elements.fontFamily.value,
    fontSize: 32,
    strokeStyle: getInitialOption(elements.strokeStyleButtons, "strokeStyle", "solid"),
  edgeStyle: getInitialOption(elements.edgeStyleButtons, "edgeStyle", "round"),
    sloppiness: getInitialOption(elements.sloppinessButtons, "sloppiness", "neat"),
    opacity: elements.opacity ? Number(elements.opacity.value) / 100 : 1,
    rotation: 0,
    bend: 0,
    arrowStart: false,
    arrowEnd: false,
  },
  groups: {},
  timeline: {
    duration: Number(elements.timelineDuration.value) || DEFAULT_TIMELINE_DURATION,
    current: 0,
    isPlaying: false,
    lastTick: null,
    loop: true,
    bounce: false,
    direction: 1,
    exportFps: elements.exportFps ? Number(elements.exportFps.value) || 25 : 25,
  },
  pointer: {
    down: false,
    start: { x: 0, y: 0 },
    current: { x: 0, y: 0 },
    mode: "idle",
    tempShape: null,
    startSnapshot: null,
    modifiedConnectors: new Set(),
    rotationCenter: null,
    rotationStartAngle: 0,
    rotationInitial: 0,
    startFontSizes: null,
    marquee: null,
    marqueeAppend: false,
    resizeBounds: null,
    usingPointerEvents: false,
    selectionBounds: null,
  },
  alignmentGuides: {
    vertical: [],   // Array of x coordinates
    horizontal: [], // Array of y coordinates
  },
  clipboard: null,
};

let shapeIdCounter = 1;
let groupIdCounter = 1;

function nextShapeId() {
  return shapeIdCounter++;
}

function nextGroupId() {
  return `group-${groupIdCounter++}`;
}

function setShapeIdCounter(nextValue) {
  const candidate = Number.isFinite(nextValue) && nextValue > 0 ? Math.floor(nextValue) : 1;
  shapeIdCounter = candidate;
}

function setGroupIdCounter(nextValue) {
  const candidate = Number.isFinite(nextValue) && nextValue > 0 ? Math.floor(nextValue) : 1;
  groupIdCounter = candidate;
}

function getShapeById(id) {
  return state.shapes.find((shape) => shape.id === id) || null;
}

function getSelectedShapes() {
  return state.shapes.filter((shape) => state.selectedIds.has(shape.id));
}

function selectionCount() {
  return state.selectedIds.size;
}

function isShapeSelected(shape) {
  return Boolean(shape && state.selectedIds.has(shape.id));
}

function getSelectableShapes(shape) {
  if (!shape) return [];
  if (shape.groupId) {
    const group = state.groups[shape.groupId];
    if (group) {
      return group.memberIds.map((id) => getShapeById(id)).filter(Boolean);
    }
  }
  return [shape];
}

function isConnectorShape(shape) {
  return Boolean(
    shape && (shape.type === "connector" || shape.type === "arrow" || shape.type === "line"),
  );
}

function getSelectionBounds(shapes) {
  if (!Array.isArray(shapes) || shapes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const boundsArray = shapes
    .map((shape) => getShapeBounds(shape))
    .filter((bounds) => bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y));
  if (boundsArray.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const minX = Math.min(...boundsArray.map((b) => b.x));
  const minY = Math.min(...boundsArray.map((b) => b.y));
  const maxX = Math.max(...boundsArray.map((b) => b.x + b.width));
  const maxY = Math.max(...boundsArray.map((b) => b.y + b.height));
  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

function canRotateShape(shape) {
  if (!shape) return false;
  if (isConnectorShape(shape)) return true;
  return (
    shape.type === "rectangle" ||
    shape.type === "diamond" ||
    shape.type === "square" ||
    shape.type === "circle" ||
    shape.type === "text" ||
    shape.type === "image" ||
    shape.type === "free"
  );
}

function getShapeCenter(shape) {
  if (!shape) return null;
  switch (shape.type) {
    case "rectangle":
    case "diamond":
    case "square":
    case "circle":
    case "text":
    case "image": {
      const live = shape.live || {};
      const width = Number(live.width) || 0;
      const height = Number(live.height) || 0;
      const x = Number(live.x) || 0;
      const y = Number(live.y) || 0;
      return {
        x: x + width / 2,
        y: y + height / 2,
      };
    }
    case "free": {
      const points = shape.live?.points;
      if (!Array.isArray(points) || points.length === 0) return null;
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      return {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2,
      };
    }
    case "line":
    case "arrow":
    case "connector": {
      const start = shape.live?.start;
      const end = shape.live?.end;
      if (!start || !end) return null;
      if (!Number.isFinite(start.x) || !Number.isFinite(start.y) || !Number.isFinite(end.x) || !Number.isFinite(end.y)) {
        return null;
      }
      return {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      };
    }
    default:
      return null;
  }
}

function getShapeBounds(shape) {
  if (!shape) return { x: 0, y: 0, width: 0, height: 0 };
  switch (shape.type) {
  case "rectangle":
  case "diamond":
    case "square":
    case "circle":
    case "text": {
      const live = shape.live || {};
      const width = Number(live.width) || 0;
      const height = Number(live.height) || 0;
      const x = Number(live.x) || 0;
      const y = Number(live.y) || 0;
      if (!canRotateShape(shape)) {
        return { x, y, width, height };
      }
      const rotation = normalizeDegrees(typeof shape.style?.rotation === "number" ? shape.style.rotation : 0);
      if (rotation === 0) {
        return { x, y, width, height };
      }
      return getRotatedBounds(x, y, width, height, rotation);
    }
    case "free": {
      const points = shape.live?.points;
      if (!Array.isArray(points) || points.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
      }
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const rotation = normalizeDegrees(typeof shape.style?.rotation === "number" ? shape.style.rotation : 0);
      if (rotation === 0) {
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      }
      const center = {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
      };
      const angle = degreesToRadians(rotation);
      const rotatedPoints = points.map((point) => rotatePointAround(point, center, angle));
      const rotatedXs = rotatedPoints.map((point) => point.x);
      const rotatedYs = rotatedPoints.map((point) => point.y);
      return {
        x: Math.min(...rotatedXs),
        y: Math.min(...rotatedYs),
        width: Math.max(...rotatedXs) - Math.min(...rotatedXs),
        height: Math.max(...rotatedYs) - Math.min(...rotatedYs),
      };
    }
    case "line":
    case "arrow":
    case "connector": {
      const { start, end } = shape.live;
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    default: {
      const { x = 0, y = 0, width = 0, height = 0 } = shape.live || {};
      return { x, y, width, height };
    }
  }
}

function getRotatedBounds(x, y, width, height, rotationDegrees) {
  const center = {
    x: x + width / 2,
    y: y + height / 2,
  };
  const angle = degreesToRadians(rotationDegrees);
  const corners = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ].map((corner) => rotatePointAround(corner, center, angle));
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export {
  state,
  nextShapeId,
  nextGroupId,
  setShapeIdCounter,
  setGroupIdCounter,
  getShapeById,
  getSelectedShapes,
  selectionCount,
  isShapeSelected,
  getSelectableShapes,
  isConnectorShape,
  getSelectionBounds,
  canRotateShape,
  getShapeCenter,
  getShapeBounds,
  getRotatedBounds,
};
