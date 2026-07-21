# Yolan's 30th · Boom 2027 — animated invitation

A reactive, psychedelic, portrait (9:16) birthday invitation for WhatsApp.
Everything is **one self-contained `index.html`** (vanilla JS + WebGL, no build
step, no dependencies).

**Live link (after deploy):** https://weiyolan.github.io/invitation/

Tap to begin → procedural acid techno starts and the invitation text plays over
a domain-warped plasma shader. It reacts to:

- **Tilt** your phone → the plasma parallax-warps (iOS asks permission on the first tap).
- **Drag / swipe** → smears the color field.
- **Tap** → skip ahead a beat (tap again at the end to replay).
- **The music** → its low end drives the visual pulse.
- **HYPE slider** (top-left) → cranks the hardstyle in real time: distorts the kick,
  opens the acid resonance, and nudges the tempo up. Too hard? Slide it back down.
- **RSVP** → on the closing credits, drop your name to say you're coming; names roll
  up at the end of the story (shared list needs Supabase — see below).

## Deploy (get the WhatsApp link)

1. Push to `main` (or the working branch listed in `.github/workflows/pages.yml`).
2. **One-time, in the GitHub UI:** repo **Settings → Pages → Source = "GitHub Actions"**.
3. The Actions run publishes to https://weiyolan.github.io/invitation/ — paste that
   into WhatsApp. The preview card comes from `poster.jpg` + the `og:` tags.

Tilt and audio need HTTPS — `file://` won't fire them; the Pages link will.

## Tuning

Edit the `CONFIG` block at the top of the `<script>` in `index.html`:
BPM, palette, per-beat durations, the calendar-event details, and the `supabase`
guest-list keys.

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
   ```
3. **Settings → API** → copy the **Project URL** + **anon public** key into
   `CONFIG.supabase` in `index.html`.

The anon key is public by design (row-level security gates it), so it's safe to
commit. Anyone can add a name (open insert) — fine for a party; add a captcha only
if it gets spammed. Until you add keys, submitted names just show locally on that
device for the session.

## Checks

`node scripts/verify.mjs` — headless Playwright: every beat renders, the
`.ics`/Google Calendar dates are right, zero console errors. Also regenerates
`poster.jpg`.

URL flags: `?debug` shows a timeline scrubber, `?clean` hides hints for screen
recording.
