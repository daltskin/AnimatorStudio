import { encodeGif } from "./gifEncoder.js";

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
  sketchButtons: Array.from(document.querySelectorAll("[data-sketch-level]")),
  fontFamily: document.getElementById("fontFamily"),
  arrowToggleButtons: Array.from(document.querySelectorAll("[data-arrow-toggle]")),
  arrowEndingControl: document.getElementById("arrowEndingControl"),
  marqueeOverlay: document.getElementById("marqueeOverlay"),
  selectionLabel: document.getElementById("selectionLabel"),
  keyframeList: document.getElementById("keyframeList"),
  timelineTrack: document.getElementById("timelineTrack"),
  timelineMarker: document.getElementById("timelineMarker"),
  timelineRange: document.getElementById("timelineRange"),
  timelineDuration: document.getElementById("timelineDuration"),
  currentTime: document.getElementById("currentTime"),
  playToggle: document.getElementById("playToggle"),
  stopPlayback: document.getElementById("stopPlayback"),
  addKeyframe: document.getElementById("addKeyframe"),
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
  shapeContextMenu: document.getElementById("shapeContextMenu"),
  stageContextMenu: document.getElementById("stageContextMenu"),
  tipsPanel: document.querySelector("[data-tips]"),
  tipsList: document.getElementById("tipsList"),
  canvasWrapper: document.querySelector(".canvas-wrapper"),
  stageSurface: document.querySelector(".stage-surface"),
  stageDimensions: document.getElementById("stageDimensions"),
  stageResizeHandle: document.getElementById("stageResizeHandle"),
  stageResizeHandles: Array.from(document.querySelectorAll("[data-stage-resize]")),
};

const DEFAULT_STAGE_BACKGROUND =
  getComputedStyle(document.documentElement).getPropertyValue("--canvas-bg")?.trim() || "#ffffff";
const STAGE_BACKGROUND_STORAGE_KEY = "animator.stage.background";
const STROKE_WIDTH_DEFAULT_RANGE = { min: 1, max: 12 };
const STROKE_WIDTH_PEN_RANGE = { min: 1, max: 24 };

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

const TIPS_DISMISSED_KEY = "animator.tips.dismissed.items";
const LEGACY_TIPS_KEY = "animator.tips.dismissed";
const TIPS_CONTENT = [
  { id: "place-shapes", text: "Click the canvas to place shapes." },
  {
    id: "move-resize",
    text: "With a shape selected, drag to move or pull the corner handle to resize.",
  },
  { id: "timeline", text: "Use the timeline to set keyframes for smooth animations." },
  { id: "arrow-tool", text: "Arrow tool can draw connectors with customizable endings." },
];

const FONT_FALLBACKS = {
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
  const family = fontFamily || "Inter";
  const fallback = FONT_FALLBACKS[family] || "sans-serif";
  const sanitized = family.replace(/"/g, '\\"');
  return `"${sanitized}", ${fallback}`;
}

const STAGE_SIZE_STORAGE_KEY = "animator.stage.size";
let dismissedTips = new Set();

const TIMELINE_DEFAULT_DURATION = 5;
const HISTORY_LIMIT = 100;

const state = {
  tool: "select",
  shapes: [],
  selection: null,
  selectedIds: new Set(),
  hoverHandle: null,
  style: {
    fill: elements.fillColor.value,
    stroke: elements.strokeColor.value,
    strokeWidth: Number(elements.strokeWidth.value),
    sketchLevel: getInitialSketchLevel(),
    arrowStart: getInitialArrowState("start", false),
    arrowEnd: getInitialArrowState("end", true),
    opacity: 1,
    edgeStyle: "curved",
    sloppiness: "neat",
    bend: 0,
    rotation: 0,
    fontFamily: elements.fontFamily?.value || "Inter",
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
    marquee: null,
    marqueeAppend: false,
    usingPointerEvents: false,
    touchIdentifier: null,
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
  resizeCanvas();
  bindEvents();
  initializeTipsPanel();
  restoreStageSize();
  restoreStageBackground();
  updateSelection(null);
  setTimelineTime(0, { apply: true });
  window.animatorState = state;
  window.animatorApi = createAnimatorApi();
  window.animatorReady = true;
  render();
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
      const value = event.target.value || "Inter";
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
  window.addEventListener("scroll", closeAllContextMenus, true);
  window.addEventListener("resize", closeAllContextMenus);

  elements.deleteShape?.addEventListener("click", () => {
    deleteSelectedShapes();
  });

  elements.groupShapes?.addEventListener("click", () => {
    if (state.selectedIds.size < 2) {
      return;
    }

    const ids = Array.from(state.selectedIds);
    const sharedGroupId = getSharedGroupId(ids);
    if (sharedGroupId && state.groups[sharedGroupId] && state.groups[sharedGroupId].size === ids.length) {
      return; // already fully grouped
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
        if (shape) delete shape.groupId;
      });
      return;
    }

    state.groups[groupId] = memberSet;
    setActiveGroupId(groupId);

    const shapes = Array.from(memberSet)
      .map((id) => getShapeById(id))
      .filter(Boolean);
    setSelectedShapes(shapes);
  });

  elements.ungroupShapes?.addEventListener("click", () => {
    const groupId = resolveSelectedGroupId();
    if (!groupId) return;
    const members = state.groups[groupId];
    if (!members) return;
    const shapes = Array.from(members)
      .map((id) => getShapeById(id))
      .filter(Boolean);
    shapes.forEach((shape) => {
      if (!shape) return;
      if (shape.groupId === groupId) {
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
    if (shapes.length > 0) {
      setSelectedShapes(shapes);
    } else {
      setSelectedShapes([]);
    }
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
  drawShapes(ctx);
  drawSelectionBounds(ctx);
  ctx.restore();

  if (state.timeline.isPlaying && !(state.timeline.__suppressAdvance > 0)) {
    advanceTimeline();
  }

  requestAnimationFrame(render);
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

function drawRectangleShape(context, shape) {
  const { style, live } = shape;
  const center = getShapeCenter(shape);
  const rotation = live.rotation || 0;
  const width = live.width;
  const height = live.height;

  context.save();
  context.translate(center.x, center.y);
  context.rotate(rotation);
  context.fillStyle = style.fill;
  context.strokeStyle = style.stroke;
  context.lineWidth = style.strokeWidth;
  context.lineCap = "round";
  context.lineJoin = "round";

  context.beginPath();
  context.rect(-width / 2, -height / 2, width, height);
  context.fill();

  if (style.strokeWidth > 0) {
    if (style.sketchLevel > 0) {
      drawSketchStroke(context, () => {
        context.beginPath();
        context.rect(-width / 2, -height / 2, width, height);
      }, shape, style.sketchLevel);
    } else {
      context.stroke();
    }
  }

  context.restore();
}

function drawImageShape(context, shape) {
  const { style = {}, live = {}, asset = {} } = shape;
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
  context.font = `16px ${getFontStack("Inter")}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("Image", 0, 0);
  };

  if (asset.image instanceof Image && asset.image.complete) {
    try {
      context.drawImage(asset.image, -width / 2, -height / 2, width, height);
    } catch (error) {
      drawFallback();
    }
  } else {
    drawFallback();
  }

  context.restore();
}

function drawCircleShape(context, shape) {
  const { style, live } = shape;
  const center = getShapeCenter(shape);
  const rotation = live.rotation || 0;
  const radius = Math.max(live.width, live.height) / 2;

  context.save();
  context.translate(center.x, center.y);
  context.rotate(rotation);
  context.fillStyle = style.fill;
  context.strokeStyle = style.stroke;
  context.lineWidth = style.strokeWidth;
  context.lineCap = "round";
  context.lineJoin = "round";

  const drawPath = () => {
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
  };

  drawPath();
  context.fill();
  if (style.strokeWidth > 0) {
    if (style.sketchLevel > 0) {
      drawSketchStroke(context, drawPath, shape, style.sketchLevel);
    } else {
      context.stroke();
    }
  }

  context.restore();
}

function drawLineShape(context, shape) {
  const { style, live } = shape;
  if (!live.start || !live.end) return;
  context.save();
  context.strokeStyle = style.stroke;
  context.lineWidth = style.strokeWidth;
  context.lineCap = "round";
  context.lineJoin = "round";

  const drawPath = () => {
    context.beginPath();
    context.moveTo(live.start.x, live.start.y);
    context.lineTo(live.end.x, live.end.y);
  };

  if (style.sketchLevel > 0 && style.strokeWidth > 0) {
    drawSketchStroke(context, drawPath, shape, style.sketchLevel);
  } else {
    drawPath();
    context.stroke();
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
    drawSketchStroke(context, drawPath, shape, style.sketchLevel);
  } else {
    drawPath();
    context.stroke();
  }

  context.restore();
}

function drawTextShape(context, shape) {
  if (!shape || shape.type !== "text") return;
  const { style, live } = shape;
  if (!live) return;
  const text = typeof live.text === "string" ? live.text : "";
  const lines = text.split(/\r?\n/);
  const fontSize = Math.max(6, Number(style.fontSize) || state.style.fontSize || 32);
  const fontFamily = style.fontFamily || state.style.fontFamily || "Inter";
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

  lines.forEach((line, index) => {
    const safeLine = line.length === 0 ? " " : line;
    context.fillText(safeLine, startX, startY + index * lineHeight);
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

  context.save();
  context.fillStyle = style.stroke;
  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(leftX, leftY);
  context.lineTo(rightX, rightY);
  context.closePath();
  context.fill();
  context.restore();
}

function drawSelectionBounds(context) {
  if (!state.selection) return;
  const pointerMode = state.pointer?.mode;
  if (pointerMode === "creating" || pointerMode === "drawing-free") {
    return;
  }
  const shape = state.selection;
  if (shape.isVisible === false) return;

  context.save();
  context.setLineDash([6, 4]);
  context.strokeStyle = "#ffffff";
  context.lineWidth = 1;

  if (shape.type === "line" || shape.type === "arrow") {
    context.beginPath();
    context.moveTo(shape.live.start.x, shape.live.start.y);
    context.lineTo(shape.live.end.x, shape.live.end.y);
    context.stroke();
    drawLineEndpointHandle(context, shape.live.start);
    drawLineEndpointHandle(context, shape.live.end);
  } else if (shape.type === "free") {
    const bounds = getShapeBounds(shape);
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    drawResizeHandle(context, bounds.x + bounds.width, bounds.y + bounds.height);
  } else {
    const center = getShapeCenter(shape);
    const rotation = shape.live.rotation || 0;
    context.save();
    context.translate(center.x, center.y);
    context.rotate(rotation);
    context.strokeRect(-shape.live.width / 2, -shape.live.height / 2, shape.live.width, shape.live.height);
    context.restore();
    const handle = getRectResizeHandlePosition(shape);
    drawResizeHandle(context, handle.x, handle.y);
  }

  const rotationHandle = getRotationHandlePosition(shape);
  if (rotationHandle) {
    context.setLineDash([]);
    context.strokeStyle = "rgba(255, 255, 255, 0.6)";
    if (rotationHandle.anchor) {
      context.beginPath();
      context.moveTo(rotationHandle.anchor.x, rotationHandle.anchor.y);
      context.lineTo(rotationHandle.position.x, rotationHandle.position.y);
      context.stroke();
    }
    drawRotationHandle(context, rotationHandle.position);
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

function handlePointerDown(event) {
  closeAllContextMenus();

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

  let handleTarget = null;
  let shape = null;

  if (state.selection) {
    const selected = state.selection;
    const rotateHandle = detectRotateHandle(selected, point);
    const resizeHandle = detectResizeHandle(selected, point);
    const lineHandle = detectLineEndpointHandle(selected, point);
    if (rotateHandle || resizeHandle || lineHandle) {
      shape = selected;
      handleTarget = rotateHandle || resizeHandle || lineHandle;
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
    const allowMulti = state.tool === "select" && (event.shiftKey || event.metaKey || event.ctrlKey);

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

    const lineHandle = handleTarget && (handleTarget === "start" || handleTarget === "end")
      ? handleTarget
      : detectLineEndpointHandle(shape, point);
    if (lineHandle) {
      state.pointer.mode = lineHandle === "start" ? "resizing-line-start" : "resizing-line-end";
      state.pointer.startSnapshot = cloneSnapshot(shape.live);
      if (state.selectedIds.size > 1) {
        state.pointer.multiSnapshot = new Map();
        state.selectedIds.forEach((id) => {
          const target = state.shapes.find((entry) => entry.id === id);
          if (!target) return;
          state.pointer.multiSnapshot.set(id, cloneSnapshot(target.live));
        });
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
    if (state.selectedIds.size > 1) {
      state.pointer.multiSnapshot = new Map();
      state.selectedIds.forEach((id) => {
        const target = state.shapes.find((entry) => entry.id === id);
        if (!target) return;
        state.pointer.multiSnapshot.set(id, cloneSnapshot(target.live));
      });
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
    state.pointer.marqueeAppend = Boolean(event.shiftKey || event.metaKey || event.ctrlKey);
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
        resizeShape(state.selection, point);
        break;
      case "rotating":
        rotateShape(state.selection, point);
        break;
      case "resizing-line-start":
      case "resizing-line-end":
        resizeLineEndpoint(state.selection, point, state.pointer.mode);
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
  state.pointer.marquee = null;
  state.pointer.marqueeAppend = false;
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
  ].includes(pointerMode)) {
    if (pointerMode === "moving" && state.pointer.multiSnapshot && state.pointer.multiSnapshot.size > 0) {
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
  shape.style.fontFamily = shape.style.fontFamily || state.style.fontFamily || "Inter";
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
  const fontFamily = style.fontFamily || state.style.fontFamily || "Inter";
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

  editor.style.fontFamily = getFontStack(shape.style.fontFamily || state.style.fontFamily || "Inter");
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
  active.element.style.fontFamily = getFontStack(shape.style.fontFamily || state.style.fontFamily || "Inter");
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
  } else if (shape.type === "rectangle" || shape.type === "square" || shape.type === "circle" || shape.type === "image") {
    resizeRectangularShape(shape, point, start);
  } else if (shape.type === "free") {
    resizeFreeformShape(shape, point, start);
  } else if (shape.type === "image") {
    resizeRectangularShape(shape, point, start);
  }
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

function resizeLineEndpoint(shape, point, mode) {
  if (!shape) return;
  markHistoryChanged();
  if (mode === "resizing-line-start") {
    shape.live.start = { x: point.x, y: point.y };
  } else {
    shape.live.end = { x: point.x, y: point.y };
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

  if (shape.type === "rectangle" || shape.type === "square" || shape.type === "circle" || shape.type === "text") {
    shape.live.rotation = normalizeAngle(baseRotation + delta);
    shape.live.width = snapshot.width;
    shape.live.height = snapshot.height;
    shape.live.x = center.x - snapshot.width / 2;
    shape.live.y = center.y - snapshot.height / 2;
    shape.style.rotation = radiansToDegrees(shape.live.rotation);
  } else if (shape.type === "line" || shape.type === "arrow") {
    shape.live.start = rotatePoint(snapshot.start, center, delta);
    shape.live.end = rotatePoint(snapshot.end, center, delta);
  } else if (shape.type === "free") {
    shape.live.points = snapshot.points.map((pt) => rotatePoint(pt, center, delta));
  }
}

function detectLineEndpointHandle(shape, point) {
  if (shape.type !== "line" && shape.type !== "arrow") return null;
  const radius = Math.max(12, (shape.style?.strokeWidth || 1) + 6);
  if (distance(point, shape.live.start) <= radius) return "start";
  if (distance(point, shape.live.end) <= radius) return "end";
  return null;
}

function detectResizeHandle(shape, point) {
  const size = 12;
  if (shape.type === "rectangle" || shape.type === "square" || shape.type === "circle" || shape.type === "image" || shape.type === "text") {
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
  const offset = 36;

  if (shape.type === "rectangle" || shape.type === "square" || shape.type === "circle" || shape.type === "text") {
    const rotation = shape.live.rotation || 0;
    const halfHeight = shape.live.height / 2;
    const anchorVec = rotateVector({ x: 0, y: -halfHeight }, rotation);
    const handleVec = rotateVector({ x: 0, y: -(halfHeight + offset) }, rotation);
    return {
      position: { x: center.x + handleVec.x, y: center.y + handleVec.y },
      anchor: { x: center.x + anchorVec.x, y: center.y + anchorVec.y },
      center,
      bounds: { x: shape.live.x, y: shape.live.y, width: shape.live.width, height: shape.live.height },
    };
  }

  if (shape.type === "line" || shape.type === "arrow") {
    const angle = Math.atan2(shape.live.end.y - shape.live.start.y, shape.live.end.x - shape.live.start.x);
    const normal = angle - Math.PI / 2;
    const position = {
      x: center.x + Math.cos(normal) * offset,
      y: center.y + Math.sin(normal) * offset,
    };
    return {
      position,
      anchor: center,
      center,
      bounds: getShapeBounds(shape),
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
  const baseStyle = {
    fill: state.style.fill,
    stroke: state.style.stroke,
    strokeWidth: state.style.strokeWidth,
    sketchLevel: state.style.sketchLevel || 0,
    arrowStart: Boolean(state.style.arrowStart),
    arrowEnd: state.style.arrowEnd !== undefined ? Boolean(state.style.arrowEnd) : true,
    opacity: state.style.opacity ?? 1,
    fontFamily: state.style.fontFamily || "Inter",
    fontSize: Number(state.style.fontSize) || 32,
    rotation: state.style.rotation || 0,
  };

  const shape = {
    id: shapeIdCounter++,
    type,
    style: { ...baseStyle },
    live: {},
    keyframes: [],
    birthTime: state.timeline.current,
    isVisible: true,
  };

  switch (type) {
    case "rectangle":
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
      shape.style.fontFamily = state.style.fontFamily || "Inter";
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
    case "text": {
      const center = getShapeCenter(shape);
      const rotation = shape.live.rotation || 0;
      const local = toLocalPoint(point, center, rotation);
      return (
        Math.abs(local.x) <= shape.live.width / 2 && Math.abs(local.y) <= shape.live.height / 2
      );
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
      const closeness = distanceToSegment(point, shape.live.start, shape.live.end);
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
  } else if (primaryId && state.selectedIds.has(primaryId)) {
    state.selection = list.find((shape) => shape.id === primaryId) || null;
  } else {
    state.selection = list[list.length - 1] || null;
  }

  if (state.selection && state.selectedIds.size === 1) {
    const selectedTime = state.timeline.selectedKeyframeTime;
    if (typeof selectedTime === "number") {
      const match = state.selection.keyframes.some((keyframe) => Math.abs(keyframe.time - selectedTime) < KEYFRAME_EPSILON);
      if (!match) {
        state.timeline.selectedKeyframeTime = null;
      }
    }
  } else {
    state.timeline.selectedKeyframeTime = null;
  }

  setActiveGroupId(resolveSelectedGroupId());
  refreshSelectionUI();
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
    if (elements.keyframeList) {
      elements.keyframeList.innerHTML = "";
    }
    renderTimelineTrackMarkers();
  } else if (selectionSize === 1) {
    if (elements.selectionLabel) {
      elements.selectionLabel.textContent = `${capitalize(state.selection.type)} selected (#${state.selection.id})`;
    }
    renderKeyframeList();
  } else {
    if (elements.selectionLabel) {
      elements.selectionLabel.textContent = `${selectionSize} shapes selected`;
    }
    if (elements.keyframeList) {
      elements.keyframeList.innerHTML = "";
    }
    renderTimelineTrackMarkers();
  }

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
  resetPointerInteraction();
  state.pointer.down = false;
  refreshSelectionUI();
  return true;
}

function handleGlobalKeyDown(event) {
  if (event.defaultPrevented) return;

  const activeElement = document.activeElement;
  const tagName = activeElement?.tagName;
  const isEditable = Boolean(activeElement?.isContentEditable);
  const isTextInput = isEditable || tagName === "INPUT" || tagName === "TEXTAREA";
  const key = typeof event.key === "string" ? event.key.toLowerCase() : event.key;

  if (!event.shiftKey && (event.ctrlKey || event.metaKey) && key === "z") {
    if (isTextInput) {
      return;
    }
    if (undoLastAction()) {
      event.preventDefault();
    }
    return;
  }

  if (event.key === "Escape") {
    if (closeAllContextMenus()) {
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

function renderKeyframeList() {
  const container = elements.keyframeList;
  if (!container) return;
  container.innerHTML = "";
  if (!state.selection || state.selectedIds.size !== 1) {
    renderTimelineTrackMarkers();
    syncKeyframeSelectionUI();
    return;
  }
  state.selection.keyframes
    .slice()
    .sort((a, b) => a.time - b.time)
    .forEach((keyframe) => {
      const safeTime = clampTimelineTime(keyframe.time, 0);
  keyframe.time = safeTime;
      const chip = document.createElement("div");
      chip.className = "keyframe-chip";
      chip.setAttribute("role", "button");
      chip.setAttribute("tabindex", "0");
      chip.setAttribute("data-keyframe-time", safeTime.toString());
      chip.setAttribute("aria-selected", "false");
      const label = document.createElement("span");
      label.textContent = `${safeTime.toFixed(1)}s`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.setAttribute("aria-label", `Delete keyframe at ${safeTime.toFixed(1)} seconds`);
  remove.setAttribute("title", "Remove this keyframe");
      remove.textContent = "×";
      remove.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setSelectedKeyframeTime(safeTime);
        deleteKeyframe(state.selection, safeTime);
      });
      chip.addEventListener("click", () => {
        setSelectedKeyframeTime(safeTime);
        setTimelineTime(safeTime, { apply: true });
      });
      chip.addEventListener("focus", () => {
        setSelectedKeyframeTime(safeTime);
      });
      chip.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          if (!state.selection || state.selectedIds.size !== 1) return;
          const step = event.shiftKey ? 1 : 0.1;
          const direction = event.key === "ArrowLeft" ? -1 : 1;
          const candidate = safeTime + direction * step;
          const nextTime = clampTimelineTime(Number(candidate.toFixed(3)), safeTime);
          if (moveKeyframe(state.selection, safeTime, nextTime)) {
            setSelectedKeyframeTime(nextTime, { focus: true });
            setTimelineTime(nextTime, { apply: true });
          }
        } else if (event.key === "Home") {
          event.preventDefault();
          if (!state.selection || state.selectedIds.size !== 1) return;
          if (moveKeyframe(state.selection, safeTime, 0)) {
            setSelectedKeyframeTime(0, { focus: true });
            setTimelineTime(0, { apply: true });
          }
        } else if (event.key === "End") {
          event.preventDefault();
          if (!state.selection || state.selectedIds.size !== 1) return;
          const duration = Number.isFinite(state.timeline.duration) && state.timeline.duration > 0 ? state.timeline.duration : safeTime;
          if (moveKeyframe(state.selection, safeTime, duration)) {
            setSelectedKeyframeTime(duration, { focus: true });
            setTimelineTime(duration, { apply: true });
          }
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setSelectedKeyframeTime(safeTime);
          setTimelineTime(safeTime, { apply: true });
        } else if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          setSelectedKeyframeTime(safeTime);
          deleteKeyframe(state.selection, safeTime);
        }
      });
      chip.append(label, remove);
      container.appendChild(chip);
    });
  syncKeyframeSelectionUI();
  renderTimelineTrackMarkers();
}

function deleteKeyframe(shape, time) {
  if (!shape) return;
  const removedSelected =
    typeof state.timeline.selectedKeyframeTime === "number" &&
    Math.abs(state.timeline.selectedKeyframeTime - time) < KEYFRAME_EPSILON;

  shape.keyframes = shape.keyframes.filter((keyframe) => Math.abs(keyframe.time - time) > KEYFRAME_EPSILON);
  normalizeShapeKeyframes(shape);

  if (removedSelected) {
    const sorted = shape.keyframes;
    const fallback = sorted.find((keyframe) => keyframe.time >= time - KEYFRAME_EPSILON) || sorted[sorted.length - 1] || null;
    state.timeline.selectedKeyframeTime = fallback ? fallback.time : null;
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

  if (state.selection && state.selectedIds.size === 1 && state.selection.id === shape.id) {
    state.timeline.selectedKeyframeTime = target;
  }

  if (apply) {
    applyTimelineState();
  }
  if (render) {
    renderKeyframeList();
  }
  return true;
}

function setSelectedKeyframeTime(time, { focus = false } = {}) {
  if (!state.selection || state.selectedIds.size !== 1) {
    state.timeline.selectedKeyframeTime = null;
    syncKeyframeSelectionUI();
    renderTimelineTrackMarkers();
    return;
  }

  const desiredTime = clampTimelineTime(time, 0);
  const target = state.selection.keyframes.find((keyframe) => Math.abs(keyframe.time - desiredTime) < KEYFRAME_EPSILON);
  state.timeline.selectedKeyframeTime = target ? target.time : null;
  syncKeyframeSelectionUI({ focus });
  renderTimelineTrackMarkers();
}

function syncKeyframeSelectionUI({ focus = false } = {}) {
  if (!elements.keyframeList) return;
  const selectedTime = state.timeline.selectedKeyframeTime;
  const chips = elements.keyframeList.querySelectorAll(".keyframe-chip");
  let focusTarget = null;

  chips.forEach((chip) => {
    const chipTime = Number(chip.getAttribute("data-keyframe-time"));
    const isSelected = typeof selectedTime === "number" && Math.abs(chipTime - selectedTime) < KEYFRAME_EPSILON;
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

  state.shapes.forEach((shape) => {
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
      if (state.selectedIds.has(shape.id) && selectedTime !== null && Math.abs(selectedTime - safeTime) < KEYFRAME_EPSILON) {
        marker.classList.add("selected");
      }
      marker.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!state.selectedIds.has(shape.id) || state.selectedIds.size !== 1) {
          updateSelection(shape);
        }
        setSelectedKeyframeTime(safeTime);
        setTimelineTime(safeTime, { apply: true });
      });
      marker.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (!state.selectedIds.has(shape.id) || state.selectedIds.size !== 1) {
            updateSelection(shape);
          }
          setSelectedKeyframeTime(safeTime, { focus: false });
          setTimelineTime(safeTime, { apply: true });
        } else if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          if (!state.selectedIds.has(shape.id) || state.selectedIds.size !== 1) {
            updateSelection(shape);
          }
          setSelectedKeyframeTime(safeTime);
          deleteKeyframe(shape, safeTime);
        }
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

  if (shape.type === "line" || shape.type === "arrow") {
    data.live = {
      start: { ...shape.live.start },
      end: { ...shape.live.end },
    };
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
  if (shape.type === "line" || shape.type === "arrow") {
    shape.live.start = { ...snapshot.live.start };
    shape.live.end = { ...snapshot.live.end };
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
  const result = {
    type: a.type,
    style: {
      fill: choose(a.style.fill, b.style.fill),
      stroke: choose(a.style.stroke, b.style.stroke),
      strokeWidth: interpolate(a.style.strokeWidth, b.style.strokeWidth),
      sketchLevel: Math.round(choose(a.style.sketchLevel ?? 0, b.style.sketchLevel ?? 0)),
      arrowStart: choose(Boolean(a.style.arrowStart), Boolean(b.style.arrowStart)),
      arrowEnd: choose(Boolean(a.style.arrowEnd ?? true), Boolean(b.style.arrowEnd ?? true)),
      fontFamily: choose(a.style.fontFamily ?? state.style.fontFamily ?? "Inter", b.style.fontFamily ?? state.style.fontFamily ?? "Inter"),
      fontSize: interpolate(Number(a.style.fontSize ?? state.style.fontSize ?? 32), Number(b.style.fontSize ?? state.style.fontSize ?? 32)),
      rotation: interpolate(a.style.rotation ?? 0, b.style.rotation ?? 0),
    },
  };

  if (a.type === "line" || a.type === "arrow") {
    result.live = {
      start: {
        x: interpolate(a.live.start.x, b.live.start.x),
        y: interpolate(a.live.start.y, b.live.start.y),
      },
      end: {
        x: interpolate(a.live.end.x, b.live.end.x),
        y: interpolate(a.live.end.y, b.live.end.y),
      },
    };
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

function syncSelectionInputs() {
  const useSelectionStyle = state.selection && state.selectedIds.size === 1;
  const styleSource = useSelectionStyle ? state.selection.style : state.style;
  if (elements.fillColor && typeof styleSource.fill === "string") {
    elements.fillColor.value = styleSource.fill;
  }
  if (elements.strokeColor && typeof styleSource.stroke === "string") {
    elements.strokeColor.value = styleSource.stroke;
  }
  updateSketchButtonStates(Number(styleSource.sketchLevel ?? 0));

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

  if (elements.fontFamily) {
    const fontValue = styleSource.fontFamily || state.style.fontFamily || "Inter";
    const options = Array.from(elements.fontFamily.options || []);
    const hasOption = options.some((option) => option.value === fontValue);
    elements.fontFamily.value = hasOption ? fontValue : "Inter";
  }
}

function updateSketchButtonStates(level) {
  if (!Array.isArray(elements.sketchButtons) || elements.sketchButtons.length === 0) {
    return;
  }
  elements.sketchButtons.forEach((button) => {
    const buttonLevel = Number(button.getAttribute("data-sketch-level")) || 0;
    button.setAttribute("aria-pressed", buttonLevel === level ? "true" : "false");
  });
}

function applySketchLevel(level) {
  const clamped = Number.isFinite(level) ? Math.max(0, Math.min(5, Math.round(level))) : 0;
  state.style.sketchLevel = clamped;
  updateSketchButtonStates(clamped);
  if (state.selection) {
    state.selection.style.sketchLevel = clamped;
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
  const passes = level === 1 ? 2 : 3;
  const jitter = level === 1 ? 1.5 : 3;
  const random = createSeededRandom(`${shape.id}:${level}`);
  for (let i = 0; i < passes; i += 1) {
    context.save();
    const offsetX = (random() - 0.5) * jitter;
    const offsetY = (random() - 0.5) * jitter;
    const angle = (random() - 0.5) * jitter * 0.05;
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

function getShapeBounds(shape) {
  if (shape.type === "free") {
    return getBoundsFromPoints(shape.live.points);
  }
  if (shape.type === "line" || shape.type === "arrow") {
    const minX = Math.min(shape.live.start.x, shape.live.end.x);
    const maxX = Math.max(shape.live.start.x, shape.live.end.x);
    const minY = Math.min(shape.live.start.y, shape.live.end.y);
    const maxY = Math.max(shape.live.start.y, shape.live.end.y);
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
  if (shape.type === "rectangle" || shape.type === "square" || shape.type === "circle" || shape.type === "text") {
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
      shape.style.fontFamily = shape.style.fontFamily || state.style.fontFamily || "Inter";
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
      updateTextMetrics(shape, { preserveOrigin: true });
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

  const offsetClipboard = () => {
    if (!state.clipboard) {
      state.clipboard = { items: [], offset: { x: 32, y: 32 } };
    }
    if (!state.clipboard.offset) {
      state.clipboard.offset = { x: 32, y: 32 };
    }
    const next = { x: state.clipboard.offset.x, y: state.clipboard.offset.y };
    state.clipboard.offset.x = Math.min(160, state.clipboard.offset.x + 16);
    state.clipboard.offset.y = Math.min(160, state.clipboard.offset.y + 16);
    if (state.clipboard.offset.x >= 160) state.clipboard.offset.x = 32;
    if (state.clipboard.offset.y >= 160) state.clipboard.offset.y = 32;
    return next;
  };

  const duplicateShape = (shape, delta) => {
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
      if (shape.type === "rectangle" || shape.type === "square" || shape.type === "circle" || shape.type === "image" || shape.type === "text") {
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
    getConnectorBendHandleClientPoint(targetId) {
      const shape = resolveShape(targetId);
      if (!shape || (shape.type !== "line" && shape.type !== "arrow")) return null;
      const start = shape.live?.start;
      const end = shape.live?.end;
      if (!start || !end) return null;
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
    copySelection() {
      const selected = getSelectedShapesList();
      if (selected.length === 0) return false;
      state.clipboard.items = selected.map((shape) => cloneShape(shape));
      state.clipboard.offset = { x: 32, y: 32 };
      return true;
    },
    pasteFromClipboard() {
      if (!state.clipboard || !Array.isArray(state.clipboard.items) || state.clipboard.items.length === 0) {
        return false;
      }
      pushHistorySnapshot("paste-from-clipboard");
      const delta = offsetClipboard();
      let last = null;
      state.clipboard.items.forEach((item) => {
        const clone = duplicateShape(item, delta);
        state.shapes.push(clone);
        ensureBaseKeyframe(clone, state.timeline.current);
  writeKeyframe(clone, state.timeline.current, { markSelected: false });
        last = clone;
      });
      if (last) {
        updateSelection(last);
      }
      return true;
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
      if (!src) return null;
      pushHistorySnapshot("create-image");
      const now = state.timeline.current;
      const shape = {
        id: shapeIdCounter++,
        type: "image",
        style: {
          fill: state.style.fill,
          stroke: state.style.stroke,
          strokeWidth: state.style.strokeWidth,
          sketchLevel: 0,
          opacity: state.style.opacity ?? 1,
          rotation: 0,
        },
        live: {
          x: state.stage.width / 2 - 96,
          y: state.stage.height / 2 - 96,
          width: 192,
          height: 192,
          rotation: 0,
        },
        keyframes: [],
        birthTime: now,
        isVisible: true,
        asset: {
          source: src,
          image: new Image(),
        },
      };

      shape.asset.image.addEventListener("load", () => {
        const img = shape.asset.image;
        const aspect = img && img.height !== 0 ? img.width / img.height : 1;
        const baseWidth = Math.min(state.stage.width * 0.4, Math.max(96, img.width));
        const width = baseWidth;
        const height = aspect !== 0 ? baseWidth / aspect : baseWidth;
        shape.live.width = width;
        shape.live.height = height;
        shape.live.x = state.stage.width / 2 - width / 2;
        shape.live.y = state.stage.height / 2 - height / 2;
  writeKeyframe(shape, state.timeline.current, { markSelected: false });
      });
      shape.asset.image.src = src;

      state.shapes.push(shape);
      ensureBaseKeyframe(shape, now);
  writeKeyframe(shape, now, { markSelected: false });
      updateSelection(shape);
      return cloneShape(shape);
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
