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
- **The music** → its low end drives the visual pulse.
- **HYPE slider** (top-left) → cranks the hardstyle in real time: distorts the kick,
  opens the acid resonance, and nudges the tempo up. Too hard? Slide it back down.
- **RSVP** → from the ticket slide on, the name form is pinned at the bottom; names
  land on the sign-off slide (shared list needs Supabase — see below).

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
   grant select, insert on public.rsvps to anon, authenticated;
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
