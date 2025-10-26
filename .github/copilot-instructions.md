# Animator Studio · Copilot Instructions

## Project snapshot

- **Tech stack:** Vanilla JavaScript single-page app (`index.html`, `app.js`, modules under `modules/`), Canvas rendering, Playwright end-to-end regression tests. Node 20+ toolchain with `npm` scripts.
- **Entry points:** `index.html` bootstraps the UI, `app.js` houses event handling, timeline logic, export/import, and text editing. Helper modules live in `modules/` (state management, rendering, math, DOM bindings).
- **State model:** Central `state` object in `modules/state.js` tracks shapes, selection, pointer, timeline, and clipboard. Mutations should go through existing helpers (`updateSelection`, `ensureBaseKeyframe`, `writeKeyframe`, etc.) to keep UI, timeline, and exports in sync.

## Development conventions

- **Preserve keyframe integrity.** Whenever shapes are duplicated, imported, or mutated, ensure keyframes remain normalized (`normalizeShapeKeyframes`) and include base snapshots via `ensureBaseKeyframe`.
- **Selection lifecycle matters.** `updateSelection` drives UI refresh (`refreshSelectionUI`) and timeline markers. Do not mutate `state.selectedIds` directly.
- **Text editing flow:** Inline editor is managed via `startTextEditing` / `finalizeActiveTextEditor`. Always call `updateTextMetrics` after changing text or font sizing so bounds, handles, and exports stay accurate.
- **Rendering helpers:** Use utilities in `modules/rendering.js` (e.g., `hitResizeHandle`, `drawRotationHandle`) instead of re-implementing hit-tests or drawing logic.
- **Timeline operations:** Use `setTimelineTime`, `setTimelineDuration`, `writeKeyframe`, and `renderKeyframeList` helpers; avoid manual DOM manipulation of timeline markers.
- **Exports/imports:** `buildSceneExportPayload` and `applyImportedScene` own serialization. Keep filenames timestamped via `formatExportTimestamp`. Clipboard serialization shares the same normalization pipeline.
- **Stage boundaries:** All shapes (live data and keyframe snapshots) must stay inside the stage rectangle. Use the existing confinement helpers (e.g. `confineShapesToStage`, `confineSnapshotToStage`) whenever importing scenes, pasting shapes, or altering stage dimensions so nothing renders outside the canvas.
- **Stage sizing & auto-fit:** Keep the visible canvas anchored with a 10px wrapper margin. When adjusting default sizing or resize flows, rely on `ensureStageFitsWrapper`, the `state.stage.autoFit` flag, and `applyStageSize` instead of direct style tweaks so manual resizes stay respected.
- **Line tool controls:** The line tool exposes arrowhead modes via the `[data-arrow-mode]` radiogroup and a dedicated bend slider that only appears while the line tool is active. Reuse `setLineArrowMode`, `updateLineArrowControls`, and `updateLineBendVisibility` when tweaking those flows so selection state and defaults stay in sync.
- **Stage boundaries:** All shapes (live data and keyframe snapshots) must stay inside the stage rectangle. Use the existing confinement helpers (e.g. `confineShapesToStage`, `confineSnapshotToStage`) whenever importing scenes, pasting shapes, or altering stage dimensions so nothing renders outside the canvas.
- **Styling:** Global styles live in `styles.css`. Disabled buttons rely on the `.disabled` class and native `[disabled]` selector; keep Add Keyframe UX consistent.

## Testing & verification

1. **Install deps** (first run):
   ```bash
   npm install
   npx playwright install
   ```
2. **Primary regression suite:**
   ```bash
   npx playwright test
   ```
3. **Targeted runs:**
   - `npx playwright test tests/text.handles.spec.js`
   - `npx playwright test --grep "text"`
   - `npm test -- timeline` (or pass specific spec paths)
4. **CI equivalent:** `npm test` runs the full Playwright suite.
5. If touching Makefile recipes or Playwright config, re-run `npx playwright test` to ensure the web server hooks still succeed.

## Common workflows

- **Add shape behaviors:** Extend `createShape`, `updateTempShape`, and corresponding render helpers. Ensure connectors refresh via `updateAttachedConnectors` and keyframes write on commit.
- **Fix pointer interactions:** Check `handlePointerDown/Move/Up` in `app.js` and pointer state in `modules/state.js`. Honor pointer vs mouse compatibility (`isMouseCompatibilityEvent`). Update tests under `tests/handles.*.spec.js`.
- **Update exports/imports:** Modify `buildSceneExportPayload`, `applyImportedScene`, and related tests (`tests/export.scene.spec.js`, `tests/import.spec.js`). Ensure selection auto-hydrates after import to refresh timeline markers.
- **Timeline tweaks:** Adjust helpers near `renderKeyframeList`, `renderTimelineTrackMarkers`, and `timeline.spec.js`. Maintain loop/bounce behaviors.

## Regression guardrails

- Always add/adjust Playwright specs alongside behavioral changes. The repo relies on end-to-end tests instead of unit tests.
- When modifying selection or keyframe logic, add focused tests in `tests/text.handles.spec.js`, `tests/rectangle.handles.spec.js`, or create a new spec mirroring the scenario.
- Maintain clipboard interoperability—update both serialization (`serializeShapeForClipboard`) and deserialization (`deserializeShapeFromClipboard`) paths.
- Keep export filenames timestamped (`animator-YYYY-MM-DD_HH-MM-SS`). GIF and JSON exporters share the formatter.
- Touching stage sizing, canvas margin, or shape confinement logic? Re-run `npm test -- import` and `npm test -- export.gif` to confirm bounds and export dimensions stay locked in.

## Tooling tips

- Use the `Makefile` for convenience (`make test`, `make browsers`, `make serve`). Default shell for scripts is bash.
- Local dev server for manual poking: `npx http-server . -p 4173 -c-1` (Playwright reuses this port).
- Node emits a harmless `DEP0066` warning when running tests; no action required unless debugging HTTP headers.

## Performance & safety checks

- Canvas rendering assumes `requestAnimationFrame` loop started by `render()`. Ensure new async ops don’t block it.
- Clamp timeline durations and export FPS via provided helpers (`clampTimelineDuration`, `clampExportFps`).
- When adding animations, respect `MAX_EXPORT_FRAMES` and `MAX_TIMELINE_DURATION` constants.
- GIF capture must mirror on-screen canvas dimensions—route through `captureTimelineFrames` / `renderSceneToContext` with the correct pixel ratio instead of custom canvas scaling.

## Communication cues for Copilot

- Prefer small, targeted diffs—avoid sweeping reformatting of `app.js` (3K+ lines).
- Before altering shared helpers, scan for usages with grep or references; many functions have cross-cutting effects.
- If uncertain about expected behavior, inspect existing Playwright specs—they document user journeys closely.
- Summarize changes in plain language and map them to updated tests when responding to users.
