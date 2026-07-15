// Headless end-to-end check for index.html + renders poster.png (the og:image).
// Run:  node scripts/verify.mjs
// Uses the globally-installed Playwright + preinstalled Chromium (no npm install needed).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const gRoot = process.env.PW_ROOT || execSync('npm root -g').toString().trim();
const { chromium } = require(join(gRoot, 'playwright'));

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pageUrl = pathToFileURL(join(root, 'index.html')).href;

const fail = m => { console.error('✗ ' + m); process.exitCode = 1; };
const ok   = m => console.log('✓ ' + m);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, acceptDownloads: true,
});
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => {
  // Ignore network resource-load failures (e.g. Google Fonts when offline — the page
  // falls back to system fonts by design). Catch only real JS/console errors.
  if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text()))
    errors.push('console: ' + m.text());
});

await page.goto(pageUrl, { waitUntil: 'load' });
await page.waitForTimeout(300);
// Remove the gate + hide the tweaks panel so screenshots (incl. poster.png) are clean.
await page.evaluate(() => {
  document.querySelector('#gate').style.display = 'none';
  document.body.classList.add('clean');
});

// 1. WebGL initialised
const hasWebGL = await page.evaluate(() => window.__hasWebGL);
hasWebGL ? ok('WebGL context created') : fail('WebGL unavailable (CSS fallback would engage)');

// 2. Each beat renders a non-black frame; capture poster.png from the BOOM beat.
const BEATS = ['ignition','boom','dates','personal','urgency','cta','signoff','story'];
for (let i = 0; i < BEATS.length; i++){
  await page.evaluate(n => window.__seek(n), i);
  await page.waitForTimeout(180);
  const buf = await page.screenshot(
    i === 1 ? { path: join(root, 'poster.jpg'), type: 'jpeg', quality: 82 } : undefined
  );
  // a fully-black 1080x1920 PNG compresses to a few KB; a plasma frame is far larger
  buf.length > 30000
    ? ok(`beat ${i} (${BEATS[i]}) rendered — ${(buf.length/1024|0)}KB`)
    : fail(`beat ${i} (${BEATS[i]}) looks blank — ${buf.length} bytes`);
}
ok('poster.jpg written from the BOOM beat');

// 3. Save-the-date .ics downloads with correct all-day dates
await page.evaluate(() => { window.__seek(5); document.querySelector('#gate').classList.add('hide'); });
await page.waitForTimeout(100);
const [ dl ] = await Promise.all([
  page.waitForEvent('download'),
  page.click('#btn-ics'),
]);
const ics = readFileSync(await dl.path(), 'utf8');
ics.includes('DTSTART;VALUE=DATE:20270718') ? ok('.ics DTSTART = 20270718') : fail('.ics DTSTART wrong');
ics.includes('DTEND;VALUE=DATE:20270726')   ? ok('.ics DTEND = 20270726 (exclusive)') : fail('.ics DTEND wrong');

// 4. Google Calendar link has the right (end-exclusive) date range
const href = await page.getAttribute('#btn-gcal', 'href');
href && href.includes('dates=20270718%2F20270726')
  ? ok('Google Calendar dates = 20270718/20270726')
  : fail('gcal href wrong: ' + href);

// 5. No console/page errors
errors.length ? fail('console/page errors:\n  ' + errors.join('\n  ')) : ok('no console or page errors');

await browser.close();
console.log(process.exitCode ? '\nFAILED' : '\nALL CHECKS PASSED');
