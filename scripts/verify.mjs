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

// Seek and wait for the frame loop to have applied it. A fixed sleep is not enough: CI has no GPU,
// so one frame of two full-screen shaders can take longer than the wait and the .active/inert
// classes land after the assertion has already read them.
const seek = async i => {
  await page.evaluate(n => window.__seek(n), i);
  await page.waitForFunction(
    n => document.querySelector(`.beat[data-beat="${n}"]`).classList.contains('active'),
    i, { timeout: 15000 });
};

// 2. Each beat renders a non-black frame; capture poster.jpg from the hero beat.
const BEATS = ['hero','origin','milestone','gathering','lake','dates','tickets','signoff'];
for (let i = 0; i < BEATS.length; i++){
  await seek(i);
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
  await seek(i);
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

// The designer credit rides along with the pinned RSVP block and links out
await page.$('#credit a[href="https://ywdesign.co"]')
  ? ok('credit link -> ywdesign.co present')
  : fail('#credit link to ywdesign.co missing');

// The slide-4 source link is tappable on its own beat. #overlay is pointer-events:none,
// so the anchor must re-enable its own hit area or the tap falls through to the canvas.
await seek(3);
const srcLink = await page.evaluate(() => {
  const a = document.querySelector('.beat[data-beat="3"] a');
  if (!a) return { missing: true };
  const r = a.getBoundingClientRect();
  const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
  return { pe: getComputedStyle(a).pointerEvents, inert: !!a.closest('[inert]'), isHitTarget: hit === a };
});
srcLink.missing        ? fail('slide-4 source link missing')
  : srcLink.pe !== 'auto' ? fail('source link pointer-events=' + srcLink.pe + ' — #overlay is none, so it needs auto')
  : srcLink.inert      ? fail('source link inert on its own beat')
  : !srcLink.isHitTarget ? fail('source link is not the hit target on beat 3 — something overlays it')
  : ok('slide-4 source link is tappable on its own beat');

// ...and its beat goes inert when hidden, so the invisible link cannot eat taps meant for the canvas
await seek(5);
await page.evaluate(() => document.querySelector('.beat[data-beat="3"]').hasAttribute('inert'))
  ? ok('hidden beats are inert — no phantom hit target')
  : fail('beat 3 not inert while hidden — its link still swallows taps');

// 5. DOM refraction (the html-in-canvas tap ripple) — the fail-safe that must never regress.
//    The origin trial is Chrome 148-150 and the Chromium pinned here is 141, so the real
//    drawElementImage cannot be reached from CI; these checks drive the state machine through a
//    shimmed API instead. What matters is the guard: the invitation is never left hidden behind an
//    empty capture. Scenario C is the bug that shipped in b9a33f5 — text and UI gone for the
//    length of every ripple.
const domState = p => p.evaluate(() => window.__domWaveState());
const domWait = async (p, pred, ms = 5000) => {
  for (let t = Date.now(); ; await p.waitForTimeout(60)){
    const s = await domState(p);
    if (pred(s) || Date.now() - t > ms) return s;
  }
};
// a real tap: same point down and up, so index.html's moved < 0.04 && < 400ms test passes
const domTap = p => p.evaluate(() => {
  window.__seek(0);                       // taps only splash once the show has started
  const st = document.querySelector('#stage');
  const at = { clientX: st.clientWidth * 0.75, clientY: st.clientHeight * 0.5, bubbles: true };
  st.dispatchEvent(new PointerEvent('pointerdown', at));
  st.dispatchEvent(new PointerEvent('pointerup', at));
});
const domVisible = p => p.evaluate(() => {
  const c = document.querySelector('#dom-content');
  const t = document.querySelector('.beat[data-beat="0"] .slide-title');
  return { parent: c.parentElement.id, boxed: c.getBoundingClientRect().height > 0,
           title: !!t && t.getBoundingClientRect().height > 0 };
});

// A: no API at all (this page, and every Safari/iOS visitor) — the DOM is never touched
{
  const s = await domState(page);
  const v = await domVisible(page);
  s.mode === 'unsupported' ? ok('no html-in-canvas API here -> domWave inert')
                           : fail('domWave engaged without the API: ' + JSON.stringify(s));
  await domTap(page);
  await page.waitForTimeout(200);
  const after = await domVisible(page);
  v.parent === 'stage' && after.parent === 'stage' && after.boxed && after.title
    ? ok('fallback path: #dom-content stays under #stage and stays laid out through a tap')
    : fail('fallback path moved or hid #dom-content: ' + JSON.stringify(after));
}

// Shimmed pages. No requestPaint shim on purpose: without it index.html captures at the tail of
// step(), which is the deterministic half of the frame — a rAF-driven fake paint event would fire
// in the wrong one and prove nothing.
// Its own browser, with the backgrounding suppressed: headless Chromium throttles rAF on any page
// it is not actively rasterising, and the wave field advances on frames, so a throttled loop makes a
// 0.6s ripple take 15s of wall clock.
const LIVE_ARGS = ['--disable-background-timer-throttling',
                   '--disable-backgrounding-occluded-windows',
                   '--disable-renderer-backgrounding'];
const shimBrowser = await chromium.launch({ args: LIVE_ARGS });
const shimPage = async impl => {
  // 360x640 is the same 9:16 stage at 1/9 the pixels. CI has no GPU, so two full-screen fragment
  // shaders per frame at 1080x1920 drop the loop to ~1fps and a 0.6s wave takes 15s of wall clock.
  const c = await shimBrowser.newContext({ viewport:{ width:360, height:640 }, deviceScaleFactor:1,
                                           reducedMotion:'no-preference' });
  await c.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  const p = await c.newPage();
  p.on('pageerror', e => errors.push('shim pageerror: ' + e.message));
  p.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text()))
      errors.push('shim console: ' + m.text());
  });
  await p.addInitScript(impl);
  await p.goto(pageUrl, { waitUntil:'domcontentloaded' });
  await p.bringToFront();   // a page that isn't the front tab gets its rAF loop throttled to a crawl
  return { c, p };
};

// B: a capture that yields pixels -> the module arms itself and refracts on tap
{
  const { c, p } = await shimPage(() => {
    CanvasRenderingContext2D.prototype.drawElementImage = function(){
      this.fillStyle = '#e7efee';                    // stand-in rasteriser: a page-shaped block
      this.fillRect(0, 0, this.canvas.width, this.canvas.height);
    };
  });
  const armed = await domWait(p, s => s.mode === 'armed' || s.mode === 'off');
  armed.mode === 'armed' && armed.hosted
    ? ok('working capture -> armed, #dom-content hosted in #dom-src')
    : fail('working capture did not arm: ' + JSON.stringify(armed));
  await domTap(p);
  const live = await domWait(p, s => s.refracting, 1000);
  live.refracting && live.blanks === 0
    ? ok('tap -> refracting with no blank captures')
    : fail('tap did not refract cleanly: ' + JSON.stringify(live));
  const done = await domWait(p, s => !s.refracting, 15000);
  done.mode === 'armed' && !done.refracting
    ? ok('wave ends -> back to armed, still no blanks')
    : fail('module did not settle after the wave: ' + JSON.stringify(done));
  await c.close();
}

// C: a capture that yields nothing -> the module must hand the DOM back, not hide it.
//    This is the regression test for the vanishing text: before the fix the state machine
//    trusted "drawElementImage did not throw" and blanked the page anyway.
{
  const { c, p } = await shimPage(() => {
    CanvasRenderingContext2D.prototype.drawElementImage = function(){};   // draws nothing, throws nothing
  });
  const off = await domWait(p, s => s.mode === 'off');
  off.mode === 'off' && off.blanks >= 1 && !off.hosted
    ? ok('blank capture -> domWave disables itself and releases #dom-content')
    : fail('blank capture did not trip the guard: ' + JSON.stringify(off));
  await domTap(p);
  await p.waitForTimeout(250);
  const v = await domVisible(p);
  v.parent === 'stage' && v.boxed && v.title
    ? ok('blank capture -> page still visible and laid out through a tap')
    : fail('page hidden after a tap with a blank capture: ' + JSON.stringify(v));
  const hidden = await p.evaluate(() => document.querySelector('#dom-out').classList.contains('off'));
  hidden ? ok('#dom-out switched off with the module') : fail('#dom-out left live after disable');
  await c.close();
}

await shimBrowser.close();

// D: the real rasteriser, if this Chromium has it. Chrome <=147 spelled it drawElement and had no
//    paint event; anything newer runs the origin-trial spelling on the deploy instead. A skip here
//    is expected, not a failure — it just means the local browser predates or postdates the flag.
{
  const flagged = await chromium.launch({
    args: ['--enable-blink-features=CanvasDrawElement,CanvasDrawElementInSubtree', ...LIVE_ARGS],
  });
  const c = await flagged.newContext({ viewport:{ width:360, height:640 }, deviceScaleFactor:1,
                                      reducedMotion:'no-preference' });
  await c.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  const p = await c.newPage();
  await p.goto(pageUrl, { waitUntil:'domcontentloaded' });
  await p.bringToFront();
  const api = await p.evaluate(() => {
    const cv = document.createElement('canvas').getContext('2d');
    return { image: typeof cv.drawElementImage === 'function', older: typeof cv.drawElement === 'function',
             paint: typeof document.createElement('canvas').requestPaint === 'function' };
  });
  if (!api.image && !api.older){
    ok(`real rasteriser unavailable in this Chromium (${(await flagged.version?.() ?? 'n/a')}) — skipped`);
  } else {
    const s = await domWait(p, x => x.mode === 'armed' || x.mode === 'off');
    const v = await domVisible(p);
    s.mode === 'armed'
      ? ok(`real rasteriser armed (paintEvent=${s.paintEvent}, probe=${s.probe})`)
      : ok(`real rasteriser rejected by the guard: ${s.error} — fallback engaged (texElementImage2D=${s.texEl})`);
    await domTap(p);
    await p.waitForTimeout(250);
    v.boxed && (await domVisible(p)).title
      ? ok('real rasteriser: page still laid out through a tap')
      : fail('real rasteriser: page lost through a tap');
  }
  await flagged.close();
}

// 6. No console/page errors
errors.length ? fail('console/page errors:\n  ' + errors.join('\n  ')) : ok('no console or page errors');

await browser.close();
console.log(process.exitCode ? '\nFAILED' : '\nALL CHECKS PASSED');
