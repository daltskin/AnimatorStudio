const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");

const elements = {
  toolGrid: document.querySelector(".tool-grid"),
  canvasWrapper: document.querySelector(".canvas-wrapper"),
  floatingToolMenu: document.querySelector(".floating-tool-menu"),
  toolMenuToggle: document.querySelector("[data-tool-menu-toggle]"),
  stageShell: document.getElementById("stageShell"),
  stageDimensions: document.getElementById("stageDimensions"),
  stageResizeHandles: Array.from(document.querySelectorAll(".stage-resize-handle")),
  fillColor: document.getElementById("fillColor"),
  fillStyleButtons: Array.from(document.querySelectorAll("[data-fill-style]")),
  strokeColor: document.getElementById("strokeColor"),
  strokeWidth: document.getElementById("strokeWidth"),
  strokeWidthValue: document.getElementById("strokeWidthValue"),
  strokeStyleButtons: Array.from(document.querySelectorAll("[data-stroke-style]")),
  edgeStyleButtons: Array.from(document.querySelectorAll("[data-edge-style]")),
  sloppinessButtons: Array.from(document.querySelectorAll("[data-sloppiness]")),
  opacity: document.getElementById("opacity"),
  opacityValue: document.getElementById("opacityValue"),
  fontFamily: document.getElementById("fontFamily"),
  selectionLabel: document.getElementById("selectionLabel"),
  actionGroup: document.querySelector(".action-group"),
  deleteShape: document.getElementById("deleteShape"),
  lineArrowButtons: Array.from(document.querySelectorAll("[data-arrow-mode]")),
  lineArrowControl: document.querySelector('[data-control="line-arrowheads"]'),
  groupShapes: document.getElementById("groupShapes"),
  ungroupShapes: document.getElementById("ungroupShapes"),
  clearCanvas: document.getElementById("clearCanvas"),
  copyShapes: document.getElementById("copyShapes"),
  pasteShapes: document.getElementById("pasteShapes"),
  tipsPanel: document.getElementById("tipsPanel"),
  tipContent: document.getElementById("tipContent"),
  tipReadToggle: document.getElementById("tipReadToggle"),
  dismissTip: document.getElementById("dismissTip"),
  showNextTip: document.getElementById("showNextTip"),
  tipsEmpty: document.getElementById("tipsEmpty"),
  tipsSourceItems: Array.from(document.querySelectorAll(".tips-source [data-tip-id]")),
  timelineRange: document.getElementById("timelineRange"),
  currentTime: document.getElementById("currentTime"),
  timelineDuration: document.getElementById("timelineDuration"),
  playToggle: document.getElementById("playToggle"),
  stopPlayback: document.getElementById("stopPlayback"),
  loopToggle: document.getElementById("loopToggle"),
  loopToggleLabel: document.querySelector('label[for="loopToggle"]'),
  loopToggleState: document.querySelector('label[for="loopToggle"] .toggle-checkbox__state'),
  bounceToggle: document.getElementById("bounceToggle"),
  bounceToggleLabel: document.querySelector('label[for="bounceToggle"]'),
  bounceToggleState: document.querySelector('label[for="bounceToggle"] .toggle-checkbox__state'),
  addKeyframe: document.getElementById("addKeyframe"),
  exportFps: document.getElementById("exportFps"),
  keyframeList: document.getElementById("keyframeList"),
  timelineTrack: document.getElementById("timelineTrack"),
  importScene: document.getElementById("importScene"),
  exportScene: document.getElementById("exportScene"),
  exportGif: document.getElementById("exportGif"),
  exportStatus: document.getElementById("exportStatus"),
  importSceneInput: document.getElementById("importSceneInput"),
};

function getToolButtons() {
  return Array.from(document.querySelectorAll(".tool-button[data-tool]"));
}

const defaultTool = (() => {
  const buttons = getToolButtons();
  if (buttons.length === 0) return "select";
  const active = buttons.find((button) => button.classList.contains("selected")) || buttons[0];
  return active?.dataset?.tool || "select";
})();

function getInitialOption(buttons, dataKey, fallback) {
  if (!Array.isArray(buttons) || buttons.length === 0) return fallback;
  const preferred = buttons.find((button) => button.classList.contains("selected"));
  const candidate = preferred || buttons[0];
  const value = candidate?.dataset?.[dataKey];
  return value || fallback;
}

function selectButtonGroup(buttons, value, dataKey) {
  if (!Array.isArray(buttons)) return;
  buttons.forEach((button) => {
    const isSelected = button?.dataset?.[dataKey] === value;
    button.classList.toggle("selected", isSelected);
    if (button) {
      button.setAttribute("aria-pressed", String(isSelected));
    }
  });
}

function bindOptionGroup(buttons, dataKey, handler) {
  if (!Array.isArray(buttons) || typeof handler !== "function") return;
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const value = button?.dataset?.[dataKey];
      if (!value) return;
      selectButtonGroup(buttons, value, dataKey);
      handler(value);
    });
  });
}

export {
  canvas,
  ctx,
  elements,
  defaultTool,
  getToolButtons,
  getInitialOption,
  selectButtonGroup,
  bindOptionGroup,
};
