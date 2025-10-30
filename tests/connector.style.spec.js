const { test, expect } = require('@playwright/test');
const { loadApp, setTool, drawLine, ensureSelectionCount, getSelectedShapeSnapshot } = require('./utils');

test.describe('connector styling controls', () => {
	async function primeStyleControls(page) {
		await page.click('[data-sketch-level="2"]');
		await page.click('[data-fill-style="hachure"]');
	}

	test('line tool ignores sketch, fill, and edge styling', async ({ page }) => {
		await loadApp(page);
		await primeStyleControls(page);

		await setTool(page, 'line');

		await expect(page.locator('#sketchControl .icon-toggle').first()).toBeDisabled();
		await expect(page.locator('#fillStyleControl .icon-toggle').first()).toBeDisabled();
		await expect(page.locator('#edgeStyleControl .icon-toggle').first()).toBeDisabled();

		await drawLine(page);
		await ensureSelectionCount(page, 1);

		const snapshot = await getSelectedShapeSnapshot(page);
		expect(snapshot?.type).toBe('line');
		expect(snapshot?.style?.sketchLevel).toBe(0);
		expect(snapshot?.style?.fillStyle).toBeUndefined();
		expect(snapshot?.style?.edgeStyle).toBeUndefined();
	});

	test('arrow tool ignores sketch, fill, and edge styling', async ({ page }) => {
		await loadApp(page);
		await primeStyleControls(page);

		await setTool(page, 'arrow');

		await expect(page.locator('#sketchControl .icon-toggle').first()).toBeDisabled();
		await expect(page.locator('#fillStyleControl .icon-toggle').first()).toBeDisabled();
		await expect(page.locator('#edgeStyleControl .icon-toggle').first()).toBeDisabled();

		await drawLine(page);
		await ensureSelectionCount(page, 1);

		const snapshot = await getSelectedShapeSnapshot(page);
		expect(snapshot?.type).toBe('arrow');
		expect(snapshot?.style?.sketchLevel).toBe(0);
		expect(snapshot?.style?.fillStyle).toBeUndefined();
		expect(snapshot?.style?.edgeStyle).toBeUndefined();
	});

	test('line tool applies selected stroke style', async ({ page }) => {
		await loadApp(page);

		const dashedButton = page.locator('[data-stroke-style="dashed"]');
		await dashedButton.click();
		await expect(dashedButton).toHaveAttribute('aria-pressed', 'true');

		await setTool(page, 'line');
		await expect(page.locator('#strokeStyleControl .icon-toggle').first()).toBeEnabled();

		await drawLine(page);
		await ensureSelectionCount(page, 1);

		await expect.poll(() => page.evaluate(() => window.animatorState.selection?.style?.strokeStyle)).toBe('dashed');

		const dottedButton = page.locator('[data-stroke-style="dotted"]');
		await dottedButton.click();
		await expect.poll(() => page.evaluate(() => window.animatorState.selection?.style?.strokeStyle)).toBe('dotted');

		const snapshot = await getSelectedShapeSnapshot(page);
		expect(snapshot?.style?.strokeStyle).toBe('dotted');

		const solidButton = page.locator('[data-stroke-style="solid"]');
		await solidButton.click();
		await expect.poll(() => page.evaluate(() => window.animatorState.selection?.style?.strokeStyle)).toBe('solid');
	});

	test('arrow tool applies selected stroke style', async ({ page }) => {
		await loadApp(page);

		const dottedButton = page.locator('[data-stroke-style="dotted"]');
		await dottedButton.click();
		await expect(dottedButton).toHaveAttribute('aria-pressed', 'true');

		await setTool(page, 'arrow');
		await expect(page.locator('#strokeStyleControl .icon-toggle').first()).toBeEnabled();

		await drawLine(page);
		await ensureSelectionCount(page, 1);

		await expect.poll(() => page.evaluate(() => window.animatorState.selection?.style?.strokeStyle)).toBe('dotted');

		const dashedButton = page.locator('[data-stroke-style="dashed"]');
		await dashedButton.click();
		await expect.poll(() => page.evaluate(() => window.animatorState.selection?.style?.strokeStyle)).toBe('dashed');

		const snapshot = await getSelectedShapeSnapshot(page);
		expect(snapshot?.style?.strokeStyle).toBe('dashed');

		const solidButton = page.locator('[data-stroke-style="solid"]');
		await solidButton.click();
		await expect.poll(() => page.evaluate(() => window.animatorState.selection?.style?.strokeStyle)).toBe('solid');
	});
});
