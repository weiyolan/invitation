# Yolan's 30th · Boom 2027 — animated invitation

A reactive, psychedelic, portrait (9:16) birthday invitation for WhatsApp.
Everything is **one self-contained `index.html`** (vanilla JS + WebGL, no build
step, no dependencies).

**Live link (after deploy):** https://weiyolan.github.io/invitation/

Tap to begin → the music starts, the invitation fades in from black over a
domain-warped plasma shader (nothing is shown behind the gate), and eight slides
play in sequence. It reacts to:

- **Tilt** your phone → the plasma parallax-warps (iOS asks permission on the first tap).
- **Drag / swipe** → smears the color field.
- **Tap** → left half goes back a slide, right half skips ahead.
- **The music** → its low end drives the visual pulse, and the plasma's liquid drift is
  locked to the 138 BPM beat grid: it surges on the kick and drags off it (1.45× / 0.55×,
  with the average pace unchanged). Through the track's near-silent intro it just drifts
  smoothly and slowly instead — the surge changes gear in *on the drop*, the same 11th beat
  the accent first rolls on.
- **The colour** → the teal accent holds through the intro, changes for the first time
  *on the drop* (the 11th beat), then randomises every 4 beats — every 2 beats once
  somebody has RSVP'd. The whole composition rotates together — plasma field, UI accent
  and the paired purple — because it is all one hue plus a fixed lightness/chroma table.
- **HYPE slider** (top-left) → cranks the hardstyle in real time: distorts the kick,
  opens the acid resonance, and nudges the tempo up. Too hard? Slide it back down.
- **RSVP** → the name form is pinned at the bottom for the whole slideshow, led by a
  small purple 🗓️ save-the-date button that downloads the `.ics`; names land on the
  sign-off slide, each name led by a star in its own bright colour (shared list needs
  Supabase — see below).

## Slides & type scale

The eight slides live in `#overlay` in `index.html`, one `.beat` each, and they all
draw from a single type scale so nothing drifts: `.slide-title` (Bebas Neue),
`.slide-body` (Space Grotesk, `<b>` for the teal keyword pops, `.slide-body--soft`
for the quieter second line), `.slide-subtext` and `.slide-label` (Space Mono).
Changing copy means editing the markup only — no per-slide CSS.

## Deploy (get the WhatsApp link)

1. Push to the branch listed in `.github/workflows/pages.yml` (currently `shader`).
2. **One-time, in the GitHub UI:** repo **Settings → Pages → Source = "GitHub Actions"**.
3. The Actions run publishes to https://weiyolan.github.io/invitation/ — paste that
   into WhatsApp. The preview card comes from `poster.jpg` + the `og:` tags.

Tilt and audio need HTTPS — `file://` won't fire them; the Pages link will.

## Tuning

Edit the `CONFIG` block at the top of the `<script>` in `index.html`: BPM, palette,
per-beat durations, the calendar-event details, and the `supabase` guest-list keys.

- `BPM` / `beatOffset` — the beat grid. Measured off the bundled track: 138.000 BPM with the
  downbeat 323.5 ms in, confirmed by fitting each 40 s window separately (spread 1.35 ms, so
  no drift). Swap the MP3 and these both need re-measuring, or every beat-locked effect sits
  off the kick. Watch for landing a quarter-beat out: a grid fitted to the 16th-note hats
  instead of the kick looks convincing but reads as consistently early.
- `latencyNudge` — shift the beat grid if the visuals read early or late on a device. The
  audible kick lags the decode position by the audio output latency, and WebKit won't
  report it, so on iPhone this may want a small positive value.
- `accentHue` + `palette.stops` — the palette is authored in **OKLCH**, as one accent hue
  plus a fixed `{L, C, dh}` per stop. Rotating `accentHue` moves everything coherently and
  keeps the designed contrast, which plain hue-rotation does not: at fixed HSL lightness a
  hue rotation swings real luminance 3×, at fixed OKLCH lightness about 6%. The defaults
  reproduce the original hexes exactly.
- `PULSE.depth` (just below `WAVE`) — how hard the liquid surges on the kick. `0.45` is
  1.45× on the beat and 0.55× off it; `0` restores the old constant drift.
- `PULSE.intro` — the plasma's drift rate before the drop, as a fraction of full speed. The track
  opens on a near-silent intro, so the surge is held off until `ACCENT.firstBeat` (the same beat the
  accent first rolls on, read from there so the two can't come apart): until then the field drifts
  smoothly at `0.25×`, then changes gear. `1` removes the gear change and leaves only the surge
  gating. The onset is continuous by construction — `warp()` is exactly zero at every beat line, so
  switching the surge on at a beat boundary adds nothing at that instant.
- `ACCENT.firstBeat` — which beat the first colour change lands on, 0-indexed on the beat
  grid. `10` is the 11th beat, i.e. the drop, measured as the intro's biggest transient. The
  accent holds on the designed teal until here, on every pass through the looping track.
- `QUALITY` (just above `WAVE`) — the phone/desktop tier: `dpr` (plasma render resolution),
  `octaves` (fbm detail), `dispersion` and `maxLive`. `dpr` and `octaves` want to move together:
  the top octaves are what aliases once the sample rate drops, and aliasing crawls frame to frame,
  which looks worse than the softness it would replace.
- `WAVE.trailIdle` — ms of pointer silence before the follower blob fades out. Drop the timeout in
  `track()` for the old behaviour, where it stayed under your last touch for the whole session.
- `ACCENT.everyN` / `everyNHyper` — beats between colour changes, before and after an RSVP.
  The cycle is anchored at `firstBeat`, so with `everyN: 4` each change lands on the same
  position in the bar as the drop.

## Guest list (RSVP)

The name form works out of the box, but names only persist/share once you point it
at a free [Supabase](https://supabase.com) project:

1. supabase.com → **New project** (free tier).
2. SQL editor → run:
   ```sql
   create table rsvps (
     id bigint generated always as identity primary key,
     name text not null check (char_length(name) between 1 and 40),
     created_at timestamptz default now()
   );
   alter table rsvps enable row level security;
   create policy "read"   on rsvps for select using (true);
   create policy "insert" on rsvps for insert with check (true);
   grant select, insert on public.rsvps to anon, authenticated;
   ```
3. **Settings → API** → copy the **Project URL** + **anon public** key into
   `CONFIG.supabase` in `index.html`.

The anon key is public by design (row-level security gates it), so it's safe to
commit. Anyone can add a name (open insert) — fine for a party; add a captcha only
if it gets spammed. Until you add keys, submitted names just show locally on that
device for the session.

## Email alerts on every RSVP

The same form is also a [Netlify Form](https://docs.netlify.com/forms/setup/) named
`rsvp`, so every submission is stored under **Project configuration → Forms** on
Netlify, independent of Supabase. To get an email for each one:

Netlify → **Project configuration → Notifications → Emails and webhooks** →
**Add notification → Email notification**, event **New form submission**, form
`rsvp`, and the address to notify. Emails arrive with the subject
"New RSVP for Yolan's 30th" (set by a hidden `subject` field in the form).

Netlify's free tier covers 100 submissions/month. A hidden honeypot field
(`bot-field`) filters bots; anything Akismet flags lands in the form's **Spam**
tab rather than your inbox.

## Checks

`node scripts/verify.mjs` — headless Playwright: every beat renders, the `.ics`
dates are right, the RSVP row is visible on every beat in the right order, zero
console errors. Also regenerates `poster.jpg`.

URL flags: `?debug` shows a timeline scrubber, `?clean` hides hints for screen
recording, `?perf` shows a frame-time HUD, `?q=high|low` forces a quality tier,
`?intro=<0..1>` overrides the plasma's pre-drop drift rate for tuning on a device.

## Performance

Phones get a cheaper render than desktop, decided once at boot from
`(pointer: coarse)`. On the low tier the plasma renders at CSS-pixel resolution
instead of 2x and `fbm` drops from 5 octaves to 3 — together ~6.7x less fragment
work — plus at most 3 concurrent tap waves and no chromatic dispersion on the
text refraction. The text and UI are separate DOM at full device resolution and
never soften. Everything is in the `QUALITY` block above `WAVE` in `index.html`;
raise `dpr.low` to 1.5 if 1 reads too soft on your device.

`?perf` is how you check any of this on a real phone. It shows p50/p95 frame time
and `miss%` against the display's *measured* refresh period (so the numbers read
correctly on both 60 Hz and 120 Hz), per-section sub-timers, and a
`bound:js|gpu` verdict — a small `js` number against a long `frame` means the
time is going to the GPU and the compositor, where no JS timer can see it.

Below the readout is a row of ablation toggles, which is the only honest way to
attribute GPU cost on mobile (`gl.drawArrays` is asynchronous and
`EXT_disjoint_timer_query` does not exist there): switch a layer off, read the
frame time, and the delta is what that layer costs. `[P]` plasma, `[R]`
`#retro-dither`, `[F]` its filter chain, `[T]` the pointer-follower blob, `[C]`
the per-frame custom properties, `[W]` the DOM refraction, `[B]` `will-change`.

**Protocol.** Open `?perf`, tap to begin, then leave the screen alone for 10 s on
the hero slide and record `frame / p95 / miss / bound`. Then tap each toggle for
~3 s and write the `frame` delta down; those deltas are your budget. Compare
`?q=high` against `?q=low` the same way. Phones thermal-throttle, so always
compare from the same cold start on the same slide.
