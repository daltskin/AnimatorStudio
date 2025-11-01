const { test, expect } = require('@playwright/test');
const { loadApp } = require('./utils');

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test.describe('SysML v2 Constraint Paste', () => {
  test('pasting SysML v2 constraint definitions with params creates an image shape', async ({ page }) => {
    await loadApp(page);

    const initialCount = await page.evaluate(() => window.animatorState.shapes.length);

    const sysmlCode = `
package kettle::analysis {
    import sysml::*;
    import kettle::structure::*;

    constraint def TimeToBoil {
        param m: Real;
        param cp: Real = 4185.0;
        param dT: Real;
        param P: Real;
        param eta: Real = 0.85;
        result t: Real;

        eq t = (m * cp * dT) / (P * eta);
    }

    constraint def MaxTempMargin {
        param Tmax: Real = 105.0;
        param safetyMargin: Real = 5.0;
        result limit: Real;
        eq limit = Tmax + safetyMargin;
    }

    binding def KettleBoilBinding {
        bind TimeToBoil.m   = 1.0;
        bind TimeToBoil.dT  = 80.0;
        bind TimeToBoil.P   = kettle::structure::Heater.ratedPower;
    }
}
`;

    await page.evaluate((code) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', code);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(pasteEvent);
    }, sysmlCode);

    await page.waitForTimeout(3000);

    const finalCount = await page.evaluate(() => window.animatorState.shapes.length);
    expect(finalCount).toBe(initialCount + 1);

    const newShape = await page.evaluate(() => {
      const shapes = window.animatorState.shapes;
      return shapes[shapes.length - 1];
    });

    expect(newShape.type).toBe('image');
    expect(newShape.asset.source).toMatch(/^data:image/);
  });
});
