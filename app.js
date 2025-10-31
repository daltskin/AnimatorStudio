import { encodeGif } from "./gifEncoder.js";

const DEFAULT_FILL_STYLE = "cross-hatch";
const DEFAULT_EDGE_STYLE = "round";
const DEFAULT_STROKE_STYLE = "solid";
const DEFAULT_TEXT_FONT = "Excalifont";

const FILL_STYLE_VALUES = new Set(["solid", "cross-hatch", "hachure"]);
const EDGE_STYLE_VALUES = new Set(["sharp", "round"]);
const STROKE_STYLE_VALUES = new Set(["solid", "dashed", "dotted"]);

const TOOLBAR_COLLAPSED_STORAGE_KEY = "animator.toolbar.collapsed";
const TOOL_MENU_COLLAPSED_STORAGE_KEY = "animator.toolMenu.collapsed";
const STAGE_BACKGROUND_STORAGE_KEY = "animator.stage.background";
const STAGE_SIZE_STORAGE_KEY = "animator.stage.size";
const TIPS_DISMISSED_KEY = "animator.tips.dismissed.items";
const LEGACY_TIPS_KEY = "animator.tips.dismissed";

const TIPS_CONTENT = [
  { id: "place-shapes", text: "Click the canvas to place shapes." },
  {
    id: "move-resize",
    text: "With a shape selected, drag to move or pull the corner handle to resize.",
  },
  { id: "rotate-shapes", text: "Use the blue rotation handle above shapes to rotate them." },
  { id: "timeline", text: "Use the timeline to set keyframes for smooth animations." },
  { id: "keyframe-drag", text: "Drag keyframe markers on the timeline to adjust animation timing." },
  { id: "arrow-tool", text: "Arrow tool can draw connectors with customizable endings." },
  { id: "zoom-controls", text: "Use Ctrl + mouse wheel or zoom buttons to zoom in/out on the canvas." },
  { id: "background-grid", text: "Right-click the canvas and enable background grid for precise alignment." },
  { id: "svg-paste", text: "Paste SVG code to import vector graphics onto the canvas." },
  { id: "png-paste", text: "Paste PNG images from clipboard to add photos and raster graphics." },
  { id: "mermaid-paste", text: "Paste Mermaid diagram syntax to automatically render flowcharts and diagrams." },
  { id: "group-shapes", text: "Select multiple shapes and use Group to move them together." },
];

const DEFAULT_STAGE_BACKGROUND =
  getComputedStyle(document.documentElement).getPropertyValue("--canvas-bg")?.trim() || "#ffffff";
const STROKE_WIDTH_DEFAULT_RANGE = { min: 1, max: 12 };
const STROKE_WIDTH_PEN_RANGE = { min: 1, max: 24 };

const TIMELINE_DEFAULT_DURATION = 5;
const HISTORY_LIMIT = 100;

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");

window.animatorReady = false;
window.animatorApi = null;

const elements = {
  toolButtons: Array.from(document.querySelectorAll(".tool-button[data-tool]")),
  fillColor: document.getElementById("fillColor"),
  strokeColor: document.getElementById("strokeColor"),
  strokeWidth: document.getElementById("strokeWidth"),
  strokeWidthValue: document.getElementById("strokeWidthValue"),
  strokeStyleButtons: Array.from(document.querySelectorAll("[data-stroke-style]")),
  strokeStyleControl: document.getElementById("strokeStyleControl"),
  sketchButtons: Array.from(document.querySelectorAll("[data-sketch-level]")),
  sketchControl: document.getElementById("sketchControl"),
  fillStyleButtons: Array.from(document.querySelectorAll("[data-fill-style]")),
  fillStyleControl: document.getElementById("fillStyleControl"),
  edgeStyleButtons: Array.from(document.querySelectorAll("[data-edge-style]")),
  edgeStyleControl: document.getElementById("edgeStyleControl"),
  opacity: document.getElementById("opacity"),
  opacityValue: document.getElementById("opacityValue"),
  fontFamily: document.getElementById("fontFamily"),
  fontFamilyControl: document.getElementById("fontFamily")?.closest(".control") || document.getElementById("fontFamily"),
  arrowToggleButtons: Array.from(document.querySelectorAll("[data-arrow-toggle]")),
  arrowEndingControl: document.getElementById("arrowEndingControl"),
  marqueeOverlay: document.getElementById("marqueeOverlay"),
  selectionLabel: document.getElementById("selectionLabel"),
  keyframeList: document.getElementById("keyframeList"),
  timelineTrack: document.getElementById("timelineTrack"),
  timelineMarker: document.querySelector(".timeline-marker"),
  timelineRange: document.getElementById("timelineRange"),
  timelineDuration: document.getElementById("timelineDuration"),
  currentTime: document.getElementById("currentTime"),
  playToggle: document.getElementById("playToggle"),
  stopPlayback: document.getElementById("stopPlayback"),
  addKeyframe: document.getElementById("addKeyframe"),
  deleteKeyframe: document.getElementById("deleteKeyframe"),
  loopToggle: document.getElementById("loopToggle"),
  bounceToggle: document.getElementById("bounceToggle"),
  bounceToggleLabel: document.getElementById("bounceToggleLabel"),
  exportFps: document.getElementById("exportFps"),
  exportScene: document.getElementById("exportScene"),
  exportGif: document.getElementById("exportGif"),
  exportStatus: document.getElementById("exportStatus"),
  exportMenu: document.querySelector(".export-menu"),
  clearCanvas: document.getElementById("clearCanvas"),
  importScene: document.getElementById("importScene"),
  importSceneInput: document.getElementById("importSceneInput"),
  groupShapes: document.getElementById("groupShapes"),
  ungroupShapes: document.getElementById("ungroupShapes"),
  deleteShape: document.getElementById("deleteShape"),
  stageBackgroundColor: document.getElementById("stageBackgroundColor"),
  backgroundGrid: document.getElementById("backgroundGrid"),
  shapeContextMenu: document.getElementById("shapeContextMenu"),
  stageContextMenu: document.getElementById("stageContextMenu"),
  tipsPanel: document.querySelector("[data-tips]"),
  tipsList: document.getElementById("tipsList"),
  canvasWrapper: document.querySelector(".canvas-wrapper"),
  stageSurface: document.querySelector(".stage-surface"),
  stageDimensions: document.getElementById("stageDimensions"),
  stageResizeHandle: document.getElementById("stageResizeHandle"),
  stageResizeHandles: Array.from(document.querySelectorAll("[data-stage-resize]")),
  zoomIn: document.getElementById("zoomIn"),
  zoomOut: document.getElementById("zoomOut"),
  zoomReset: document.getElementById("zoomReset"),
  appShell: document.querySelector(".app-shell"),
  toolbarToggles: Array.from(document.querySelectorAll("[data-toolbar-toggle]")),
  toolbar: document.querySelector(".toolbar"),
  floatingToolMenu: document.querySelector(".floating-tool-menu"),
  toolMenuToggle: document.querySelector("[data-tool-menu-toggle]"),
};

const FONT_FALLBACKS = {
  Excalifont: "sans-serif",
  Inter: "sans-serif",
  Poppins: "sans-serif",
  Roboto: "sans-serif",
  Montserrat: "sans-serif",
  "Source Sans Pro": "sans-serif",
  "Work Sans": "sans-serif",
  Nunito: "sans-serif",
  Raleway: "sans-serif",
  Merriweather: "serif",
  Lora: "serif",
  "Playfair Display": "serif",
  "DM Serif Display": "serif",
  "IBM Plex Mono": "monospace",
  "Courier Prime": "monospace",
  "Fira Code": "monospace",
  Caveat: "cursive",
  "Shadows Into Light": "cursive",
  "Permanent Marker": "cursive",
  Pacifico: "cursive",
  "Amatic SC": "cursive",
  Lobster: "cursive",
};

function getFontStack(fontFamily) {
  const family = fontFamily || DEFAULT_TEXT_FONT;
  const fallback = FONT_FALLBACKS[family] || "sans-serif";
  const sanitized = family.replace(/"/g, '\\"');
  return `"${sanitized}", ${fallback}`;
}

const findArrowToggleButton = (key) =>
  elements.arrowToggleButtons.find((button) => button.getAttribute("data-arrow-toggle") === key) || null;

const isButtonPressed = (button) => button?.getAttribute("aria-pressed") === "true";

const getInitialSketchLevel = () => {
  const active = elements.sketchButtons.find((button) => isButtonPressed(button));
  return active ? Number(active.getAttribute("data-sketch-level")) || 0 : 0;
};

const getInitialArrowState = (key, fallback = false) => {
  const button = findArrowToggleButton(key);
  return button ? isButtonPressed(button) : fallback;
};

const getInitialStrokeStyle = () => {
  const active = elements.strokeStyleButtons?.find((button) => isButtonPressed(button));
  return active?.getAttribute("data-stroke-style") || DEFAULT_STROKE_STYLE;
};

const getInitialFillStyle = () => {
  const active = elements.fillStyleButtons?.find((button) => isButtonPressed(button));
  return active?.getAttribute("data-fill-style") || DEFAULT_FILL_STYLE;
};

const getInitialEdgeStyle = () => {
  const active = elements.edgeStyleButtons?.find((button) => isButtonPressed(button));
  return active?.getAttribute("data-edge-style") || DEFAULT_EDGE_STYLE;
};

let dismissedTips = new Set();

function normalizeFillStyle(value, fallback = DEFAULT_FILL_STYLE) {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (FILL_STYLE_VALUES.has(normalized)) {
    return normalized;
  }
  if (normalized === "crosshatch" || normalized === "cross") {
    return "cross-hatch";
  }
  if (normalized === "hachured") {
    return "hachure";
  }
  return fallback;
}

function normalizeEdgeStyle(value, fallback = DEFAULT_EDGE_STYLE) {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (EDGE_STYLE_VALUES.has(normalized)) {
    return normalized;
  }
  if (normalized === "curved" || normalized === "rounded") {
    return "round";
  }
  if (normalized === "straight") {
    return "sharp";
  }
  return fallback;
}

function normalizeStrokeStyle(value, fallback = DEFAULT_STROKE_STYLE) {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (STROKE_STYLE_VALUES.has(normalized)) {
    return normalized;
  }
  if (normalized === "dash" || normalized === "dashes") {
    return "dashed";
  }
  if (normalized === "dot" || normalized === "dots") {
    return "dotted";
  }
  return fallback;
}

function ensureStyleHasFillStyle(style, shapeType) {
  if (!style || typeof style !== "object") {
    return;
  }
  style.strokeStyle = normalizeStrokeStyle(style.strokeStyle ?? state?.style?.strokeStyle ?? DEFAULT_STROKE_STYLE);
  const isConnector = shapeType === "line" || shapeType === "arrow";
  if (isConnector) {
    delete style.fillStyle;
    delete style.edgeStyle;
    style.sketchLevel = 0;
    return;
  }
  style.fillStyle = normalizeFillStyle(style.fillStyle ?? state?.style?.fillStyle ?? DEFAULT_FILL_STYLE);
  style.edgeStyle = normalizeEdgeStyle(style.edgeStyle ?? state?.style?.edgeStyle ?? DEFAULT_EDGE_STYLE);
}

const state = {
  tool: "select",
  shapes: [],
  selection: null,
  selectedIds: new Set(),
  hoverHandle: null,
  toolbarCollapsed: false,
  toolMenuCollapsed: false,
  style: {
    fill: elements.fillColor.value,
    fillStyle: normalizeFillStyle(getInitialFillStyle(), DEFAULT_FILL_STYLE),
    stroke: elements.strokeColor.value,
    strokeWidth: Number(elements.strokeWidth.value),
    strokeStyle: normalizeStrokeStyle(getInitialStrokeStyle(), DEFAULT_STROKE_STYLE),
    sketchLevel: getInitialSketchLevel(),
    arrowStart: getInitialArrowState("start", false),
    arrowEnd: getInitialArrowState("end", true),
    opacity: elements.opacity ? Number(elements.opacity.value) / 100 : 1,
    edgeStyle: normalizeEdgeStyle(getInitialEdgeStyle(), DEFAULT_EDGE_STYLE),
    sloppiness: "neat",
    bend: 0,
    rotation: 0,
    fontFamily: elements.fontFamily?.value || DEFAULT_TEXT_FONT,
    fontSize: 32,
  },
  stage: {
    width: canvas.width,
    height: canvas.height,
    displayWidth: canvas.width,
    displayHeight: canvas.height,
    minWidth: 320,
    minHeight: 240,
    maxWidth: 4096,
    maxHeight: 3072,
    autoFit: true,
    resizeSession: null,
    background: DEFAULT_STAGE_BACKGROUND,
    canvasRect: null,
    zoom: 1,
    showGrid: false,
  },
  timeline: {
    duration: Number(elements.timelineDuration.value) || TIMELINE_DEFAULT_DURATION,
    current: 0,
    isPlaying: false,
    lastTick: null,
    loop: true,
    bounce: false,
    direction: 1,
    exportFps: elements.exportFps ? Number(elements.exportFps.value) || 12 : 12,
    selectedKeyframeTime: null,
    selectedKeyframeShapeId: null,
  },
  pointer: {
    down: false,
    start: { x: 0, y: 0 },
    current: { x: 0, y: 0 },
    mode: "idle",
    tempShape: null,
    startSnapshot: null,
    startCenter: null,
    startRotation: 0,
    rotationStartAngle: 0,
    startBounds: null,
    activeHandle: null,
    startHandleVector: null,
    startStyle: null,
    multiSnapshot: null,
    multiStyles: null,
    marquee: null,
    marqueeAppend: false,
    usingPointerEvents: false,
    touchIdentifier: null,
  },
  modifiers: {
    shift: false,
    ctrl: false,
    meta: false,
    alt: false,
  },
  history: {
    undoStack: [],
    limit: HISTORY_LIMIT,
    pending: null,
  },
  clipboard: {
    items: [],
    offset: { x: 32, y: 32 },
  },
  activeTextEditor: null,
  groups: {},
  activeGroupId: null,
  activeGroup: null,
};

ensureStyleHasFillStyle(state.style);

function loadToolbarCollapsedPreference() {
  try {
    const stored = window.localStorage?.getItem(TOOLBAR_COLLAPSED_STORAGE_KEY);
    if (stored === "1" || stored === "true") {
      return true;
    }
    if (stored === "0" || stored === "false") {
      return false;
    }
  } catch (error) {
    console.warn("Failed to read toolbar collapse preference", error);
  }
  return null;
}

function saveToolbarCollapsedPreference(collapsed) {
  try {
    window.localStorage?.setItem(TOOLBAR_COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
  } catch (error) {
    console.warn("Failed to persist toolbar collapse preference", error);
  }
}

function applyToolbarCollapsedState({ scheduleResize = false } = {}) {
  const collapsed = Boolean(state.toolbarCollapsed);

  if (elements.appShell) {
    elements.appShell.classList.toggle("toolbar-collapsed", collapsed);
  }

  const label = collapsed ? "Show the toolbar" : "Hide the toolbar";
  const stateValue = collapsed ? "collapsed" : "expanded";
  if (Array.isArray(elements.toolbarToggles)) {
    elements.toolbarToggles.forEach((button) => {
      if (!button) return;
      button.setAttribute("aria-pressed", collapsed ? "true" : "false");
      button.setAttribute("aria-label", label);
      button.title = label;
      button.dataset.toolbarState = stateValue;
    });
  }

  if (elements.toolbar) {
    elements.toolbar.setAttribute("aria-hidden", collapsed ? "true" : "false");
  }

  if (scheduleResize) {
    window.requestAnimationFrame(() => {
      resizeCanvas();
    });
  }
}

function loadToolMenuCollapsedPreference() {
  try {
    const stored = window.localStorage?.getItem(TOOL_MENU_COLLAPSED_STORAGE_KEY);
    if (stored === "1" || stored === "true") {
      return true;
    }
    if (stored === "0" || stored === "false") {
      return false;
    }
  } catch (error) {
    console.warn("Failed to read tool menu collapse preference", error);
  }
  return null;
}

function saveToolMenuCollapsedPreference(collapsed) {
  try {
    window.localStorage?.setItem(TOOL_MENU_COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
  } catch (error) {
    console.warn("Failed to persist tool menu collapse preference", error);
  }
}

function applyToolMenuCollapsedState({ scheduleResize = false } = {}) {
  const collapsed = Boolean(state.toolMenuCollapsed);

  if (elements.canvasWrapper) {
    elements.canvasWrapper.classList.toggle("tool-menu-collapsed", collapsed);
  }

  if (elements.floatingToolMenu) {
    elements.floatingToolMenu.dataset.collapsed = collapsed ? "true" : "false";
    elements.floatingToolMenu.setAttribute("aria-hidden", "false");
  }

  if (elements.toolMenuToggle) {
    const label = collapsed ? "Show canvas tools" : "Hide canvas tools";
    const stateValue = collapsed ? "collapsed" : "expanded";
    elements.toolMenuToggle.setAttribute("aria-pressed", collapsed ? "true" : "false");
    elements.toolMenuToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    elements.toolMenuToggle.setAttribute("aria-label", label);
    elements.toolMenuToggle.title = label;
    elements.toolMenuToggle.dataset.toolMenuState = stateValue;
  }

  if (scheduleResize) {
    window.requestAnimationFrame(() => {
      resizeCanvas();
    });
  }
}

function setToolbarCollapsed(nextCollapsed, { persist = true, force = false, scheduleResize = true } = {}) {
  const collapsed = Boolean(nextCollapsed);
  const changed = collapsed !== state.toolbarCollapsed;

  if (!changed && !force) {
    return;
  }

  state.toolbarCollapsed = collapsed;
  applyToolbarCollapsedState({ scheduleResize: scheduleResize && changed });

  if (persist && changed) {
    saveToolbarCollapsedPreference(collapsed);
  }
}

function toggleToolbarVisibility(event) {
  if (event) {
    event.preventDefault();
  }
  setToolbarCollapsed(!state.toolbarCollapsed);
}

function restoreToolbarCollapsedPreference() {
  const stored = loadToolbarCollapsedPreference();
  if (typeof stored === "boolean") {
    setToolbarCollapsed(stored, { persist: false, force: true, scheduleResize: false });
  } else {
    applyToolbarCollapsedState({ scheduleResize: false });
  }
}

function setToolMenuCollapsed(nextCollapsed, { persist = true, force = false, scheduleResize = true } = {}) {
  const collapsed = Boolean(nextCollapsed);
  const changed = collapsed !== state.toolMenuCollapsed;

  if (!changed && !force) {
    return;
  }

  state.toolMenuCollapsed = collapsed;
  applyToolMenuCollapsedState({ scheduleResize: scheduleResize && (changed || force) });

  if (persist && changed) {
    saveToolMenuCollapsedPreference(collapsed);
  }
}

function toggleToolMenuVisibility(event) {
  if (event) {
    event.preventDefault();
  }
  setToolMenuCollapsed(!state.toolMenuCollapsed);
}

function restoreToolMenuCollapsedPreference() {
  const stored = loadToolMenuCollapsedPreference();
  if (typeof stored === "boolean") {
    setToolMenuCollapsed(stored, { persist: false, force: true, scheduleResize: false });
  } else {
    applyToolMenuCollapsedState({ scheduleResize: false });
  }
}

ensureStyleHasFillStyle(state.style);

let shapeIdCounter = 1;
let groupIdCounter = 1;

function syncActiveGroupState() {
  const groupId = state.activeGroupId;
  if (!groupId) {
    state.activeGroup = null;
    return;
  }
  const members = state.groups[groupId];
  if (!(members instanceof Set) || members.size < 2) {
    state.activeGroup = null;
    state.activeGroupId = null;
    return;
  }
  state.activeGroup = {
    id: groupId,
    ids: new Set(members),
  };
}

function setActiveGroupId(nextGroupId) {
  state.activeGroupId = nextGroupId ?? null;
  syncActiveGroupState();
}

function cloneShapeForHistory(shape) {
  if (!shape) return null;
  const clone = {
    id: shape.id,
    type: shape.type,
    style: JSON.parse(JSON.stringify(shape.style || {})),
    live: JSON.parse(JSON.stringify(shape.live || {})),
    keyframes: Array.isArray(shape.keyframes)
      ? shape.keyframes.map((keyframe) => ({
          time: keyframe.time,
          snapshot: keyframe.snapshot ? JSON.parse(JSON.stringify(keyframe.snapshot)) : null,
        }))
      : [],
    birthTime: shape.birthTime ?? 0,
    isVisible: shape.isVisible !== false,
  };

  ensureStyleHasFillStyle(clone.style, clone.type);
  if (Array.isArray(clone.keyframes)) {
    clone.keyframes.forEach((keyframe) => {
      if (keyframe && keyframe.snapshot && keyframe.snapshot.style) {
        const snapshotType = keyframe.snapshot.type ?? clone.type;
        ensureStyleHasFillStyle(keyframe.snapshot.style, snapshotType);
      }
    });
  }

  if (shape.groupId) {
    clone.groupId = shape.groupId;
  }

  if (shape.asset) {
    clone.asset = { ...shape.asset };
    if (clone.asset.image) {
      delete clone.asset.image;
    }
  }

  return clone;
}

function reviveShapeFromHistory(data) {
  if (!data) return null;
  const shape = {
    id: data.id,
    type: data.type,
    style: JSON.parse(JSON.stringify(data.style || {})),
    live: JSON.parse(JSON.stringify(data.live || {})),
    keyframes: Array.isArray(data.keyframes)
      ? data.keyframes.map((keyframe) => ({
          time: keyframe.time,
          snapshot: keyframe.snapshot ? JSON.parse(JSON.stringify(keyframe.snapshot)) : null,
        }))
      : [],
    birthTime: data.birthTime ?? 0,
    isVisible: data.isVisible !== false,
  };

  ensureStyleHasFillStyle(shape.style, shape.type);
  if (Array.isArray(shape.keyframes)) {
    shape.keyframes.forEach((keyframe) => {
      if (keyframe && keyframe.snapshot && keyframe.snapshot.style) {
        const snapshotType = keyframe.snapshot.type ?? shape.type;
        ensureStyleHasFillStyle(keyframe.snapshot.style, snapshotType);
      }
    });
  }

  if (data.groupId) {
    shape.groupId = data.groupId;
  }

  if (data.asset) {
    shape.asset = { ...data.asset };
    if (shape.asset.image) {
      delete shape.asset.image;
    }
    if (shape.asset.source) {
      rehydrateShapeAsset(shape);
    }
  }

  normalizeShapeKeyframes(shape);
  return shape;
}

function cloneStateSnapshot() {
  const groups = {};
  Object.entries(state.groups || {}).forEach(([groupId, members]) => {
    groups[groupId] = Array.from(members);
  });

  return {
    shapes: state.shapes.map((shape) => cloneShapeForHistory(shape)).filter(Boolean),
    groups,
    activeGroupId: state.activeGroupId ?? null,
    selectedIds: Array.from(state.selectedIds || []),
    selectionId: state.selection ? state.selection.id : null,
    timeline: {
      current: state.timeline.current,
      duration: state.timeline.duration,
      loop: state.timeline.loop,
      bounce: state.timeline.bounce,
      exportFps: state.timeline.exportFps,
      selectedKeyframeTime: state.timeline.selectedKeyframeTime ?? null,
      selectedKeyframeShapeId: state.timeline.selectedKeyframeShapeId ?? null,
    },
    shapeIdCounter,
    groupIdCounter,
  };
}

function pushSnapshotToUndo(snapshot, reason = "change") {
  if (!snapshot) return;
  state.history.undoStack.push({ snapshot, reason });
  if (state.history.undoStack.length > state.history.limit) {
    state.history.undoStack.shift();
  }
}

function prepareHistory(reason = "change") {
  const snapshot = cloneStateSnapshot();
  state.history.pending = {
    snapshot,
    reason,
    applied: false,
  };
  return state.history.pending;
}

function markHistoryChanged() {
  if (state.history.pending) {
    state.history.pending.applied = true;
  }
}

function finalizeHistory({ discardIfUnchanged = true } = {}) {
  const pending = state.history.pending;
  if (!pending) return;
  if (!pending.applied && discardIfUnchanged) {
    state.history.pending = null;
    return;
  }
  pushSnapshotToUndo(pending.snapshot, pending.reason);
  state.history.pending = null;
}

function pushHistorySnapshot(reason = "change") {
  state.history.pending = null;
  pushSnapshotToUndo(cloneStateSnapshot(), reason);
}

function createHistoryEntry(reason = "change") {
  return {
    snapshot: cloneStateSnapshot(),
    reason,
  };
}

function commitHistoryEntry(entry) {
  if (!entry || !entry.snapshot) return;
  pushSnapshotToUndo(entry.snapshot, entry.reason);
}

function restoreHistorySnapshot(snapshot) {
  if (!snapshot) return false;

  state.history.pending = null;
  stopPlayback();
  destroyActiveTextEditorElement();

  const shapes = Array.isArray(snapshot.shapes)
    ? snapshot.shapes.map((shape) => reviveShapeFromHistory(shape)).filter(Boolean)
    : [];
  state.shapes = shapes;

  const groups = {};
  Object.entries(snapshot.groups || {}).forEach(([groupId, members]) => {
    groups[groupId] = new Set(Array.isArray(members) ? members : []);
  });
  state.groups = groups;
  setActiveGroupId(snapshot.activeGroupId ?? null);

  const timeline = snapshot.timeline || {};
  if (Number.isFinite(timeline.duration)) {
    state.timeline.duration = Math.max(0, timeline.duration);
    if (elements.timelineDuration) {
      elements.timelineDuration.value = String(state.timeline.duration);
    }
  }
  if (typeof timeline.loop === "boolean") {
    state.timeline.loop = timeline.loop;
  }
  if (typeof timeline.bounce === "boolean") {
    state.timeline.bounce = timeline.bounce;
  }
  if (Number.isFinite(timeline.exportFps)) {
    state.timeline.exportFps = timeline.exportFps;
    if (elements.exportFps) {
      elements.exportFps.value = String(Math.round(state.timeline.exportFps));
    }
  }
  state.timeline.selectedKeyframeTime = Number.isFinite(timeline.selectedKeyframeTime)
    ? timeline.selectedKeyframeTime
    : null;
  state.timeline.selectedKeyframeShapeId = Number.isFinite(timeline.selectedKeyframeShapeId)
    ? timeline.selectedKeyframeShapeId
    : null;
  state.timeline.lastTick = null;
  state.timeline.isPlaying = false;
  state.timeline.direction = 1;

  const currentTime = Number.isFinite(timeline.current) ? timeline.current : state.timeline.current;
  setTimelineTime(Math.max(0, currentTime), { apply: true });

  const selectedIds = Array.isArray(snapshot.selectedIds) ? snapshot.selectedIds : [];
  const selectedShapes = selectedIds
    .map((id) => state.shapes.find((shape) => shape.id === id))
    .filter(Boolean);

  if (selectedShapes.length > 0) {
    setSelectedShapes(selectedShapes, { primaryId: snapshot.selectionId || undefined });
  } else {
    setSelectedShapes([]);
  }

  state.shapes.forEach((shape) => {
    if (shape && shape.type === "text") {
      updateTextMetrics(shape, { keepCenter: true });
    }
  });

  applyTimelineState();
  renderTimelineTrackMarkers();

  const maxShapeId = state.shapes.reduce((max, shape) => Math.max(max, Number(shape.id) || 0), 0);
  const nextShapeId = Math.max(maxShapeId + 1, snapshot.shapeIdCounter ?? 1);
  shapeIdCounter = Number.isFinite(nextShapeId) ? nextShapeId : maxShapeId + 1;

  const groupIds = Object.keys(state.groups || {});
  const maxGroupNumeric = groupIds.reduce((max, id) => {
    const numeric = getGroupNumericSuffix(id);
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);
  const nextGroupId = Math.max(maxGroupNumeric + 1, snapshot.groupIdCounter ?? 1);
  groupIdCounter = Number.isFinite(nextGroupId) ? nextGroupId : maxGroupNumeric + 1;

  return true;
}

function undoLastAction() {
  if (!state.history || !Array.isArray(state.history.undoStack)) return false;
  if (state.history.undoStack.length === 0) return false;

  const entry = state.history.undoStack.pop();
  if (!entry || !entry.snapshot) {
    return false;
  }

  return restoreHistorySnapshot(entry.snapshot);
}

const TEXT_PADDING = 16;
const KEYFRAME_EPSILON = 0.001;
const MARQUEE_EPSILON = 0.5;

function init() {
  restoreToolbarCollapsedPreference();
  restoreToolMenuCollapsedPreference();
  resizeCanvas();
  bindEvents();
  initializeTipsPanel();
  restoreStageSize();
  restoreStageBackground();
  updateSelection(null);
  setTimelineTime(0, { apply: true });
  initializeMobileOptimizations();
  window.animatorState = state;
  window.animatorApi = createAnimatorApi();
  window.animatorReady = true;
  render();
}

function initializeMobileOptimizations() {
  // Prevent double-tap zoom on buttons and controls
  const preventDoubleTapZoom = (event) => {
    const target = event.target.closest('button, .tool-button, .timeline-key, .keyframe-chip');
    if (target) {
      event.preventDefault();
      target.click();
    }
  };

  // Add touch-action to prevent default behaviors
  document.body.style.touchAction = 'pan-x pan-y';
  
  // Prevent context menu on long press (mobile)
  if ('ontouchstart' in window) {
    document.addEventListener('contextmenu', (event) => {
      if (event.target.closest('.tool-button, button, .timeline-key')) {
        event.preventDefault();
      }
    });
  }

  // Handle orientation changes
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      resizeCanvas();
      updateCanvasMetrics();
      render();
    }, 100);
  });

  // Handle window resize for mobile keyboard
  let lastHeight = window.innerHeight;
  window.addEventListener('resize', () => {
    const currentHeight = window.innerHeight;
    // If height decreased significantly, keyboard might be showing
    if (lastHeight - currentHeight > 150) {
      document.body.classList.add('keyboard-visible');
    } else {
      document.body.classList.remove('keyboard-visible');
    }
    lastHeight = currentHeight;
  });
}

function computeAutoFitSize() {
  const wrapper = elements.canvasWrapper ? elements.canvasWrapper.getBoundingClientRect() : null;
  const fallback = canvas.getBoundingClientRect();
  const baseWidth = Number.isFinite(state.stage.width) && state.stage.width > 0 ? state.stage.width : fallback.width || canvas.width;
  const baseHeight = Number.isFinite(state.stage.height) && state.stage.height > 0 ? state.stage.height : fallback.height || canvas.height;
  const aspect = baseWidth > 0 && baseHeight > 0 ? baseWidth / baseHeight : 16 / 9;
  const margin = 20; // 10px margin on each side

  const availableWidth = wrapper ? Math.max(state.stage.minWidth, wrapper.width - margin) : fallback.width || baseWidth;
  const availableHeight = wrapper ? Math.max(state.stage.minHeight, wrapper.height - margin) : fallback.height || baseHeight;

  let targetWidth = availableWidth;
  let targetHeight = targetWidth / aspect;

  if (targetHeight > availableHeight) {
    targetHeight = availableHeight;
    targetWidth = targetHeight * aspect;
  }

  targetWidth = Math.max(state.stage.minWidth, Math.min(state.stage.maxWidth, targetWidth));
  targetHeight = Math.max(state.stage.minHeight, Math.min(state.stage.maxHeight, targetHeight));

  return {
    width: targetWidth,
    height: targetHeight,
  };
}

function updateCanvasMetrics() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  state.stage.canvasRect = {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
  state.stage.displayWidth = rect.width;
  state.stage.displayHeight = rect.height;
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  let targetWidth;
  let targetHeight;

  if (state.stage.autoFit) {
    const autoFit = computeAutoFitSize();
    targetWidth = autoFit.width;
    targetHeight = autoFit.height;
  } else {
    targetWidth = state.stage.width;
    targetHeight = state.stage.height;
  }

  if (!Number.isFinite(targetWidth) || targetWidth <= 0 || !Number.isFinite(targetHeight) || targetHeight <= 0) {
    const rect = canvas.getBoundingClientRect();
    targetWidth = rect.width || canvas.width;
    targetHeight = rect.height || canvas.height;
  }

  canvas.style.width = `${targetWidth}px`;
  canvas.style.height = `${targetHeight}px`;
  canvas.width = Math.max(1, Math.round(targetWidth * ratio));
  canvas.height = Math.max(1, Math.round(targetHeight * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  updateCanvasMetrics();

  const displayWidth = state.stage.canvasRect?.width || targetWidth;
  const displayHeight = state.stage.canvasRect?.height || targetHeight;

  if (state.stage.autoFit) {
    state.stage.width = displayWidth;
    state.stage.height = displayHeight;
  } else {
    state.stage.width = targetWidth;
    state.stage.height = targetHeight;
  }

  updateStageDimensionsLabel();
  repositionActiveTextEditor();
  applyZoom();
  updateZoomDisplay();
}

function bindEvents() {
  window.addEventListener("resize", resizeCanvas);

  if (canvas) {
    canvas.style.touchAction = "none";
  }
  if (elements.stageSurface && elements.stageSurface.style) {
    elements.stageSurface.style.touchAction = "none";
  }

  elements.stageBackgroundColor?.addEventListener("input", (event) => {
    const value = event.target.value;
    if (!value || value === state.stage.background) {
      return;
    }
    applyStageBackground(value, { updateControl: false });
  });

  elements.backgroundGrid?.addEventListener("change", (event) => {
    state.stage.showGrid = event.target.checked;
    render();
  });

  elements.stageContextMenu?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute("data-stage-action");
    if (action === "reset-background") {
      event.preventDefault();
      applyStageBackground(getDefaultStageBackground(), { updateControl: true });
      closeStageContextMenu();
    }
  });

  if (Array.isArray(elements.toolbarToggles)) {
    elements.toolbarToggles.forEach((button) => {
      button.addEventListener("click", toggleToolbarVisibility);
    });
  }

  if (elements.toolMenuToggle) {
    elements.toolMenuToggle.addEventListener("click", toggleToolMenuVisibility);
  }

  elements.toolButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setTool(button.dataset.tool);
    });
  });

  elements.fillColor.addEventListener("input", (event) => {
    state.style.fill = event.target.value;
    if (state.selection) {
      state.selection.style.fill = event.target.value;
      commitShapeChange(state.selection);
    }
  });

  if (Array.isArray(elements.fillStyleButtons) && elements.fillStyleButtons.length > 0) {
    elements.fillStyleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.getAttribute("data-fill-style");
        if (!value) return;
        applyFillStyle(value);
      });
    });
  }

  if (Array.isArray(elements.edgeStyleButtons) && elements.edgeStyleButtons.length > 0) {
    elements.edgeStyleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.getAttribute("data-edge-style");
        if (!value) return;
        applyEdgeStyle(value);
      });
    });
  }

  if (elements.opacity) {
    elements.opacity.addEventListener("input", (event) => {
      const raw = Number(event.target.value);
      const clamped = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 100;
      const normalized = clamped / 100;
      state.style.opacity = normalized;
      if (elements.opacityValue) {
        elements.opacityValue.textContent = `${Math.round(clamped)}%`;
      }
      if (state.selection) {
        state.selection.style.opacity = normalized;
        commitShapeChange(state.selection);
      }
    });
  }

  elements.strokeColor.addEventListener("input", (event) => {
    state.style.stroke = event.target.value;
    if (state.selection) {
      state.selection.style.stroke = event.target.value;
      commitShapeChange(state.selection);
    }
  });

  elements.strokeWidth.addEventListener("input", (event) => {
    const value = Number(event.target.value);
    state.style.strokeWidth = value;
    elements.strokeWidthValue.textContent = `${value}px`;
    if (state.selection) {
      state.selection.style.strokeWidth = value;
      commitShapeChange(state.selection);
    }
  });

  if (Array.isArray(elements.strokeStyleButtons) && elements.strokeStyleButtons.length > 0) {
    elements.strokeStyleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.getAttribute("data-stroke-style");
        if (!value) return;
        applyStrokeStyle(value);
      });
    });
  }

  if (Array.isArray(elements.sketchButtons) && elements.sketchButtons.length > 0) {
    elements.sketchButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const level = Number(button.getAttribute("data-sketch-level")) || 0;
        applySketchLevel(level);
      });
    });
  }

  if (elements.fontFamily) {
    elements.fontFamily.addEventListener("change", (event) => {
      const value = event.target.value || DEFAULT_TEXT_FONT;
      state.style.fontFamily = value;
      if (state.selection && state.selection.type === "text") {
        state.selection.style.fontFamily = value;
        updateTextMetrics(state.selection, { keepCenter: true });
        commitShapeChange(state.selection);
        repositionActiveTextEditor();
      }
    });
  }

  if (Array.isArray(elements.arrowToggleButtons) && elements.arrowToggleButtons.length > 0) {
    elements.arrowToggleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.getAttribute("data-arrow-toggle");
        if (!key) return;
        const nextState = !isButtonPressed(button);
        applyArrowToggle(key, nextState);
      });
    });
  }

  if (Array.isArray(elements.stageResizeHandles) && elements.stageResizeHandles.length > 0) {
    elements.stageResizeHandles.forEach((handle) => {
      handle.addEventListener("pointerdown", startStageResize);
      handle.addEventListener("mousedown", startStageResize);
      handle.addEventListener("touchstart", startStageResize, { passive: false });
    });
  } else {
    elements.stageResizeHandle?.addEventListener("pointerdown", startStageResize);
    elements.stageResizeHandle?.addEventListener("mousedown", startStageResize);
    elements.stageResizeHandle?.addEventListener("touchstart", startStageResize, { passive: false });
  }
  elements.tipsList?.addEventListener("click", handleTipsListClick);
  window.addEventListener("pointermove", handleStageResizeMove);
  window.addEventListener("pointerup", endStageResize);
  window.addEventListener("pointercancel", endStageResize);
  window.addEventListener("mousemove", handleStageResizeMove);
  window.addEventListener("mouseup", endStageResize);
  window.addEventListener("touchmove", handleStageResizeMove, { passive: false });
  window.addEventListener("touchend", endStageResize, { passive: false });
  window.addEventListener("touchcancel", endStageResize, { passive: false });

  canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
  canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
  canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
  canvas.addEventListener("touchcancel", handleTouchCancel, { passive: false });
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointerleave", handlePointerUp);
  canvas.addEventListener("mousedown", handleMouseDownFallback);
  canvas.addEventListener("contextmenu", handleCanvasContextMenu);
  canvas.addEventListener("dblclick", handleCanvasDoubleClick);
  window.addEventListener("mousemove", handleMouseMoveFallback);
  window.addEventListener("mouseup", handleMouseUpFallback);
  window.addEventListener("scroll", repositionActiveTextEditor);
  window.addEventListener("pointerdown", handleGlobalPointerDownForContextMenu);
  window.addEventListener("blur", closeAllContextMenus);
  window.addEventListener("blur", resetModifierState);
  window.addEventListener("scroll", closeAllContextMenus, true);
  window.addEventListener("resize", closeAllContextMenus);

  elements.deleteShape?.addEventListener("click", () => {
    deleteSelectedShapes();
  });

  elements.groupShapes?.addEventListener("click", () => {
    groupSelectedShapes();
  });

  elements.ungroupShapes?.addEventListener("click", () => {
    ungroupSelectedShapes();
  });

  elements.timelineRange.addEventListener("input", (event) => {
    const ratio = Number(event.target.value) / 1000;
    setTimelineTime(ratio * state.timeline.duration, { apply: true });
  });

  elements.timelineDuration.addEventListener("change", (event) => {
    applyTimelineDuration(event.target.value);
  });

  elements.timelineDuration.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 5 : 1;
    let handled = false;
    if (event.key === "ArrowUp") {
      applyTimelineDuration(state.timeline.duration + step);
      handled = true;
    } else if (event.key === "ArrowDown") {
      applyTimelineDuration(state.timeline.duration - step);
      handled = true;
    } else if (event.key === "Home") {
      applyTimelineDuration(1);
      handled = true;
    } else if (event.key === "End") {
      applyTimelineDuration(120);
      handled = true;
    }
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  elements.playToggle.addEventListener("click", togglePlayback);
  elements.stopPlayback.addEventListener("click", () => {
    stopPlayback();
    setTimelineTime(0, { apply: true });
  });

  elements.addKeyframe.addEventListener("click", () => {
    const targets = getSelectedShapesList();
    if (targets.length === 0) return;
    targets.forEach((shape) => {
      ensureBaseKeyframe(shape, state.timeline.current);
      writeKeyframe(shape, state.timeline.current);
    });
    renderKeyframeList();
  });

  elements.deleteKeyframe.addEventListener("click", () => {
    const targets = getSelectedShapesList();
    if (targets.length === 0) return;
    targets.forEach((shape) => {
      deleteKeyframe(shape, state.timeline.current);
    });
    renderKeyframeList();
    renderTimelineTrackMarkers();
    render();
  });

  elements.zoomIn?.addEventListener("click", () => {
    setZoomLevel(state.stage.zoom * 1.2);
  });

  elements.zoomOut?.addEventListener("click", () => {
    setZoomLevel(state.stage.zoom / 1.2);
  });

  elements.zoomReset?.addEventListener("click", () => {
    setZoomLevel(1);
  });

  canvas.addEventListener("wheel", (event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const delta = -event.deltaY;
      const zoomFactor = delta > 0 ? 1.1 : 0.9;
      setZoomLevel(state.stage.zoom * zoomFactor);
    }
  }, { passive: false });

  const closeExportMenu = () => {
    if (elements.exportMenu?.open) {
      elements.exportMenu.open = false;
    }
  };

  elements.exportScene.addEventListener("click", () => {
    closeExportMenu();
    exportScene();
  });

  elements.clearCanvas?.addEventListener("click", () => {
    window.animatorApi?.clearCanvas();
  });

  if (elements.importScene && elements.importSceneInput) {
    elements.importScene.addEventListener("click", () => {
      closeExportMenu();
      elements.importSceneInput.value = "";
      elements.importSceneInput.click();
    });
    elements.importSceneInput.addEventListener("change", handleSceneImport);
  }

  elements.exportGif?.addEventListener("click", () => {
    closeExportMenu();
    handleExportGif();
  });

  elements.loopToggle?.addEventListener("change", (event) => {
    state.timeline.loop = Boolean(event.target.checked);
    state.timeline.direction = 1;
  });

  elements.bounceToggle?.addEventListener("change", (event) => {
    state.timeline.bounce = Boolean(event.target.checked);
    state.timeline.direction = 1;
  });

  elements.exportFps?.addEventListener("change", (event) => {
    const value = Math.max(1, Math.min(60, Number(event.target.value) || state.timeline.exportFps || 12));
    state.timeline.exportFps = value;
    event.target.value = String(value);
  });

  window.addEventListener("keydown", handleGlobalKeyDown);
  window.addEventListener("keyup", handleGlobalKeyUp);
  window.addEventListener("copy", handleGlobalCopy);
  window.addEventListener("cut", handleGlobalCut);
  window.addEventListener("paste", handleGlobalPaste);

  elements.shapeContextMenu?.addEventListener("click", handleContextMenuActionClick);


}

function setTool(tool) {
  finalizeActiveTextEditor();
  closeAllContextMenus();
  state.tool = tool;
  updateStrokeWidthControl(tool);
  elements.toolButtons.forEach((button) => {
    const isActive = button.dataset.tool === tool;
    button.classList.toggle("selected", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  syncArrowEndingUI();
  syncSelectionInputs();
}

function updateStrokeWidthControl(tool) {
  const slider = elements.strokeWidth;
  const display = elements.strokeWidthValue;
  if (!slider || !display) return;
  const range = tool === "free" ? STROKE_WIDTH_PEN_RANGE : STROKE_WIDTH_DEFAULT_RANGE;
  slider.min = String(range.min);
  slider.max = String(range.max);
  const selectionWidth = Number.isFinite(state.selection?.style?.strokeWidth)
    ? state.selection.style.strokeWidth
    : null;
  const baseWidth = Number.isFinite(state.style.strokeWidth) ? state.style.strokeWidth : range.min;
  const clampedBaseWidth = Math.max(range.min, Math.min(range.max, baseWidth));

  if (!Number.isFinite(state.style.strokeWidth) || state.style.strokeWidth !== clampedBaseWidth) {
    state.style.strokeWidth = clampedBaseWidth;
  }

  const effectiveWidth = selectionWidth ?? state.style.strokeWidth;
  const sliderValue = Math.max(range.min, Math.min(range.max, effectiveWidth));

  if (Number(slider.value) !== sliderValue) {
    slider.value = String(sliderValue);
  }
  display.textContent = `${effectiveWidth}px`;
}

function render() {
  const ratio = window.devicePixelRatio || 1;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.save();
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  if (state.stage.showGrid) {
    drawBackgroundGrid(ctx);
  }
  drawShapes(ctx);
  drawSelectionBounds(ctx);
  ctx.restore();

  if (state.timeline.isPlaying && !(state.timeline.__suppressAdvance > 0)) {
    advanceTimeline();
  }

  requestAnimationFrame(render);
}

function drawBackgroundGrid(context) {
  const gridSize = 20;
  const width = state.stage.width;
  const height = state.stage.height;
  
  context.save();
  context.strokeStyle = "rgba(0, 0, 0, 0.1)";
  context.lineWidth = 1;
  context.setLineDash([]);
  
  // Draw vertical lines
  for (let x = 0; x <= width; x += gridSize) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  
  // Draw horizontal lines
  for (let y = 0; y <= height; y += gridSize) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  
  context.restore();
}

function drawShapes(context) {
  state.shapes.forEach((shape) => {
    if (shape.isVisible === false) return;
    drawShape(context, shape);
  });
}

function drawShape(context, shape) {
  const { type } = shape;
  switch (type) {
    case "rectangle":
    case "square":
      drawRectangleShape(context, shape);
      break;
    case "diamond":
      drawDiamondShape(context, shape);
      break;
    case "circle":
      drawCircleShape(context, shape);
      break;
    case "line":
      drawLineShape(context, shape);
      break;
    case "arrow":
      drawArrowShape(context, shape);
      break;
    case "image":
      drawImageShape(context, shape);
      break;
    case "free":
      drawFreeShape(context, shape);
      break;
    case "text":
      drawTextShape(context, shape);
      break;
    default:
      break;
  }
}

const FILL_PATTERN_CACHE = new Map();
const PATTERN_CANVAS_SIZE = 16;
const PATTERN_BASE_ALPHA = 0.22;
const PATTERN_BACKGROUND_ALPHA = 0.12;
const PATTERN_LINE_ALPHA = 0.6;

function clampUnit(value) {
  if (!Number.isFinite(value)) return 1;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function getPatternCanvas(fillStyle, color) {
  const key = `${fillStyle}|${color}`;
  if (FILL_PATTERN_CACHE.has(key)) {
    return FILL_PATTERN_CACHE.get(key);
  }
  const canvas = document.createElement("canvas");
  canvas.width = PATTERN_CANVAS_SIZE;
  canvas.height = PATTERN_CANVAS_SIZE;
  const patternCtx = canvas.getContext("2d");
  if (!patternCtx) {
    FILL_PATTERN_CACHE.set(key, null);
    return null;
  }

  patternCtx.clearRect(0, 0, canvas.width, canvas.height);
  patternCtx.fillStyle = color;
  patternCtx.globalAlpha = PATTERN_BACKGROUND_ALPHA;
  patternCtx.fillRect(0, 0, canvas.width, canvas.height);
  patternCtx.globalAlpha = PATTERN_LINE_ALPHA;
  patternCtx.strokeStyle = color;
  patternCtx.lineWidth = 1;
  patternCtx.lineCap = "square";

  if (fillStyle === "hachure") {
    const step = canvas.width / 2;
    patternCtx.beginPath();
    patternCtx.moveTo(-step, canvas.height);
    patternCtx.lineTo(canvas.width, -step);
    patternCtx.moveTo(0, canvas.height);
    patternCtx.lineTo(canvas.width, 0);
    patternCtx.moveTo(step, canvas.height);
    patternCtx.lineTo(canvas.width, step);
    patternCtx.stroke();
  } else if (fillStyle === "cross-hatch") {
    const step = canvas.width / 2;
    patternCtx.beginPath();
    for (let offset = -canvas.width; offset <= canvas.width; offset += step) {
      patternCtx.moveTo(offset, canvas.height);
      patternCtx.lineTo(offset + canvas.width, 0);
      patternCtx.moveTo(offset, 0);
      patternCtx.lineTo(offset + canvas.width, canvas.height);
    }
    patternCtx.stroke();
  } else {
    patternCtx.globalAlpha = 1;
    FILL_PATTERN_CACHE.set(key, null);
    return null;
  }

  patternCtx.globalAlpha = 1;
  FILL_PATTERN_CACHE.set(key, canvas);
  return canvas;
}

function getFillPattern(context, color, fillStyle) {
  const canvas = getPatternCanvas(fillStyle, color);
  if (!canvas) return null;
  try {
    return context.createPattern(canvas, "repeat");
  } catch (error) {
    return null;
  }
}

function resolveShapeOpacity(style) {
  if (style && typeof style.opacity === "number") {
    return clampUnit(style.opacity);
  }
  if (state.style && typeof state.style.opacity === "number") {
    return clampUnit(state.style.opacity);
  }
  return 1;
}

function withGlobalOpacity(context, opacity, draw) {
  const clamped = clampUnit(opacity);
  if (clamped <= 0) {
    return;
  }
  if (clamped >= 0.999) {
    draw();
    return;
  }
  context.save();
  context.globalAlpha *= clamped;
  try {
    draw();
  } finally {
    context.restore();
  }
}

function fillPathWithStyle(context, style = {}, buildPath) {
  if (typeof buildPath !== "function") {
    return;
  }
  const fallbackColor = state.style?.fill || "#ff6b6b";
  const rawColor = typeof style.fill === "string" && style.fill.trim() !== ""
    ? style.fill
    : fallbackColor;
  const resolvedStyle = normalizeFillStyle(style.fillStyle ?? state.style?.fillStyle ?? DEFAULT_FILL_STYLE);
  const opacity = resolveShapeOpacity(style);
  if (opacity <= 0) {
    return;
  }

  if (resolvedStyle === "solid" || rawColor === "transparent") {
    buildPath();
    withGlobalOpacity(context, opacity, () => {
      context.fillStyle = rawColor;
      context.fill();
    });
    return;
  }

  buildPath();
  withGlobalOpacity(context, opacity * PATTERN_BASE_ALPHA, () => {
    context.fillStyle = rawColor;
    context.fill();
  });

  const pattern = getFillPattern(context, rawColor, resolvedStyle);
  if (pattern) {
    buildPath();
    withGlobalOpacity(context, opacity, () => {
      context.fillStyle = pattern;
      context.fill();
    });
  } else {
    buildPath();
    withGlobalOpacity(context, opacity, () => {
      context.fillStyle = rawColor;
      context.fill();
    });
  }
}

function drawRectangleShape(context, shape) {
  const { style, live } = shape;
  const opacity = resolveShapeOpacity(style);
  const center = getShapeCenter(shape);
  const rotation = live.rotation || 0;
  const width = live.width;
  const height = live.height;
  const absWidth = Math.abs(width || 0);
  const absHeight = Math.abs(height || 0);
  const edgeStyle = normalizeEdgeStyle(style.edgeStyle ?? state.style.edgeStyle ?? DEFAULT_EDGE_STYLE);
  const minDimension = Math.max(0, Math.min(absWidth, absHeight));
  const radius = edgeStyle === "round" && minDimension > 0
    ? Math.min(Math.max(minDimension * 0.25, 8), minDimension / 2)
    : 0;

  context.save();
  context.translate(center.x, center.y);
  context.rotate(rotation);
  context.strokeStyle = style.stroke;
  context.lineWidth = style.strokeWidth;
  context.lineCap = edgeStyle === "round" ? "round" : "butt";
  context.lineJoin = edgeStyle === "round" ? "round" : "miter";
  applyStrokePattern(context, style);

  const buildPath = () => {
    context.beginPath();
    if (radius > 0) {
      const left = -absWidth / 2;
      const top = -absHeight / 2;
      if (typeof context.roundRect === "function") {
        context.roundRect(left, top, absWidth, absHeight, radius);
      } else {
        traceRoundedRectCentered(context, absWidth, absHeight, radius);
      }
    } else {
      context.rect(-absWidth / 2, -absHeight / 2, absWidth, absHeight);
    }
  };

  fillPathWithStyle(context, style, buildPath);

  if (style.strokeWidth > 0) {
    withGlobalOpacity(context, opacity, () => {
      if (style.sketchLevel > 0) {
        drawSketchStroke(context, buildPath, shape, style.sketchLevel);
      } else {
        buildPath();
        context.stroke();
      }
    });
  }

  context.restore();
}

function applyStrokePattern(context, style) {
  const width = Math.max(0.5, Number(style?.strokeWidth) || Number(state.style?.strokeWidth) || 1);
  const strokeStyle = normalizeStrokeStyle(style?.strokeStyle ?? state.style?.strokeStyle ?? DEFAULT_STROKE_STYLE);
  if (strokeStyle === "dashed") {
    const dash = Math.max(4, width * 3);
    context.setLineDash([dash, dash]);
  } else if (strokeStyle === "dotted") {
    const dot = Math.max(1, width);
    const gap = Math.max(dot, width * 1.8);
    context.setLineDash([dot, gap]);
    context.lineCap = "round";
  } else {
    context.setLineDash([]);
  }
}

function traceRoundedRectCentered(context, width, height, radius) {
  const halfWidth = Math.max(0, width / 2);
  const halfHeight = Math.max(0, height / 2);
  const clampedRadius = Math.max(0, Math.min(radius, halfWidth, halfHeight));
  const left = -halfWidth;
  const right = halfWidth;
  const top = -halfHeight;
  const bottom = halfHeight;

  context.moveTo(right - clampedRadius, top);
  context.lineTo(left + clampedRadius, top);
  context.quadraticCurveTo(left, top, left, top + clampedRadius);
  context.lineTo(left, bottom - clampedRadius);
  context.quadraticCurveTo(left, bottom, left + clampedRadius, bottom);
  context.lineTo(right - clampedRadius, bottom);
  context.quadraticCurveTo(right, bottom, right, bottom - clampedRadius);
  context.lineTo(right, top + clampedRadius);
  context.quadraticCurveTo(right, top, right - clampedRadius, top);
  context.closePath();
}

function drawDiamondShape(context, shape) {
  const { style, live } = shape;
  const opacity = resolveShapeOpacity(style);
  const center = getShapeCenter(shape);
  const rotation = live.rotation || 0;
  const width = live.width;
  const height = live.height;
  const edgeStyle = normalizeEdgeStyle(style.edgeStyle ?? state.style.edgeStyle ?? DEFAULT_EDGE_STYLE);

  context.save();
  context.translate(center.x, center.y);
  context.rotate(rotation);
  context.strokeStyle = style.stroke;
  context.lineWidth = style.strokeWidth;
  context.lineCap = edgeStyle === "round" ? "round" : "butt";
  context.lineJoin = edgeStyle === "round" ? "round" : "miter";
  applyStrokePattern(context, style);

  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const absHalfWidth = Math.abs(halfWidth);
  const absHalfHeight = Math.abs(halfHeight);

  const corners = [
    { x: 0, y: -halfHeight },
    { x: halfWidth, y: 0 },
    { x: 0, y: halfHeight },
    { x: -halfWidth, y: 0 },
  ];

  const edgeLengths = corners.map((corner, index) => {
    const next = corners[(index + 1) % corners.length];
    return Math.hypot(next.x - corner.x, next.y - corner.y);
  });

  const minEdgeLength = Math.max(0, Math.min(...edgeLengths));
  const minDimension = Math.max(0, Math.min(absHalfWidth, absHalfHeight)) * 2;
  const rawInset = minDimension > 0 ? Math.max(minDimension * 0.18, 4) : 0;
  const inset = edgeStyle === "round" ? Math.min(rawInset, minEdgeLength / 2) : 0;

  const buildPath = () => {
    context.beginPath();

    if (inset <= 0) {
      context.moveTo(0, -halfHeight);
      context.lineTo(halfWidth, 0);
      context.lineTo(0, halfHeight);
      context.lineTo(-halfWidth, 0);
      context.closePath();
      return;
    }

    const segments = corners.map((corner, index, list) => {
      const prev = list[(index - 1 + list.length) % list.length];
      const next = list[(index + 1) % list.length];

      const prevVector = { x: prev.x - corner.x, y: prev.y - corner.y };
      const nextVector = { x: next.x - corner.x, y: next.y - corner.y };

      const prevLength = Math.hypot(prevVector.x, prevVector.y) || 1;
      const nextLength = Math.hypot(nextVector.x, nextVector.y) || 1;

      const prevNormal = { x: (prevVector.x / prevLength) * inset, y: (prevVector.y / prevLength) * inset };
      const nextNormal = { x: (nextVector.x / nextLength) * inset, y: (nextVector.y / nextLength) * inset };

      return {
        corner,
        start: { x: corner.x + prevNormal.x, y: corner.y + prevNormal.y },
        end: { x: corner.x + nextNormal.x, y: corner.y + nextNormal.y },
      };
    });

    const first = segments[0];
    context.moveTo(first.end.x, first.end.y);

    for (let i = 0; i < segments.length; i += 1) {
      const current = segments[i];
      const next = segments[(i + 1) % segments.length];
      context.lineTo(next.start.x, next.start.y);
      context.quadraticCurveTo(next.corner.x, next.corner.y, next.end.x, next.end.y);
    }

    context.closePath();
  };

  fillPathWithStyle(context, style, buildPath);

  if (style.strokeWidth > 0) {
    withGlobalOpacity(context, opacity, () => {
      if (style.sketchLevel > 0) {
        drawSketchStroke(context, buildPath, shape, style.sketchLevel);
      } else {
        buildPath();
        context.stroke();
      }
    });
  }

  context.restore();
}

function drawImageShape(context, shape) {
  const { style = {}, live = {}, asset = {} } = shape;
  const opacity = resolveShapeOpacity(style);
  const center = getShapeCenter(shape);
  const rotation = live.rotation || 0;
  const width = live.width;
  const height = live.height;

  context.save();
  context.translate(center.x, center.y);
  context.rotate(rotation);

  const drawFallback = () => {
    context.fillStyle = style.fill || "#cbd5f5";
    context.strokeStyle = style.stroke || "#1f2937";
    context.lineWidth = style.strokeWidth || 2;
    context.beginPath();
    context.rect(-width / 2, -height / 2, width, height);
    context.fill();
    if (style.strokeWidth > 0) {
      context.stroke();
    }
  context.fillStyle = "rgba(30, 41, 59, 0.6)";
  context.font = `16px ${getFontStack(DEFAULT_TEXT_FONT)}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("Image", 0, 0);
  };

  withGlobalOpacity(context, opacity, () => {
    if (asset.image instanceof Image && asset.image.complete) {
      try {
        context.drawImage(asset.image, -width / 2, -height / 2, width, height);
      } catch (error) {
        drawFallback();
      }
    } else {
      drawFallback();
    }
  });

  context.restore();
}

function drawCircleShape(context, shape) {
  const { style, live } = shape;
  const opacity = resolveShapeOpacity(style);
  const center = getShapeCenter(shape);
  const rotation = live.rotation || 0;
  const radius = Math.max(live.width, live.height) / 2;

  context.save();
  context.translate(center.x, center.y);
  context.rotate(rotation);
  context.strokeStyle = style.stroke;
  context.lineWidth = style.strokeWidth;
  context.lineCap = "round";
  context.lineJoin = "round";
  applyStrokePattern(context, style);
  applyStrokePattern(context, style);

  const drawPath = () => {
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
  };

  fillPathWithStyle(context, style, drawPath);
  if (style.strokeWidth > 0) {
    withGlobalOpacity(context, opacity, () => {
      if (style.sketchLevel > 0) {
        drawSketchStroke(context, drawPath, shape, style.sketchLevel);
      } else {
        drawPath();
        context.stroke();
      }
    });
  }

  context.restore();
}

function drawLineShape(context, shape) {
  const { style, live } = shape;
  if (!live.start || !live.end) return;
  const opacity = resolveShapeOpacity(style);
  context.save();
  context.strokeStyle = style.stroke;
  context.lineWidth = style.strokeWidth;
  context.lineCap = "round";
  context.lineJoin = "round";
  applyStrokePattern(context, style);

  const drawPath = () => {
    context.beginPath();
    context.moveTo(live.start.x, live.start.y);
    if (live.control) {
      context.quadraticCurveTo(live.control.x, live.control.y, live.end.x, live.end.y);
    } else {
      context.lineTo(live.end.x, live.end.y);
    }
  };

  if (style.strokeWidth > 0) {
    withGlobalOpacity(context, opacity, () => {
      if (style.sketchLevel > 0) {
        drawSketchStroke(context, drawPath, shape, style.sketchLevel);
      } else {
        drawPath();
        context.stroke();
      }
    });
  }

  context.restore();
}

function drawArrowShape(context, shape) {
  const { style, live } = shape;
  if (!live.start || !live.end) return;

  drawLineShape(context, shape);

  const headLength = Math.max(8, style.strokeWidth * 3);
  if (style.arrowEnd) {
    drawArrowHead(context, live.start, live.end, headLength, style);
  }
  if (style.arrowStart) {
    drawArrowHead(context, live.end, live.start, headLength, style);
  }
}

function drawFreeShape(context, shape) {
  const { style, live } = shape;
  if (!live.points || live.points.length < 2) return;
  const opacity = resolveShapeOpacity(style);
  context.save();
  context.strokeStyle = style.stroke;
  context.lineWidth = style.strokeWidth;
  context.lineCap = "round";
  context.lineJoin = "round";

  const drawPath = () => {
    context.beginPath();
    live.points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
  };

  if (style.sketchLevel > 0 && style.strokeWidth > 0) {
    withGlobalOpacity(context, opacity, () => {
      drawSketchStroke(context, drawPath, shape, style.sketchLevel);
    });
  } else {
    withGlobalOpacity(context, opacity, () => {
      drawPath();
      context.stroke();
    });
  }

  context.restore();
}

function drawTextShape(context, shape) {
  if (!shape || shape.type !== "text") return;
  const { style, live } = shape;
  if (!live) return;
  const opacity = resolveShapeOpacity(style);
  if (opacity <= 0) return;
  const text = typeof live.text === "string" ? live.text : "";
  const lines = text.split(/\r?\n/);
  const fontSize = Math.max(6, Number(style.fontSize) || state.style.fontSize || 32);
  const fontFamily = style.fontFamily || state.style.fontFamily || DEFAULT_TEXT_FONT;
  const center = getShapeCenter(shape);
  const rotation = live.rotation || 0;

  const lineHeight = fontSize * 1.25;
  const width = Math.max(fontSize * 0.6 + TEXT_PADDING, live.width || 0);
  const height = Math.max(lineHeight + TEXT_PADDING, live.height || 0);
  const startX = -width / 2 + TEXT_PADDING / 2;
  const startY = -height / 2 + TEXT_PADDING / 2;

  context.save();
  context.translate(center.x, center.y);
  context.rotate(rotation);
  context.fillStyle = style.fill || "#111827";
  context.font = `${fontSize}px ${getFontStack(fontFamily)}`;
  context.textBaseline = "top";
  context.textAlign = "left";

  withGlobalOpacity(context, opacity, () => {
    lines.forEach((line, index) => {
      const safeLine = line.length === 0 ? " " : line;
      context.fillText(safeLine, startX, startY + index * lineHeight);
    });
  });

  context.restore();
}

function drawArrowHead(context, start, end, size, style) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const headLength = Math.max(8, size);
  const leftX = end.x - headLength * Math.cos(angle - Math.PI / 6);
  const leftY = end.y - headLength * Math.sin(angle - Math.PI / 6);
  const rightX = end.x - headLength * Math.cos(angle + Math.PI / 6);
  const rightY = end.y - headLength * Math.sin(angle + Math.PI / 6);
  const opacity = resolveShapeOpacity(style);
  withGlobalOpacity(context, opacity, () => {
    context.beginPath();
    context.fillStyle = style.stroke;
    context.moveTo(end.x, end.y);
    context.lineTo(leftX, leftY);
    context.lineTo(rightX, rightY);
    context.closePath();
    context.fill();
  });
}

function drawShapeSelectionOutline(context, shape, { includeHandles = true } = {}) {
  if (!shape || shape.isVisible === false) return;

  if (shape.type === "line" || shape.type === "arrow") {
    context.beginPath();
    context.moveTo(shape.live.start.x, shape.live.start.y);
    if (shape.live.control && shape.type === "line") {
      context.quadraticCurveTo(shape.live.control.x, shape.live.control.y, shape.live.end.x, shape.live.end.y);
    } else {
      context.lineTo(shape.live.end.x, shape.live.end.y);
    }
    context.stroke();
    if (includeHandles) {
      drawLineEndpointHandle(context, shape.live.start);
      drawLineEndpointHandle(context, shape.live.end);
      if (shape.type === "line") {
        drawLineBendHandle(context, getLineBendHandlePosition(shape));
      }
    }
    return;
  }

  if (shape.type === "free") {
    const bounds = getShapeBounds(shape);
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    if (includeHandles) {
      drawResizeHandle(context, bounds.x + bounds.width, bounds.y + bounds.height);
    }
  } else {
    const center = getShapeCenter(shape);
    const rotation = shape.live.rotation || 0;
    context.save();
    context.translate(center.x, center.y);
    context.rotate(rotation);
    context.strokeRect(-shape.live.width / 2, -shape.live.height / 2, shape.live.width, shape.live.height);
    context.restore();
    if (includeHandles) {
      const handle = getRectResizeHandlePosition(shape);
      drawResizeHandle(context, handle.x, handle.y);
    }
  }

  if (includeHandles) {
    const rotationHandle = getRotationHandlePosition(shape);
    if (rotationHandle) {
      drawRotationHandle(context, rotationHandle.position);
    }
  }
}

function getSelectionBoundingRect(shapes) {
  if (!Array.isArray(shapes) || shapes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  shapes.forEach((shape) => {
    if (!shape || shape.isVisible === false) return;
    const bounds = getShapeBounds(shape);
    if (!bounds) return;
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

const GROUP_HANDLE_SIZE = 16;
const GROUP_ROTATION_HANDLE_OFFSET = 36;

function drawGroupHandles(context, bounds) {
  if (!context || !bounds) return;
  const handleX = bounds.x + bounds.width;
  const handleY = bounds.y + bounds.height;
  drawResizeHandle(context, handleX, handleY);

  const centerX = bounds.x + bounds.width / 2;
  const anchor = { x: centerX, y: bounds.y };
  const rotationPosition = { x: centerX, y: bounds.y - GROUP_ROTATION_HANDLE_OFFSET };

  context.save();
  context.setLineDash([]);
  context.strokeStyle = "rgba(96, 165, 250, 0.8)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(anchor.x, anchor.y);
  context.lineTo(rotationPosition.x, rotationPosition.y);
  context.stroke();
  drawRotationHandle(context, rotationPosition);
  context.restore();
}

function detectGroupResizeHandle(point, bounds) {
  if (!point || !bounds) return null;
  const handleX = bounds.x + bounds.width;
  const handleY = bounds.y + bounds.height;
  if (Math.abs(point.x - handleX) > GROUP_HANDLE_SIZE || Math.abs(point.y - handleY) > GROUP_HANDLE_SIZE) {
    return null;
  }
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  return {
    type: "group-resize",
    position: { x: handleX, y: handleY },
    center,
    bounds: { ...bounds },
    localVector: {
      x: Math.max(1, bounds.width / 2),
      y: Math.max(1, bounds.height / 2),
    },
  };
}

function detectGroupRotateHandle(point, bounds) {
  if (!point || !bounds) return null;
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  const anchor = { x: center.x, y: bounds.y };
  const handle = { x: center.x, y: bounds.y - GROUP_ROTATION_HANDLE_OFFSET };
  const radius = GROUP_HANDLE_SIZE + 4;
  if (distance(point, handle) > radius) {
    return null;
  }
  return {
    type: "group-rotate",
    position: handle,
    anchor,
    center,
    bounds: { ...bounds },
    pointerAngle: Math.atan2(point.y - center.y, point.x - center.x),
  };
}

function detectGroupHandle(point, bounds) {
  if (!point || !bounds) return null;
  const rotateHandle = detectGroupRotateHandle(point, bounds);
  if (rotateHandle) {
    return rotateHandle;
  }
  return detectGroupResizeHandle(point, bounds);
}

function drawSelectionBounds(context) {
  const selectedCount = state.selectedIds?.size ?? 0;
  if (selectedCount === 0) return;
  const pointerMode = state.pointer?.mode;
  if (pointerMode === "creating" || pointerMode === "drawing-free") {
    return;
  }

  const primaryShape = state.selection ?? null;
  const multiSelected = selectedCount > 1;
  const selectedShapes = multiSelected ? getSelectedShapesList() : primaryShape ? [primaryShape] : [];

  context.save();
  context.setLineDash([6, 4]);
  context.lineWidth = 1;

  if (multiSelected) {
    const bounds = getSelectionBoundingRect(selectedShapes);
    if (bounds) {
      context.strokeStyle = "rgba(96, 165, 250, 0.95)";
      context.lineWidth = 2;
      context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

      context.setLineDash([6, 4]);
      context.lineWidth = 1.5;
      context.strokeStyle = "rgba(96, 165, 250, 0.8)";
      selectedShapes.forEach((shape) => {
        drawShapeSelectionOutline(context, shape, { includeHandles: false });
      });

      drawGroupHandles(context, bounds);
    }
  }

  if (!multiSelected && primaryShape) {
    context.setLineDash([6, 4]);
    context.lineWidth = 1;
    context.strokeStyle = "#ffffff";
    drawShapeSelectionOutline(context, primaryShape, { includeHandles: true });
  }

  context.restore();
}

function drawResizeHandle(context, x, y) {
  const size = 10;
  context.save();
  context.setLineDash([]);
  context.fillStyle = "#facc15";
  context.strokeStyle = "#0f172a";
  context.lineWidth = 1;
  context.beginPath();
  context.rect(x - size / 2, y - size / 2, size, size);
  context.fill();
  context.stroke();
  context.restore();
}

function drawRotationHandle(context, position) {
  const radius = 8;
  context.save();
  context.setLineDash([]);
  context.fillStyle = "#38bdf8";
  context.strokeStyle = "#0f172a";
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(position.x, position.y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function drawLineEndpointHandle(context, position) {
  const radius = 6;
  context.save();
  context.setLineDash([]);
  context.fillStyle = "#facc15";
  context.strokeStyle = "#0f172a";
  context.lineWidth = 1;
  context.beginPath();
  context.arc(position.x, position.y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function drawLineBendHandle(context, position) {
  if (!position) return;
  const radius = 7;
  context.save();
  context.setLineDash([]);
  context.fillStyle = "#38bdf8";
  context.strokeStyle = "#0f172a";
  context.lineWidth = 1.25;
  context.beginPath();
  context.arc(position.x, position.y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function updateModifierStateFromEvent(event, { allowFalse = true } = {}) {
  if (!event) return;
  const apply = (key, value) => {
    if (value) {
      state.modifiers[key] = true;
    } else if (allowFalse) {
      state.modifiers[key] = false;
    }
  };
  apply("shift", event.shiftKey);
  apply("ctrl", event.ctrlKey);
  apply("meta", event.metaKey);
  apply("alt", event.altKey);
}

function resetModifierState() {
  state.modifiers.shift = false;
  state.modifiers.ctrl = false;
  state.modifiers.meta = false;
  state.modifiers.alt = false;
}

function isMultiSelectModifierActive(event) {
  if (event && (event.shiftKey || event.metaKey || event.ctrlKey)) {
    return true;
  }
  return state.modifiers.shift || state.modifiers.meta || state.modifiers.ctrl;
}

function captureMultiSelectionSnapshot() {
  if (!state.selectedIds || state.selectedIds.size === 0) {
    state.pointer.multiSnapshot = null;
    state.pointer.multiStyles = null;
    return false;
  }

  const snapshotMap = new Map();
  const styleMap = new Map();

  state.selectedIds.forEach((id) => {
    const target = getShapeById(id);
    if (!target) return;
    snapshotMap.set(id, cloneSnapshot(target.live));
    styleMap.set(id, JSON.parse(JSON.stringify(target.style || {})));
  });

  if (snapshotMap.size === 0) {
    state.pointer.multiSnapshot = null;
    state.pointer.multiStyles = null;
    return false;
  }

  state.pointer.multiSnapshot = snapshotMap;
  state.pointer.multiStyles = styleMap;
  return true;
}

function handlePointerDown(event) {
  closeAllContextMenus();

  updateModifierStateFromEvent(event, { allowFalse: false });

  const nonPrimaryButton = (() => {
    if (typeof event.button === "number") {
      return event.button !== 0;
    }
    if (typeof event.buttons === "number" && event.buttons !== 0) {
      return (event.buttons & 1) === 0;
    }
    return false;
  })();

  if (nonPrimaryButton) {
    return;
  }

  const point = getCanvasPoint(event);
  state.pointer.down = true;
  state.pointer.start = point;
  state.pointer.current = point;
  state.pointer.mode = "idle";
  state.pointer.tempShape = null;
  state.pointer.startSnapshot = null;
  state.pointer.startCenter = null;
  state.pointer.startRotation = 0;
  state.pointer.rotationStartAngle = 0;
  state.pointer.startBounds = null;
  state.pointer.activeHandle = null;
  state.pointer.startHandleVector = null;
  state.pointer.startStyle = null;
  state.pointer.multiSnapshot = null;
  state.pointer.multiStyles = null;
  if (typeof event.pointerId === "number" && !event.isSyntheticPointer) {
    state.pointer.usingPointerEvents = true;
    if (typeof canvas.setPointerCapture === "function") {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (error) {
        // Ignore capture errors for fallback devices.
      }
    }
  } else {
    state.pointer.usingPointerEvents = false;
  }

  const targetNode = event.target;
  const clickedInsideEditor = targetNode instanceof Element && targetNode.closest(".canvas-text-editor");
  if (!clickedInsideEditor) {
    finalizeActiveTextEditor();
  }

  const multiSelected = state.selectedIds.size > 1;
  if (multiSelected && state.tool === "select") {
    const selectedShapes = getSelectedShapesList();
    const groupBounds = getSelectionBoundingRect(selectedShapes);
    const groupHandle = detectGroupHandle(point, groupBounds);
    if (groupHandle) {
      if (!captureMultiSelectionSnapshot()) {
        state.pointer.mode = "idle";
        return;
      }
      state.pointer.mode = groupHandle.type === "group-rotate" ? "rotating" : "resizing";
      state.pointer.startSnapshot = state.selection ? cloneSnapshot(state.selection.live) : null;
      state.pointer.startCenter = groupHandle.center;
      state.pointer.startBounds = groupHandle.bounds ? { ...groupHandle.bounds } : groupBounds ? { ...groupBounds } : null;
      state.pointer.activeHandle = groupHandle;
      state.pointer.startHandleVector = groupHandle.localVector || null;
      if (groupHandle.type === "group-rotate") {
        const angle = groupHandle.pointerAngle ?? Math.atan2(point.y - groupHandle.center.y, point.x - groupHandle.center.x);
        state.pointer.rotationStartAngle = angle;
      } else {
        state.pointer.rotationStartAngle = 0;
      }
      state.pointer.startRotation = 0;
      prepareHistory(groupHandle.type === "group-rotate" ? "rotate-shape" : "resize-shape");
      return;
    }
  }

  let handleTarget = null;
  let shape = null;

  if (state.selection) {
    const selected = state.selection;
    const rotateHandle = detectRotateHandle(selected, point);
    const resizeHandle = detectResizeHandle(selected, point);
    const bendHandle = detectLineBendHandle(selected, point);
    const lineHandle = detectLineEndpointHandle(selected, point);
    if (rotateHandle || resizeHandle || bendHandle || lineHandle) {
      shape = selected;
      handleTarget = rotateHandle || resizeHandle || bendHandle || lineHandle;
    }
  }

  if (!shape) {
    shape = hitTest(point);
  }

  if (state.tool === "text" && !shape) {
    state.pointer.mode = "text-pending";
    return;
  }

  if (shape) {
    const alreadySelected = state.selectedIds.has(shape.id);
  const allowMulti = state.tool === "select" && isMultiSelectModifierActive(event);

    if (allowMulti) {
      const current = getSelectedShapesList();
      if (alreadySelected) {
        const removalIds = getGroupMemberIds(shape);
        const remaining = current.filter((entry) => !removalIds.has(entry.id));
        setSelectedShapes(remaining);
      } else {
        const additions = Array.from(getGroupMemberIds(shape))
          .map((id) => getShapeById(id))
          .filter(Boolean);
        const merged = [...current];
        additions.forEach((member) => {
          if (!merged.some((entry) => entry.id === member.id)) {
            merged.push(member);
          }
        });
        setSelectedShapes(merged, { primaryId: shape.id });
      }
      state.pointer.mode = "idle";
      return;
    }

    if (!alreadySelected) {
      updateSelection(shape);
      resetPointerInteraction();
      state.pointer.down = false;
      if (typeof event.pointerId === "number" && typeof canvas.releasePointerCapture === "function") {
        try {
          canvas.releasePointerCapture(event.pointerId);
        } catch (error) {
          // Ignore release errors for fallback devices.
        }
      }
      return;
    }

    if (state.selectedIds.size > 1 && state.selection?.id !== shape.id) {
      state.selection = shape;
      refreshSelectionUI();
    }
    state.pointer.startStyle = { ...shape.style };

    const bendHandle = handleTarget && handleTarget.type === "line-bend"
      ? handleTarget
      : detectLineBendHandle(shape, point);
    if (bendHandle) {
      state.pointer.mode = "bending-line";
      state.pointer.startSnapshot = cloneSnapshot(shape.live);
      state.pointer.activeHandle = bendHandle;
      if (state.selectedIds.size > 1) {
        captureMultiSelectionSnapshot();
      }
      prepareHistory("bend-line");
      return;
    }

    const lineHandle = handleTarget && (handleTarget === "start" || handleTarget === "end")
      ? handleTarget
      : detectLineEndpointHandle(shape, point);
    if (lineHandle) {
      state.pointer.mode = lineHandle === "start" ? "resizing-line-start" : "resizing-line-end";
      state.pointer.startSnapshot = cloneSnapshot(shape.live);
      if (state.selectedIds.size > 1) {
        captureMultiSelectionSnapshot();
      }
      prepareHistory("adjust-line-endpoint");
      return;
    }

  const rotateHandle = handleTarget && handleTarget.type === "rotate" ? handleTarget : detectRotateHandle(shape, point);
    if (rotateHandle) {
      state.pointer.mode = "rotating";
      state.pointer.startSnapshot = cloneSnapshot(shape.live);
      state.pointer.startCenter = rotateHandle.center;
      state.pointer.rotationStartAngle = rotateHandle.pointerAngle;
      state.pointer.startRotation = getShapeRotation(shape);
      state.pointer.startBounds = rotateHandle.bounds;
      state.pointer.activeHandle = rotateHandle;
      updateCanvasCursor();
      prepareHistory("rotate-shape");
      return;
    }

    const resizeHandle = handleTarget && handleTarget.type === "corner" ? handleTarget : detectResizeHandle(shape, point);
    if (resizeHandle) {
      state.pointer.mode = "resizing";
      state.pointer.startSnapshot = cloneSnapshot(shape.live);
      state.pointer.startCenter = resizeHandle.center;
      state.pointer.startRotation = getShapeRotation(shape);
      state.pointer.startBounds = resizeHandle.bounds;
      state.pointer.activeHandle = resizeHandle;
      state.pointer.startHandleVector = resizeHandle.localVector || null;
      prepareHistory("resize-shape");
      return;
    }

    state.pointer.mode = "moving";
    state.pointer.startSnapshot = cloneSnapshot(shape.live);
    state.pointer.startCenter = getShapeCenter(shape);
    updateCanvasCursor();
    if (state.selectedIds.size > 1) {
      captureMultiSelectionSnapshot();
    }
    prepareHistory("move-shapes");
    return;
  }

  if (state.tool === "select") {
    state.pointer.mode = "marquee";
    state.pointer.marquee = {
      start: { ...state.pointer.start },
      current: { ...state.pointer.start },
    };
    state.pointer.marqueeAppend = Boolean(isMultiSelectModifierActive(event));
    if (!state.pointer.marqueeAppend) {
      setSelectedShapes([]);
    }
    return;
  }

  state.pointer.mode = state.tool === "free" ? "drawing-free" : "creating";
  prepareHistory(state.pointer.mode === "drawing-free" ? "draw-freeform" : "create-shape");
  const tempShape = createShape(state.tool, point, point);
  state.pointer.tempShape = tempShape;
  state.shapes.push(tempShape);
  updateSelection(tempShape);
}

function updateCanvasCursor() {
  if (!canvas) return;
  
  switch (state.pointer.mode) {
    case "rotating":
      canvas.style.cursor = "grabbing";
      break;
    case "moving":
      canvas.style.cursor = "move";
      break;
    default:
      canvas.style.cursor = "";
      break;
  }
}

function handlePointerMove(event) {
  if (!state.pointer.down) return;
  const point = getCanvasPoint(event);
  state.pointer.current = point;

  if (state.pointer.mode === "text-pending" || state.pointer.mode === "text-dragging") {
    if (state.pointer.mode === "text-pending" && distance(state.pointer.start, point) > 6) {
      state.pointer.mode = "text-dragging";
    }
    return;
  }

  if (state.pointer.mode === "marquee" && state.pointer.marquee) {
    updateMarqueeSelection(point);
    return;
  }

  if (state.selection && [
    "moving",
    "resizing",
    "rotating",
    "resizing-line-start",
    "resizing-line-end",
    "bending-line",
  ].includes(state.pointer.mode)) {
    switch (state.pointer.mode) {
      case "moving":
        if (state.pointer.multiSnapshot && state.pointer.multiSnapshot.size > 0) {
          state.pointer.multiSnapshot.forEach((snapshot, id) => {
            const target = state.shapes.find((shape) => shape.id === id);
            if (!target) return;
            moveShape(target, point, snapshot);
          });
        } else {
          moveShape(state.selection, point);
        }
        break;
      case "resizing":
        if (state.pointer.multiSnapshot && state.pointer.multiSnapshot.size > 0) {
          resizeGroupSelection(point);
        } else {
          resizeShape(state.selection, point);
        }
        break;
      case "rotating":
        if (state.pointer.multiSnapshot && state.pointer.multiSnapshot.size > 0) {
          rotateGroupSelection(point);
        } else {
          rotateShape(state.selection, point);
        }
        break;
      case "resizing-line-start":
      case "resizing-line-end":
        resizeLineEndpoint(state.selection, point, state.pointer.mode);
        break;
      case "bending-line":
        bendLineShape(state.selection, point);
        break;
      default:
        break;
    }
    return;
  }

  if (state.pointer.mode === "creating") {
    updateTempShape(point);
  } else if (state.pointer.mode === "drawing-free") {
    markHistoryChanged();
    state.pointer.tempShape?.live.points.push(point);
  }
}

function resetPointerInteraction() {
  state.pointer.mode = "idle";
  state.pointer.tempShape = null;
  state.pointer.startSnapshot = null;
  state.pointer.startCenter = null;
  state.pointer.startRotation = 0;
  state.pointer.rotationStartAngle = 0;
  state.pointer.startBounds = null;
  state.pointer.activeHandle = null;
  state.pointer.startHandleVector = null;
  state.pointer.startStyle = null;
  state.pointer.multiSnapshot = null;
  state.pointer.multiStyles = null;
  state.pointer.marquee = null;
  state.pointer.marqueeAppend = false;
  updateCanvasCursor();
  state.pointer.usingPointerEvents = false;
  state.pointer.touchIdentifier = null;
  hideMarqueeOverlay();
}

function handlePointerUp(event) {
  if (!state.pointer.down) return;
  const point = getCanvasPoint(event);
  state.pointer.current = point;
  state.pointer.down = false;
  if (typeof event.pointerId === "number" && typeof canvas.releasePointerCapture === "function") {
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch (error) {
      // Ignore release errors
    }
  }

  const pointerMode = state.pointer.mode;
  const isTextCreation = state.tool === "text" && (pointerMode === "text-pending" || pointerMode === "text-dragging");

  if (isTextCreation) {
    if (pointerMode !== "text-dragging") {
      const shape = createTextShapeAt(state.pointer.start);
      if (shape) {
        startTextEditing(shape, { focus: true, selectAll: true });
      }
    }
    resetPointerInteraction();
    return;
  }

  let shouldFinalizeHistory = false;

  if (pointerMode === "marquee" && state.pointer.marquee) {
    finalizeMarqueeSelection();
  } else if (state.selection && [
    "moving",
    "resizing",
    "rotating",
    "resizing-line-start",
    "resizing-line-end",
    "bending-line",
  ].includes(pointerMode)) {
    const hasMultiSnapshot = state.pointer.multiSnapshot && state.pointer.multiSnapshot.size > 0;
    if (hasMultiSnapshot) {
      state.pointer.multiSnapshot.forEach((_, id) => {
        const target = state.shapes.find((shape) => shape.id === id);
        if (!target) return;
        writeKeyframe(target, state.timeline.current, { apply: false, render: false, markSelected: false });
      });
      applyTimelineState();
      renderKeyframeList();
    } else {
      commitShapeChange(state.selection);
    }
    shouldFinalizeHistory = true;
  } else if (pointerMode === "creating" || pointerMode === "drawing-free") {
    finalizeTempShape(point);
    shouldFinalizeHistory = true;
  }

  if (shouldFinalizeHistory) {
    finalizeHistory();
  }

  resetPointerInteraction();
}

function handleMouseDownFallback(event) {
  if (state.pointer.usingPointerEvents) return;
  if (typeof event.button === "number" && event.button !== 0) {
    closeAllContextMenus();
    return;
  }
  updateModifierStateFromEvent(event, { allowFalse: false });
  handlePointerDown(createSyntheticPointerEvent(event));
}

function handleMouseMoveFallback(event) {
  if (state.pointer.usingPointerEvents || !state.pointer.down) return;
  handlePointerMove(createSyntheticPointerEvent(event));
}

function handleMouseUpFallback(event) {
  if (state.pointer.usingPointerEvents) return;
  handlePointerUp(createSyntheticPointerEvent(event));
}

function createSyntheticPointerEvent(event) {
  return {
    clientX: event.clientX,
    clientY: event.clientY,
    pointerId: 1,
    buttons: typeof event.buttons === "number" ? event.buttons : event.type === "mouseup" ? 0 : 1,
    preventDefault: () => event.preventDefault(),
    isSyntheticPointer: true,
    pointerType: "mouse",
    button: typeof event.button === "number" ? event.button : 0,
    shiftKey: Boolean(event.shiftKey),
    ctrlKey: Boolean(event.ctrlKey),
    metaKey: Boolean(event.metaKey),
    altKey: Boolean(event.altKey),
    target: event.target,
  };
}

function getTouchById(touchList, identifier) {
  if (!touchList) return null;
  for (let index = 0; index < touchList.length; index += 1) {
    const touch = touchList.item(index);
    if (!touch) continue;
    if (identifier === null || touch.identifier === identifier) {
      return touch;
    }
  }
  return null;
}

function createPointerEventFromTouch(event, touch, phase) {
  const pointerId = (touch.identifier ?? 0) + 2;
  return {
    clientX: touch.clientX,
    clientY: touch.clientY,
    pointerId,
    button: 0,
    buttons: phase === "end" || phase === "cancel" ? 0 : 1,
    shiftKey: Boolean(event.shiftKey),
    ctrlKey: Boolean(event.ctrlKey),
    metaKey: Boolean(event.metaKey),
    altKey: Boolean(event.altKey),
    preventDefault: () => event.preventDefault(),
    stopPropagation: () => event.stopPropagation(),
    target: event.target,
    pointerType: "touch",
    isSyntheticPointer: true,
    touchIdentifier: touch.identifier,
  };
}

function handleTouchStart(event) {
  if (state.pointer.down) {
    return;
  }
  const touch = getTouchById(event.changedTouches, null);
  if (!touch) {
    return;
  }
  event.preventDefault();
  const pointerEvent = createPointerEventFromTouch(event, touch, "start");
  handlePointerDown(pointerEvent);
  if (state.pointer.down) {
    state.pointer.usingPointerEvents = true;
  }
  if (state.pointer.down) {
    state.pointer.touchIdentifier = touch.identifier;
  } else {
    state.pointer.touchIdentifier = null;
  }
}

function handleTouchMove(event) {
  if (!state.pointer.down) {
    return;
  }
  const identifier = state.pointer.touchIdentifier;
  if (identifier === null) {
    return;
  }
  const touch = getTouchById(event.changedTouches, identifier);
  if (!touch) {
    return;
  }
  event.preventDefault();
  const pointerEvent = createPointerEventFromTouch(event, touch, "move");
  handlePointerMove(pointerEvent);
}

function handleTouchEnd(event) {
  const identifier = state.pointer.touchIdentifier;
  if (identifier === null) {
    return;
  }
  const touch = getTouchById(event.changedTouches, identifier);
  if (!touch) {
    return;
  }
  event.preventDefault();
  const pointerEvent = createPointerEventFromTouch(event, touch, "end");
  handlePointerUp(pointerEvent);
  state.pointer.touchIdentifier = null;
  state.pointer.usingPointerEvents = false;
}

function handleTouchCancel(event) {
  const identifier = state.pointer.touchIdentifier;
  if (identifier === null) {
    return;
  }
  const touch = getTouchById(event.changedTouches, identifier) || getTouchById(event.touches, identifier);
  if (!touch) {
    resetPointerInteraction();
    return;
  }
  event.preventDefault();
  const pointerEvent = createPointerEventFromTouch(event, touch, "cancel");
  handlePointerUp(pointerEvent);
  state.pointer.touchIdentifier = null;
  state.pointer.usingPointerEvents = false;
}

function createTextShapeAt(point) {
  const origin = point || state.pointer.start || { x: state.stage.width / 2, y: state.stage.height / 2 };
  const historyEntry = createHistoryEntry("create-text");
  const shape = createShape("text", origin, origin);
  if (!shape) return null;
  shape.style.fontFamily = shape.style.fontFamily || state.style.fontFamily || DEFAULT_TEXT_FONT;
  shape.style.fontSize = Math.max(6, shape.style.fontSize || state.style.fontSize || 32);
  shape.style.rotation = shape.style.rotation || 0;
  shape.live.rotation = shape.live.rotation || 0;
  state.shapes.push(shape);
  updateSelection(shape);
  updateTextMetrics(shape, { centerOverride: origin });
  repositionActiveTextEditor();
  commitHistoryEntry(historyEntry);
  return shape;
}

function handleCanvasDoubleClick(event) {
  const point = getCanvasPoint(event);
  const shape = hitTest(point);
  if (shape && shape.type === "text") {
    event.preventDefault();
    event.stopPropagation();
    updateSelection(shape);
    startTextEditing(shape, { focus: true, selectAll: true });
  }
}

function measureTextMetrics(text, style = {}) {
  const lines = (typeof text === "string" && text.length > 0 ? text : "").split(/\r?\n/);
  const fontSize = Math.max(6, Number(style.fontSize) || state.style.fontSize || 32);
  const fontFamily = style.fontFamily || state.style.fontFamily || DEFAULT_TEXT_FONT;
  const effectiveLines = lines.length > 0 ? lines : [""];
  ctx.save();
  ctx.font = `${fontSize}px ${getFontStack(fontFamily)}`;
  let maxWidth = 0;
  let ascent = fontSize * 0.8;
  let descent = fontSize * 0.2;
  effectiveLines.forEach((line) => {
    const metrics = ctx.measureText(line.length > 0 ? line : " ");
    maxWidth = Math.max(maxWidth, metrics.width);
    if (metrics.actualBoundingBoxAscent) {
      ascent = Math.max(ascent, metrics.actualBoundingBoxAscent);
    }
    if (metrics.actualBoundingBoxDescent) {
      descent = Math.max(descent, metrics.actualBoundingBoxDescent);
    }
  });
  ctx.restore();

  const lineHeight = fontSize * 1.25;
  const totalHeight = Math.max(lineHeight, effectiveLines.length * lineHeight) + TEXT_PADDING;
  const totalWidth = Math.max(fontSize * 0.6, maxWidth) + TEXT_PADDING;

  return {
    width: totalWidth,
    height: totalHeight,
    ascent,
    descent,
    fontSize,
    fontFamily,
    lineHeight,
  };
}

function updateTextMetrics(shape, { keepCenter = false, centerOverride = null, preserveOrigin = false } = {}) {
  if (!shape || shape.type !== "text") return null;
  const metrics = measureTextMetrics(shape.live.text || "", shape.style);
  const previousCenter = getShapeCenter(shape);
  const previousTopLeft = { x: shape.live.x ?? 0, y: shape.live.y ?? 0 };
  shape.live.width = metrics.width;
  shape.live.height = metrics.height;
  shape.live.ascent = metrics.ascent;
  shape.live.descent = metrics.descent;
  shape.live.lineHeight = metrics.lineHeight;

  let center = null;
  if (centerOverride) {
    center = centerOverride;
  } else if (keepCenter) {
    center = previousCenter;
  }

  if (center) {
    shape.live.x = center.x - metrics.width / 2;
    shape.live.y = center.y - metrics.height / 2;
  } else if (preserveOrigin && Number.isFinite(previousTopLeft.x) && Number.isFinite(previousTopLeft.y)) {
    shape.live.x = previousTopLeft.x;
    shape.live.y = previousTopLeft.y;
  } else {
    shape.live.x = shape.live.x ?? state.stage.width / 2 - metrics.width / 2;
    shape.live.y = shape.live.y ?? state.stage.height / 2 - metrics.height / 2;
  }

  return metrics;
}

function refreshTextSnapshotMetrics(snapshot, { fallbackStyle = null, keepCenter = false } = {}) {
  if (!snapshot || snapshot.type !== "text") return;
  const originalStyleRotation = snapshot.style?.rotation;
  const originalLiveRotation = snapshot.live?.rotation;
  const style = { ...(fallbackStyle || {}), ...(snapshot.style || {}) };
  const live = { ...(snapshot.live || {}) };
  const workingShape = {
    type: "text",
    style,
    live,
  };
  const options = keepCenter ? { keepCenter: true } : { preserveOrigin: true };
  updateTextMetrics(workingShape, options);
  snapshot.style = workingShape.style;
  if (originalStyleRotation !== undefined) {
    snapshot.style.rotation = originalStyleRotation;
  }
  snapshot.live = workingShape.live;
  if (originalLiveRotation !== undefined) {
    snapshot.live.rotation = originalLiveRotation;
  }
}

function destroyActiveTextEditorElement() {
  const active = state.activeTextEditor;
  if (!active) return;
  const { element, handlers } = active;
  if (element) {
    if (handlers?.blur) element.removeEventListener("blur", handlers.blur);
    if (handlers?.keydown) element.removeEventListener("keydown", handlers.keydown);
    if (handlers?.input) element.removeEventListener("input", handlers.input);
    if (handlers?.pointerdown) element.removeEventListener("pointerdown", handlers.pointerdown);
    if (handlers?.mousedown) element.removeEventListener("mousedown", handlers.mousedown);
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }
  state.activeTextEditor = null;
}

function finalizeActiveTextEditor({ cancel = false } = {}) {
  const active = state.activeTextEditor;
  if (!active) return;
  const { element, shapeId, initialText } = active;
  const shape = state.shapes.find((entry) => entry.id === shapeId);
  const value = element ? element.value : initialText;
  destroyActiveTextEditorElement();

  if (!shape || shape.type !== "text") {
    return;
  }

  const nextText = cancel ? initialText : value;
  const trimmed = (nextText || "").trim();

  if (!cancel) {
    shape.live.text = nextText;
  } else {
    shape.live.text = initialText;
  }

  if (trimmed.length === 0) {
    removeShape(shape);
    return;
  }

  updateTextMetrics(shape, { keepCenter: true });
  if (!cancel) {
    ensureBaseKeyframe(shape, state.timeline.current);
  writeKeyframe(shape, state.timeline.current, { markSelected: false });
  }
  repositionActiveTextEditor();
}

function startTextEditing(shape, { focus = true, selectAll = false } = {}) {
  if (!shape || shape.type !== "text") return;
  finalizeActiveTextEditor();

  const editor = document.createElement("textarea");
  editor.className = "canvas-text-editor";
  editor.value = shape.live.text || "";
  editor.spellcheck = false;
  editor.autocapitalize = "off";
  editor.autocomplete = "off";
  editor.setAttribute("data-shape-id", String(shape.id));

  const pointerBlocker = (event) => {
    event.stopPropagation();
  };

  const handleBlur = () => {
    finalizeActiveTextEditor();
  };

  const handleKeydown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      finalizeActiveTextEditor();
    } else if (event.key === "Escape") {
      event.preventDefault();
      finalizeActiveTextEditor({ cancel: true });
    }
  };

  const handleInput = () => {
    shape.live.text = editor.value;
    const keepCenter = state.activeTextEditor?.keepCenter;
    if (keepCenter) {
      updateTextMetrics(shape, { keepCenter: true });
    } else {
      updateTextMetrics(shape, { preserveOrigin: true });
    }
    repositionActiveTextEditor();
  };

  editor.addEventListener("pointerdown", pointerBlocker);
  editor.addEventListener("mousedown", pointerBlocker);
  editor.addEventListener("blur", handleBlur);
  editor.addEventListener("keydown", handleKeydown);
  editor.addEventListener("input", handleInput);

  document.body.appendChild(editor);

  const keepCenter = Math.abs(shape.live.rotation || shape.style.rotation || 0) > 0.001;

  state.activeTextEditor = {
    element: editor,
    shapeId: shape.id,
    initialText: shape.live.text || "",
    handlers: {
      blur: handleBlur,
      keydown: handleKeydown,
      input: handleInput,
      pointerdown: pointerBlocker,
      mousedown: pointerBlocker,
    },
    keepCenter,
  };

  editor.style.fontFamily = getFontStack(shape.style.fontFamily || state.style.fontFamily || DEFAULT_TEXT_FONT);
  editor.style.fontSize = `${Math.max(6, shape.style.fontSize || state.style.fontSize || 32)}px`;

  if (keepCenter) {
    updateTextMetrics(shape, { keepCenter: true });
  } else {
    updateTextMetrics(shape, { preserveOrigin: true });
  }
  repositionActiveTextEditor();

  if (focus) {
    editor.focus();
    if (selectAll) {
      editor.select();
    }
  }
}

function repositionActiveTextEditor() {
  const active = state.activeTextEditor;
  if (!active || !active.element) return;
  const shape = state.shapes.find((entry) => entry.id === active.shapeId);
  if (!shape || shape.type !== "text") {
    destroyActiveTextEditorElement();
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const left = rect.left + shape.live.x;
  const top = rect.top + shape.live.y;
  active.element.style.left = `${left}px`;
  active.element.style.top = `${top}px`;
  active.element.style.width = `${shape.live.width}px`;
  active.element.style.height = `${shape.live.height}px`;
  active.element.style.fontFamily = getFontStack(shape.style.fontFamily || state.style.fontFamily || DEFAULT_TEXT_FONT);
  active.element.style.fontSize = `${Math.max(6, shape.style.fontSize || state.style.fontSize || 32)}px`;
}

function moveShape(shape, point, startSnapshot = state.pointer.startSnapshot) {
  if (!shape) return;
  if (!startSnapshot) return;
  markHistoryChanged();
  const dx = point.x - state.pointer.start.x;
  const dy = point.y - state.pointer.start.y;

  if (shape.type === "line" || shape.type === "arrow") {
    shape.live.start.x = startSnapshot.start.x + dx;
    shape.live.start.y = startSnapshot.start.y + dy;
    shape.live.end.x = startSnapshot.end.x + dx;
    shape.live.end.y = startSnapshot.end.y + dy;
    if (shape.type === "line") {
      if (startSnapshot.control) {
        shape.live.control = {
          x: startSnapshot.control.x + dx,
          y: startSnapshot.control.y + dy,
        };
      } else {
        delete shape.live.control;
      }
    }
  } else if (shape.type === "free") {
    shape.live.points = startSnapshot.points.map((pt) => ({
      x: pt.x + dx,
      y: pt.y + dy,
    }));
  } else {
    shape.live.x = startSnapshot.x + dx;
    shape.live.y = startSnapshot.y + dy;
  }
}

function resizeShape(shape, point) {
  if (!shape) return;
  const start = state.pointer.startSnapshot;
  if (!start) return;
  markHistoryChanged();

  if (shape.type === "text") {
    resizeTextShape(shape, point, start);
  } else if (shape.type === "rectangle" || shape.type === "diamond" || shape.type === "square" || shape.type === "circle" || shape.type === "image") {
    resizeRectangularShape(shape, point, start);
  } else if (shape.type === "free") {
    resizeFreeformShape(shape, point, start);
  } else if (shape.type === "image") {
    resizeRectangularShape(shape, point, start);
  }
}

function resizeGroupSelection(point) {
  if (!point) return false;
  const snapshots = state.pointer.multiSnapshot;
  if (!snapshots || snapshots.size === 0) return false;
  const startBounds = state.pointer.startBounds;
  if (!startBounds) return false;

  const center = state.pointer.startCenter || {
    x: startBounds.x + startBounds.width / 2,
    y: startBounds.y + startBounds.height / 2,
  };
  const startVector = state.pointer.startHandleVector || {
    x: Math.max(1, startBounds.width / 2),
    y: Math.max(1, startBounds.height / 2),
  };
  const currentVector = {
    x: Math.max(1, Math.abs(point.x - center.x)),
    y: Math.max(1, Math.abs(point.y - center.y)),
  };

  const scaleX = clampScale(currentVector.x / Math.max(1, startVector.x));
  const scaleY = clampScale(currentVector.y / Math.max(1, startVector.y));

  markHistoryChanged();
  const styleSnapshots = state.pointer.multiStyles || new Map();

  snapshots.forEach((snapshot, id) => {
    const shape = getShapeById(id);
    if (!shape) return;
    const styleSnapshot = styleSnapshots.get(id) || null;
    applyScaledSnapshotToShape(shape, snapshot, center, scaleX, scaleY, styleSnapshot);
  });

  return true;
}

function resizeRectangularShape(shape, point, startSnapshot) {
  const center = state.pointer.startCenter || {
    x: startSnapshot.x + startSnapshot.width / 2,
    y: startSnapshot.y + startSnapshot.height / 2,
  };
  const rotation = state.pointer.startRotation || 0;
  const localPoint = toLocalPoint(point, center, rotation);
  const halfWidth = Math.max(8, Math.abs(localPoint.x));
  const halfHeight = Math.max(8, Math.abs(localPoint.y));

  let width = halfWidth * 2;
  let height = halfHeight * 2;

  if (shape.type === "square") {
    const size = Math.max(width, height);
    width = size;
    height = size;
  } else if (shape.type === "circle") {
    const diameter = Math.max(width, height);
    width = diameter;
    height = diameter;
  }

  shape.live.width = width;
  shape.live.height = height;
  shape.live.x = center.x - width / 2;
  shape.live.y = center.y - height / 2;
  shape.live.rotation = rotation;
}

function resizeTextShape(shape, point, startSnapshot) {
  if (!shape || shape.type !== "text") return;
  const center = state.pointer.startCenter || {
    x: (startSnapshot.x ?? 0) + (startSnapshot.width ?? 0) / 2,
    y: (startSnapshot.y ?? 0) + (startSnapshot.height ?? 0) / 2,
  };
  const rotation = state.pointer.startRotation || 0;
  const localPoint = toLocalPoint(point, center, rotation);
  const halfWidth = Math.max(8, Math.abs(localPoint.x));
  const width = Math.max(halfWidth * 2, TEXT_PADDING * 2);
  const startWidth = Math.max(8, startSnapshot.width || shape.live.width || width);
  const scale = clampScale(width / startWidth);
  const startFont = state.pointer.startStyle?.fontSize ?? shape.style.fontSize ?? state.style.fontSize;
  const newFont = Math.max(6, Math.round(startFont * scale));
  shape.style.fontSize = newFont;
  state.style.fontSize = newFont;
  shape.live.rotation = rotation;
  shape.style.rotation = radiansToDegrees(rotation);
  updateTextMetrics(shape, { centerOverride: center });
}

function resizeFreeformShape(shape, point, startSnapshot) {
  if (!startSnapshot.points) return;
  const bounds = state.pointer.startBounds || getBoundsFromPoints(startSnapshot.points);
  const center = state.pointer.startCenter || getCenterFromBounds(bounds);
  const startVector = state.pointer.startHandleVector || {
    x: Math.max(1, bounds.width / 2),
    y: Math.max(1, bounds.height / 2),
  };

  const currentVector = {
    x: Math.max(1, Math.abs(point.x - center.x)),
    y: Math.max(1, Math.abs(point.y - center.y)),
  };

  const scaleX = clampScale(currentVector.x / startVector.x);
  const scaleY = clampScale(currentVector.y / startVector.y);

  shape.live.points = startSnapshot.points.map((pt) => ({
    x: center.x + (pt.x - center.x) * scaleX,
    y: center.y + (pt.y - center.y) * scaleY,
  }));
}

function applyScaledSnapshotToShape(shape, snapshot, center, scaleX, scaleY, styleSnapshot) {
  if (!shape || !snapshot) return;
  switch (shape.type) {
    case "line":
    case "arrow": {
      if (!snapshot.start || !snapshot.end) return;
      shape.live.start = {
        x: center.x + (snapshot.start.x - center.x) * scaleX,
        y: center.y + (snapshot.start.y - center.y) * scaleY,
      };
      shape.live.end = {
        x: center.x + (snapshot.end.x - center.x) * scaleX,
        y: center.y + (snapshot.end.y - center.y) * scaleY,
      };
      if (shape.type === "line") {
        if (snapshot.control) {
          shape.live.control = {
            x: center.x + (snapshot.control.x - center.x) * scaleX,
            y: center.y + (snapshot.control.y - center.y) * scaleY,
          };
        } else {
          delete shape.live.control;
        }
      }
      return;
    }
    case "free": {
      if (!Array.isArray(snapshot.points)) return;
      shape.live.points = snapshot.points.map((pt) => ({
        x: center.x + (pt.x - center.x) * scaleX,
        y: center.y + (pt.y - center.y) * scaleY,
      }));
      return;
    }
    case "text": {
      const width = Math.max(1, snapshot.width ?? shape.live.width ?? 0);
      const height = Math.max(1, snapshot.height ?? shape.live.height ?? 0);
      const snapshotCenter = {
        x: (snapshot.x ?? shape.live.x ?? 0) + width / 2,
        y: (snapshot.y ?? shape.live.y ?? 0) + height / 2,
      };
      const nextCenter = {
        x: center.x + (snapshotCenter.x - center.x) * scaleX,
        y: center.y + (snapshotCenter.y - center.y) * scaleY,
      };
      const baseStyle = styleSnapshot || shape.style || {};
      const baseFontSize = Math.max(6, Number(baseStyle.fontSize) || state.style.fontSize || 32);
      const uniformScale = Math.min(scaleX, scaleY);
      const nextFontSize = Math.max(6, Math.round(baseFontSize * uniformScale));
      shape.style.fontSize = nextFontSize;
      const baseRotation = snapshot.rotation ?? shape.live.rotation ?? 0;
      shape.live.rotation = baseRotation;
      shape.style.rotation = radiansToDegrees(baseRotation);
      updateTextMetrics(shape, { centerOverride: nextCenter });
      return;
    }
    default: {
      const width = Math.max(1, snapshot.width ?? shape.live.width ?? 0);
      const height = Math.max(1, snapshot.height ?? shape.live.height ?? 0);
      const snapshotCenter = {
        x: (snapshot.x ?? shape.live.x ?? 0) + width / 2,
        y: (snapshot.y ?? shape.live.y ?? 0) + height / 2,
      };
      const nextCenter = {
        x: center.x + (snapshotCenter.x - center.x) * scaleX,
        y: center.y + (snapshotCenter.y - center.y) * scaleY,
      };
      let nextWidth = Math.max(8, width * scaleX);
      let nextHeight = Math.max(8, height * scaleY);
      if (shape.type === "square" || shape.type === "circle") {
        const uniform = Math.max(nextWidth, nextHeight);
        nextWidth = uniform;
        nextHeight = uniform;
      }
      const baseRotation = snapshot.rotation ?? shape.live.rotation ?? 0;
      shape.live.rotation = baseRotation;
      if (shape.style) {
        shape.style.rotation = radiansToDegrees(baseRotation);
      }
      shape.live.width = nextWidth;
      shape.live.height = nextHeight;
      shape.live.x = nextCenter.x - nextWidth / 2;
      shape.live.y = nextCenter.y - nextHeight / 2;
    }
  }
}

function resizeLineEndpoint(shape, point, mode) {
  if (!shape) return;
  markHistoryChanged();
  if (mode === "resizing-line-start") {
    shape.live.start = { x: point.x, y: point.y };
  } else {
    shape.live.end = { x: point.x, y: point.y };
  }
  if (shape.type === "line") {
    const snapshot = state.pointer.startSnapshot;
    if (snapshot && snapshot.control && snapshot.start && snapshot.end) {
      const preservedOffset = getLineBendOffset(snapshot.start, snapshot.end, snapshot.control);
      const clamped = clampLineBendOffset(shape.live.start, shape.live.end, preservedOffset);
      if (Math.abs(clamped) < 1.2) {
        delete shape.live.control;
      } else {
        shape.live.control = getLineControlFromOffset(shape.live.start, shape.live.end, clamped);
      }
    } else if (shape.live.control) {
      const offset = getLineBendOffset(shape.live.start, shape.live.end, shape.live.control);
      const clamped = clampLineBendOffset(shape.live.start, shape.live.end, offset);
      if (Math.abs(clamped) < 1.2) {
        delete shape.live.control;
      } else {
        shape.live.control = getLineControlFromOffset(shape.live.start, shape.live.end, clamped);
      }
    }
  }
}

function bendLineShape(shape, point) {
  if (!shape || shape.type !== "line") return;
  const { start, end } = shape.live || {};
  if (!start || !end) return;
  markHistoryChanged();
  const offset = getLineBendOffsetFromPoint(start, end, point);
  const clamped = clampLineBendOffset(start, end, offset);
  if (Math.abs(clamped) < 1.2) {
    delete shape.live.control;
  } else {
    shape.live.control = getLineControlFromOffset(start, end, clamped);
  }
}

function rotateShape(shape, point) {
  if (!shape) return;
  const snapshot = state.pointer.startSnapshot;
  if (!snapshot) return;
  markHistoryChanged();
  const center = state.pointer.startCenter || getShapeCenter(shape);
  const baseRotation = state.pointer.startRotation || 0;
  const startAngle = state.pointer.rotationStartAngle;
  const currentAngle = Math.atan2(point.y - center.y, point.x - center.x);
  const delta = currentAngle - startAngle;

  if (shape.type === "rectangle" || shape.type === "diamond" || shape.type === "square" || shape.type === "circle" || shape.type === "text" || shape.type === "image") {
    shape.live.rotation = normalizeAngle(baseRotation + delta);
    shape.live.width = snapshot.width;
    shape.live.height = snapshot.height;
    shape.live.x = center.x - snapshot.width / 2;
    shape.live.y = center.y - snapshot.height / 2;
    shape.style.rotation = radiansToDegrees(shape.live.rotation);
  } else if (shape.type === "line" || shape.type === "arrow") {
    shape.live.start = rotatePoint(snapshot.start, center, delta);
    shape.live.end = rotatePoint(snapshot.end, center, delta);
    if (shape.type === "line") {
      if (snapshot.control) {
        shape.live.control = rotatePoint(snapshot.control, center, delta);
      } else {
        delete shape.live.control;
      }
    }
  } else if (shape.type === "free") {
    shape.live.points = snapshot.points.map((pt) => rotatePoint(pt, center, delta));
  }
}

function rotateGroupSelection(point) {
  if (!point) return false;
  const snapshots = state.pointer.multiSnapshot;
  if (!snapshots || snapshots.size === 0) return false;
  const center = state.pointer.startCenter;
  if (!center) return false;
  const startAngle = state.pointer.rotationStartAngle ?? 0;
  const currentAngle = Math.atan2(point.y - center.y, point.x - center.x);
  if (!Number.isFinite(currentAngle)) return false;
  const delta = currentAngle - startAngle;

  markHistoryChanged();
  snapshots.forEach((snapshot, id) => {
    const shape = getShapeById(id);
    if (!shape) return;
    applyRotationSnapshotToShape(shape, snapshot, center, delta);
  });

  return true;
}

function applyRotationSnapshotToShape(shape, snapshot, center, delta) {
  if (!shape || !snapshot) return;
  switch (shape.type) {
    case "line":
    case "arrow": {
      if (!snapshot.start || !snapshot.end) return;
      shape.live.start = rotatePoint(snapshot.start, center, delta);
      shape.live.end = rotatePoint(snapshot.end, center, delta);
      if (shape.type === "line") {
        if (snapshot.control) {
          shape.live.control = rotatePoint(snapshot.control, center, delta);
        } else {
          delete shape.live.control;
        }
      }
      return;
    }
    case "free": {
      if (!Array.isArray(snapshot.points)) return;
      shape.live.points = snapshot.points.map((pt) => rotatePoint(pt, center, delta));
      return;
    }
    case "text": {
      const width = Math.max(1, snapshot.width ?? shape.live.width ?? 0);
      const height = Math.max(1, snapshot.height ?? shape.live.height ?? 0);
      const snapshotCenter = {
        x: (snapshot.x ?? shape.live.x ?? 0) + width / 2,
        y: (snapshot.y ?? shape.live.y ?? 0) + height / 2,
      };
      const nextCenter = rotatePoint(snapshotCenter, center, delta);
      updateTextMetrics(shape, { centerOverride: nextCenter });
      const baseRotation = snapshot.rotation ?? shape.live.rotation ?? 0;
      shape.live.rotation = normalizeAngle(baseRotation + delta);
      shape.style.rotation = radiansToDegrees(shape.live.rotation);
      return;
    }
    default: {
      const width = Math.max(1, snapshot.width ?? shape.live.width ?? 0);
      const height = Math.max(1, snapshot.height ?? shape.live.height ?? 0);
      const snapshotCenter = {
        x: (snapshot.x ?? shape.live.x ?? 0) + width / 2,
        y: (snapshot.y ?? shape.live.y ?? 0) + height / 2,
      };
      const nextCenter = rotatePoint(snapshotCenter, center, delta);
      const baseRotation = snapshot.rotation ?? shape.live.rotation ?? 0;
      const nextRotation = normalizeAngle(baseRotation + delta);
      shape.live.rotation = nextRotation;
      if (shape.style) {
        shape.style.rotation = radiansToDegrees(nextRotation);
      }
      shape.live.width = width;
      shape.live.height = height;
      shape.live.x = nextCenter.x - width / 2;
      shape.live.y = nextCenter.y - height / 2;
    }
  }
}

function detectLineEndpointHandle(shape, point) {
  if (shape.type !== "line" && shape.type !== "arrow") return null;
  const radius = Math.max(12, (shape.style?.strokeWidth || 1) + 6);
  if (distance(point, shape.live.start) <= radius) return "start";
  if (distance(point, shape.live.end) <= radius) return "end";
  return null;
}

function detectLineBendHandle(shape, point) {
  if (!shape || shape.type !== "line") return null;
  const position = getLineBendHandlePosition(shape);
  if (!position) return null;
  const radius = Math.max(14, (shape.style?.strokeWidth || 1) + 8);
  if (distance(point, position) > radius) return null;
  return {
    type: "line-bend",
    position,
    offset: getLineBendOffset(shape.live.start, shape.live.end, shape.live.control),
  };
}

function detectResizeHandle(shape, point) {
  const size = 12;
  if (shape.type === "rectangle" || shape.type === "diamond" || shape.type === "square" || shape.type === "circle" || shape.type === "image" || shape.type === "text") {
    const center = getShapeCenter(shape);
    const rotation = shape.live.rotation || 0;
    const localVector = { x: shape.live.width / 2, y: shape.live.height / 2 };
    const offset = rotateVector(localVector, rotation);
    const handle = { x: center.x + offset.x, y: center.y + offset.y };
    if (Math.abs(point.x - handle.x) <= size && Math.abs(point.y - handle.y) <= size) {
      return {
        type: "corner",
        position: handle,
        center,
        bounds: { x: shape.live.x, y: shape.live.y, width: shape.live.width, height: shape.live.height },
        localVector,
      };
    }
    return null;
  }

  if (shape.type === "free") {
    const bounds = getShapeBounds(shape);
    const handle = { x: bounds.x + bounds.width, y: bounds.y + bounds.height };
    if (Math.abs(point.x - handle.x) <= size && Math.abs(point.y - handle.y) <= size) {
      return {
        type: "corner",
        position: handle,
        center: getCenterFromBounds(bounds),
        bounds,
        localVector: { x: Math.max(1, bounds.width / 2), y: Math.max(1, bounds.height / 2) },
      };
    }
    return null;
  }

  return null;
}

function detectRotateHandle(shape, point) {
  const handle = getRotationHandlePosition(shape);
  if (!handle) return null;
  const radius = 14;
  if (distance(point, handle.position) > radius) return null;
  return {
    type: "rotate",
    position: handle.position,
    anchor: handle.anchor,
    center: handle.center,
    pointerAngle: Math.atan2(point.y - handle.center.y, point.x - handle.center.x),
    bounds: handle.bounds,
  };
}

function getRectResizeHandlePosition(shape) {
  const center = getShapeCenter(shape);
  const rotation = shape.live.rotation || 0;
  const localVector = { x: shape.live.width / 2, y: shape.live.height / 2 };
  const offset = rotateVector(localVector, rotation);
  return { x: center.x + offset.x, y: center.y + offset.y };
}

function getRotationHandlePosition(shape) {
  if (!shape) return null;
  const center = getShapeCenter(shape);
  if (!center) return null;
  const offset = 5;

  if (shape.type === "rectangle" || shape.type === "diamond" || shape.type === "square" || shape.type === "circle" || shape.type === "text" || shape.type === "image") {
    const bounds = { x: shape.live.x, y: shape.live.y, width: shape.live.width, height: shape.live.height };
    const anchor = { x: center.x, y: bounds.y };
    const position = { x: anchor.x, y: anchor.y - offset };
    return {
      position,
      anchor,
      center,
      bounds,
    };
  }

  if (shape.type === "line" || shape.type === "arrow") {
    const bounds = getShapeBounds(shape);
    const anchor = { x: center.x, y: bounds.y };
    const position = { x: anchor.x, y: anchor.y - offset };
    return {
      position,
      anchor,
      center,
      bounds,
    };
  }

  if (shape.type === "free") {
    const bounds = getShapeBounds(shape);
    const anchor = { x: bounds.x + bounds.width / 2, y: bounds.y };
    const position = { x: anchor.x, y: anchor.y - offset };
    return {
      position,
      anchor,
      center,
      bounds,
    };
  }

  return null;
}

function updateTempShape(point) {
  const shape = state.pointer.tempShape;
  if (!shape) return;
  markHistoryChanged();
  switch (shape.type) {
    case "rectangle":
    case "diamond":
    case "square": {
      const dx = point.x - state.pointer.start.x;
      const dy = point.y - state.pointer.start.y;
      if (shape.type === "square") {
        const size = Math.max(16, Math.max(Math.abs(dx), Math.abs(dy)));
        shape.live.width = size;
        shape.live.height = size;
        shape.live.x = dx >= 0 ? state.pointer.start.x : state.pointer.start.x - size;
        shape.live.y = dy >= 0 ? state.pointer.start.y : state.pointer.start.y - size;
      } else {
        const width = Math.max(16, Math.abs(dx));
        const height = Math.max(16, Math.abs(dy));
        shape.live.width = width;
        shape.live.height = height;
        shape.live.x = dx >= 0 ? state.pointer.start.x : state.pointer.start.x - width;
        shape.live.y = dy >= 0 ? state.pointer.start.y : state.pointer.start.y - height;
      }
      break;
    }
    case "circle": {
      const dx = point.x - state.pointer.start.x;
      const dy = point.y - state.pointer.start.y;
      const radius = Math.max(16, Math.sqrt(dx * dx + dy * dy));
      shape.live.width = radius * 2;
      shape.live.height = radius * 2;
      shape.live.x = state.pointer.start.x - radius;
      shape.live.y = state.pointer.start.y - radius;
      break;
    }
    case "line":
    case "arrow": {
      shape.live.start = { ...state.pointer.start };
      shape.live.end = { ...point };
      break;
    }
    default:
      break;
  }
}

function finalizeTempShape(point) {
  const shape = state.pointer.tempShape;
  if (!shape) return;
  if (shape.type === "free") {
    if (shape.live.points.length < 2) {
      removeShape(shape);
      return;
    }
  } else if (shape.type === "line" || shape.type === "arrow") {
    shape.live.end = { ...point };
    if (distance(shape.live.start, shape.live.end) < 6) {
      removeShape(shape);
      return;
    }
  } else {
    if (shape.type === "circle") {
      const moved = distance(state.pointer.start, point);
      if (moved < 6) {
        removeShape(shape);
        return;
      }
    }
    if (shape.live.width < 8 || shape.live.height < 8) {
      removeShape(shape);
      return;
    }
  }

  markHistoryChanged();
  ensureBaseKeyframe(shape, state.timeline.current);
  writeKeyframe(shape, state.timeline.current, { markSelected: false });
  updateSelection(shape);
  if (state.tool !== "select") {
    setTool("select");
  }
}

function removeShape(shape) {
  const index = state.shapes.findIndex((s) => s.id === shape.id);
  if (state.activeTextEditor && state.activeTextEditor.shapeId === shape.id) {
    destroyActiveTextEditorElement();
  }
  if (index >= 0) state.shapes.splice(index, 1);
  if (state.selection && state.selection.id === shape.id) {
    updateSelection(null);
  }
}

function commitShapeChange(shape) {
  if (!shape) return;
  writeKeyframe(shape, state.timeline.current, { markSelected: false });
}

function createShape(type, start, end) {
  const isConnector = type === "line" || type === "arrow";
  const baseStyle = {
    fill: state.style.fill,
    stroke: state.style.stroke,
    strokeWidth: state.style.strokeWidth,
    strokeStyle: normalizeStrokeStyle(state.style.strokeStyle || DEFAULT_STROKE_STYLE),
    sketchLevel: isConnector ? 0 : state.style.sketchLevel || 0,
    arrowStart: Boolean(state.style.arrowStart),
    arrowEnd: state.style.arrowEnd !== undefined ? Boolean(state.style.arrowEnd) : true,
    opacity: state.style.opacity ?? 1,
    fontFamily: state.style.fontFamily || DEFAULT_TEXT_FONT,
    fontSize: Number(state.style.fontSize) || 32,
    rotation: state.style.rotation || 0,
  };

  if (!isConnector) {
    baseStyle.fillStyle = normalizeFillStyle(state.style.fillStyle || DEFAULT_FILL_STYLE);
    baseStyle.edgeStyle = normalizeEdgeStyle(state.style.edgeStyle || DEFAULT_EDGE_STYLE);
  }

  const shape = {
    id: shapeIdCounter++,
    type,
    style: { ...baseStyle },
    live: {},
    keyframes: [],
    birthTime: state.timeline.current,
    isVisible: true,
  };

  ensureStyleHasFillStyle(shape.style, type);

  switch (type) {
    case "rectangle":
    case "diamond":
    case "square": {
      shape.live = {
        x: start.x,
        y: start.y,
        width: 1,
        height: 1,
        rotation: 0,
      };
      break;
    }
    case "circle": {
      shape.live = {
        x: start.x - 16,
        y: start.y - 16,
        width: 32,
        height: 32,
        rotation: 0,
      };
      break;
    }
    case "line":
    case "arrow": {
      shape.live = {
        start: { ...start },
        end: { ...start },
      };
      break;
    }
    case "image": {
      shape.live = {
        x: start.x - 64,
        y: start.y - 64,
        width: 128,
        height: 128,
        rotation: 0,
      };
      shape.asset = { image: null, source: null };
      break;
    }
    case "free": {
      shape.live = {
        points: [
          {
            x: start.x,
            y: start.y,
          },
        ],
      };
      break;
    }
    case "text": {
      const fontSize = Math.max(6, Number(state.style.fontSize) || 32);
      const initialRotationDeg = state.style.rotation || 0;
      const initialRotationRad = degreesToRadians(initialRotationDeg);
  shape.style.fontFamily = state.style.fontFamily || DEFAULT_TEXT_FONT;
      shape.style.fontSize = fontSize;
      shape.style.stroke = "transparent";
      shape.style.strokeWidth = 0;
      shape.style.rotation = initialRotationDeg;
      shape.live = {
        x: start.x,
        y: start.y,
        width: fontSize * 4 + TEXT_PADDING,
        height: fontSize * 1.6 + TEXT_PADDING,
        rotation: initialRotationRad,
        text: "",
        ascent: 0,
        descent: 0,
        lineHeight: fontSize * 1.25,
      };
      break;
    }
    default:
      break;
  }

  return shape;
}

function hitTest(point) {
  for (let i = state.shapes.length - 1; i >= 0; i -= 1) {
    const shape = state.shapes[i];
    if (isPointInsideShape(shape, point)) {
      return shape;
    }
  }
  return null;
}

function isPointInsideShape(shape, point) {
  switch (shape.type) {
    case "rectangle":
    case "square":
    case "text":
    case "image": {
      const center = getShapeCenter(shape);
      const rotation = shape.live.rotation || 0;
      const local = toLocalPoint(point, center, rotation);
      return (
        Math.abs(local.x) <= shape.live.width / 2 && Math.abs(local.y) <= shape.live.height / 2
      );
    }
    case "diamond": {
      const center = getShapeCenter(shape);
      const rotation = shape.live.rotation || 0;
      const local = toLocalPoint(point, center, rotation);
      const halfWidth = Math.max(1, shape.live.width / 2);
      const halfHeight = Math.max(1, shape.live.height / 2);
      const normalized = Math.abs(local.x) / halfWidth + Math.abs(local.y) / halfHeight;
      return normalized <= 1;
    }
    case "circle": {
      const radius = shape.live.width / 2;
      const center = {
        x: shape.live.x + shape.live.width / 2,
        y: shape.live.y + shape.live.height / 2,
      };
      return distance(point, center) <= radius;
    }
    case "line":
    case "arrow": {
      const { start, end, control } = shape.live || {};
      if (!start || !end) return false;
      const closeness = shape.type === "line" && control
        ? distanceToQuadratic(point, start, control, end)
        : distanceToSegment(point, start, end);
      return closeness <= Math.max(10, shape.style.strokeWidth + 4);
    }
    case "free": {
      for (let i = 0; i < shape.live.points.length - 1; i += 1) {
        const closeness = distanceToSegment(point, shape.live.points[i], shape.live.points[i + 1]);
        if (closeness <= Math.max(10, shape.style.strokeWidth + 4)) return true;
      }
      return false;
    }
    default:
      return false;
  }
}

function setSelectedShapes(shapes, { primaryId } = {}) {
  const requested = Array.isArray(shapes) ? shapes.filter(Boolean) : [];
  const expandedMap = new Map();

  requested.forEach((shape) => {
    if (!shape) return;
    const memberIds = getGroupMemberIds(shape);
    memberIds.forEach((id) => {
      const member = getShapeById(id);
      if (member) {
        expandedMap.set(member.id, member);
      }
    });
  });

  const list = Array.from(expandedMap.values());
  const ids = new Set(list.map((shape) => shape.id));

  if (state.activeTextEditor && !ids.has(state.activeTextEditor.shapeId)) {
    finalizeActiveTextEditor();
  }

  state.selectedIds.clear();
  list.forEach((shape) => {
    state.selectedIds.add(shape.id);
  });

  if (state.selectedIds.size === 0) {
    state.selection = null;
    state.timeline.selectedKeyframeTime = null;
    state.timeline.selectedKeyframeShapeId = null;
  } else if (primaryId && state.selectedIds.has(primaryId)) {
    state.selection = list.find((shape) => shape.id === primaryId) || null;
  } else {
    state.selection = list[list.length - 1] || null;
  }

  if (state.selection && state.selectedIds.size === 1) {
    const selectedTime = state.timeline.selectedKeyframeTime;
    if (typeof selectedTime === "number") {
      const match = state.selection.keyframes.some((keyframe) => Math.abs(keyframe.time - selectedTime) < KEYFRAME_EPSILON);
      if (match) {
        state.timeline.selectedKeyframeShapeId = state.selection.id;
      } else {
        state.timeline.selectedKeyframeTime = null;
        state.timeline.selectedKeyframeShapeId = null;
      }
    } else {
      state.timeline.selectedKeyframeShapeId = null;
    }
  } else {
    state.timeline.selectedKeyframeTime = null;
    state.timeline.selectedKeyframeShapeId = null;
  }

  setActiveGroupId(resolveSelectedGroupId());
  refreshSelectionUI();
}

function selectAllShapes({ focusLast = true } = {}) {
  const shapes = Array.isArray(state.shapes) ? state.shapes.filter(Boolean) : [];
  if (shapes.length === 0) {
    setSelectedShapes([]);
    return false;
  }
  const primaryId = focusLast ? shapes[shapes.length - 1]?.id : shapes[0]?.id;
  if (primaryId) {
    setSelectedShapes(shapes, { primaryId });
  } else {
    setSelectedShapes(shapes);
  }
  return true;
}

function clearSelection() {
  if (!state.selectedIds || state.selectedIds.size === 0) {
    return false;
  }
  setSelectedShapes([]);
  return true;
}

function updateMarqueeOverlay(rect) {
  const overlay = elements.marqueeOverlay;
  if (!overlay) return;
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.width = "0px";
    overlay.style.height = "0px";
    return;
  }

  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");
  overlay.style.left = `${rect.x}px`;
  overlay.style.top = `${rect.y}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
}

function hideMarqueeOverlay() {
  updateMarqueeOverlay(null);
}

function updateMarqueeSelection(point, { finalize = false } = {}) {
  const marquee = state.pointer.marquee;
  if (!marquee) return;

  if (point) {
    marquee.current = { ...point };
  }

  marquee.rect = getMarqueeRect(marquee.start, marquee.current || marquee.start);
  updateMarqueeOverlay(marquee.rect);
  applyMarqueeSelection({ finalize });
}

function applyMarqueeSelection({ finalize = false } = {}) {
  const marquee = state.pointer.marquee;
  if (!marquee || !marquee.rect) return;

  const hits = getShapesContainedInRect(marquee.rect);
  const baseSelection = state.pointer.marqueeAppend ? getSelectedShapesList() : [];
  const preservedIds = new Set(baseSelection.map((shape) => shape.id));
  hits.forEach((shape) => preservedIds.add(shape.id));

  if (preservedIds.size === 0) {
    if (!state.pointer.marqueeAppend) {
      setSelectedShapes([]);
    }
    return;
  }

  const orderedShapes = state.shapes.filter((shape) => preservedIds.has(shape.id));
  if (orderedShapes.length === 0) {
    if (!state.pointer.marqueeAppend) {
      setSelectedShapes([]);
    }
    return;
  }

  let primaryId = null;
  if (state.selection && preservedIds.has(state.selection.id)) {
    primaryId = state.selection.id;
  } else if (finalize) {
    primaryId = orderedShapes[orderedShapes.length - 1]?.id ?? null;
  }

  if (primaryId) {
    setSelectedShapes(orderedShapes, { primaryId });
  } else {
    setSelectedShapes(orderedShapes);
  }
}

function finalizeMarqueeSelection() {
  if (!state.pointer.marquee) return;
  updateMarqueeSelection(state.pointer.current || state.pointer.start, { finalize: true });
}

function positionContextMenu(menu, clientX, clientY) {
  const padding = 8;
  menu.style.left = "0px";
  menu.style.top = "0px";
  const rect = menu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxLeft = Math.max(padding, viewportWidth - rect.width - padding);
  const maxTop = Math.max(padding, viewportHeight - rect.height - padding);
  const targetLeft = Math.min(Math.max(clientX, padding), maxLeft);
  const targetTop = Math.min(Math.max(clientY, padding), maxTop);
  menu.style.left = `${targetLeft}px`;
  menu.style.top = `${targetTop}px`;
}

function openShapeContextMenu(clientX, clientY) {
  const menu = elements.shapeContextMenu;
  if (!menu) return;

  closeStageContextMenu();
  menu.hidden = false;
  menu.setAttribute("aria-hidden", "false");
  if (!menu.hasAttribute("tabindex")) {
    menu.tabIndex = -1;
  }

  positionContextMenu(menu, clientX, clientY);

  const firstButton = menu.querySelector("button");
  if (firstButton instanceof HTMLElement) {
    firstButton.focus();
  } else {
    menu.focus();
  }
}

function openStageContextMenu(clientX, clientY) {
  const menu = elements.stageContextMenu;
  if (!menu) return;

  closeShapeContextMenu();
  menu.hidden = false;
  menu.setAttribute("aria-hidden", "false");
  if (!menu.hasAttribute("tabindex")) {
    menu.tabIndex = -1;
  }

  positionContextMenu(menu, clientX, clientY);

  if (elements.stageBackgroundColor) {
    const value = normalizeStageColor(state.stage.background) || getDefaultStageBackground();
    elements.stageBackgroundColor.value = value;
    elements.stageBackgroundColor.focus();
  } else {
    menu.focus();
  }
}

function closeShapeContextMenu() {
  const menu = elements.shapeContextMenu;
  if (!menu || menu.hidden) return false;
  if (menu.contains(document.activeElement)) {
    try {
      document.activeElement?.blur?.();
    } catch (error) {
      // Ignore focus errors
    }
  }
  menu.hidden = true;
  menu.setAttribute("aria-hidden", "true");
  menu.style.left = "-9999px";
  menu.style.top = "-9999px";
  return true;
}

function closeStageContextMenu() {
  const menu = elements.stageContextMenu;
  if (!menu || menu.hidden) return false;
  if (menu.contains(document.activeElement)) {
    try {
      document.activeElement?.blur?.();
    } catch (error) {
      // Ignore focus errors
    }
  }
  menu.hidden = true;
  menu.setAttribute("aria-hidden", "true");
  menu.style.left = "-9999px";
  menu.style.top = "-9999px";
  return true;
}

function closeAllContextMenus() {
  const closedStage = closeStageContextMenu();
  const closedShape = closeShapeContextMenu();
  return closedStage || closedShape;
}

function handleCanvasContextMenu(event) {
  event.preventDefault();
  event.stopPropagation();

  const point = getCanvasPoint(event);
  const shape = hitTest(point);
  const hasSelection = state.selectedIds.size > 0;

  if (shape) {
    if (!state.selectedIds.has(shape.id)) {
      updateSelection(shape);
    }
    openShapeContextMenu(event.clientX, event.clientY);
    return;
  }

  if (hasSelection) {
    openShapeContextMenu(event.clientX, event.clientY);
    return;
  }

  openStageContextMenu(event.clientX, event.clientY);
}

function handleGlobalPointerDownForContextMenu(event) {
  const target = event.target;
  let didClose = false;

  if (elements.shapeContextMenu && !elements.shapeContextMenu.hidden) {
    if (!(target instanceof Node && elements.shapeContextMenu.contains(target))) {
      didClose = closeShapeContextMenu() || didClose;
    }
  }

  if (elements.stageContextMenu && !elements.stageContextMenu.hidden) {
    if (!(target instanceof Node && elements.stageContextMenu.contains(target))) {
      didClose = closeStageContextMenu() || didClose;
    }
  }

  return didClose;
}

function applyZOrderAction(action) {
  if (!action) return false;
  if (!Array.isArray(state.shapes) || state.shapes.length === 0) return false;
  if (!state.selectedIds || state.selectedIds.size === 0) return false;

  const selectedIds = new Set(state.selectedIds);
  const historyEntry = createHistoryEntry("reorder-shapes");
  let didChange = false;

  switch (action) {
    case "bring-forward": {
      for (let index = state.shapes.length - 2; index >= 0; index -= 1) {
        const shape = state.shapes[index];
        if (!selectedIds.has(shape.id)) continue;
        const nextIndex = index + 1;
        const nextShape = state.shapes[nextIndex];
        if (!nextShape || selectedIds.has(nextShape.id)) continue;
        state.shapes[index] = nextShape;
        state.shapes[nextIndex] = shape;
        didChange = true;
      }
      break;
    }
    case "send-backward": {
      for (let index = 1; index < state.shapes.length; index += 1) {
        const shape = state.shapes[index];
        if (!selectedIds.has(shape.id)) continue;
        const previousIndex = index - 1;
        const previousShape = state.shapes[previousIndex];
        if (!previousShape || selectedIds.has(previousShape.id)) continue;
        state.shapes[index] = previousShape;
        state.shapes[previousIndex] = shape;
        didChange = true;
      }
      break;
    }
    case "bring-to-front": {
      const tail = state.shapes.slice(-selectedIds.size);
      const alreadyAtFront = tail.length === selectedIds.size && tail.every((shape) => selectedIds.has(shape.id));
      if (!alreadyAtFront) {
        const selected = state.shapes.filter((shape) => selectedIds.has(shape.id));
        const remainder = state.shapes.filter((shape) => !selectedIds.has(shape.id));
        state.shapes = [...remainder, ...selected];
        didChange = true;
      }
      break;
    }
    case "send-to-back": {
      const head = state.shapes.slice(0, selectedIds.size);
      const alreadyAtBack = head.length === selectedIds.size && head.every((shape) => selectedIds.has(shape.id));
      if (!alreadyAtBack) {
        const selected = state.shapes.filter((shape) => selectedIds.has(shape.id));
        const remainder = state.shapes.filter((shape) => !selectedIds.has(shape.id));
        state.shapes = [...selected, ...remainder];
        didChange = true;
      }
      break;
    }
    default:
      return false;
  }

  if (didChange) {
    commitHistoryEntry(historyEntry);
    refreshSelectionUI();
  }

  return didChange;
}

function handleContextMenuActionClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.getAttribute("data-z-action");
  if (!action) return;
  event.preventDefault();
  event.stopPropagation();
  applyZOrderAction(action);
  closeShapeContextMenu();
}

function updateSelection(target) {
  if (Array.isArray(target)) {
    setSelectedShapes(target);
    return;
  }

  if (state.activeTextEditor) {
    if (!target || state.activeTextEditor.shapeId !== target.id) {
      finalizeActiveTextEditor();
    }
  }

  if (!target) {
    setSelectedShapes([]);
    return;
  }

  setSelectedShapes([target]);
}

function refreshSelectionUI() {
  const selectionSize = state.selectedIds.size;

  if (elements.deleteShape) {
    elements.deleteShape.disabled = selectionSize === 0;
  }
  if (elements.addKeyframe) {
    elements.addKeyframe.disabled = selectionSize === 0;
  }
  if (elements.deleteKeyframe) {
    const hasKeyframeAtCurrentTime = selectionSize > 0 && getSelectedShapesList().some(shape => 
      shape.keyframes && shape.keyframes.some(kf => Math.abs(kf.time - state.timeline.current) < 0.001)
    );
    elements.deleteKeyframe.disabled = !hasKeyframeAtCurrentTime;
  }

  if (elements.groupShapes) {
    const selectionIds = Array.from(state.selectedIds);
    const sharedGroupId = getSharedGroupId(selectionIds);
    const groupSize = sharedGroupId ? state.groups[sharedGroupId]?.size ?? 0 : 0;
    const canGroup = selectionSize >= 2 && (!sharedGroupId || groupSize !== selectionSize);
    elements.groupShapes.disabled = !canGroup;
  }
  if (elements.ungroupShapes) {
    const activeSelectionGroupId = resolveSelectedGroupId();
    setActiveGroupId(activeSelectionGroupId);
    const groupSize = state.activeGroupId ? state.groups[state.activeGroupId]?.size ?? 0 : 0;
    elements.ungroupShapes.disabled = !activeSelectionGroupId || groupSize < 2;
  }

  if (selectionSize === 0 || !state.selection) {
    if (elements.selectionLabel) {
      elements.selectionLabel.textContent = "No shape selected";
    }
  } else if (selectionSize === 1) {
    if (elements.selectionLabel) {
      elements.selectionLabel.textContent = `${capitalize(state.selection.type)} selected (#${state.selection.id})`;
    }
  } else {
    if (elements.selectionLabel) {
      elements.selectionLabel.textContent = `${selectionSize} shapes selected`;
    }
  }

  renderKeyframeList();
  syncSelectionInputs();
  syncArrowEndingUI();
}

function getSelectedShapesList() {
  if (!state.selectedIds || state.selectedIds.size === 0) return [];
  return state.shapes.filter((shape) => state.selectedIds.has(shape.id));
}

function getShapeById(id) {
  if (!Number.isFinite(Number(id))) return null;
  const numericId = Number(id);
  return state.shapes.find((shape) => shape.id === numericId) || null;
}

function getGroupMemberIds(shapeOrId) {
  const shape = typeof shapeOrId === "object" && shapeOrId !== null ? shapeOrId : getShapeById(shapeOrId);
  if (!shape) return new Set();
  const groupId = shape.groupId;
  if (!groupId) {
    return new Set([shape.id]);
  }
  const group = state.groups[groupId];
  if (!group || group.size < 2) {
    return new Set([shape.id]);
  }
  const memberIds = new Set(group);
  memberIds.add(shape.id);
  return new Set(Array.from(memberIds));
}

function getSharedGroupId(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return null;
  let shared = null;
  for (const id of ids) {
    const shape = getShapeById(id);
    if (!shape || !shape.groupId) {
      return null;
    }
    if (!state.groups[shape.groupId] || state.groups[shape.groupId].size < 2) {
      return null;
    }
    if (shared === null) {
      shared = shape.groupId;
    } else if (shared !== shape.groupId) {
      return null;
    }
  }
  return shared;
}

function resolveSelectedGroupId() {
  if (!state.selectedIds || state.selectedIds.size === 0) return null;
  const ids = Array.from(state.selectedIds);
  const shared = getSharedGroupId(ids);
  if (!shared) return null;
  const group = state.groups[shared];
  if (!group) return null;
  const groupIds = Array.from(group);
  const matches = groupIds.length === ids.length && groupIds.every((id) => state.selectedIds.has(id));
  return matches ? shared : null;
}

function getGroupNumericSuffix(groupId) {
  if (typeof groupId !== "string") return NaN;
  const match = groupId.match(/(\d+)$/);
  if (!match) return NaN;
  return Number(match[1]);
}

function removeShapeFromGroup(shape, groupId) {
  if (!shape || !groupId) return;
  const group = state.groups[groupId];
  if (group) {
    group.delete(shape.id);
    if (group.size < 2) {
      group.forEach((memberId) => {
        const member = getShapeById(memberId);
        if (member && member.groupId === groupId) {
          delete member.groupId;
        }
      });
      delete state.groups[groupId];
      if (state.activeGroupId === groupId) {
        setActiveGroupId(null);
      } else {
        syncActiveGroupState();
      }
    }
  }
  if (shape.groupId === groupId) {
    delete shape.groupId;
  }
  if (state.activeGroupId === groupId) {
    syncActiveGroupState();
  }
}

function removeShapeFromCurrentGroup(shape) {
  if (!shape || !shape.groupId) return;
  removeShapeFromGroup(shape, shape.groupId);
}

function groupSelectedShapes() {
  if (!state.selectedIds || state.selectedIds.size < 2) {
    return false;
  }

  const ids = Array.from(state.selectedIds);
  const sharedGroupId = getSharedGroupId(ids);
  if (sharedGroupId && state.groups[sharedGroupId] && state.groups[sharedGroupId].size === ids.length) {
    return false;
  }

  const groupId = `group-${groupIdCounter++}`;
  const memberSet = new Set();

  ids.forEach((id) => {
    const shape = getShapeById(id);
    if (!shape) return;
    removeShapeFromCurrentGroup(shape);
    shape.groupId = groupId;
    memberSet.add(shape.id);
  });

  if (memberSet.size < 2) {
    memberSet.forEach((id) => {
      const shape = getShapeById(id);
      if (shape) {
        delete shape.groupId;
      }
    });
    return false;
  }

  state.groups[groupId] = memberSet;
  setActiveGroupId(groupId);

  const shapes = Array.from(memberSet)
    .map((memberId) => getShapeById(memberId))
    .filter(Boolean);
  if (shapes.length === 0) {
    return false;
  }

  setSelectedShapes(shapes, { primaryId: shapes[shapes.length - 1]?.id });
  return true;
}

function ungroupSelectedShapes() {
  const groupId = resolveSelectedGroupId();
  if (!groupId) {
    return false;
  }

  const members = state.groups[groupId];
  if (!members || members.size < 2) {
    return false;
  }

  const shapes = Array.from(members)
    .map((id) => getShapeById(id))
    .filter(Boolean);
  if (shapes.length === 0) {
    delete state.groups[groupId];
    if (state.activeGroupId === groupId) {
      setActiveGroupId(null);
    } else {
      syncActiveGroupState();
    }
    return false;
  }

  shapes.forEach((shape) => {
    if (shape && shape.groupId === groupId) {
      delete shape.groupId;
    }
  });

  delete state.groups[groupId];
  if (state.activeGroupId === groupId) {
    setActiveGroupId(null);
  } else {
    syncActiveGroupState();
  }
  pruneEmptyGroups();
  setSelectedShapes(shapes, { primaryId: shapes[shapes.length - 1]?.id });
  return true;
}

function pruneEmptyGroups() {
  const entries = Object.entries(state.groups || {});
  entries.forEach(([groupId, members]) => {
    const validMembers = Array.from(members).filter((id) => {
      const shape = getShapeById(id);
      return shape && shape.groupId === groupId;
    });

    if (validMembers.length < 2) {
      validMembers.forEach((id) => {
        const member = getShapeById(id);
        if (member && member.groupId === groupId) {
          delete member.groupId;
        }
      });
      delete state.groups[groupId];
      if (state.activeGroupId === groupId) {
        setActiveGroupId(null);
      } else {
        syncActiveGroupState();
      }
      return;
    }

    if (validMembers.length !== members.size) {
      state.groups[groupId] = new Set(validMembers);
      if (state.activeGroupId === groupId) {
        syncActiveGroupState();
      }
    }
  });
}

function rebuildGroupStateFromShapes() {
  const nextGroups = {};
  let maxNumericId = 0;
  state.shapes.forEach((shape) => {
    if (!shape || !shape.groupId) return;
    if (!nextGroups[shape.groupId]) {
      nextGroups[shape.groupId] = new Set();
    }
    nextGroups[shape.groupId].add(shape.id);
  });

  Object.entries(nextGroups).forEach(([groupId, members]) => {
    const validMembers = Array.from(members).filter((id) => {
      const member = getShapeById(id);
      return member && member.groupId === groupId;
    });

    if (validMembers.length < 2) {
      validMembers.forEach((id) => {
        const member = getShapeById(id);
        if (member && member.groupId === groupId) {
          delete member.groupId;
        }
      });
      delete nextGroups[groupId];
      return;
    }

    nextGroups[groupId] = new Set(validMembers);
    const numericId = getGroupNumericSuffix(groupId);
    if (Number.isFinite(numericId)) {
      maxNumericId = Math.max(maxNumericId, numericId);
    }
  });

  state.groups = nextGroups;
  setActiveGroupId(null);
  if (Number.isFinite(maxNumericId) && maxNumericId > 0) {
    groupIdCounter = Math.max(groupIdCounter, maxNumericId + 1);
  }
}

function deleteSelectedShapes() {
  if (!state.selectedIds || state.selectedIds.size === 0) return false;
  const ids = new Set(state.selectedIds);
  if (ids.size === 0) return false;

  pushHistorySnapshot("delete-shapes");

  if (state.activeTextEditor && ids.has(state.activeTextEditor.shapeId)) {
    destroyActiveTextEditorElement();
  }

  state.shapes
    .filter((shape) => ids.has(shape.id))
    .forEach((shape) => {
      if (shape?.groupId) {
        removeShapeFromGroup(shape, shape.groupId);
      }
    });

  state.shapes = state.shapes.filter((shape) => !ids.has(shape.id));
  state.selectedIds.clear();
  state.selection = null;
  pruneEmptyGroups();
  setActiveGroupId(null);
  state.timeline.selectedKeyframeTime = null;
  state.timeline.selectedKeyframeShapeId = null;
  resetPointerInteraction();
  state.pointer.down = false;
  refreshSelectionUI();
  return true;
}

function isTextInputActive() {
  const activeElement = document.activeElement;
  if (!activeElement) return false;

  if (typeof activeElement.isContentEditable === "boolean" && activeElement.isContentEditable) {
    return true;
  }

  if (activeElement instanceof HTMLTextAreaElement) {
    return !activeElement.readOnly && !activeElement.disabled;
  }

  if (activeElement instanceof HTMLInputElement) {
    if (activeElement.readOnly || activeElement.disabled) {
      return false;
    }
    const type = (activeElement.getAttribute("type") || "text").toLowerCase();
    const textLikeTypes = new Set(["text", "search", "email", "url", "tel", "password", "number"]);
    return textLikeTypes.has(type);
  }

  return false;
}

function ensureClipboardState() {
  if (!state.clipboard) {
    state.clipboard = { items: [], offset: { x: 32, y: 32 } };
  }
  if (!state.clipboard.offset) {
    state.clipboard.offset = { x: 32, y: 32 };
  }
  if (!Array.isArray(state.clipboard.items)) {
    state.clipboard.items = [];
  }
  return state.clipboard;
}

function resetClipboardOffset() {
  ensureClipboardState();
  state.clipboard.offset = { x: 32, y: 32 };
}

function nextClipboardOffset() {
  const clipboard = ensureClipboardState();
  const next = { x: clipboard.offset.x, y: clipboard.offset.y };
  clipboard.offset.x = Math.min(160, clipboard.offset.x + 16);
  clipboard.offset.y = Math.min(160, clipboard.offset.y + 16);
  if (clipboard.offset.x >= 160) clipboard.offset.x = 32;
  if (clipboard.offset.y >= 160) clipboard.offset.y = 32;
  return next;
}

function duplicateShapeForClipboard(shape, delta) {
  const clone = cloneShape(shape);
  clone.id = shapeIdCounter++;
  clone.birthTime = state.timeline.current;
  clone.isVisible = true;
  if (clone.groupId) {
    delete clone.groupId;
  }
  if (clone.type === "line" || clone.type === "arrow") {
    clone.live.start.x += delta.x;
    clone.live.start.y += delta.y;
    clone.live.end.x += delta.x;
    clone.live.end.y += delta.y;
  } else if (clone.type === "free") {
    clone.live.points = clone.live.points.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y }));
  } else {
    clone.live.x += delta.x;
    clone.live.y += delta.y;
  }
  if (clone.asset && clone.asset.source) {
    clone.asset.image = null;
    rehydrateShapeAsset(clone);
  }
  return clone;
}

function copySelectionToClipboard() {
  const selected = getSelectedShapesList();
  if (selected.length === 0) return false;
  ensureClipboardState();
  state.clipboard.items = selected.map((shape) => cloneShape(shape));
  resetClipboardOffset();
  return true;
}

function pasteClipboardItems() {
  const clipboard = ensureClipboardState();
  if (!clipboard.items || clipboard.items.length === 0) {
    return false;
  }
  pushHistorySnapshot("paste-from-clipboard");
  const delta = nextClipboardOffset();
  let last = null;
  clipboard.items.forEach((item) => {
    const clone = duplicateShapeForClipboard(item, delta);
    state.shapes.push(clone);
    ensureBaseKeyframe(clone, state.timeline.current);
    writeKeyframe(clone, state.timeline.current, { markSelected: false });
    last = clone;
  });
  if (last) {
    updateSelection(last);
  }
  return Boolean(last);
}

function createImageShapeFromSourceInternal(src, options = {}) {
  if (!src) return null;
  const {
    select = true,
    addHistory = true,
    liveRect = null,
    styleOverrides = null,
  } = options;

  if (addHistory) {
    pushHistorySnapshot("create-image");
  }
  closeAllContextMenus();

  const stageWidth = Number.isFinite(state?.stage?.width) ? state.stage.width : 0;
  const stageHeight = Number.isFinite(state?.stage?.height) ? state.stage.height : 0;
  const defaultLive = {
    x: stageWidth / 2 - 96,
    y: stageHeight / 2 - 96,
    width: 192,
    height: 192,
    rotation: 0,
  };

  const hasCustomRect = liveRect && typeof liveRect === "object";
  const resolvedRect = hasCustomRect
    ? {
        x: Number.isFinite(liveRect.x) ? liveRect.x : defaultLive.x,
        y: Number.isFinite(liveRect.y) ? liveRect.y : defaultLive.y,
        width: Math.max(2, Number.isFinite(liveRect.width) ? liveRect.width : defaultLive.width),
        height: Math.max(2, Number.isFinite(liveRect.height) ? liveRect.height : defaultLive.height),
        rotation: Number.isFinite(liveRect.rotation) ? liveRect.rotation : defaultLive.rotation,
      }
    : defaultLive;

  const now = state.timeline.current;
  const baseStyle = {
    fill: state.style.fill,
    fillStyle: normalizeFillStyle(state.style.fillStyle || DEFAULT_FILL_STYLE),
    stroke: state.style.stroke,
    strokeWidth: state.style.strokeWidth,
    sketchLevel: 0,
    opacity: state.style.opacity ?? 1,
    rotation: Number.isFinite(resolvedRect.rotation) ? resolvedRect.rotation : 0,
  };

  if (styleOverrides && typeof styleOverrides === "object") {
    if (styleOverrides.opacity !== undefined) {
      const numericOpacity = Number(styleOverrides.opacity);
      if (Number.isFinite(numericOpacity)) {
        baseStyle.opacity = clampToRange(numericOpacity, 0, 1);
      }
    }
  }

  const shape = {
    id: shapeIdCounter++,
    type: "image",
    style: baseStyle,
    live: {
      x: resolvedRect.x,
      y: resolvedRect.y,
      width: resolvedRect.width,
      height: resolvedRect.height,
      rotation: Number.isFinite(resolvedRect.rotation) ? resolvedRect.rotation : 0,
    },
    keyframes: [],
    birthTime: now,
    isVisible: true,
    asset: {
      source: src,
      image: new Image(),
    },
  };

  ensureStyleHasFillStyle(shape.style, shape.type);

  const shouldAutoSizeOnLoad = !hasCustomRect;

  shape.asset.image.addEventListener("load", () => {
    if (!shouldAutoSizeOnLoad) {
      applyTimelineState();
      return;
    }
    const img = shape.asset.image;
    const aspect = img && img.height !== 0 ? img.width / img.height : 1;
    const baseWidth = Math.min(stageWidth * 0.4, Math.max(96, img.width || 0));
    const width = baseWidth;
    const height = aspect !== 0 ? baseWidth / aspect : baseWidth;
    shape.live.width = width;
    shape.live.height = height;
    shape.live.x = stageWidth / 2 - width / 2;
    shape.live.y = stageHeight / 2 - height / 2;
    writeKeyframe(shape, state.timeline.current, { markSelected: false });
  });
  shape.asset.image.addEventListener("error", () => {
    // Leave the shape in place even if the image fails to load.
  });
  shape.asset.image.src = src;

  if (!shouldAutoSizeOnLoad) {
    confineShapeToStage(shape, stageWidth, stageHeight);
  }

  state.shapes.push(shape);
  ensureBaseKeyframe(shape, now);
  writeKeyframe(shape, now, { markSelected: false });
  if (select) {
    updateSelection(shape);
  } else {
    refreshSelectionUI();
  }
  return cloneShape(shape);
}

function pasteImageBlob(blob) {
  if (!blob) return false;
  try {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = reader.result;
      if (typeof result === "string" && result) {
        createImageShapeFromSourceInternal(result);
      }
    });
    reader.readAsDataURL(blob);
    return true;
  } catch (error) {
    return false;
  }
}

function pasteSvgContent(svgText) {
  if (typeof svgText !== "string") return false;
  const trimmed = svgText.trim();
  if (!trimmed) return false;
  const match = trimmed.match(/<svg[\s\S]*<\/svg>/i);
  if (!match) return false;
  const markup = match[0];

  const parser = new DOMParser();
  const doc = parser.parseFromString(markup, "image/svg+xml");
  const svgRoot = doc.documentElement;
  if (!svgRoot || svgRoot.nodeName.toLowerCase() !== "svg") {
    return false;
  }

  const sandbox = document.createElement("div");
  sandbox.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;";
  const measuringSvg = svgRoot.cloneNode(true);
  sandbox.appendChild(measuringSvg);
  document.body.appendChild(sandbox);

  const fragmentAttr = "data-animator-fragment-id";
  const candidateSelector = "path,rect,circle,ellipse,line,polyline,polygon,text,image,use";
  const skipAncestorSelector = "defs,clipPath,mask,pattern,marker,symbol";
  const fragmentRecords = [];

  const safeGetBBox = (node) => {
    try {
      if (typeof node.getBBox === "function") {
        return node.getBBox();
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  const computeNodeOpacity = (node) => {
    if (!(node instanceof Element)) {
      return 1;
    }
    let resolved = Number.NaN;
    try {
      const computed = window.getComputedStyle(node);
      if (computed && typeof computed.opacity === "string") {
        const numeric = parseFloat(computed.opacity);
        if (Number.isFinite(numeric)) {
          resolved = numeric;
        }
      }
    } catch (error) {
      // Ignore computed style lookup issues.
    }
    if (!Number.isFinite(resolved)) {
      const attrValue = typeof node.getAttribute === "function" ? node.getAttribute("opacity") : null;
      if (attrValue !== null && attrValue !== "") {
        const numeric = parseFloat(attrValue);
        if (Number.isFinite(numeric)) {
          resolved = numeric;
        }
      }
    }
    if (!Number.isFinite(resolved)) {
      resolved = 1;
    }
    return clampToRange(resolved, 0, 1);
  };

  const findFragmentRoot = (node) => {
    let current = node;
    while (current && current !== measuringSvg) {
      if (current instanceof SVGElement) {
        const tag = current.tagName.toLowerCase();
        if (tag === "g") {
          if (current.hasAttribute("transform") || current.hasAttribute("data-testid") || current.hasAttribute("data-id") || current.hasAttribute("data-shape")) {
            return current;
          }
        }
      }
      const parent = current.parentElement;
      if (!parent) {
        break;
      }
      if (parent === measuringSvg) {
        return current;
      }
      current = parent;
    }
    return current;
  };

  const rootMap = new Map();

  const svgOpacity = computeNodeOpacity(measuringSvg);

  const fallbackToImage = (styleOverrides = null) => {
    try {
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
      const options = {};
      const resolvedOverrides = styleOverrides && typeof styleOverrides === "object" ? styleOverrides : null;
      if (resolvedOverrides) {
        options.styleOverrides = resolvedOverrides;
      } else if (svgOpacity < 1) {
        options.styleOverrides = { opacity: svgOpacity };
      }
      const created = createImageShapeFromSourceInternal(dataUrl, options);
      return Boolean(created);
    } catch (error) {
      return false;
    }
  };

  const cleanup = () => {
    rootMap.forEach((record, node) => {
      if (node) {
        node.removeAttribute(fragmentAttr);
      }
    });
    if (sandbox.parentNode) {
      sandbox.parentNode.removeChild(sandbox);
    }
  };

  Array.from(measuringSvg.querySelectorAll(candidateSelector)).forEach((node) => {
    if (!(node instanceof SVGElement)) return;
    if (node.closest(skipAncestorSelector)) return;
    const style = window.getComputedStyle(node);
    if (style && (style.display === "none" || style.visibility === "hidden")) {
      return;
    }

    const root = findFragmentRoot(node);
    if (!(root instanceof SVGElement)) return;
    if (root.closest(skipAncestorSelector)) return;

    if (!rootMap.has(root)) {
      const bbox = safeGetBBox(root);
      if (!bbox) return;
      const width = Number.isFinite(bbox.width) ? bbox.width : 0;
      const height = Number.isFinite(bbox.height) ? bbox.height : 0;
      if (width === 0 && height === 0) return;
      const marker = `fragment-${Date.now()}-${rootMap.size}`;
      root.setAttribute(fragmentAttr, marker);
      rootMap.set(root, {
        node: root,
        marker,
        order: rootMap.size,
        bounds: {
          x: Number.isFinite(bbox.x) ? bbox.x : 0,
          y: Number.isFinite(bbox.y) ? bbox.y : 0,
          width: Math.max(width, 0),
          height: Math.max(height, 0),
        },
        opacity: computeNodeOpacity(root),
      });
    }
  });

  rootMap.forEach((record) => {
    fragmentRecords.push(record);
  });

  fragmentRecords.sort((a, b) => {
    const orderA = Number.isFinite(a.order) ? a.order : 0;
    const orderB = Number.isFinite(b.order) ? b.order : 0;
    return orderA - orderB;
  });

  try {
    if (fragmentRecords.length === 0) {
      return fallbackToImage();
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    fragmentRecords.forEach((info) => {
      const { x, y, width, height } = info.bounds;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return fallbackToImage();
    }

    const globalWidth = Math.max(1, maxX - minX);
    const globalHeight = Math.max(1, maxY - minY);
    const stageWidth = Number.isFinite(state?.stage?.width) ? state.stage.width : 0;
    const stageHeight = Number.isFinite(state?.stage?.height) ? state.stage.height : 0;
    const maxWidth = stageWidth > 0 ? stageWidth * 0.6 : globalWidth;
    const maxHeight = stageHeight > 0 ? stageHeight * 0.6 : globalHeight;
    const minTargetSize = 96;

    let scale = 1;
    if (globalWidth > 0 && maxWidth > 0) {
      scale = Math.min(scale, maxWidth / globalWidth);
    }
    if (globalHeight > 0 && maxHeight > 0) {
      scale = Math.min(scale, maxHeight / globalHeight);
    }
    if (!Number.isFinite(scale) || scale <= 0) {
      scale = 1;
    }

    if (globalWidth > 0 && globalWidth * scale < minTargetSize) {
      const enlarge = maxWidth > 0 ? Math.min(maxWidth / globalWidth, minTargetSize / globalWidth) : minTargetSize / globalWidth;
      if (enlarge > scale) {
        scale = enlarge;
      }
    }
    if (globalHeight > 0 && globalHeight * scale < minTargetSize) {
      const enlarge = maxHeight > 0 ? Math.min(maxHeight / globalHeight, minTargetSize / globalHeight) : minTargetSize / globalHeight;
      if (enlarge > scale) {
        scale = enlarge;
      }
    }

    if (!Number.isFinite(scale) || scale <= 0) {
      scale = 1;
    }

    const stageCenterX = stageWidth / 2;
    const stageCenterY = stageHeight / 2;
    const groupCenterX = minX + globalWidth / 2;
    const groupCenterY = minY + globalHeight / 2;
    const offsetX = stageCenterX - groupCenterX * scale;
    const offsetY = stageCenterY - groupCenterY * scale;

    const serializer = new XMLSerializer();
    const createdIds = [];

    pushHistorySnapshot("paste-svg");

    fragmentRecords.forEach((info) => {
      const singleSvg = measuringSvg.cloneNode(true);
      const survivors = Array.from(singleSvg.querySelectorAll(`[${fragmentAttr}]`));
      survivors.forEach((element) => {
        if (element.getAttribute(fragmentAttr) !== info.marker) {
          element.remove();
        }
      });

      const target = singleSvg.querySelector(`[${fragmentAttr}="${info.marker}"]`);
      Array.from(singleSvg.children).forEach((child) => {
        if (child.tagName && child.tagName.toLowerCase() === "defs") {
          return;
        }
        if (!child.contains(target) && child !== target) {
          child.remove();
        }
      });
      if (target) {
        target.removeAttribute(fragmentAttr);
      }

      const bounds = info.bounds;
      const rawWidth = Math.max(bounds.width, 1);
      const rawHeight = Math.max(bounds.height, 1);
      const viewBoxX = Number.isFinite(bounds.x) ? bounds.x : 0;
      const viewBoxY = Number.isFinite(bounds.y) ? bounds.y : 0;
      singleSvg.setAttribute("viewBox", `${viewBoxX} ${viewBoxY} ${rawWidth} ${rawHeight}`);
      singleSvg.setAttribute("width", `${rawWidth}`);
      singleSvg.setAttribute("height", `${rawHeight}`);
      singleSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      singleSvg.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
      singleSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");

      const markupFragment = serializer.serializeToString(singleSvg);
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markupFragment)}`;

      const scaledWidth = Math.max(bounds.width * scale, 2);
      const scaledHeight = Math.max(bounds.height * scale, 2);
      const liveRect = {
        x: offsetX + bounds.x * scale,
        y: offsetY + bounds.y * scale,
        width: scaledWidth,
        height: scaledHeight,
        rotation: 0,
      };

      const styleOverrides = Number.isFinite(info.opacity) ? { opacity: info.opacity } : null;
      const imageOptions = {
        select: false,
        addHistory: false,
        liveRect,
      };
      if (styleOverrides) {
        imageOptions.styleOverrides = styleOverrides;
      }

      const created = createImageShapeFromSourceInternal(dataUrl, imageOptions);

      if (created && Number.isFinite(created.id)) {
        createdIds.push(created.id);
      }
    });

    if (createdIds.length === 0) {
      return fallbackToImage();
    }

    const shapesToSelect = createdIds
      .map((id) => getShapeById(id))
      .filter(Boolean);
    if (shapesToSelect.length > 0) {
      setSelectedShapes(shapesToSelect, { primaryId: createdIds[createdIds.length - 1] });
    } else {
      refreshSelectionUI();
    }
    return true;
  } finally {
    cleanup();
  }
}

function tryPasteExcalidrawText(text) {
  if (typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed || !trimmed.startsWith("{")) return false;
  if (!trimmed.includes("\"excalidraw/clipboard\"")) return false;
  let payload = null;
  try {
    payload = JSON.parse(trimmed);
  } catch (error) {
    return false;
  }
  return pasteExcalidrawClipboardPayload(payload);
}

async function tryPasteMermaidText(text) {
  if (typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  // Detect common Mermaid diagram keywords
  const mermaidKeywords = [
    'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram',
    'erDiagram', 'journey', 'gantt', 'pie', 'gitGraph', 'mindmap', 'timeline'
  ];
  
  const firstLine = trimmed.split('\n')[0].toLowerCase();
  const isMermaid = mermaidKeywords.some(keyword => firstLine.includes(keyword.toLowerCase()));
  
  if (!isMermaid) return false;

  // Check if mermaid library is loaded
  if (typeof window.mermaid === 'undefined') {
    console.warn('Mermaid library not loaded');
    return false;
  }

  try {
    // Generate a unique ID for the diagram
    const diagramId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Render the Mermaid diagram to SVG
    const { svg } = await window.mermaid.render(diagramId, trimmed);
    
    if (!svg) return false;

    // Convert SVG to data URL and create as image shape (not fragmented SVG)
    const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
    
    // Convert to data URL using Promise-based approach
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(svgBlob);
    });
    
    createImageShapeFromSourceInternal(dataUrl);
    return true;
  } catch (error) {
    console.error('Failed to render Mermaid diagram:', error);
    return false;
  }
}

function pasteExcalidrawClipboardPayload(payload) {
  if (!payload || payload.type !== "excalidraw/clipboard") return false;
  const elements = Array.isArray(payload.elements)
    ? payload.elements.filter((element) => element && !element.isDeleted)
    : [];
  if (elements.length === 0) return false;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  elements.forEach((element) => {
    const x = Number.isFinite(element.x) ? element.x : 0;
    const y = Number.isFinite(element.y) ? element.y : 0;
    const width = Number.isFinite(element.width) ? element.width : 0;
    const height = Number.isFinite(element.height) ? element.height : 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return false;
  }

  const globalWidth = Math.max(1, maxX - minX);
  const globalHeight = Math.max(1, maxY - minY);
  const stageWidth = Number.isFinite(state?.stage?.width) ? state.stage.width : 0;
  const stageHeight = Number.isFinite(state?.stage?.height) ? state.stage.height : 0;
  const maxWidth = stageWidth > 0 ? stageWidth * 0.6 : globalWidth;
  const maxHeight = stageHeight > 0 ? stageHeight * 0.6 : globalHeight;
  const minTargetSize = 96;

  let scale = 1;
  if (globalWidth > 0 && maxWidth > 0) {
    scale = Math.min(scale, maxWidth / globalWidth);
  }
  if (globalHeight > 0 && maxHeight > 0) {
    scale = Math.min(scale, maxHeight / globalHeight);
  }
  if (!Number.isFinite(scale) || scale <= 0) {
    scale = 1;
  }

  if (globalWidth > 0 && globalWidth * scale < minTargetSize) {
    const enlarge = maxWidth > 0 ? Math.min(maxWidth / globalWidth, minTargetSize / globalWidth) : minTargetSize / globalWidth;
    if (enlarge > scale) {
      scale = enlarge;
    }
  }
  if (globalHeight > 0 && globalHeight * scale < minTargetSize) {
    const enlarge = maxHeight > 0 ? Math.min(maxHeight / globalHeight, minTargetSize / globalHeight) : minTargetSize / globalHeight;
    if (enlarge > scale) {
      scale = enlarge;
    }
  }

  if (!Number.isFinite(scale) || scale <= 0) {
    scale = 1;
  }

  const offsetX = stageWidth > 0 ? stageWidth / 2 - (globalWidth * scale) / 2 : 0;
  const offsetY = stageHeight > 0 ? stageHeight / 2 - (globalHeight * scale) / 2 : 0;

  const context = { scale, offsetX, offsetY, minX, minY, stageWidth, stageHeight };
  const plans = elements
    .map((element, index) => {
      const plan = createExcalidrawElementPlan(element, context);
      if (!plan) return null;
      return { ...plan, order: index };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);

  if (plans.length === 0) {
    return false;
  }

  pushHistorySnapshot("paste-excalidraw");
  const createdShapes = [];
  const now = state.timeline.current;

  plans.forEach((plan) => {
    if (plan.kind === "shape") {
      const shape = {
        id: shapeIdCounter++,
        type: plan.payload.type,
        style: { ...plan.payload.style },
        live: { ...plan.payload.live },
        keyframes: [],
        birthTime: now,
        isVisible: true,
      };
      if (plan.payload.text !== undefined) {
        shape.live.text = plan.payload.text;
      }
      ensureStyleHasFillStyle(shape.style, shape.type);
      state.shapes.push(shape);
      confineShapeToStage(shape, stageWidth, stageHeight);
      ensureBaseKeyframe(shape, now);
      if (shape.type === "text") {
        updateTextMetrics(shape, { preserveOrigin: true });
      }
      writeKeyframe(shape, now, { markSelected: false });
      createdShapes.push(shape);
    } else if (plan.kind === "image") {
      const created = createImageShapeFromSourceInternal(plan.payload.dataUrl, {
        select: false,
        addHistory: false,
        liveRect: plan.payload.liveRect,
      });
      if (created && Number.isFinite(created.id)) {
        const actual = getShapeById(created.id);
        if (actual) {
          confineShapeToStage(actual, stageWidth, stageHeight);
          writeKeyframe(actual, now, { markSelected: false });
          createdShapes.push(actual);
        }
      }
    }
  });

  if (createdShapes.length === 0) {
    refreshSelectionUI();
    return false;
  }

  setSelectedShapes(createdShapes, { primaryId: createdShapes[createdShapes.length - 1].id });
  return true;
}

function createExcalidrawElementPlan(element, context) {
  if (!element) return null;
  const x = Number.isFinite(element.x) ? element.x : 0;
  const y = Number.isFinite(element.y) ? element.y : 0;
  const width = Math.max(0, Number.isFinite(element.width) ? element.width : 0);
  const height = Math.max(0, Number.isFinite(element.height) ? element.height : 0);
  const scale = context.scale || 1;
  const baseX = context.offsetX + (x - context.minX) * scale;
  const baseY = context.offsetY + (y - context.minY) * scale;
  const scaledWidth = Math.max(width * scale, 2);
  const scaledHeight = Math.max(height * scale, 2);
  const rotationDegrees = radiansToDegrees(Number.isFinite(element.angle) ? element.angle : 0);
  const opacity = clampToRange((Number.isFinite(element.opacity) ? element.opacity : 100) / 100, 0, 1);
  const strokeWidth = Math.max((Number.isFinite(element.strokeWidth) ? element.strokeWidth : 1) * scale, 0.5);
  const strokeStyle = resolveStrokeStyle(element.strokeStyle);
  const fillColor = resolveExcalidrawColor(element.backgroundColor, state.style.fill);
  const strokeColor = resolveExcalidrawColor(element.strokeColor, state.style.stroke);
  const sketchLevel = resolveSketchLevel(element.roughness);
  const fillStyle = resolveExcalidrawFillStyle(element.fillStyle);

  switch (element.type) {
    case "rectangle": {
      return {
        kind: "shape",
        payload: {
          type: "rectangle",
          style: {
            fill: fillColor,
            fillStyle,
            stroke: strokeColor,
            strokeWidth,
            strokeStyle,
            opacity,
            rotation: rotationDegrees,
            edgeStyle: normalizeEdgeStyle(element.roundness ? "round" : "sharp"),
            sketchLevel,
          },
          live: {
            x: baseX,
            y: baseY,
            width: scaledWidth,
            height: scaledHeight,
            rotation: rotationDegrees,
          },
        },
      };
    }
    case "ellipse": {
      return {
        kind: "shape",
        payload: {
          type: "circle",
          style: {
            fill: fillColor,
            fillStyle,
            stroke: strokeColor,
            strokeWidth,
            strokeStyle,
            opacity,
            rotation: rotationDegrees,
            sketchLevel,
          },
          live: {
            x: baseX,
            y: baseY,
            width: scaledWidth,
            height: scaledHeight,
            rotation: rotationDegrees,
          },
        },
      };
    }
    case "text": {
      const fontSize = Math.max(6, (Number.isFinite(element.fontSize) ? element.fontSize : 20) * scale);
      return {
        kind: "shape",
        payload: {
          type: "text",
          style: {
            fill: strokeColor,
            fillStyle: "solid",
            stroke: "transparent",
            strokeWidth: 0,
            opacity,
            rotation: rotationDegrees,
            fontFamily: resolveExcalidrawFontFamily(element.fontFamily),
            fontSize,
            sketchLevel,
          },
          live: {
            x: baseX,
            y: baseY,
            width: scaledWidth,
            height: scaledHeight,
            rotation: rotationDegrees,
          },
          text: typeof element.text === "string" ? element.text : "",
        },
      };
    }
    case "diamond": {
      return {
        kind: "shape",
        payload: {
          type: "diamond",
          style: {
            fill: fillColor,
            fillStyle,
            stroke: strokeColor,
            strokeWidth,
            strokeStyle,
            opacity,
            rotation: rotationDegrees,
            sketchLevel,
          },
          live: {
            x: baseX,
            y: baseY,
            width: scaledWidth,
            height: scaledHeight,
            rotation: rotationDegrees,
          },
        },
      };
    }
    case "line":
    case "arrow": {
      const points = Array.isArray(element.points)
        ? element.points.filter((pair) => Array.isArray(pair) && pair.length >= 2)
        : [];
      if (points.length < 2) {
        return null;
      }

      const rotationRadians = degreesToRadians(rotationDegrees);
      const hasArrowStart = Boolean(element.startArrowhead && element.startArrowhead !== "none");
      const hasArrowEnd = Boolean(element.endArrowhead && element.endArrowhead !== "none");
      const targetType = element.type === "arrow" || hasArrowStart || hasArrowEnd ? "arrow" : "line";

      const center = {
        x: context.offsetX + ((x + width / 2) - context.minX) * scale,
        y: context.offsetY + ((y + height / 2) - context.minY) * scale,
      };

      const convertPoint = (pair) => {
        const rawX = x + (Number(pair[0]) || 0);
        const rawY = y + (Number(pair[1]) || 0);
        const stageX = context.offsetX + (rawX - context.minX) * scale;
        const stageY = context.offsetY + (rawY - context.minY) * scale;
        if (rotationDegrees === 0) {
          return { x: stageX, y: stageY };
        }
        const offset = {
          x: stageX - center.x,
          y: stageY - center.y,
        };
        const rotated = rotateVector(offset, rotationRadians);
        return {
          x: center.x + rotated.x,
          y: center.y + rotated.y,
        };
      };

      const startPoint = convertPoint(points[0]);
      const endPoint = convertPoint(points[points.length - 1]);

      if (!Number.isFinite(startPoint.x) || !Number.isFinite(startPoint.y) || !Number.isFinite(endPoint.x) || !Number.isFinite(endPoint.y)) {
        return null;
      }

      const connectorStyle = {
        stroke: strokeColor,
        fill: "transparent",
        fillStyle: "solid",
        strokeWidth,
        strokeStyle,
        opacity,
        sketchLevel,
        edgeStyle: normalizeEdgeStyle("sharp"),
        bend: 0,
      };

      if (targetType === "arrow") {
        connectorStyle.arrowStart = hasArrowStart;
        connectorStyle.arrowEnd = hasArrowEnd;
      }

      return {
        kind: "shape",
        payload: {
          type: targetType,
          style: connectorStyle,
          live: {
            start: startPoint,
            end: endPoint,
          },
        },
      };
    }
    case "freedraw": {
      const pairs = Array.isArray(element.points)
        ? element.points.filter((pair) => Array.isArray(pair) && pair.length >= 2)
        : [];
      if (pairs.length < 2) {
        return null;
      }

      const rotationRadians = degreesToRadians(rotationDegrees);
      const center = {
        x: context.offsetX + ((x + width / 2) - context.minX) * scale,
        y: context.offsetY + ((y + height / 2) - context.minY) * scale,
      };

      const convertPoint = (pair) => {
        const rawX = x + (Number(pair[0]) || 0);
        const rawY = y + (Number(pair[1]) || 0);
        const stageX = context.offsetX + (rawX - context.minX) * scale;
        const stageY = context.offsetY + (rawY - context.minY) * scale;
        if (rotationDegrees === 0) {
          return { x: stageX, y: stageY };
        }
        const offset = {
          x: stageX - center.x,
          y: stageY - center.y,
        };
        const rotated = rotateVector(offset, rotationRadians);
        return {
          x: center.x + rotated.x,
          y: center.y + rotated.y,
        };
      };

      const points = pairs.map(convertPoint).filter((point, index, list) => {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
          return false;
        }
        if (index === 0) return true;
        const prev = list[index - 1];
        return !(prev && point.x === prev.x && point.y === prev.y);
      });

      if (points.length < 2) {
        return null;
      }

      return {
        kind: "shape",
        payload: {
          type: "free",
          style: {
            stroke: strokeColor,
            fill: "transparent",
            fillStyle: "solid",
            strokeWidth,
            strokeStyle,
            opacity,
            sketchLevel,
          },
          live: {
            points,
          },
        },
      };
    }
    default:
      return null;
  }
}

function resolveExcalidrawColor(value, fallback) {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  return fallback;
}

function resolveExcalidrawFillStyle(value) {
  if (typeof value !== "string") {
    return DEFAULT_FILL_STYLE;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "hachure" || normalized === "hachured") {
    return "hachure";
  }
  if (normalized === "cross-hatch" || normalized === "crosshatch" || normalized === "cross") {
    return "cross-hatch";
  }
  if (normalized === "solid") {
    return "solid";
  }
  return DEFAULT_FILL_STYLE;
}

function resolveStrokeStyle(value) {
  if (value === "dashed") return "dashed";
  if (value === "dotted") return "dotted";
  return "solid";
}

function resolveSketchLevel(value) {
  if (!Number.isFinite(value)) return 0;
  return clampToRange(Math.round(value), 0, 2);
}

function resolveExcalidrawFontFamily(value) {
  switch (value) {
    case 1:
      return DEFAULT_TEXT_FONT;
    case 2:
      return "Inter";
    case 3:
      return "Cascadia";
    default:
      return state.style.fontFamily || DEFAULT_TEXT_FONT;
  }
}

function tryPasteGraphicsFromClipboard(clipboardData) {
  if (!clipboardData) return false;

  const acceptImageFile = (file) => {
    if (!file || typeof file.type !== "string") return false;
    if (!file.type.startsWith("image/")) return false;
    if (file.type === "image/svg+xml") {
      try {
        const reader = new FileReader();
        reader.addEventListener("load", () => {
          const result = reader.result;
          if (typeof result === "string" && result) {
            const handled = pasteSvgContent(result);
            if (!handled) {
              try {
                const fallbackBlob = new Blob([result], { type: "image/svg+xml" });
                pasteImageBlob(fallbackBlob);
              } catch (error) {
                // Ignore fallback serialization errors.
              }
            }
          }
        });
        reader.readAsText(file);
        return true;
      } catch (error) {
        return false;
      }
    }
    return pasteImageBlob(file);
  };

  const itemList = clipboardData.items ? Array.from(clipboardData.items) : [];
  for (const item of itemList) {
    if (!item) continue;
    if (item.kind === "file") {
      const file = typeof item.getAsFile === "function" ? item.getAsFile() : null;
      if (acceptImageFile(file)) {
        return true;
      }
    }
  }

  const fileList = clipboardData.files ? Array.from(clipboardData.files) : [];
  for (const file of fileList) {
    if (acceptImageFile(file)) {
      return true;
    }
  }

  if (typeof clipboardData.getData === "function") {
    const svgContent = clipboardData.getData("image/svg+xml");
    if (pasteSvgContent(svgContent)) {
      return true;
    }

    const html = clipboardData.getData("text/html");
    if (html && html.includes("<img")) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const inlineSvg = doc.querySelector("svg");
        if (inlineSvg && pasteSvgContent(inlineSvg.outerHTML)) {
          return true;
        }
        const img = doc.querySelector("img[src]");
        const src = img?.getAttribute("src");
        if (src && (src.startsWith("data:image") || src.startsWith("http://") || src.startsWith("https://"))) {
          createImageShapeFromSourceInternal(src);
          return true;
        }
      } catch (error) {
        // Ignore HTML parsing errors and continue.
      }
    } else if (html && html.includes("<svg")) {
      if (pasteSvgContent(html)) {
        return true;
      }
    }

    const text = clipboardData.getData("text/plain");
    if (tryPasteExcalidrawText(text)) {
      return true;
    }
    if (typeof text === "string") {
      const trimmed = text.trim();
      
      // Try Mermaid first (async but fire-and-forget for better UX)
      const mermaidKeywords = [
        'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram',
        'erDiagram', 'journey', 'gantt', 'pie', 'gitGraph', 'mindmap', 'timeline'
      ];
      const firstLine = trimmed.split('\n')[0].toLowerCase();
      if (mermaidKeywords.some(keyword => firstLine.includes(keyword.toLowerCase()))) {
        tryPasteMermaidText(text).catch(error => {
          console.error('Mermaid paste failed:', error);
        });
        return true;
      }
      
      if (trimmed.startsWith("data:image")) {
        createImageShapeFromSourceInternal(trimmed);
        return true;
      }
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        createImageShapeFromSourceInternal(trimmed);
        return true;
      }
      if (trimmed && pasteSvgContent(trimmed)) {
        return true;
      }
    }
  }

  return false;
}

function handleGlobalKeyDown(event) {
  updateModifierStateFromEvent(event);
  if (event.defaultPrevented) return;

  const isTextInput = isTextInputActive();
  const key = typeof event.key === "string" ? event.key.toLowerCase() : event.key;
  const hasCommandModifier = event.ctrlKey || event.metaKey;

  if (hasCommandModifier && !event.shiftKey && key === "z") {
    if (isTextInput) {
      return;
    }
    if (undoLastAction()) {
      event.preventDefault();
    }
    return;
  }

  if (hasCommandModifier && !event.shiftKey && key === "c") {
    if (isTextInput) {
      return;
    }
    if (copySelectionToClipboard()) {
      event.preventDefault();
    }
    return;
  }

  if (hasCommandModifier && !event.shiftKey && key === "v") {
    if (isTextInput) {
      return;
    }
    if (pasteClipboardItems()) {
      event.preventDefault();
    }
    return;
  }

  if (hasCommandModifier && key === "a") {
    if (isTextInput) {
      return;
    }
    if (selectAllShapes({ focusLast: !event.shiftKey })) {
      event.preventDefault();
    }
    return;
  }

  if (hasCommandModifier && key === "g") {
    if (isTextInput) {
      return;
    }
    const didAct = event.shiftKey ? ungroupSelectedShapes() : groupSelectedShapes();
    if (didAct) {
      event.preventDefault();
    }
    return;
  }

  if (event.key === "Escape") {
    if (closeAllContextMenus()) {
      event.preventDefault();
      return;
    }
    if (!isTextInput && clearSelection()) {
      event.preventDefault();
      return;
    }
  }

  if (event.key !== "Delete" && event.key !== "Backspace") return;

  if (isTextInput) {
    return;
  }

  if (state.selection && state.selectedIds.size === 1 && typeof state.timeline.selectedKeyframeTime === "number") {
    const selectedTime = state.timeline.selectedKeyframeTime;
    const hasMatch = state.selection.keyframes.some((keyframe) => Math.abs(keyframe.time - selectedTime) < KEYFRAME_EPSILON);
    if (hasMatch) {
      deleteKeyframe(state.selection, selectedTime);
      event.preventDefault();
      return;
    }
  }

  if (deleteSelectedShapes()) {
    event.preventDefault();
  }
}

function handleGlobalKeyUp(event) {
  updateModifierStateFromEvent(event);
}

function handleGlobalCopy(event) {
  if (event.defaultPrevented) return;
  if (isTextInputActive()) return;
  if (copySelectionToClipboard()) {
    event.preventDefault();
  }
}

function handleGlobalCut(event) {
  if (event.defaultPrevented) return;
  if (isTextInputActive()) return;
  if (copySelectionToClipboard()) {
    deleteSelectedShapes();
    event.preventDefault();
  }
}

function handleGlobalPaste(event) {
  if (event.defaultPrevented) return;
  if (isTextInputActive()) return;
  const clipboardData = event.clipboardData || window.clipboardData || null;
  if (clipboardData && tryPasteGraphicsFromClipboard(clipboardData)) {
    event.preventDefault();
    return;
  }
  if (pasteClipboardItems()) {
    event.preventDefault();
  }
}

function renderKeyframeList() {
  const container = elements.keyframeList;
  if (!container) return;

  container.innerHTML = "";

  const shapes = Array.isArray(state.shapes) ? state.shapes : [];
  if (shapes.length === 0) {
    renderTimelineTrackMarkers();
    syncKeyframeSelectionUI();
    return;
  }

  const selectedTime =
    typeof state.timeline.selectedKeyframeTime === "number"
      ? state.timeline.selectedKeyframeTime
      : null;
  const selectedShapeId =
    state.timeline.selectedKeyframeShapeId !== null &&
    state.timeline.selectedKeyframeShapeId !== undefined
      ? state.timeline.selectedKeyframeShapeId
      : null;

  const entries = shapes
    .map((shape) => {
      normalizeShapeKeyframes(shape);
      const keyframes = (Array.isArray(shape.keyframes) ? shape.keyframes : []).filter(
        (keyframe) => keyframe && typeof keyframe.time === "number",
      );
      if (keyframes.length === 0) {
        return null;
      }
      return {
        shape,
        keyframes: keyframes.slice().sort((a, b) => a.time - b.time),
      };
    })
    .filter(Boolean);

  if (entries.length === 0) {
    renderTimelineTrackMarkers();
    syncKeyframeSelectionUI();
    return;
  }

  entries.forEach(({ shape, keyframes }) => {
    keyframes.forEach((keyframe) => {
      const safeTime = clampTimelineTime(keyframe.time, 0);
      keyframe.time = safeTime;

      const chip = document.createElement("div");
      chip.className = "keyframe-chip";
      chip.setAttribute("role", "button");
      chip.setAttribute("tabindex", "0");
      chip.setAttribute("data-keyframe-time", safeTime.toString());
      chip.setAttribute("data-shape-id", String(shape.id));

      const isSelected =
        selectedTime !== null &&
        Math.abs(selectedTime - safeTime) < 1e-4 &&
        selectedShapeId === shape.id;
      chip.setAttribute("aria-selected", isSelected ? "true" : "false");
      chip.classList.toggle("selected", isSelected);
      chip.setAttribute(
        "title",
        `${capitalize(shape.type)} #${shape.id} at ${safeTime.toFixed(1)} seconds`,
      );

      const label = document.createElement("span");
      label.textContent = `#${shape.id} • ${safeTime.toFixed(1)}s`;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.setAttribute(
        "aria-label",
        `Delete keyframe at ${safeTime.toFixed(1)} seconds for shape #${shape.id}`,
      );
      remove.setAttribute("title", "Remove this keyframe");
      remove.textContent = "×";
      remove.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setSelectedKeyframeTime(safeTime, { shapeId: shape.id, selectShape: true });
        deleteKeyframe(shape, safeTime);
      });

      chip.addEventListener("click", () => {
        setSelectedKeyframeTime(safeTime, { shapeId: shape.id, selectShape: true });
        setTimelineTime(safeTime, { apply: true });
      });

      chip.addEventListener("focus", () => {
        setSelectedKeyframeTime(safeTime, { shapeId: shape.id, selectShape: true });
      });

      chip.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          const step = event.shiftKey ? 1 : 0.1;
          const direction = event.key === "ArrowLeft" ? -1 : 1;
          const candidate = safeTime + direction * step;
          const nextTime = clampTimelineTime(Number(candidate.toFixed(3)), safeTime);
          if (moveKeyframe(shape, safeTime, nextTime)) {
            setSelectedKeyframeTime(nextTime, {
              focus: true,
              shapeId: shape.id,
              selectShape: true,
            });
            setTimelineTime(nextTime, { apply: true });
          }
        } else if (event.key === "Home") {
          event.preventDefault();
          if (moveKeyframe(shape, safeTime, 0)) {
            setSelectedKeyframeTime(0, {
              focus: true,
              shapeId: shape.id,
              selectShape: true,
            });
            setTimelineTime(0, { apply: true });
          }
        } else if (event.key === "End") {
          event.preventDefault();
          const duration =
            Number.isFinite(state.timeline.duration) && state.timeline.duration > 0
              ? state.timeline.duration
              : safeTime;
          if (moveKeyframe(shape, safeTime, duration)) {
            setSelectedKeyframeTime(duration, {
              focus: true,
              shapeId: shape.id,
              selectShape: true,
            });
            setTimelineTime(duration, { apply: true });
          }
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setSelectedKeyframeTime(safeTime, { shapeId: shape.id, selectShape: true });
          setTimelineTime(safeTime, { apply: true });
        } else if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          setSelectedKeyframeTime(safeTime, { shapeId: shape.id, selectShape: true });
          deleteKeyframe(shape, safeTime);
        }
      });

      chip.append(label, remove);
      container.appendChild(chip);
    });
  });

  syncKeyframeSelectionUI();
  renderTimelineTrackMarkers();
}

function deleteKeyframe(shape, time) {
  if (!shape) return;
  const removedSelected =
    state.timeline.selectedKeyframeShapeId === shape.id &&
    typeof state.timeline.selectedKeyframeTime === "number" &&
    Math.abs(state.timeline.selectedKeyframeTime - time) < KEYFRAME_EPSILON;

  shape.keyframes = shape.keyframes.filter((keyframe) => Math.abs(keyframe.time - time) > KEYFRAME_EPSILON);
  normalizeShapeKeyframes(shape);

  if (removedSelected) {
    const sorted = shape.keyframes;
    const fallback =
      sorted.find((keyframe) => keyframe.time >= time - KEYFRAME_EPSILON) ||
      sorted[sorted.length - 1] ||
      null;
    if (fallback) {
      state.timeline.selectedKeyframeTime = fallback.time;
      state.timeline.selectedKeyframeShapeId = shape.id;
    } else {
      state.timeline.selectedKeyframeTime = null;
      state.timeline.selectedKeyframeShapeId = null;
    }
  }

  applyTimelineState();
  renderKeyframeList();
}

function moveKeyframe(shape, fromTime, toTime, { apply = true, render = true } = {}) {
  if (!shape || !Array.isArray(shape.keyframes)) return false;
  const source = shape.keyframes.find((keyframe) => Math.abs(keyframe.time - fromTime) < KEYFRAME_EPSILON);
  if (!source) return false;

  const target = clampTimelineTime(toTime, fromTime);
  if (!Number.isFinite(target) || Math.abs(source.time - target) < KEYFRAME_EPSILON) {
    return false;
  }

  source.time = target;
  normalizeShapeKeyframes(shape);

  if (
    (state.selection && state.selectedIds.size === 1 && state.selection.id === shape.id) ||
    state.timeline.selectedKeyframeShapeId === shape.id
  ) {
    state.timeline.selectedKeyframeTime = target;
    state.timeline.selectedKeyframeShapeId = shape.id;
  }

  if (apply) {
    applyTimelineState();
  }
  if (render) {
    renderKeyframeList();
  }
  return true;
}

function setSelectedKeyframeTime(time, { focus = false, shapeId = null, selectShape = false } = {}) {
  const desiredTime = clampTimelineTime(time, 0);
  const numericShapeId = Number(shapeId);
  let targetShape = Number.isFinite(numericShapeId) ? getShapeById(numericShapeId) : null;

  if (!targetShape && state.selection && state.selectedIds.size === 1) {
    targetShape = state.selection;
  } else if (!targetShape && Number.isFinite(state.timeline.selectedKeyframeShapeId)) {
    targetShape = getShapeById(state.timeline.selectedKeyframeShapeId);
  }

  if (selectShape && targetShape) {
    if (!state.selectedIds.has(targetShape.id) || state.selectedIds.size !== 1) {
      updateSelection(targetShape);
    }
    if (state.selection && state.selection.id === targetShape.id) {
      targetShape = state.selection;
    } else if (Number.isFinite(targetShape.id)) {
      targetShape = getShapeById(targetShape.id);
    }
  }

  if (!targetShape) {
    state.timeline.selectedKeyframeTime = null;
    state.timeline.selectedKeyframeShapeId = null;
    syncKeyframeSelectionUI({ focus: false });
    renderTimelineTrackMarkers();
    return;
  }

  normalizeShapeKeyframes(targetShape);
  const targetKeyframe = targetShape.keyframes.find(
    (keyframe) => Math.abs(keyframe.time - desiredTime) < KEYFRAME_EPSILON,
  );

  if (targetKeyframe) {
    state.timeline.selectedKeyframeTime = targetKeyframe.time;
    state.timeline.selectedKeyframeShapeId = targetShape.id;
  } else {
    state.timeline.selectedKeyframeTime = null;
    state.timeline.selectedKeyframeShapeId = null;
  }

  syncKeyframeSelectionUI({ focus });
  renderTimelineTrackMarkers();
}

function syncKeyframeSelectionUI({ focus = false } = {}) {
  if (!elements.keyframeList) return;
  const selectedTime = state.timeline.selectedKeyframeTime;
  const selectedShapeId = state.timeline.selectedKeyframeShapeId;
  const chips = elements.keyframeList.querySelectorAll(".keyframe-chip");
  let focusTarget = null;

  chips.forEach((chip) => {
    const chipTime = Number(chip.getAttribute("data-keyframe-time"));
    const chipShapeId = Number(chip.getAttribute("data-shape-id"));
    const isSelected =
      Number.isFinite(selectedShapeId) &&
      chipShapeId === selectedShapeId &&
      typeof selectedTime === "number" &&
      Math.abs(chipTime - selectedTime) < KEYFRAME_EPSILON;
    chip.classList.toggle("selected", isSelected);
    chip.setAttribute("aria-selected", String(isSelected));
    if (isSelected) {
      focusTarget = chip;
    }
  });

  if (focus && focusTarget) {
    requestAnimationFrame(() => {
      focusTarget.focus();
    });
  }
}

function renderTimelineTrackMarkers() {
  if (!elements.timelineTrack) return;
  elements.timelineTrack.querySelectorAll(".timeline-key").forEach((node) => node.remove());
  if (!Array.isArray(state.shapes) || state.shapes.length === 0 || state.timeline.duration <= 0) return;

  const duration = Number.isFinite(state.timeline.duration) && state.timeline.duration > 0 ? state.timeline.duration : 1;
  const selectedTime = typeof state.timeline.selectedKeyframeTime === "number" ? state.timeline.selectedKeyframeTime : null;
  const selectedShapeId = Number.isFinite(state.timeline.selectedKeyframeShapeId)
    ? state.timeline.selectedKeyframeShapeId
    : null;

  // Get selected shapes from canvas selection
  const selectedShapes = getSelectedShapesList();
  const hasCanvasSelection = selectedShapes.length > 0;

  // Filter shapes: if shapes are selected on canvas, only show their keyframes
  const shapesToShow = hasCanvasSelection 
    ? state.shapes.filter(shape => selectedShapes.some(selected => selected.id === shape.id))
    : state.shapes;

  shapesToShow.forEach((shape) => {
    if (!shape || !Array.isArray(shape.keyframes)) return;
    shape.keyframes.forEach((keyframe) => {
      if (!keyframe) return;
      const marker = document.createElement("div");
      marker.className = "timeline-key";
      const safeTime = clampTimelineTime(keyframe.time, shape.birthTime ?? 0);
      keyframe.time = safeTime;
      const ratio = Math.min(1, Math.max(0, duration > 0 ? safeTime / duration : 0));
      marker.style.left = `${ratio * 100}%`;
      marker.setAttribute("data-time", safeTime.toString());
      marker.setAttribute("data-shape-id", String(shape.id));
      marker.setAttribute("role", "button");
      marker.setAttribute("tabindex", "0");
      const titleBase = `Keyframe at ${safeTime.toFixed(1)} seconds`;
      const title = state.shapes.length > 1 ? `${titleBase} for shape #${shape.id}` : titleBase;
      marker.title = title;
      marker.setAttribute("aria-label", title);
      const isSelectedMarker =
        selectedShapeId === shape.id &&
        selectedTime !== null &&
        Math.abs(selectedTime - safeTime) < KEYFRAME_EPSILON;
      if (isSelectedMarker) {
        marker.classList.add("selected");
      }
      marker.setAttribute("aria-selected", String(isSelectedMarker));
      marker.addEventListener("click", (event) => {
        event.stopPropagation();
        setSelectedKeyframeTime(safeTime, { shapeId: shape.id, selectShape: true });
        setTimelineTime(safeTime, { apply: true });
      });
      marker.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setSelectedKeyframeTime(safeTime, { focus: false, shapeId: shape.id, selectShape: true });
          setTimelineTime(safeTime, { apply: true });
        } else if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          setSelectedKeyframeTime(safeTime, { shapeId: shape.id, selectShape: true });
          deleteKeyframe(shape, safeTime);
        }
      });
      
      // Make keyframe markers draggable
      marker.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return; // Only left click
        event.stopPropagation();
        event.preventDefault();
        
        const trackRect = elements.timelineTrack.getBoundingClientRect();
        const startX = event.clientX;
        const startTime = safeTime;
        
        marker.classList.add("dragging");
        marker.setPointerCapture(event.pointerId);
        
        const handlePointerMove = (moveEvent) => {
          const deltaX = moveEvent.clientX - startX;
          const trackWidth = trackRect.width;
          const deltaTime = (deltaX / trackWidth) * duration;
          const newTime = Math.max(0, Math.min(duration, startTime + deltaTime));
          
          // Update marker position visually
          const ratio = newTime / duration;
          marker.style.left = `${ratio * 100}%`;
          marker.setAttribute("data-time", newTime.toString());
        };
        
        const handlePointerUp = (upEvent) => {
          marker.classList.remove("dragging");
          marker.releasePointerCapture(upEvent.pointerId);
          
          const deltaX = upEvent.clientX - startX;
          const trackWidth = trackRect.width;
          const deltaTime = (deltaX / trackWidth) * duration;
          const newTime = Math.max(0, Math.min(duration, startTime + deltaTime));
          
          // Update the actual keyframe time in the shape data
          moveKeyframe(shape, startTime, newTime);
          
          marker.removeEventListener("pointermove", handlePointerMove);
          marker.removeEventListener("pointerup", handlePointerUp);
          marker.removeEventListener("pointercancel", handlePointerUp);
        };
        
        marker.addEventListener("pointermove", handlePointerMove);
        marker.addEventListener("pointerup", handlePointerUp);
        marker.addEventListener("pointercancel", handlePointerUp);
      });
      
      elements.timelineTrack.appendChild(marker);
    });
  });
}

function clampTimelineTime(value, fallback = 0) {
  const duration = Number.isFinite(state.timeline?.duration) ? state.timeline.duration : 0;
  const numeric = Number(value);
  const fallbackNumeric = Number(fallback);
  const candidate = Number.isFinite(numeric)
    ? numeric
    : Number.isFinite(fallbackNumeric)
    ? fallbackNumeric
    : 0;
  if (!Number.isFinite(duration) || duration <= 0) {
    return Math.max(0, candidate);
  }
  return Math.max(0, Math.min(duration, candidate));
}

function normalizeShapeKeyframes(shape) {
  if (!shape) return;
  const source = Array.isArray(shape.keyframes) ? shape.keyframes.filter(Boolean) : [];
  const normalized = [];

  source.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const safeTime = clampTimelineTime(Number(entry.time), shape.birthTime ?? 0);
    const existingIndex = normalized.findIndex((candidate) => Math.abs(candidate.time - safeTime) < KEYFRAME_EPSILON);
    if (existingIndex >= 0) {
      const existing = normalized[existingIndex];
      normalized[existingIndex] = {
        ...existing,
        ...entry,
        time: safeTime,
        snapshot: entry.snapshot || existing.snapshot || snapshotShape(shape),
      };
    } else {
      normalized.push({
        ...entry,
        time: safeTime,
        snapshot: entry.snapshot || snapshotShape(shape),
      });
    }
  });

  if (normalized.length === 0) {
    const baseTime = clampTimelineTime(shape.birthTime ?? 0, 0);
    normalized.push({
      time: baseTime,
      snapshot: snapshotShape(shape),
    });
  }

  normalized.sort((a, b) => a.time - b.time);
  shape.keyframes = normalized;
  updateShapeBirth(shape);
}

function ensureBaseKeyframe(shape, time = 0) {
  if (!shape) return;
  const clamped = clampTimelineTime(time, 0);
  const existing = shape.keyframes.find((keyframe) => Math.abs(keyframe.time - clamped) < KEYFRAME_EPSILON);
  if (!existing) {
    shape.keyframes.push({ time: clamped, snapshot: snapshotShape(shape) });
  } else if (!existing.snapshot) {
    existing.snapshot = snapshotShape(shape);
  }
  normalizeShapeKeyframes(shape);
}

function writeKeyframe(shape, time, { apply = true, render = true, markSelected = true } = {}) {
  if (!shape) return;
  const rounded = clampTimelineTime(time, state.timeline.current);
  const existing = shape.keyframes.find((keyframe) => Math.abs(keyframe.time - rounded) < KEYFRAME_EPSILON);
  if (existing) {
    existing.snapshot = snapshotShape(shape);
    existing.time = rounded;
  } else {
    shape.keyframes.push({ time: rounded, snapshot: snapshotShape(shape) });
  }
  normalizeShapeKeyframes(shape);
  if (state.selection && state.selectedIds.size === 1 && state.selection.id === shape.id) {
    if (markSelected) {
      state.timeline.selectedKeyframeTime = rounded;
    } else if (typeof state.timeline.selectedKeyframeTime === "number") {
      const hasMatch = shape.keyframes.some(
        (keyframe) => Math.abs(keyframe.time - state.timeline.selectedKeyframeTime) < KEYFRAME_EPSILON,
      );
      if (!hasMatch) {
        state.timeline.selectedKeyframeTime = null;
      }
    }
  }
  if (apply) {
    applyTimelineState();
  }
  if (render) {
    renderKeyframeList();
  }
}

function updateShapeBirth(shape) {
  if (!shape) return;
  if (shape.keyframes.length === 0) {
    shape.birthTime = Math.max(0, shape.birthTime ?? 0);
    return;
  }
  shape.birthTime = shape.keyframes.reduce((min, keyframe) => Math.min(min, keyframe.time), Infinity);
}

function snapshotShape(shape) {
  const data = {
    type: shape.type,
    style: { ...shape.style },
  };

  ensureStyleHasFillStyle(data.style, shape.type);

  if (shape.type === "line" || shape.type === "arrow") {
    data.live = {
      start: { ...shape.live.start },
      end: { ...shape.live.end },
    };
    if (shape.type === "line" && shape.live.control) {
      data.live.control = { ...shape.live.control };
    }
  } else if (shape.type === "free") {
    data.live = {
      points: shape.live.points.map((point) => ({ ...point })),
    };
  } else {
    data.live = { ...shape.live };
  }

  return data;
}

function cloneSnapshot(live) {
  if (!live) return null;
  return JSON.parse(JSON.stringify(live));
}

function applySnapshot(shape, snapshot) {
  shape.style = { ...snapshot.style };
  ensureStyleHasFillStyle(shape.style, shape.type);
  if (shape.type === "line" || shape.type === "arrow") {
    shape.live.start = { ...snapshot.live.start };
    shape.live.end = { ...snapshot.live.end };
    if (shape.type === "line") {
      if (snapshot.live.control) {
        shape.live.control = { ...snapshot.live.control };
      } else {
        delete shape.live.control;
      }
    }
  } else if (shape.type === "free") {
    shape.live.points = snapshot.live.points.map((point) => ({ ...point }));
  } else {
    shape.live = { ...snapshot.live };
  }
}

function applyTimelineState() {
  state.shapes.forEach((shape) => {
    if (shape.keyframes.length === 0) {
      shape.isVisible = true;
      return;
    }
    const snapshot = interpolateKeyframes(shape.keyframes, state.timeline.current);
    if (!snapshot) {
      shape.isVisible = false;
      return;
    }
    shape.isVisible = true;
    applySnapshot(shape, snapshot);
    if (shape.type === "text") {
      updateTextMetrics(shape, { preserveOrigin: true });
    }
  });
  syncSelectionInputs();
  syncArrowEndingUI();
}

function interpolateKeyframes(keyframes, time) {
  if (keyframes.length === 0) return null;
  const sorted = keyframes.slice().sort((a, b) => a.time - b.time);
  const firstTime = sorted[0].time;
  const lastTime = sorted[sorted.length - 1].time;
  if (time < firstTime - KEYFRAME_EPSILON) return null;
  if (time <= firstTime + KEYFRAME_EPSILON) return cloneSnapshot(sorted[0].snapshot);
  if (time >= lastTime - KEYFRAME_EPSILON) return cloneSnapshot(sorted[sorted.length - 1].snapshot);

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (time >= current.time - KEYFRAME_EPSILON && time <= next.time + KEYFRAME_EPSILON) {
      const span = next.time - current.time;
      const t = span === 0 ? 0 : (time - current.time) / span;
      return blendSnapshots(current.snapshot, next.snapshot, t);
    }
  }

  return cloneSnapshot(sorted[0].snapshot);
}

function blendSnapshots(a, b, t) {
  const interpolate = (from, to) => from + (to - from) * t;
  const choose = (from, to) => (t < 0.5 ? from : to);
  const resolveOpacity = (style) => {
    if (style && typeof style.opacity === "number") {
      return clampUnit(style.opacity);
    }
    if (typeof state.style.opacity === "number") {
      return clampUnit(state.style.opacity);
    }
    return 1;
  };
  const result = {
    type: a.type,
    style: {
      fill: choose(a.style.fill, b.style.fill),
      fillStyle: choose(normalizeFillStyle(a.style.fillStyle), normalizeFillStyle(b.style.fillStyle)),
      stroke: choose(a.style.stroke, b.style.stroke),
      strokeWidth: interpolate(a.style.strokeWidth, b.style.strokeWidth),
      opacity: clampUnit(interpolate(resolveOpacity(a.style), resolveOpacity(b.style))),
      strokeStyle: choose(
        normalizeStrokeStyle(a.style.strokeStyle ?? state.style.strokeStyle ?? DEFAULT_STROKE_STYLE),
        normalizeStrokeStyle(b.style.strokeStyle ?? state.style.strokeStyle ?? DEFAULT_STROKE_STYLE),
      ),
      sketchLevel: Math.round(choose(a.style.sketchLevel ?? 0, b.style.sketchLevel ?? 0)),
      arrowStart: choose(Boolean(a.style.arrowStart), Boolean(b.style.arrowStart)),
      arrowEnd: choose(Boolean(a.style.arrowEnd ?? true), Boolean(b.style.arrowEnd ?? true)),
      fontFamily: choose(
        a.style.fontFamily ?? state.style.fontFamily ?? DEFAULT_TEXT_FONT,
        b.style.fontFamily ?? state.style.fontFamily ?? DEFAULT_TEXT_FONT,
      ),
      fontSize: interpolate(Number(a.style.fontSize ?? state.style.fontSize ?? 32), Number(b.style.fontSize ?? state.style.fontSize ?? 32)),
      rotation: interpolate(a.style.rotation ?? 0, b.style.rotation ?? 0),
    },
  };

  if (a.type === "line" || a.type === "arrow") {
    const start = {
      x: interpolate(a.live.start.x, b.live.start.x),
      y: interpolate(a.live.start.y, b.live.start.y),
    };
    const end = {
      x: interpolate(a.live.end.x, b.live.end.x),
      y: interpolate(a.live.end.y, b.live.end.y),
    };
    result.live = { start, end };
    if (a.type === "line") {
      const offsetA = getLineBendOffset(a.live.start, a.live.end, a.live.control);
      const offsetB = getLineBendOffset(b.live.start, b.live.end, b.live.control);
      const blendedOffset = interpolate(offsetA, offsetB);
      const clamped = clampLineBendOffset(start, end, blendedOffset);
      if (Math.abs(clamped) >= 1.2) {
        result.live.control = getLineControlFromOffset(start, end, clamped);
      }
    }
  } else if (a.type === "free") {
    const length = Math.min(a.live.points.length, b.live.points.length);
    result.live = {
      points: new Array(length).fill(0).map((_, index) => ({
        x: interpolate(a.live.points[index].x, b.live.points[index].x),
        y: interpolate(a.live.points[index].y, b.live.points[index].y),
      })),
    };
  } else {
    const rotation = interpolate(a.live.rotation || a.style.rotation || 0, b.live.rotation || b.style.rotation || 0);
    result.live = {
      x: interpolate(a.live.x, b.live.x),
      y: interpolate(a.live.y, b.live.y),
      width: interpolate(a.live.width, b.live.width),
      height: interpolate(a.live.height, b.live.height),
      rotation,
    };
    if (a.type === "text") {
      result.live.text = t < 0.5 ? a.live.text : b.live.text;
    }
  }

  return result;
}

function togglePlayback() {
  state.timeline.isPlaying = !state.timeline.isPlaying;
  if (state.timeline.isPlaying) {
    elements.playToggle.textContent = "Pause";
    state.timeline.lastTick = null;
    state.timeline.direction = 1;
  } else {
    elements.playToggle.textContent = "Play";
    state.timeline.direction = 1;
  }
  elements.playToggle.setAttribute("aria-pressed", String(state.timeline.isPlaying));
}

function stopPlayback() {
  state.timeline.isPlaying = false;
  state.timeline.lastTick = null;
  state.timeline.direction = 1;
  elements.playToggle.textContent = "Play";
  elements.playToggle.setAttribute("aria-pressed", "false");
}

function advanceTimeline() {
  const now = performance.now();
  if (state.timeline.lastTick === null) {
    state.timeline.lastTick = now;
    return;
  }

  const delta = (now - state.timeline.lastTick) / 1000;
  state.timeline.lastTick = now;
  advanceTimelineBy(delta);
}

function advanceTimelineBy(deltaSeconds) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return state.timeline.current;
  }

  const duration = Math.max(0, state.timeline.duration);
  if (duration === 0) {
    setTimelineTime(0, { apply: true });
    return state.timeline.current;
  }

  const direction = state.timeline.direction || 1;
  let updated = state.timeline.current + deltaSeconds * direction;

  if (state.timeline.bounce) {
    if (updated >= duration) {
      updated = duration;
      state.timeline.direction = -1;
    } else if (updated <= 0) {
      updated = 0;
      state.timeline.direction = 1;
    }
  } else if (state.timeline.loop) {
    if (updated > duration) {
      updated = duration > 0 ? updated % duration : 0;
    } else if (updated < 0) {
      if (duration > 0) {
        updated = (duration + (updated % duration)) % duration;
      } else {
        updated = 0;
      }
    }
  } else if (updated >= duration) {
    updated = duration;
    setTimelineTime(updated, { apply: true });
    stopPlayback();
    return state.timeline.current;
  }

  setTimelineTime(updated, { apply: true });
  return state.timeline.current;
}

function setTimelineTime(time, { apply = false } = {}) {
  const clamped = Math.max(0, Math.min(state.timeline.duration, time));
  state.timeline.current = clamped;
  const ratio = state.timeline.duration === 0 ? 0 : clamped / state.timeline.duration;
  elements.timelineRange.value = Math.round(ratio * 1000);
  elements.currentTime.textContent = `${clamped.toFixed(1)}s`;
  if (elements.timelineMarker) {
    elements.timelineMarker.style.left = `${ratio * 100}%`;
  }
  if (apply) {
    applyTimelineState();
  }
  refreshSelectionUI();
}

function applyTimelineDuration(value) {
  const numeric = Number(value);
  const candidate = Number.isFinite(numeric) ? numeric : state.timeline.duration;
  const clamped = Math.max(1, Math.min(120, candidate));
  state.timeline.duration = clamped;
  if (elements.timelineDuration) {
    elements.timelineDuration.value = String(clamped);
  }
  setTimelineTime(Math.min(state.timeline.current, clamped), { apply: true });
  renderTimelineTrackMarkers();
}

function setControlGroupState(container, buttons, { disabled = false, hidden = false } = {}) {
  if (container) {
    container.classList.toggle("is-disabled", disabled && !hidden);
    container.classList.toggle("is-hidden", hidden);
    if (hidden) {
      container.setAttribute("aria-hidden", "true");
      container.setAttribute("hidden", "");
      container.removeAttribute("aria-disabled");
    } else {
      container.removeAttribute("hidden");
      container.removeAttribute("aria-hidden");
      if (disabled) {
        container.setAttribute("aria-disabled", "true");
      } else {
        container.removeAttribute("aria-disabled");
      }
    }
  }
  if (!Array.isArray(buttons)) {
    return;
  }
  buttons.forEach((button) => {
    if (!button) return;
    button.disabled = disabled || hidden;
    button.classList.toggle("disabled", (disabled || hidden) && !hidden);
    if (hidden) {
      button.setAttribute("tabindex", "-1");
    } else {
      button.removeAttribute("tabindex");
    }
    if (disabled && !hidden) {
      button.setAttribute("aria-disabled", "true");
    } else {
      button.removeAttribute("aria-disabled");
    }
  });
}

function syncSelectionInputs() {
  const useSelectionStyle = state.selection && state.selectedIds.size === 1;
  const styleSource = useSelectionStyle ? state.selection.style : state.style;
  const selectionType = useSelectionStyle ? state.selection.type : null;
  const selectionIsConnector = selectionType === "line" || selectionType === "arrow";
  const toolIsConnector = !useSelectionStyle && (state.tool === "line" || state.tool === "arrow");
  const activeToolType = state.tool;
  const activeType = selectionType || (activeToolType !== "select" ? activeToolType : null);
  const supportsSketchControl = !activeType || (!selectionIsConnector && !toolIsConnector);
  const supportsFillStyle = !activeType || ["rectangle", "square", "diamond", "circle"].includes(activeType);
  const supportsEdgeStyleTool = !activeType || ["rectangle", "square", "diamond"].includes(activeType);
  const selectionSupportsEdge = useSelectionStyle ? shapeSupportsEdgeStyle(state.selection) : true;
  const showEdgeStyle = supportsEdgeStyleTool && selectionSupportsEdge;

  setControlGroupState(elements.sketchControl, elements.sketchButtons, {
    hidden: !supportsSketchControl,
    disabled: !supportsSketchControl,
  });
  setControlGroupState(elements.fillStyleControl, elements.fillStyleButtons, {
    hidden: !supportsFillStyle,
    disabled: !supportsFillStyle,
  });
  setControlGroupState(elements.edgeStyleControl, elements.edgeStyleButtons, {
    hidden: !showEdgeStyle,
    disabled: !showEdgeStyle,
  });

  if (elements.fillColor && typeof styleSource.fill === "string") {
    elements.fillColor.value = styleSource.fill;
  }
  if (elements.strokeColor && typeof styleSource.stroke === "string") {
    elements.strokeColor.value = styleSource.stroke;
  }
  updateFillStyleButtonStates(styleSource.fillStyle ?? state.style.fillStyle ?? DEFAULT_FILL_STYLE);
  updateEdgeStyleButtonStates(styleSource.edgeStyle ?? state.style.edgeStyle ?? DEFAULT_EDGE_STYLE);
  updateStrokeStyleButtonStates(styleSource.strokeStyle ?? state.style.strokeStyle ?? DEFAULT_STROKE_STYLE);
  updateSketchButtonStates(Number(styleSource.sketchLevel ?? 0));

  const showFontControls = selectionType === "text" || (!useSelectionStyle && state.tool === "text");
  if (elements.fontFamilyControl) {
    elements.fontFamilyControl.classList.toggle("is-hidden", !showFontControls);
    if (!showFontControls) {
      elements.fontFamilyControl.setAttribute("hidden", "");
      elements.fontFamilyControl.setAttribute("aria-hidden", "true");
    } else {
      elements.fontFamilyControl.removeAttribute("hidden");
      elements.fontFamilyControl.removeAttribute("aria-hidden");
    }
  }
  if (elements.fontFamily) {
    elements.fontFamily.disabled = !showFontControls;
  }

  const strokeWidth = Number(styleSource.strokeWidth) || 0;
  const sliderMin = Number(elements.strokeWidth?.min) || 1;
  const sliderMax = Number(elements.strokeWidth?.max) || 12;
  const sliderValue = Math.max(sliderMin, Math.min(sliderMax, Math.round(strokeWidth)));
  if (elements.strokeWidth) {
    elements.strokeWidth.value = sliderValue;
  }
  const displayValue = strokeWidth % 1 === 0 ? `${strokeWidth}px` : `${strokeWidth.toFixed(1)}px`;
  if (elements.strokeWidthValue) {
    elements.strokeWidthValue.textContent = displayValue;
  }

  const opacityValue = typeof styleSource.opacity === "number" ? styleSource.opacity : state.style.opacity ?? 1;
  const clampedOpacity = Math.max(0, Math.min(1, opacityValue));
  const opacityPercent = Math.round(clampedOpacity * 100);
  if (elements.opacity) {
    elements.opacity.value = String(opacityPercent);
  }
  if (elements.opacityValue) {
    elements.opacityValue.textContent = `${opacityPercent}%`;
  }

  if (elements.fontFamily) {
    const fontValue = styleSource.fontFamily || state.style.fontFamily || DEFAULT_TEXT_FONT;
    const options = Array.from(elements.fontFamily.options || []);
    const hasOption = options.some((option) => option.value === fontValue);
    elements.fontFamily.value = hasOption ? fontValue : DEFAULT_TEXT_FONT;
  }
}

function updateSketchButtonStates(level) {
  if (!Array.isArray(elements.sketchButtons) || elements.sketchButtons.length === 0) {
    return;
  }
  elements.sketchButtons.forEach((button) => {
    const buttonLevel = Number(button.getAttribute("data-sketch-level")) || 0;
    const isActive = buttonLevel === level;
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.classList.toggle("selected", isActive);
  });
}

function updateFillStyleButtonStates(value) {
  if (!Array.isArray(elements.fillStyleButtons) || elements.fillStyleButtons.length === 0) {
    return;
  }
  const active = normalizeFillStyle(value ?? state.style.fillStyle ?? DEFAULT_FILL_STYLE);
  elements.fillStyleButtons.forEach((button) => {
    const buttonValue = normalizeFillStyle(button.getAttribute("data-fill-style") || DEFAULT_FILL_STYLE);
    const isActive = buttonValue === active;
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.classList.toggle("selected", isActive);
  });
}

function updateEdgeStyleButtonStates(value) {
  if (!Array.isArray(elements.edgeStyleButtons) || elements.edgeStyleButtons.length === 0) {
    return;
  }
  const active = normalizeEdgeStyle(value ?? state.style.edgeStyle ?? DEFAULT_EDGE_STYLE);
  elements.edgeStyleButtons.forEach((button) => {
    const buttonValue = normalizeEdgeStyle(button.getAttribute("data-edge-style") || DEFAULT_EDGE_STYLE);
    const isActive = buttonValue === active;
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.classList.toggle("selected", isActive);
  });
}

function updateStrokeStyleButtonStates(value) {
  if (!Array.isArray(elements.strokeStyleButtons) || elements.strokeStyleButtons.length === 0) {
    return;
  }
  const active = normalizeStrokeStyle(value ?? state.style.strokeStyle ?? DEFAULT_STROKE_STYLE);
  elements.strokeStyleButtons.forEach((button) => {
    const buttonValue = normalizeStrokeStyle(button.getAttribute("data-stroke-style") || DEFAULT_STROKE_STYLE);
    const isActive = buttonValue === active;
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.classList.toggle("selected", isActive);
  });
}

function applySketchLevel(level) {
  const clamped = Number.isFinite(level) ? Math.max(0, Math.min(5, Math.round(level))) : 0;
  state.style.sketchLevel = clamped;
  updateSketchButtonStates(clamped);
  if (state.selection && state.selection.type !== "line" && state.selection.type !== "arrow") {
    state.selection.style.sketchLevel = clamped;
    commitShapeChange(state.selection);
  }
}

function applyFillStyle(value) {
  const normalized = normalizeFillStyle(value, state.style.fillStyle ?? DEFAULT_FILL_STYLE);
  state.style.fillStyle = normalized;
  updateFillStyleButtonStates(normalized);
  const canApply =
    state.selection &&
    state.selectedIds.size === 1 &&
    state.selection.type !== "line" &&
    state.selection.type !== "arrow";
  if (canApply) {
    ensureStyleHasFillStyle(state.selection.style, state.selection.type);
    state.selection.style.fillStyle = normalized;
    commitShapeChange(state.selection);
  }
}

function shapeSupportsEdgeStyle(shape) {
  if (!shape) {
    return false;
  }
  return (
    shape.type === "rectangle" ||
    shape.type === "square" ||
    shape.type === "triangle" ||
    shape.type === "diamond"
  );
}

function applyEdgeStyle(value) {
  const normalized = normalizeEdgeStyle(value, state.style.edgeStyle ?? DEFAULT_EDGE_STYLE);
  state.style.edgeStyle = normalized;
  updateEdgeStyleButtonStates(normalized);
  if (state.selection && state.selectedIds.size === 1 && shapeSupportsEdgeStyle(state.selection)) {
    ensureStyleHasFillStyle(state.selection.style, state.selection.type);
    state.selection.style.edgeStyle = normalized;
    commitShapeChange(state.selection);
  }
}

function applyStrokeStyle(value) {
  const normalized = normalizeStrokeStyle(value, state.style.strokeStyle ?? DEFAULT_STROKE_STYLE);
  state.style.strokeStyle = normalized;
  updateStrokeStyleButtonStates(normalized);
  if (state.selection && state.selectedIds.size === 1) {
    ensureStyleHasFillStyle(state.selection.style, state.selection.type);
    state.selection.style.strokeStyle = normalized;
    commitShapeChange(state.selection);
  }
}

function updateArrowToggleButtons(startActive, endActive) {
  const startButton = findArrowToggleButton("start");
  const endButton = findArrowToggleButton("end");
  if (startButton) {
    startButton.setAttribute("aria-pressed", startActive ? "true" : "false");
  }
  if (endButton) {
    endButton.setAttribute("aria-pressed", endActive ? "true" : "false");
  }
}

function updateArrowToggleVisibility(shouldShow) {
  if (!elements.arrowEndingControl) return;
  elements.arrowEndingControl.toggleAttribute("hidden", !shouldShow);
  elements.arrowEndingControl.setAttribute("aria-hidden", shouldShow ? "false" : "true");
}

function applyArrowToggle(key, value) {
  if (key === "start") {
    state.style.arrowStart = value;
  } else if (key === "end") {
    state.style.arrowEnd = value;
  }

  const startActive = Boolean(state.style.arrowStart);
  const endActive = state.style.arrowEnd !== undefined ? Boolean(state.style.arrowEnd) : true;
  updateArrowToggleButtons(startActive, endActive);

  if (state.selection && state.selection.type === "arrow") {
    state.selection.style.arrowStart = startActive;
    state.selection.style.arrowEnd = endActive;
    commitShapeChange(state.selection);
  }
}

function initializeTipsPanel() {
  dismissedTips = loadDismissedTips();
  renderTipsPanel();
}

function handleTipsListClick(event) {
  const button = event.target.closest(".tip-dismiss");
  if (!button || !elements.tipsList || !elements.tipsList.contains(button)) {
    return;
  }
  const tipId = button.getAttribute("data-tip-id");
  if (!tipId) {
    return;
  }
  dismissedTips.add(tipId);
  persistDismissedTips();
  renderTipsPanel();
}

function renderTipsPanel() {
  if (!elements.tipsPanel || !elements.tipsList) {
    return;
  }
  const activeTips = TIPS_CONTENT.filter((tip) => !dismissedTips.has(tip.id));
  if (activeTips.length === 0) {
    elements.tipsPanel.remove();
    elements.tipsPanel = null;
    elements.tipsList = null;
    return;
  }
  elements.tipsList.innerHTML = "";
  activeTips.forEach((tip) => {
    const item = document.createElement("li");
    item.className = "tip-item";

    const message = document.createElement("span");
    message.textContent = tip.text;

    const dismissButton = document.createElement("button");
    dismissButton.type = "button";
    dismissButton.className = "tip-dismiss";
    dismissButton.setAttribute("data-tip-id", tip.id);
    dismissButton.setAttribute("title", "Dismiss tip");
    dismissButton.setAttribute("aria-label", `Dismiss tip: ${tip.text}`);
    dismissButton.textContent = "×";

    item.appendChild(message);
    item.appendChild(dismissButton);
    elements.tipsList.appendChild(item);
  });
}

function loadDismissedTips() {
  try {
    const legacyFlag = window.localStorage?.getItem(LEGACY_TIPS_KEY);
    if (legacyFlag === "1") {
      window.localStorage?.removeItem(LEGACY_TIPS_KEY);
      return new Set(TIPS_CONTENT.map((tip) => tip.id));
    }
    const raw = window.localStorage?.getItem(TIPS_DISMISSED_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((value) => typeof value === "string"));
    }
  } catch (error) {
    console.warn("Failed to parse stored tip dismissal state", error);
  }
  return new Set();
}

function persistDismissedTips() {
  try {
    const payload = JSON.stringify(Array.from(dismissedTips));
    window.localStorage?.setItem(TIPS_DISMISSED_KEY, payload);
    window.localStorage?.removeItem(LEGACY_TIPS_KEY);
  } catch (error) {
    console.warn("Failed to persist tip dismissal state", error);
  }
}

function setZoomLevel(zoom) {
  const clamped = Math.max(0.1, Math.min(5, zoom));
  state.stage.zoom = clamped;
  applyZoom();
  updateZoomDisplay();
}

function applyZoom() {
  if (!elements.stageSurface) return;
  const zoom = state.stage.zoom;
  canvas.style.transform = `scale(${zoom})`;
  canvas.style.transformOrigin = "center center";
}

function updateZoomDisplay() {
  if (!elements.zoomReset) return;
  const percentage = Math.round(state.stage.zoom * 100);
  const zoomLevel = elements.zoomReset.querySelector(".zoom-level");
  if (zoomLevel) {
    zoomLevel.textContent = `${percentage}%`;
  }
}

function applyStageSize(width, height, { persist = true } = {}) {
  if (!canvas) return;
  const minWidth = state.stage.minWidth || 320;
  const minHeight = state.stage.minHeight || 240;
  const maxWidth = state.stage.maxWidth || 4096;
  const maxHeight = state.stage.maxHeight || 3072;

  const clampedWidth = Math.max(minWidth, Math.min(maxWidth, Math.round(width)));
  const clampedHeight = Math.max(minHeight, Math.min(maxHeight, Math.round(height)));

  state.stage.autoFit = false;
  state.stage.width = clampedWidth;
  state.stage.height = clampedHeight;
  resizeCanvas();
  updateStageDimensionsLabel();

  if (persist) {
    saveStageSize(clampedWidth, clampedHeight);
  }
}

function saveStageSize(width, height) {
  try {
    window.localStorage?.setItem(STAGE_SIZE_STORAGE_KEY, JSON.stringify({ width, height }));
  } catch (error) {
    console.warn("Failed to persist stage size", error);
  }
}

function loadStageSize() {
  try {
    const raw = window.localStorage?.getItem(STAGE_SIZE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const width = Number(parsed?.width);
    const height = Number(parsed?.height);
    if (Number.isFinite(width) && Number.isFinite(height)) {
      return { width, height };
    }
  } catch (error) {
    console.warn("Failed to read stored stage size", error);
  }
  return null;
}

function restoreStageSize() {
  const stored = loadStageSize();
  if (stored) {
    applyStageSize(stored.width, stored.height, { persist: false });
  } else {
    updateStageDimensionsLabel();
  }
}

function getDefaultStageBackground() {
  return DEFAULT_STAGE_BACKGROUND;
}

function normalizeStageColor(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return null;
}

function applyStageBackground(color, { updateControl = true, persist = true } = {}) {
  const normalized = normalizeStageColor(color) || normalizeStageColor(DEFAULT_STAGE_BACKGROUND);
  if (!normalized) return;
  if (state.stage.background === normalized) {
    if (updateControl && elements.stageBackgroundColor) {
      elements.stageBackgroundColor.value = normalized;
    }
    return;
  }
  state.stage.background = normalized;
  syncStageBackgroundStyle(normalized);
  if (updateControl && elements.stageBackgroundColor) {
    elements.stageBackgroundColor.value = normalized;
  }
  if (persist) {
    saveStageBackground(normalized);
  }
}

function syncStageBackgroundStyle(color) {
  if (!canvas) return;
  canvas.style.setProperty("--canvas-bg", color);
}

function saveStageBackground(color) {
  try {
    window.localStorage?.setItem(STAGE_BACKGROUND_STORAGE_KEY, color);
  } catch (error) {
    console.warn("Failed to persist stage background", error);
  }
}

function loadStageBackground() {
  try {
    const stored = window.localStorage?.getItem(STAGE_BACKGROUND_STORAGE_KEY);
    if (!stored) return null;
    return normalizeStageColor(stored);
  } catch (error) {
    console.warn("Failed to read stored stage background", error);
  }
  return null;
}

function restoreStageBackground() {
  const stored = loadStageBackground();
  const target = stored || state.stage.background || DEFAULT_STAGE_BACKGROUND;
  applyStageBackground(target, { updateControl: true, persist: false });
}

function extractStagePointerData(event, pointerId = null) {
  if (event.changedTouches && event.changedTouches.length > 0) {
    const touch = getTouchById(event.changedTouches, pointerId);
    if (!touch) {
      return null;
    }
    return {
      clientX: touch.clientX,
      clientY: touch.clientY,
      pointerId: touch.identifier,
      isTouch: true,
    };
  }
  if (event.touches && event.touches.length > 0 && pointerId !== null) {
    const touch = getTouchById(event.touches, pointerId);
    if (touch) {
      return {
        clientX: touch.clientX,
        clientY: touch.clientY,
        pointerId: touch.identifier,
        isTouch: true,
      };
    }
  }
  if (typeof event.clientX === "number" && typeof event.clientY === "number") {
    return {
      clientX: event.clientX,
      clientY: event.clientY,
      pointerId: event.pointerId ?? pointerId ?? 0,
      isTouch: false,
    };
  }
  return null;
}

function startStageResize(event) {
  if (state.stage.resizeSession) {
    return;
  }
  const data = extractStagePointerData(event);
  if (!data) {
    return;
  }
  event.preventDefault();
  const mode = event.currentTarget?.getAttribute("data-stage-resize") || "corner";
  state.stage.resizeSession = {
    pointerId: data.pointerId,
    startX: data.clientX,
    startY: data.clientY,
    startWidth: state.stage.width,
    startHeight: state.stage.height,
    mode,
    handle: event.currentTarget || null,
    isTouch: data.isTouch,
  };
  if (!data.isTouch) {
    try {
      event.currentTarget?.setPointerCapture(data.pointerId);
    } catch (error) {
      // Ignore pointer capture errors
    }
  }
  elements.canvasWrapper?.classList.add("is-resizing");
}

function handleStageResizeMove(event) {
  const session = state.stage.resizeSession;
  if (!session) {
    return;
  }
  const data = extractStagePointerData(event, session.pointerId);
  if (!data || data.pointerId !== session.pointerId) {
    return;
  }
  event.preventDefault();
  const deltaX = data.clientX - session.startX;
  const deltaY = data.clientY - session.startY;
  let targetWidth = session.startWidth;
  let targetHeight = session.startHeight;
  if (session.mode === "corner" || session.mode === "right") {
    targetWidth = session.startWidth + deltaX;
  }
  if (session.mode === "corner" || session.mode === "bottom") {
    targetHeight = session.startHeight + deltaY;
  }
  applyStageSize(targetWidth, targetHeight, { persist: false });
}

function endStageResize(event) {
  const session = state.stage.resizeSession;
  if (!session) {
    return;
  }
  const data = extractStagePointerData(event, session.pointerId);
  if (!data || data.pointerId !== session.pointerId) {
    return;
  }
  if (!session.isTouch) {
    try {
      session.handle?.releasePointerCapture(session.pointerId);
    } catch (error) {
      // Ignore release errors
    }
  }
  state.stage.resizeSession = null;
  elements.canvasWrapper?.classList.remove("is-resizing");
  state.stage.autoFit = false;
  saveStageSize(Math.round(state.stage.width), Math.round(state.stage.height));
}

function updateStageDimensionsLabel() {
  if (!elements.stageDimensions) return;
  const width = Math.round(state.stage.width || canvas.width || 0);
  const height = Math.round(state.stage.height || canvas.height || 0);
  elements.stageDimensions.textContent = `${width} × ${height} px`;
}

function syncArrowEndingUI() {
  const multiSelected = state.selectedIds.size > 1;
  const arrowSelected = Boolean(state.selection && state.selection.type === "arrow");
  const shouldShowArrows = !multiSelected && (arrowSelected || state.tool === "arrow");
  updateArrowToggleVisibility(shouldShowArrows);
  if (shouldShowArrows) {
    const source = arrowSelected ? state.selection.style : state.style;
    const defaultEnd = source.arrowEnd !== undefined ? Boolean(source.arrowEnd) : true;
    updateArrowToggleButtons(Boolean(source.arrowStart), defaultEnd);
  }
}

function toLocalPoint(point, center, rotation) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos,
  };
}

function rotateVector(vector, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos,
  };
}

function rotatePoint(point, center, angle) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

function normalizeAngle(angle) {
  const tau = Math.PI * 2;
  let normalized = angle % tau;
  if (normalized > Math.PI) normalized -= tau;
  if (normalized < -Math.PI) normalized += tau;
  return normalized;
}

function radiansToDegrees(radians) {
  return (radians * 180) / Math.PI;
}

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function clampScale(value) {
  if (!Number.isFinite(value) || value === 0) return 0.1;
  return Math.max(0.1, Math.abs(value));
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(value) {
  let seed = hashString(String(value)) || 1;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    seed ^= seed >>> 15;
    seed = Math.imul(seed, 1 | seed);
    seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed);
    return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
  };
}

function drawSketchStroke(context, buildPath, shape, level) {
  const passes = level === 1 ? 2 : 5;
  let jitter = level === 1 ? 1.2 : 3.5;
  if (shape?.type === "line" || shape?.type === "arrow") {
    jitter = level === 1 ? 0.6 : 1.8;
  }
  const random = createSeededRandom(`${shape.id}:${level}`);
  for (let i = 0; i < passes; i += 1) {
    context.save();
    const offsetX = (random() - 0.5) * jitter;
    const offsetY = (random() - 0.5) * jitter;
    const angle = (random() - 0.5) * jitter * 0.03;
    context.translate(offsetX, offsetY);
    context.rotate(angle);
    buildPath();
    context.stroke();
    context.restore();
  }
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function distanceToSegment(point, start, end) {
  const lengthSquared = distanceSquared(start, end);
  if (lengthSquared === 0) return distance(point, start);
  let t = ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  const projection = {
    x: start.x + t * (end.x - start.x),
    y: start.y + t * (end.y - start.y),
  };
  return distance(point, projection);
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function getQuadraticPoint(start, control, end, t) {
  const oneMinusT = 1 - t;
  const x = oneMinusT * oneMinusT * start.x + 2 * oneMinusT * t * control.x + t * t * end.x;
  const y = oneMinusT * oneMinusT * start.y + 2 * oneMinusT * t * control.y + t * t * end.y;
  return { x, y };
}

function distanceToQuadratic(point, start, control, end) {
  const segments = 16;
  let closest = Infinity;
  let previous = start;
  for (let index = 1; index <= segments; index += 1) {
    const t = index / segments;
    const current = getQuadraticPoint(start, control, end, t);
    const candidate = distanceToSegment(point, previous, current);
    if (candidate < closest) {
      closest = candidate;
    }
    previous = current;
  }
  return closest;
}

function getLineMidpoint(start, end) {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}

function getLineNormal(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) {
    return { x: 0, y: -1 };
  }
  return {
    x: -dy / length,
    y: dx / length,
  };
}

function getLineBendOffset(start, end, control) {
  if (!start || !end || !control) return 0;
  const normal = getLineNormal(start, end);
  const mid = getLineMidpoint(start, end);
  const vector = { x: control.x - mid.x, y: control.y - mid.y };
  return vector.x * normal.x + vector.y * normal.y;
}

function clampLineBendOffset(start, end, offset) {
  const length = Math.max(1, distance(start, end));
  const limit = Math.max(24, length * 0.65);
  return Math.max(-limit, Math.min(limit, offset));
}

function getLineControlFromOffset(start, end, offset) {
  const normal = getLineNormal(start, end);
  const mid = getLineMidpoint(start, end);
  return {
    x: mid.x + normal.x * offset,
    y: mid.y + normal.y * offset,
  };
}

function getLineBendOffsetFromPoint(start, end, point) {
  const normal = getLineNormal(start, end);
  const mid = getLineMidpoint(start, end);
  const vector = { x: point.x - mid.x, y: point.y - mid.y };
  return vector.x * normal.x + vector.y * normal.y;
}

function getLineBendHandlePosition(shape) {
  if (!shape || shape.type !== "line") return null;
  const { start, end, control } = shape.live || {};
  if (!start || !end) return null;
  if (control && Number.isFinite(control.x) && Number.isFinite(control.y)) {
    return { x: control.x, y: control.y };
  }
  return getLineMidpoint(start, end);
}

function computeQuadraticExtremumCoordinate(p0, p1, p2) {
  const denominator = p0 - 2 * p1 + p2;
  if (Math.abs(denominator) < 1e-6) return null;
  const t = (p0 - p1) / denominator;
  if (t <= 0 || t >= 1) return null;
  return t;
}

function getShapeBounds(shape) {
  if (shape.type === "free") {
    return getBoundsFromPoints(shape.live.points);
  }
  if (shape.type === "line" || shape.type === "arrow") {
    const { start, end } = shape.live;
    if (!start || !end) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    const points = [start, end];
    if (shape.type === "line" && shape.live.control) {
      const control = shape.live.control;
      points.push(control);
      const tx = computeQuadraticExtremumCoordinate(start.x, control.x, end.x);
      if (tx !== null) {
        points.push(getQuadraticPoint(start, control, end, tx));
      }
      const ty = computeQuadraticExtremumCoordinate(start.y, control.y, end.y);
      if (ty !== null) {
        points.push(getQuadraticPoint(start, control, end, ty));
      }
    }
    const xs = points.map((pt) => pt.x);
    const ys = points.map((pt) => pt.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  return { x: shape.live.x, y: shape.live.y, width: shape.live.width, height: shape.live.height };
}

function getMarqueeRect(start, end) {
  if (!start || !end) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const minX = Math.min(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxX = Math.max(start.x, end.x);
  const maxY = Math.max(start.y, end.y);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function getShapesContainedInRect(rect) {
  if (!rect) return [];
  return state.shapes.filter((shape) => {
    if (!shape) return false;
    if (shape.isVisible === false) return false;
    const bounds = getShapeBounds(shape);
    return rectContainsRect(rect, bounds, MARQUEE_EPSILON);
  });
}

function getBoundsFromPoints(points = []) {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function rectContainsRect(outer, inner, epsilon = 0) {
  if (!outer || !inner) return false;
  const left = inner.x >= outer.x - epsilon;
  const top = inner.y >= outer.y - epsilon;
  const right = inner.x + inner.width <= outer.x + outer.width + epsilon;
  const bottom = inner.y + inner.height <= outer.y + outer.height + epsilon;
  return left && top && right && bottom;
}

function getShapeCenter(shape) {
  switch (shape.type) {
    case "rectangle":
    case "diamond":
    case "square":
    case "circle":
    case "image":
    case "text":
      return {
        x: shape.live.x + shape.live.width / 2,
        y: shape.live.y + shape.live.height / 2,
      };
    case "line":
    case "arrow":
      return {
        x: (shape.live.start.x + shape.live.end.x) / 2,
        y: (shape.live.start.y + shape.live.end.y) / 2,
      };
    case "free": {
      const bounds = getShapeBounds(shape);
      return getCenterFromBounds(bounds);
    }
    default:
      return { x: 0, y: 0 };
  }
}

function getCenterFromBounds(bounds) {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

function getShapeRotation(shape) {
  if (!shape) return 0;
  if (shape.type === "rectangle" || shape.type === "diamond" || shape.type === "square" || shape.type === "circle" || shape.type === "text") {
    if (typeof shape.live.rotation === "number") {
      return shape.live.rotation;
    }
    return degreesToRadians(shape.style.rotation || 0);
  }
  return 0;
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  let clientX = 0;
  let clientY = 0;

  if (typeof event.clientX === "number" && typeof event.clientY === "number") {
    clientX = event.clientX;
    clientY = event.clientY;
  } else if (event.touches && event.touches.length > 0) {
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  } else if (event.changedTouches && event.changedTouches.length > 0) {
    clientX = event.changedTouches[0].clientX;
    clientY = event.changedTouches[0].clientY;
  } else if (typeof event.pageX === "number" && typeof event.pageY === "number") {
    clientX = event.pageX - window.pageXOffset;
    clientY = event.pageY - window.pageYOffset;
  }

  const width = rect.width || 1;
  const height = rect.height || 1;
  const scaleX = Number.isFinite(state.stage.width) && width !== 0 ? state.stage.width / width : 1;
  const scaleY = Number.isFinite(state.stage.height) && height !== 0 ? state.stage.height / height : 1;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function updateExportStatus(message, variant = "info") {
  if (!elements.exportStatus) return;
  elements.exportStatus.textContent = message;
  elements.exportStatus.setAttribute("data-variant", variant);
}

function renderFrameToContext(targetCtx) {
  if (!targetCtx) return;
  const ratio = window.devicePixelRatio || 1;
  targetCtx.save();
  targetCtx.setTransform(1, 0, 0, 1, 0, 0);
  targetCtx.clearRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
  targetCtx.restore();

  targetCtx.save();
  targetCtx.scale(ratio, ratio);
  drawShapes(targetCtx);
  targetCtx.restore();
}

function handleSceneImport(event) {
  const { files } = event.target;
  if (!files || files.length === 0) return;
  const [file] = files;
  if (!file) return;
  const reader = new FileReader();
  updateExportStatus("Importing scene…", "info");
  reader.addEventListener("load", () => {
    try {
      const data = JSON.parse(reader.result);
      applyImportedScene(data);
      updateExportStatus("Scene imported!", "success");
    } catch (error) {
      updateExportStatus("Scene import failed", "error");
      console.error("Import error", error);
      alert("Unable to import scene file. Ensure it's a valid Animator export.");
    }
  });
  reader.addEventListener("error", () => {
    updateExportStatus("Import cancelled", "error");
  });
  reader.readAsText(file);
}

async function handleExportGif() {
  const fps = state.timeline.exportFps || 12;
  const duration = Math.max(0, state.timeline.duration);
  const maxFrames = 600;
  const step = fps > 0 ? 1 / fps : 0.1;

  updateExportStatus("Capturing frames…", "info");

  const originalTime = state.timeline.current;
  const originalBounce = state.timeline.bounce;
  const originalLoop = state.timeline.loop;

  const offscreen = document.createElement("canvas");
  offscreen.width = canvas.width;
  offscreen.height = canvas.height;
  const offCtx = offscreen.getContext("2d");

  const frames = [];
  let time = 0;
  let direction = 1;
  const targetFrames = duration === 0 ? 1 : Math.max(1, Math.ceil(duration * fps));
  const plannedFrames = Math.max(1, Math.min(maxFrames, originalBounce ? targetFrames * 2 : targetFrames));

  for (let index = 0; index < plannedFrames; index += 1) {
    setTimelineTime(time, { apply: true });
    renderFrameToContext(offCtx);
    const data = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
    frames.push({
      data: data.data,
      delayMs: Math.max(20, Math.round(1000 / Math.max(1, fps))),
    });

    if (duration === 0) {
      continue;
    }

    time += step * direction;
    if (originalBounce) {
      if (time >= duration) {
        time = duration;
        direction = -1;
      } else if (time <= 0) {
        time = 0;
        direction = 1;
      }
    } else if (originalLoop) {
      if (time >= duration) {
        time = 0;
      }
    } else if (time > duration) {
      time = duration;
    }
  }

  if (frames.length <= 1) {
    updateExportStatus("Single static frame – animation not exported", "error");
    alert("GIF export aborted because the animation only produced a single static frame.");
    setTimelineTime(originalTime, { apply: true });
    return;
  }

  try {
    updateExportStatus("Encoding GIF…", "info");
    const bytes = encodeGif({
      width: offscreen.width,
      height: offscreen.height,
      frames,
      loop: originalLoop,
    });
    const blob = new Blob([bytes], { type: "image/gif" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `animator-export-${Date.now()}.gif`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    updateExportStatus("GIF download ready", "success");
  } catch (error) {
    console.error("GIF export failed", error);
    updateExportStatus("GIF export failed", "error");
    alert("GIF export failed. Please try again.");
  } finally {
    setTimelineTime(originalTime, { apply: true });
  }
}

function cloneShape(shape) {
  if (!shape) return null;
  const clone = {
    id: shape.id,
    type: shape.type,
    style: JSON.parse(JSON.stringify(shape.style || {})),
    live: JSON.parse(JSON.stringify(shape.live || {})),
    keyframes: Array.isArray(shape.keyframes)
      ? shape.keyframes.map((keyframe) => ({
          time: keyframe.time,
          snapshot: JSON.parse(JSON.stringify(keyframe.snapshot || {})),
        }))
      : [],
    birthTime: shape.birthTime ?? 0,
    isVisible: shape.isVisible !== false,
    groupId: shape.groupId ?? null,
  };
  if (shape.asset && shape.asset.source) {
    clone.asset = {
      source: shape.asset.source,
    };
  }
  ensureStyleHasFillStyle(clone.style, clone.type);
  if (Array.isArray(clone.keyframes)) {
    clone.keyframes.forEach((keyframe) => {
      if (keyframe && keyframe.snapshot && keyframe.snapshot.style) {
        const snapshotType = keyframe.snapshot.type ?? clone.type;
        ensureStyleHasFillStyle(keyframe.snapshot.style, snapshotType);
      }
    });
  }
  normalizeShapeKeyframes(clone);
  return clone;
}

function rehydrateShapeAsset(shape) {
  if (!shape || !shape.asset || !shape.asset.source) return;
  const image = new Image();
  image.src = shape.asset.source;
  shape.asset.image = image;
}

function buildSceneExportPayload() {
  return {
    version: 1,
    duration: state.timeline.duration,
    stage: {
      width: Math.round(state.stage.width),
      height: Math.round(state.stage.height),
      background: state.stage.background || DEFAULT_STAGE_BACKGROUND,
    },
    timeline: {
      duration: state.timeline.duration,
      loop: state.timeline.loop,
      bounce: state.timeline.bounce,
      exportFps: state.timeline.exportFps || 12,
    },
    shapes: state.shapes.map((shape) => {
      const serialized = cloneShape(shape);
      return serialized;
    }),
  };
}

function clampToRange(value, min, max) {
  const resolvedMin = Number.isFinite(min) ? min : 0;
  const resolvedMax = Number.isFinite(max) ? max : resolvedMin;
  if (!Number.isFinite(value)) {
    return resolvedMin;
  }
  if (resolvedMin > resolvedMax) {
    return resolvedMin;
  }
  return Math.min(Math.max(value, resolvedMin), resolvedMax);
}

function confineRectLikeLive(live, stageWidth, stageHeight) {
  if (!live) return;
  const width = Number(live.width) || 0;
  const height = Number(live.height) || 0;
  const maxX = Math.max(0, (Number.isFinite(stageWidth) ? stageWidth : width) - width);
  const maxY = Math.max(0, (Number.isFinite(stageHeight) ? stageHeight : height) - height);
  live.x = clampToRange(Number(live.x) || 0, 0, maxX);
  live.y = clampToRange(Number(live.y) || 0, 0, maxY);
}

function confineLineLikeLive(live, stageWidth, stageHeight) {
  if (!live) return;
  if (live.start) {
    live.start.x = clampToRange(Number(live.start.x) || 0, 0, Number.isFinite(stageWidth) ? stageWidth : live.start.x || 0);
    live.start.y = clampToRange(Number(live.start.y) || 0, 0, Number.isFinite(stageHeight) ? stageHeight : live.start.y || 0);
  }
  if (live.end) {
    live.end.x = clampToRange(Number(live.end.x) || 0, 0, Number.isFinite(stageWidth) ? stageWidth : live.end.x || 0);
    live.end.y = clampToRange(Number(live.end.y) || 0, 0, Number.isFinite(stageHeight) ? stageHeight : live.end.y || 0);
  }
}

function confineFreeformLive(live, stageWidth, stageHeight) {
  if (!live || !Array.isArray(live.points) || live.points.length === 0) return;
  const xs = live.points.map((point) => Number(point.x) || 0);
  const ys = live.points.map((point) => Number(point.y) || 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  let offsetX = 0;
  let offsetY = 0;
  if (Number.isFinite(stageWidth)) {
    if (minX < 0) {
      offsetX = -minX;
    } else if (maxX > stageWidth) {
      offsetX = stageWidth - maxX;
    }
  }
  if (Number.isFinite(stageHeight)) {
    if (minY < 0) {
      offsetY = -minY;
    } else if (maxY > stageHeight) {
      offsetY = stageHeight - maxY;
    }
  }
  if (offsetX !== 0 || offsetY !== 0) {
    live.points = live.points.map((point) => ({
      x: (Number(point.x) || 0) + offsetX,
      y: (Number(point.y) || 0) + offsetY,
    }));
  }
}

function confineLiveGeometry(type, live, stageWidth, stageHeight) {
  switch (type) {
  case "rectangle":
  case "diamond":
  case "square":
  case "circle":
  case "text":
  case "image":
      confineRectLikeLive(live, stageWidth, stageHeight);
      break;
    case "line":
    case "arrow":
    case "connector":
      confineLineLikeLive(live, stageWidth, stageHeight);
      break;
    case "free":
      confineFreeformLive(live, stageWidth, stageHeight);
      break;
    default:
      if (live && typeof live.x === "number" && typeof live.y === "number") {
        live.x = clampToRange(Number(live.x) || 0, 0, Number.isFinite(stageWidth) ? stageWidth : live.x || 0);
        live.y = clampToRange(Number(live.y) || 0, 0, Number.isFinite(stageHeight) ? stageHeight : live.y || 0);
      }
      break;
  }
}

function confineSnapshotToStage(snapshot, stageWidth, stageHeight, fallbackType) {
  if (!snapshot || !snapshot.live) return;
  const type = snapshot.type || fallbackType;
  confineLiveGeometry(type, snapshot.live, stageWidth, stageHeight);
}

function confineShapeToStage(shape, stageWidth, stageHeight) {
  if (!shape) return;
  confineLiveGeometry(shape.type, shape.live, stageWidth, stageHeight);
  if (Array.isArray(shape.keyframes)) {
    shape.keyframes.forEach((keyframe) => {
      if (!keyframe || !keyframe.snapshot) return;
      confineSnapshotToStage(keyframe.snapshot, stageWidth, stageHeight, shape.type);
    });
  }
}

function applyImportedScene(payload) {
  if (!payload || typeof payload !== "object") return;
  const historyEntry = createHistoryEntry("import-scene");
  const shapes = Array.isArray(payload.shapes) ? payload.shapes : [];

  const normalizedShapes = shapes.map((entry) => {
    const targetType = entry.type === "connector" ? "arrow" : entry.type;
  const style = JSON.parse(JSON.stringify(entry.style || {}));
  ensureStyleHasFillStyle(style, targetType);
    if (targetType === "arrow") {
      style.arrowStart = Boolean(style.arrowStart);
      style.arrowEnd = style.arrowEnd !== undefined ? Boolean(style.arrowEnd) : true;
    }
    const keyframes = Array.isArray(entry.keyframes)
      ? entry.keyframes
          .map((keyframe) => {
            if (!keyframe || typeof keyframe !== "object") return null;
            return {
              time: Number(keyframe.time) || 0,
              snapshot: JSON.parse(JSON.stringify(keyframe.snapshot || {})),
            };
          })
          .filter(Boolean)
      : [];

    keyframes.forEach((keyframe) => {
      if (keyframe.snapshot) {
        keyframe.snapshot.type = targetType;
        if (keyframe.snapshot.style) {
          ensureStyleHasFillStyle(keyframe.snapshot.style, targetType);
        }
        if (keyframe.snapshot.bindings) {
          delete keyframe.snapshot.bindings;
        }
      }
    });

    const shape = {
      id: Number.isFinite(entry.id) ? entry.id : shapeIdCounter++,
      type: targetType,
      style,
      live: JSON.parse(JSON.stringify(entry.live || {})),
      keyframes,
      birthTime: entry.birthTime ?? 0,
      isVisible: entry.isVisible !== false,
    };

    if (targetType === "arrow" && shape.live && shape.live.bindings) {
      delete shape.live.bindings;
    }

  ensureStyleHasFillStyle(shape.style, shape.type);

    if (entry.asset && entry.asset.source) {
      shape.asset = {
        source: entry.asset.source,
      };
      rehydrateShapeAsset(shape);
    }

    return shape;
  });

  state.shapes = normalizedShapes;
  state.groups = {};
  setActiveGroupId(null);

  if (state.shapes.length > 0) {
    const maxId = Math.max(...state.shapes.map((shape) => Number(shape.id) || 0));
    if (Number.isFinite(maxId)) {
      shapeIdCounter = Math.max(shapeIdCounter, maxId + 1);
    }
  }

  const stageWidthCandidate = Number(payload.stage?.width);
  const stageHeightCandidate = Number(payload.stage?.height);
  if (Number.isFinite(stageWidthCandidate) || Number.isFinite(stageHeightCandidate)) {
    const nextWidth = Number.isFinite(stageWidthCandidate) ? stageWidthCandidate : state.stage.width;
    const nextHeight = Number.isFinite(stageHeightCandidate) ? stageHeightCandidate : state.stage.height;
    applyStageSize(nextWidth, nextHeight);
  }

  const stageBackgroundCandidate = normalizeStageColor(payload.stage?.background) || normalizeStageColor(payload.stageBackground);
  if (stageBackgroundCandidate) {
    applyStageBackground(stageBackgroundCandidate, { updateControl: true });
  } else {
    applyStageBackground(getDefaultStageBackground(), { updateControl: true });
  }

  const stageWidth = state.stage.width;
  const stageHeight = state.stage.height;
  state.shapes.forEach((shape) => {
    confineShapeToStage(shape, stageWidth, stageHeight);
  });

  state.shapes.forEach((shape) => {
    if (shape.type === "text") {
      shape.style.fontFamily = shape.style.fontFamily || state.style.fontFamily || DEFAULT_TEXT_FONT;
      shape.style.fontSize = Math.max(6, Number(shape.style.fontSize) || state.style.fontSize || 32);
      if (typeof shape.style.rotation === "number") {
        // assume stored in degrees
      } else if (typeof shape.live.rotation === "number") {
        shape.style.rotation = radiansToDegrees(shape.live.rotation);
      } else {
        shape.style.rotation = 0;
      }
      if (typeof shape.live.rotation !== "number") {
        shape.live.rotation = degreesToRadians(shape.style.rotation || 0);
      }
      if (typeof shape.live.text !== "string") {
        shape.live.text = "";
      }
      const keepCenter = Math.abs(shape.live.rotation || 0) > 0.001 || Math.abs(shape.style.rotation || 0) > 0.001;
      updateTextMetrics(shape, keepCenter ? { keepCenter: true } : { preserveOrigin: true });
      if (Array.isArray(shape.keyframes)) {
        shape.keyframes.forEach((keyframe) => {
          if (!keyframe || !keyframe.snapshot) return;
          if ((keyframe.snapshot.type || shape.type) !== "text") return;
          let rawSnapshotRotation = null;
          if (keyframe.snapshot.live && typeof keyframe.snapshot.live.rotation === "number") {
            rawSnapshotRotation = keyframe.snapshot.live.rotation;
          } else if (typeof keyframe.snapshot.style?.rotation === "number") {
            rawSnapshotRotation = degreesToRadians(keyframe.snapshot.style.rotation);
          }
          const referenceRotation = rawSnapshotRotation !== null ? rawSnapshotRotation : shape.live.rotation || 0;
          const snapshotKeepCenter = Math.abs(referenceRotation) > 0.001;
          refreshTextSnapshotMetrics(keyframe.snapshot, {
            fallbackStyle: shape.style,
            keepCenter: snapshotKeepCenter,
          });
        });
      }
    }
    ensureBaseKeyframe(shape, shape.birthTime ?? 0);
  });

  rebuildGroupStateFromShapes();

  const resolvedDuration = Number.isFinite(payload.timeline?.duration)
    ? payload.timeline.duration
    : Number.isFinite(payload.duration)
    ? payload.duration
    : null;
  if (Number.isFinite(resolvedDuration)) {
    const clamped = Math.max(0, resolvedDuration);
    state.timeline.duration = clamped;
    if (elements.timelineDuration) {
      elements.timelineDuration.value = String(clamped);
    }
  }
  if (typeof payload.timeline?.exportFps === "number") {
    state.timeline.exportFps = Math.max(1, Math.round(payload.timeline.exportFps));
  }
  if (typeof payload.timeline?.loop === "boolean") {
    state.timeline.loop = payload.timeline.loop;
  }
  if (typeof payload.timeline?.bounce === "boolean") {
    state.timeline.bounce = payload.timeline.bounce;
  }

  setTimelineTime(0, { apply: true });

  if (state.shapes.length > 0) {
    const primaryShape = state.shapes[state.shapes.length - 1];
    setSelectedShapes([primaryShape]);
  } else {
    setSelectedShapes([]);
  }

  renderTimelineTrackMarkers();
  commitHistoryEntry(historyEntry);
}

function exportScene() {
  const payload = buildSceneExportPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `animator-scene-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function createAnimatorApi() {
  const toClientPoint = (point) => {
    if (!point) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + point.x,
      y: rect.top + point.y,
    };
  };

  const resolveShape = (targetId) => {
    if (typeof targetId === "number") {
      return state.shapes.find((shape) => shape.id === targetId) || null;
    }
    if (targetId && typeof targetId === "string") {
      const numeric = Number(targetId);
      if (Number.isFinite(numeric)) {
        return state.shapes.find((shape) => shape.id === numeric) || null;
      }
    }
    if (state.selection) return state.selection;
    const selected = getSelectedShapesList();
    return selected.length > 0 ? selected[0] : null;
  };

  const captureTimelineFrames = async ({ fps = state.timeline.exportFps || 12, maxFrames = 360, onFrame } = {}) => {
    const duration = Math.max(0, state.timeline.duration);
    const step = fps <= 0 ? 0 : 1 / fps;
    const originalTime = state.timeline.current;
    const originalDirection = state.timeline.direction || 1;
    const originalBounce = state.timeline.bounce;
    const frames = duration === 0 ? 1 : Math.max(1, Math.min(maxFrames, Math.ceil(duration * fps)));
    const results = [];
    let direction = 1;
    let time = 0;

    for (let index = 0; index < frames && results.length < maxFrames; index += 1) {
      setTimelineTime(time, { apply: true });
      if (typeof onFrame === "function") {
        results.push(onFrame());
      } else {
        results.push(time);
      }

      if (duration === 0) {
        continue;
      }

      time += step * direction;
      if (state.timeline.bounce) {
        if (time >= duration) {
          time = duration;
          direction = -1;
        } else if (time <= 0) {
          time = 0;
          direction = 1;
        }
      } else if (state.timeline.loop) {
        if (time >= duration) {
          time = 0;
        }
      } else if (time > duration) {
        time = duration;
      }
    }

    if (state.timeline.bounce && results.length < maxFrames && duration > 0) {
      direction = -1;
      for (let index = 0; index < frames && results.length < maxFrames; index += 1) {
        time += step * direction;
        time = Math.max(0, Math.min(duration, time));
        setTimelineTime(time, { apply: true });
        if (typeof onFrame === "function") {
          results.push(onFrame());
        } else {
          results.push(time);
        }
        if (time <= 0) {
          direction = 1;
        }
      }
    }

    setTimelineTime(originalTime, { apply: true });
    state.timeline.direction = originalDirection;
    state.timeline.bounce = originalBounce;

    return {
      totalFrames: results.length,
      results,
    };
  };

  return {
    getShapeBounds(targetId) {
      const shape = resolveShape(targetId);
      if (!shape) return null;
      const bounds = getShapeBounds(shape);
      return { ...bounds };
    },
    getResizeHandleClientPoint(targetId) {
      const shape = resolveShape(targetId);
      if (!shape) return null;
      if (shape.type === "line" || shape.type === "arrow") {
        return toClientPoint(shape.live?.end);
      }
      let point = null;
  if (shape.type === "rectangle" || shape.type === "diamond" || shape.type === "square" || shape.type === "circle" || shape.type === "image" || shape.type === "text") {
        point = getRectResizeHandlePosition(shape);
      }
      if (!point) {
        const bounds = getShapeBounds(shape);
        point = { x: bounds.x + bounds.width, y: bounds.y + bounds.height };
      }
      return toClientPoint(point);
    },
    getRotationHandleClientPoint(targetId) {
      const shape = resolveShape(targetId);
      if (!shape) return null;
      const handle = getRotationHandlePosition(shape);
      if (!handle) return null;
      return toClientPoint(handle.position);
    },
    getRotationHandleData(targetId) {
      const shape = resolveShape(targetId);
      if (!shape) return null;
      const handle = getRotationHandlePosition(shape);
      if (!handle) return null;
      return {
        position: { ...handle.position },
        anchor: handle.anchor ? { ...handle.anchor } : null,
        center: handle.center ? { ...handle.center } : null,
      };
    },
    getConnectorBendHandleClientPoint(targetId) {
      const shape = resolveShape(targetId);
      if (!shape || (shape.type !== "line" && shape.type !== "arrow")) return null;
      const start = shape.live?.start;
      const end = shape.live?.end;
      if (!start || !end) return null;
      if (shape.type === "line") {
        const handle = getLineBendHandlePosition(shape);
        if (!handle) return null;
        return toClientPoint(handle);
      }
      const mid = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      };
      const angle = Math.atan2(end.y - start.y, end.x - start.x) - Math.PI / 2;
      const distance = 48 + Math.min(120, Math.hypot(end.x - start.x, end.y - start.y) * 0.2);
      const control = {
        x: mid.x + Math.cos(angle) * distance,
        y: mid.y + Math.sin(angle) * distance,
      };
      return toClientPoint(control);
    },
    getLineBendHandleClientPoint(targetId) {
      const shape = resolveShape(targetId);
      if (!shape || shape.type !== "line") return null;
      const handle = getLineBendHandlePosition(shape);
      if (!handle) return null;
      return toClientPoint(handle);
    },
    copySelection() {
      return copySelectionToClipboard();
    },
    pasteFromClipboard() {
      return pasteClipboardItems();
    },
    selectAll() {
      return selectAllShapes();
    },
    clearSelection() {
      return clearSelection();
    },
    groupSelection() {
      return groupSelectedShapes();
    },
    ungroupSelection() {
      return ungroupSelectedShapes();
    },
    clearCanvas() {
      if (state.shapes.length === 0) {
        return true;
      }
      pushHistorySnapshot("clear-canvas");
      state.shapes = [];
      state.groups = {};
  setActiveGroupId(null);
      updateSelection(null);
      renderKeyframeList();
      renderTimelineTrackMarkers();
      return true;
    },
    exportScenePayload() {
      return buildSceneExportPayload();
    },
    importSceneFromData(data) {
      applyImportedScene(data);
      return true;
    },
    createImageShapeFromSource(src) {
      return createImageShapeFromSourceInternal(src);
    },
    advanceTimelineForTest(seconds) {
      const delta = Math.max(0, Number(seconds) || 0);
      const previousLastTick = state.timeline.lastTick;
      state.timeline.__suppressAdvance = (state.timeline.__suppressAdvance || 0) + 1;
      let result;
      let postLastTick;
      try {
        result = advanceTimelineBy(delta);
        postLastTick = state.timeline.lastTick;
      } finally {
        state.timeline.__suppressAdvance = Math.max(0, (state.timeline.__suppressAdvance || 1) - 1);
      }
      if (state.timeline.isPlaying) {
        state.timeline.lastTick = performance.now();
      } else {
        state.timeline.lastTick = postLastTick ?? previousLastTick;
      }
      return result;
    },
    captureTimelineFrames,
  };
}

document.addEventListener("DOMContentLoaded", init);
