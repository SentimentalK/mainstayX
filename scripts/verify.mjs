// Acceptance checks in headless Chromium.
//   npm run build && npm run preview &   (or npm run dev, then pass http://localhost:4321)
//   node scripts/verify.mjs [baseUrl=http://localhost:4321] [soakSeconds=65]
// Writes screenshots + report.json to ./screenshots and exits non-zero on failure.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = (process.argv[2] ?? 'http://localhost:4321').replace(/\/$/, '');
const SOAK = Number(process.argv[3] ?? 65);
const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

const report = { base: BASE, checks: [], shots: [] };
let failed = 0;
const check = (name, ok, detail) => {
  report.checks.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ' + JSON.stringify(detail) : ''}`);
};

const browser = await chromium.launch({ args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] });

async function open(query, { storage = {}, countAudio = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(({ storage, countAudio }) => {
    if (!sessionStorage.getItem('__seeded')) {
      localStorage.clear();
      for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
      sessionStorage.setItem('__seeded', '1');
    }
    if (countAudio) {
      window.__audioCtxCount = 0;
      const Orig = window.AudioContext;
      window.AudioContext = class extends Orig {
        constructor(...a) { super(...a); window.__audioCtxCount++; }
      };
    }
  }, { storage, countAudio });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/' + query);
  await page.waitForFunction(() => window.__mx?.debug?.().frames > 2);
  return { ctx, page, errors };
}
const dbg = page => page.evaluate(() => window.__mx.debug());
async function clickStage(page, x, y) {
  const b = await page.locator('.stage').boundingBox();
  await page.mouse.click(b.x + (x / 320) * b.width, b.y + (y / 180) * b.height);
}
async function shot(page, name) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path });
  report.shots.push(path);
}
/** Wait until the fixed-step sim reaches t seconds (headless fps is low). */
async function simWait(page, seconds) {
  const t0 = (await dbg(page)).time;
  await page.waitForFunction(t => window.__mx.debug().time >= t, t0 + seconds, { timeout: 120_000, polling: 50 });
}

try {
  // 1. Door scene + knocking
  {
    const { ctx, page, errors } = await open('?scene=door&seed=1');
    await simWait(page, 1);
    await shot(page, 'door');
    await clickStage(page, 160, 120);
    await simWait(page, 0.15);
    await shot(page, 'door-knock1');
    await clickStage(page, 150, 110);
    await simWait(page, 0.1);
    await shot(page, 'door-knock2');
    const d = await dbg(page);
    check('door: knocking moves to KNOCK phase', d.phase === 'KNOCK', d.phase);
    check('door: no console errors', errors.length === 0, errors);
    await ctx.close();
  }

  // 2. Warp scene
  {
    const { ctx, page, errors } = await open('?scene=warp&seed=1');
    await simWait(page, 0.5);
    await shot(page, 'warp-zoom');
    await simWait(page, 0.9);
    await shot(page, 'warp-tunnel');
    await simWait(page, 3);
    const d = await dbg(page);
    check('warp: ends in WORLD', d.phase === 'WORLD', d.phase);
    check('warp: no console errors', errors.length === 0, errors);
    await ctx.close();
  }

  // 3. Full first visit: audio starts only after the click; full flow; revisit skips intro.
  {
    const { ctx, page, errors } = await open('?seed=7', { countAudio: true });
    await simWait(page, 0.5);
    let d = await dbg(page);
    check('first visit starts at DOOR', d.phase === 'DOOR', d.phase);
    check('no AudioContext before a user gesture', (await page.evaluate(() => window.__audioCtxCount)) === 0);
    for (let i = 0; i < 3; i++) { await clickStage(page, 160, 115); await simWait(page, 0.35); }
    check('AudioContext created after the first knock', (await page.evaluate(() => window.__audioCtxCount)) >= 1);
    d = await dbg(page);
    check('audio unlocked after knock', d.audio.unlocked === true, d.audio);
    await page.waitForFunction(() => window.__mx.debug().phase === 'GREET', null, { timeout: 60_000 });
    await simWait(page, 0.9);
    await shot(page, 'greet');
    await page.waitForFunction(() => window.__mx.debug().phase === 'WORLD', null, { timeout: 90_000 });
    check('full flow reaches WORLD', true);
    check('seen flag stored', (await page.evaluate(() => localStorage.getItem('mx.seenIntro'))) === '1');
    // mute
    await page.locator('button.mute').click();
    d = await dbg(page);
    check('mute button mutes', d.audio.muted === true && (await page.evaluate(() => localStorage.getItem('mx.muted'))) === '1', d.audio);
    await page.locator('button.mute').click();
    d = await dbg(page);
    check('mute button unmutes', d.audio.muted === false, d.audio);
    // revisit
    await page.reload();
    await page.waitForFunction(() => window.__mx?.debug?.().frames > 2);
    d = await dbg(page);
    check('revisit lands in WORLD', d.phase === 'WORLD', d.phase);
    check('replay button visible on revisit', await page.locator('button.replay').isVisible());
    check('skip button hidden in world', !(await page.locator('button.skip').isVisible()));
    await page.locator('button.replay').click();
    await simWait(page, 0.3);
    d = await dbg(page);
    check('replay goes back to DOOR', d.phase === 'DOOR', d.phase);
    check('skip button visible during intro', await page.locator('button.skip').isVisible());
    await page.keyboard.press('Escape');
    await simWait(page, 0.3);
    d = await dbg(page);
    check('Esc skips to WORLD', d.phase === 'WORLD', d.phase);
    check('flow: no console errors', errors.length === 0, errors);
    await ctx.close();
  }

  // 4. Reduced motion goes straight to the world
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(BASE + '/?seed=3');
    await page.waitForFunction(() => window.__mx?.debug?.().frames > 2);
    const d = await dbg(page);
    check('prefers-reduced-motion lands in WORLD', d.phase === 'WORLD', d.phase);
    await ctx.close();
  }

  // 5. Small viewport (phone) doesn't crash
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(BASE + '/?scene=world&seed=5');
    await page.waitForFunction(() => window.__mx?.debug?.().frames > 10);
    await page.screenshot({ path: `${OUT}/phone.png` });
    check('phone viewport renders without errors', errors.length === 0, errors);
    await ctx.close();
  }

  // 6. World soak with a fixed seed
  {
    const { ctx, page, errors } = await open('?scene=world&seed=123');
    const cdp = await ctx.newCDPSession(page);
    const heap = async () => {
      await cdp.send('HeapProfiler.collectGarbage');
      return (await cdp.send('Runtime.getHeapUsage')).usedSize;
    };
    await simWait(page, 3);
    await shot(page, 'world');
    const heap0 = await heap();
    const samples = [];
    let outOfBounds = 0, maxParticles = 0, maxPackets = 0, maxMinis = 0, maxActive = 0;
    const start = Date.now();
    let shotN = 0;
    while (Date.now() - start < SOAK * 1000) {
      await page.waitForTimeout(1000);
      const d = (await dbg(page)).detail ?? {};
      samples.push(d);
      for (const a of d.agents ?? []) if (a.x < 0 || a.x > 320 || a.y < 60 || a.y > 180) outOfBounds++;
      maxParticles = Math.max(maxParticles, d.particles ?? 0);
      maxPackets = Math.max(maxPackets, d.packets ?? 0);
      maxMinis = Math.max(maxMinis, d.minis ?? 0);
      maxActive = Math.max(maxActive, (d.activeEvents ?? []).length);
      if ((Date.now() - start) / 1000 > (shotN + 1) * (SOAK / 4) && shotN < 3) await shot(page, `world-${++shotN}`);
    }
    const heap1 = await heap();
    const last = samples.at(-1) ?? {};
    const simTime = (await dbg(page)).time;
    const counts = last.eventCounts ?? {};
    const kinds = Object.keys(counts).filter(k => counts[k] > 0);
    report.soak = { seconds: SOAK, simTime, eventCounts: counts, maxParticles, maxPackets, maxMinis, maxActive, heap0, heap1 };
    check(`world soak: sim ran ≥ 60 s (${simTime.toFixed(1)} s)`, simTime >= 60);
    check('world soak: ≥ 8 different skits happened', kinds.length >= 8, counts);
    check('world soak: never more than 2 skits at once', maxActive <= 2, maxActive);
    check('world soak: agents stay in bounds', outOfBounds === 0, outOfBounds);
    check('world soak: bounded particles/packets/minis', maxParticles <= 600 && maxPackets <= 40 && maxMinis <= 6, { maxParticles, maxPackets, maxMinis });
    check('world soak: heap does not grow > 5 MB', heap1 - heap0 < 5 * 1024 * 1024, { heap0, heap1 });
    // Agents keep doing things (not stuck in one state for the whole run)
    const states = {};
    for (const s of samples) for (const a of s.agents ?? []) (states[a.id] ??= new Set()).add(a.state);
    const stuck = Object.entries(states).filter(([, v]) => v.size < 2).map(([k]) => k);
    check('world soak: every agent changes state', stuck.length === 0, stuck);
    check('world soak: no console errors', errors.length === 0, errors.slice(0, 5));
    await ctx.close();
  }
} catch (e) {
  check('verify script crashed', false, String(e?.stack ?? e));
}

await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(`\n${report.checks.length - failed}/${report.checks.length} checks passed`);
process.exit(failed ? 1 : 0);
