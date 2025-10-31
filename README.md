# Animator Studio

Animator Studio is a lightweight web app for building presentation-friendly motion graphics right inside the browser. Drag shapes onto the stage, wire them up with animated connectors, then bring everything to life on a tactile timeline.

# Demo

Have a play with it [here](https://animatorstudio.gentlebay-3289cfef.westus2.azurecontainerapps.io/), either start something new, or load one of the samples in this repo.

## ✨ Feature Highlights

- **Rich shape library:** Rectangle, square, circle, arrow, straight line, and free-draw pen.
- **Direct manipulation:** Click to place shapes, drag to reposition, and pull the golden handle to resize (with live aspect locking for squares and radius control for circles).
- **Instant selection:** Newly drawn shapes auto-select so you can tweak styling or keyframes without swapping tools.
- **Precision stacking:** Only the active selection responds to move, resize, and rotate handles, preventing stray edits to shapes tucked above or below.
- **Smart styling controls:** Update fill, stroke, stroke width, and sketchiness on the fly; selections keep the sidebar controls in sync.
- **Expanded typography:** Pick from a broader mix of handwriting, freestyle, display, and serif fonts—no more grouped options.
- **Animated connectors:** Arrow and Line tools stay editable, exposing bend + arrowhead toggles for fast callouts.
- **Stage colour control:** Right-click the canvas to open the stage context menu, pick a background colour, or reset to the default—settings persist between sessions and export with the scene.
- **Grouping that sticks:** Combine shapes, move them as a unit, and ungroup when you need to iterate; marquee selection respects grouped clusters.
- **Mermaid diagram support:** Paste Mermaid diagram syntax (flowcharts, sequence diagrams, class diagrams, etc.) and it auto-renders as a high-quality image shape ready for animation.
- **Timeline-first workflow:** Scrub or type the duration, drop keyframes per shape, and play back loops or bounce animations with one click.
- **Scene + GIF export:** Download JSON snapshots for round-tripping or capture animated GIFs directly from the timeline.

## 🚀 Getting Started

1. Clone or download the repository.
2. Open `index.html` in any modern browser (Chrome, Edge, Firefox, or Safari). No build tooling is required.

> Tip: For best fidelity, serve the folder with a simple static server (e.g., `python -m http.server`) so fonts and downloads behave consistently.

### Developing in a Dev Container

If you're using VS Code with the Dev Containers extension (or GitHub Codespaces), this repository includes a ready-to-go setup:

1. Open the command palette and choose **Dev Containers: Reopen in Container**.
2. The container installs Node.js 20, Python 3.12, and the `http-server` CLI for quick previews.
3. Once the container is running, start a preview server with:

   ```bash
   http-server . -c-1
   ```

   Port 8080 is auto-forwarded so the canvas UI loads instantly in your browser.

## 🧭 Canvas & Tooling Basics

1. Pick a tool from the left toolbar. The Select tool is active by default.
2. Click on the stage to place the chosen shape, then drag while holding the mouse button to size it (for free draw, just sketch!).
3. Use the selection bounding box to reposition (drag inside) or resize (grab the golden corner handle). Rotation handles appear once a shape is selected.
4. Adjust fill, stroke, stroke width, sketchiness, arrowheads, and line endings from the Appearance panel; changes apply to the current selection and future shapes.
5. Delete removes the active shape; Export Scene downloads a JSON description of every shape and its keyframes. Export GIF records the current animation.

### Grouping & Marquee Selection

- Drag a marquee with the Select tool to capture shapes entirely inside the region.
- Use the **Group** button to keep selected items locked together; **Ungroup** returns them to individual control.
- Group membership is preserved across duplicates, imports, exports, and timeline edits.

### Arrow & Line Tools

- **Arrow tool:** Drag from a start to an end point; toggle arrowheads via the toolbar buttons or stage context controls.
- **Line tool:** Straight segments without arrowheads—ideal for dividers. Lines can adopt arrowheads and bends using the same controls.

### Stage Context Menu

- Right-click the stage to open the context menu for background colour selection and quick reset.
- Stage dimensions can be resized from the lower-right handle; the readout updates live and persists between sessions.

## 🎬 Working with the Timeline

1. Move the scrubber using the slider or by clicking keyframe chips—time updates instantly.
2. With a shape selected, press **Add keyframe** to store the current pose at the active timestamp.
3. Reposition, recolour, or resize the shape to update that keyframe automatically; keyframes are clamped safely inside the timeline duration.
4. Hit **Play** to preview in real time; enable **Loop** or **Bounce** to experiment with repeating motion. **Stop** returns to the 0-second mark.
5. Duration (1–120 seconds) is editable; shortening the timeline keeps keyframes in range. Keyboard shortcuts adjust the duration field quickly.

Keyframe chips mirror onto the timeline track as glowing markers, so you always know where changes happen. Clicking a chip or marker location scrubs right to that instant, and keyboard navigation works for retiming and deletion.

## 📦 Export Format

Choosing **Export Scene** downloads `animator-scene-<timestamp>.json` with:

- Global timeline duration
- Every shape’s live geometry and styling
- Individual keyframe snapshots (time + full state)
- Stage metadata (dimensions, background colour)
- Group membership so collaborative layouts stay intact

This makes it easy to archive work, hand off to teammates, or build a future importer.

To capture animated GIFs, switch to the desired timeline range, click **Export GIF**, and follow the prompts. The GIF encoder samples the current stage background colour and respects loop/bounce settings.

## 🎨 Sample Scenes

Reusable demos live under `samples/` so you can import them from the toolbar’s scene picker:

## ✅ Testing

The project ships with Playwright end-to-end specs that cover the canvas, timeline, context menus, and export flows.

```bash
npm install
npx playwright install
npm test
```

> Tip: `npx playwright test --ui` launches the interactive runner if you prefer exploratory debugging.

## 📄 Licensing

- Animator Studio is released under the [MIT License](LICENSE).
- The bundled **Excalifont** typeface is © Excalidraw and provided under the [OFL-1.1 License](https://plus.excalidraw.com/excalifont).

# Future roadmap

- Add more samples, using layered shapes to create depth in the scene including:
  - Running man through a park with trees and benches in the background on a sunny day
  - Moving cars (different types) along a motorway becoming stuck in a traffic jam
  - A festive winter scene with snow falling

Enjoy crafting motion stories! If you spot a bug or have a feature suggestion, feel free to open an issue or send a PR.
