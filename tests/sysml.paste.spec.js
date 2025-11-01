const { test, expect } = require('@playwright/test');
const { loadApp } = require('./utils');

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test.describe('SysML v2 Paste', () => {
  test('pasting SysML v2 part definition creates an image shape', async ({ page }) => {
    await loadApp(page);

    const initialCount = await page.evaluate(() => window.animatorState.shapes.length);

    const sysmlCode = `
part def Vehicle {
  part engine: Engine;
  part wheels: Wheel[4];
  attribute mass: Real;
  attribute color: String;
}

part def Engine {
  attribute power: Real;
  attribute fuelType: String;
}

part def Wheel {
  attribute diameter: Real;
  attribute pressure: Real;
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

  test('pasting SysML v2 requirement definition creates an image shape', async ({ page }) => {
    await loadApp(page);

    const initialCount = await page.evaluate(() => window.animatorState.shapes.length);

    const sysmlCode = `
requirement def PerformanceRequirement {
  attribute maxSpeed: Real;
  attribute acceleration: Real;
}

requirement def SafetyRequirement {
  attribute crashTestRating: String;
  attribute airbagCount: Integer;
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

  test('pasting SysML v2 connection definition creates an image shape', async ({ page }) => {
    await loadApp(page);

    const initialCount = await page.evaluate(() => window.animatorState.shapes.length);

    const sysmlCode = `
connection def PressureSeat {
		end [1] part bead : TireBead;
		end [1] part mountingRim : TireMountingRim;
	}
	
	part wheelHubAssembly : WheelHubAssembly {
		
		part wheel : WheelAssembly[1] {
			part t : Tire[1] {
				part bead : TireBead[2];			
			}
			part w: Wheel[1] {
				part rim : TireMountingRim[2];
				part mountingHoles : LugBoltMountingHole[5];
			}						
			connection : PressureSeat 
				connect bead references t.bead 
				to mountingRim references w.rim;		
		}
		
		part lugBoltJoints : LugBoltJoint[0..5];
		part hub : Hub[1] {
			part h : LugBoltThreadableHole[5];
		}
		connect [0..1] lugBoltJoints to [1] wheel.w.mountingHoles;
		connect [0..1] lugBoltJoints to [1] hub.h;
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

  test('pasting regular text does not trigger SysML rendering', async ({ page }) => {
    await loadApp(page);

    const initialCount = await page.evaluate(() => window.animatorState.shapes.length);

    const regularText = 'This is just regular text with no SysML v2 keywords';

    await page.evaluate((text) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', text);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(pasteEvent);
    }, regularText);

    await page.waitForTimeout(1000);

    const finalCount = await page.evaluate(() => window.animatorState.shapes.length);
    expect(finalCount).toBe(initialCount);
  });

  test('SysML v2 package with nested elements creates an image shape', async ({ page }) => {
    await loadApp(page);

    const initialCount = await page.evaluate(() => window.animatorState.shapes.length);

    const sysmlCode = `
package VehicleSystem {
  part def Vehicle {
    part engine: Engine;
    part transmission: Transmission;
  }
  
  part def Engine {
    attribute displacement: Real;
    port fuelIn: FuelPort;
    port powerOut: PowerPort;
  }
  
  part def Transmission {
    attribute gearRatio: Real[6];
    port powerIn: PowerPort;
    port driveOut: DrivePort;
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
