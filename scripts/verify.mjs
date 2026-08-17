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
// Block external requests (Google Fonts etc.) so a flaky/blocked network can't stall load;
// the page falls back to system fonts by design and the canvas doesn't need the network.
await ctx.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => {
  // Ignore network resource-load failures (e.g. Google Fonts when offline — the page
  // falls back to system fonts by design). Catch only real JS/console errors.
  if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text()))
    errors.push('console: ' + m.text());
});

await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(400);
// Remove the gate + hide the tweaks panel so screenshots (incl. poster.png) are clean.
await page.evaluate(() => {
  document.querySelector('#gate').style.display = 'none';
  document.body.classList.add('clean');
});

// 1. WebGL initialised
const hasWebGL = await page.evaluate(() => window.__hasWebGL);
hasWebGL ? ok('WebGL context created') : fail('WebGL unavailable (CSS fallback would engage)');

// 2. Each beat renders a non-black frame; capture poster.jpg from the hero beat.
const BEATS = ['hero','origin','milestone','gathering','lake','dates','tickets','signoff'];
for (let i = 0; i < BEATS.length; i++){
  await page.evaluate(n => window.__seek(n), i);
  await page.waitForTimeout(180);
  // JPEG throughout (grain makes PNGs huge/slow); poster.jpg from the hero beat at higher quality
  const buf = await page.screenshot(
    i === 0 ? { path: join(root, 'poster.jpg'), type: 'jpeg', quality: 82 }
            : { type: 'jpeg', quality: 55 }
  );
  buf.length > 12000
    ? ok(`beat ${i} (${BEATS[i]}) rendered — ${(buf.length/1024|0)}KB`)
    : fail(`beat ${i} (${BEATS[i]}) looks blank — ${buf.length} bytes`);
}
ok('poster.jpg written from the hero beat');

// 3. Save-the-date .ics downloads with correct all-day dates (the purple button leads the RSVP row,
//    which is pinned for the whole show — drop `clean` so the form is visible/clickable)
await page.evaluate(() => {
  window.__seek(0);
  document.body.classList.remove('clean');
  document.querySelector('#gate').classList.add('hide');
});
await page.waitForTimeout(100);
const [ dl ] = await Promise.all([
  page.waitForEvent('download'),
  page.click('#btn-ics'),
]);
const ics = readFileSync(await dl.path(), 'utf8');
ics.includes('DTSTART;VALUE=DATE:20270718') ? ok('.ics DTSTART = 20270718') : fail('.ics DTSTART wrong');
ics.includes('DTEND;VALUE=DATE:20270726')   ? ok('.ics DTEND = 20270726 (exclusive)') : fail('.ics DTEND wrong');

// 4. The RSVP form is visible on every beat, not just the closing ones
for (let i = 0; i < BEATS.length; i++){
  await page.evaluate(n => window.__seek(n), i);
  await page.waitForTimeout(120);
  const shown = await page.isVisible('#rsvp-form');
  if (!shown) fail(`RSVP form hidden on beat ${i} (${BEATS[i]})`);
}
ok('RSVP form visible on all beats');

// The purple .ics button comes first in the row, then the name input, then submit.
// Netlify Forms adds hidden plumbing (form-name, subject, honeypot) — ignore anything invisible.
const order = await page.evaluate(() =>
  [...document.querySelectorAll('#rsvp-form > *')]
    .filter(el => el.offsetParent !== null)
    .map(el => el.id || el.type));
JSON.stringify(order) === JSON.stringify(['btn-ics','rsvp-name','submit'])
  ? ok('RSVP row order = .ics · name · submit')
  : fail('RSVP row order wrong: ' + order.join(', '));

// The removed save-the-date footer is really gone
await page.$('#cta-footer')
  ? fail('#cta-footer still present')
  : ok('save-the-date CTA footer removed');

// 5. No console/page errors
errors.length ? fail('console/page errors:\n  ' + errors.join('\n  ')) : ok('no console or page errors');

await browser.close();
console.log(process.exitCode ? '\nFAILED' : '\nALL CHECKS PASSED');
