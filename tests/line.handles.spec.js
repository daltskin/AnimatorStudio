const { test, expect } = require('@playwright/test');
const {
	loadApp,
	setTool,
	drawLine,
	ensureSelectionCount,
	getSelectedShapeSnapshot,
	pointerDrag,
	getLineBendHandlePoint,
	stagePointToClient,
} = require('./utils');

test.describe('line bend handle', () => {
	test.beforeEach(async ({ page }) => {
		await loadApp(page);
		await setTool(page, 'line');
		await drawLine(page);
		await ensureSelectionCount(page, 1);
	});

	test('dragging the midpoint handle introduces a smooth bend', async ({ page }) => {
		let snapshot = await getSelectedShapeSnapshot(page);
		expect(snapshot?.live?.control).toBeUndefined();

		const handle = await getLineBendHandlePoint(page);
		expect(handle).not.toBeNull();

		await pointerDrag(page, handle.x, handle.y, handle.x, handle.y - 80, { steps: 12 });

		snapshot = await getSelectedShapeSnapshot(page);
		expect(snapshot?.live?.control).toBeDefined();
		const { start, end, control } = snapshot.live;
		expect(control).toBeDefined();
		const midY = (start.y + end.y) / 2;
		expect(control.y).toBeLessThan(midY);
	});

	test('returning the handle to center flattens the line', async ({ page }) => {
		let handle = await getLineBendHandlePoint(page);
		await pointerDrag(page, handle.x, handle.y, handle.x, handle.y - 70, { steps: 10 });

		let snapshot = await getSelectedShapeSnapshot(page);
		expect(snapshot?.live?.control).toBeDefined();

		const midStage = {
			x: (snapshot.live.start.x + snapshot.live.end.x) / 2,
			y: (snapshot.live.start.y + snapshot.live.end.y) / 2,
		};
		const midClient = await stagePointToClient(page, midStage);
		handle = await getLineBendHandlePoint(page);
		expect(midClient).not.toBeNull();
		expect(handle).not.toBeNull();

		await pointerDrag(page, handle.x, handle.y, midClient.x, midClient.y, { steps: 10 });

		snapshot = await getSelectedShapeSnapshot(page);
		expect(snapshot?.live).not.toHaveProperty('control');
	});
});
