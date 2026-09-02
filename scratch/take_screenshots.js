const { chromium } = require('playwright');
const path = require('path');

async function capture() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const targets = [
    { url: 'https://prime-chic-studio.vercel.app/', file: 'prime-chic.png' },
    { url: 'https://handbag-website-woad.vercel.app/', file: 'handbag-website.png' },
    { url: 'https://cafe-olive-chi.vercel.app/', file: 'cafe-olive.png' }
  ];

  for (const t of targets) {
    console.log(`Navigating to ${t.url}...`);
    const page = await context.newPage();
    try {
      await page.goto(t.url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
      const dest = path.join(__dirname, '..', 'images', t.file);
      await page.screenshot({ path: dest, fullPage: false });
      console.log(`Saved screenshot to ${dest}`);
    } catch (e) {
      console.error(`Failed to capture ${t.url}:`, e);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log('Done!');
}

capture();
