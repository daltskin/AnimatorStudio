const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Clear localStorage first
  await page.goto('http://localhost:4173');
  await page.evaluate(() => {
    localStorage.clear();
    console.log('LocalStorage cleared');
  });
  
  // Reload the page
  await page.reload();
  await page.waitForLoadState('networkidle');
  
  // Check if tips panel exists
  const tipsPanel = await page.locator('[data-tips]').count();
  console.log('Tips panel count:', tipsPanel);
  
  if (tipsPanel > 0) {
    const tipsList = await page.locator('#tipsList').count();
    console.log('Tips list count:', tipsList);
    
    if (tipsList > 0) {
      const tipsContent = await page.locator('#tipsList').innerHTML();
      console.log('Tips content length:', tipsContent.length);
      
      const tipItems = await page.locator('.tip-item').count();
      console.log('Number of tip items:', tipItems);
    }
  }
  
  // Check if localStorage has any tips dismissed
  const dismissed = await page.evaluate(() => {
    return localStorage.getItem('animator.tips.dismissed.items');
  });
  console.log('Dismissed tips:', dismissed);
  
  await page.screenshot({ path: 'tips-debug.png' });
  console.log('Screenshot saved as tips-debug.png');
  
  await browser.close();
})();
