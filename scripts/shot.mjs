// Quick screenshot helper for development.
//   node scripts/shot.mjs <url> <out.png> [waitMs] [clicks]
// clicks: comma-separated "x:y@ms" in low-res coords (e.g. "160:120@500,160:120@900").
// Prints console errors and window.__mx.debug() as JSON.
import { createRequire } from 'node:module';
// Uses the globally pre-installed playwright (or a local one if present).
const { chromium } = createRequire(import.meta.url)('playwright');

const [url, out, wait = '1500', clicks = ''] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));
await page.goto(url);
const start = Date.now();
for (const c of clicks.split(',').filter(Boolean)) {
  const [xy, at] = c.split('@');
  const [x, y] = xy.split(':').map(Number);
  const delay = Number(at) - (Date.now() - start);
  if (delay > 0) await page.waitForTimeout(delay);
  const box = await page.locator('.stage').boundingBox();
  await page.mouse.click(box.x + (x / 320) * box.width, box.y + (y / 180) * box.height);
}
const rest = Number(wait) - (Date.now() - start);
if (rest > 0) await page.waitForTimeout(rest);
await page.screenshot({ path: out });
const dbg = await page.evaluate(() => window.__mx?.debug?.());
console.log(JSON.stringify(dbg));
if (errors.length) console.log(errors.join('\n'));
await browser.close();
