# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

"Aero Hub" — a single-user (extensible to a few friends), purpose-built
replacement for a Notion setup used to plan Aerospace Engineering coursework
(tasks + study-time scheduling). Full original product spec is in
`spec.md` — read it once for context, but note its own "Open questions"
(§8) are now **answered and implemented**; treat this file as the current
source of truth over spec.md wherever the two would conflict.

## Stack (decided, implemented)

- **Frontend**: Next.js 15 (App Router, TypeScript), deployed to **Vercel**
  (free tier — auto-detects Next.js from the GitHub repo, gives a free
  `*.vercel.app` subdomain, no custom domain needed).
- **Backend/DB/Auth/Storage**: **Supabase** free tier (Postgres + Auth +
  Storage). Chosen over Vercel Postgres/Neon for the combined
  auth+DB+storage+cron story in one free-tier service, comfortably covering
  "tens of users."
- **Auth**: Supabase Auth, Google OAuth as the primary method (avoids
  password-reset flows entirely) with email magic-link as a fallback — no
  passwords anywhere.
- **Styling**: Tailwind v4, custom design tokens (no default/templated
  look) — dark "dusk cockpit" theme: Fraunces (display serif, headings/
  quote) + Space Grotesk (UI), navy/amber palette. See `src/app/globals.css`.

## Key product decisions worth knowing before touching related code

- **Tasks and Scheduler blocks are deliberately NOT linked** in the data
  model — connected only implicitly via a shared `tag_id`. Tried as a real
  relation in the Notion prototype and explicitly rejected (too much
  upkeep). Do not reintroduce a task↔block relation.
- **Parent/child tasks auto-complete**, enforced in Postgres (not
  client-side) — see "Architecture notes" below. This is the one feature
  motivating a custom build over Notion.
- **Task nesting is capped at 3 levels** (parent → subtask → subtask's own
  children), enforced by a DB trigger that rejects a 4th level.
- **Block titles are always auto-derived from the tag** (e.g. "Study Aero
  II", or bare "Gym"/"Free" for non-unit tags) — never typed.
- **Hub section order is fixed and deliberate**: Today's blocks → Tasks →
  Deadlines → Stats. Don't reorder without a reason (tuned from real Notion
  usage — Tasks was promoted above Stats/Deadlines after a mobile pass).
- **Mobile-first** for logging a block and checking off a task — both must
  stay near one-tap. Single-column mobile layouts; side-by-side only on
  wide viewports (a Notion-era side-by-side stats layout was reverted for
  this reason — don't reintroduce it on mobile).
- **Timezone**: set once at onboarding (IANA name, e.g. `Europe/Lisbon`),
  DST handled automatically via `Intl`/Postgres — no external timezone API
  needed. Scheduler blocks/task due dates are plain wall-clock values (not
  timezone-relative at all); only `imported_events` carry a real UTC
  instant, so a timezone change only needs to touch that table (freezes
  past events' display, re-derives future ones — see
  `src/lib/actions/profile.ts`).
- **Tag lifecycle**: delete → referencing tasks/blocks become tagless
  (`ON DELETE SET NULL`), not deleted. Archive → cascades to that tag's
  *future* tasks/blocks only (past stays untouched); unarchive reverses
  exactly that set. See `src/lib/actions/tags.ts`.
- **No semester-rollover feature** — the user just keeps editing/archiving
  the same flat tag list indefinitely, no "start new semester" action.
- **Stats are current-week-focused but support week-over-week comparison**
  (this week vs. last 2), not a full historical browser — see
  `/stats`.
- **Duplicate-week button** on the Scheduler copies a week's blocks forward
  one week, allows overlap with whatever's already there (user resolves
  collisions manually), and never touches the source (past) week.
- **`.ics` calendar sync accepts either a live URL or an uploaded file**
  per source (classes/tests) — the two live feed URLs weren't available at
  spec time and may never be reliably link-shaped, so file upload is a
  first-class option, not a fallback. Google Calendar import/export is a
  **separate, explicit** connection (UI always states which direction is
  active) — never silently conflated with `.ics` upload.

See `spec.md` §5 for the full list of explicitly rejected designs — don't
re-propose without new information: task↔block relations with "roll to
next block," a full calendar grid on the Hub, side-by-side mobile stat
columns.

## Build/lint commands

- `npm run dev` — dev server
- `npm run build` — production build (also runs typecheck + lint)
- `npm run lint` — ESLint only

## Architecture notes

- `src/app/(app)/` — authenticated route group (Hub, Tasks, Scheduler,
  Stats, Settings), gated by `src/app/(app)/layout.tsx` which redirects to
  `/login` or `/onboarding` as needed. `src/middleware.ts` refreshes the
  Supabase session on every request.
- `src/lib/actions/` — Server Actions for all mutations (tags, tasks,
  blocks, `.ics` feeds, profile/timezone). Client components call these
  directly; RLS is the backstop, not the only check.
- `src/lib/database.types.ts` — hand-written to match
  `supabase/migrations/`. Regenerate with
  `npx supabase gen types typescript --linked` once the project is linked
  via the Supabase CLI, instead of hand-editing further.
- Task auto-completion (spec §3.4) is enforced in Postgres via triggers
  (`tasks_derive_done` + `tasks_propagate_to_ancestors` in
  `0001_init.sql`), not computed client-side — a task with children always
  has its `done` derived from them, propagating up all 3 levels,
  bidirectionally (unchecking a child un-completes ancestors too).
- Blocks store wall-clock `date`/`start_time`/`end_time` (not a UTC
  instant) since they're inherently local, not timezone-relative.
  `imported_events` (from `.ics`/Google) DO store a real UTC instant — see
  the timezone bullet above.

## Current status (as of the last working session)

Deployed against a real Supabase project (migrations `0001_init.sql` and
`0002_ics_storage.sql` have been run; RLS, triggers, and the `ics-feeds`
storage bucket are live). Google OAuth + email magic-link login both work.
Build/lint are clean. **The UI has not been visually reviewed yet** — a
"plain HTML" report during setup turned out to be a stale orphaned dev
server, not a real bug (compiled CSS was verified present and correct
afterward), but that's not the same as an actual design/UX pass.

Built: DB schema + RLS + auto-completion trigger, auth, timezone
onboarding, app shell/nav, Hub, Tasks (tree view, 3-level nesting,
quick-add), Scheduler (week view, quick-add block, duplicate-week),
Settings (tags CRUD with archive cascade, timezone change, `.ics` feed
config with manual sync), Stats (week-over-week comparison).

Not built: automatic/periodic `.ics` sync (currently manual "Sync now"),
Google Calendar OAuth wiring (client ID/secret are in `.env.local`, but the
callback route and token exchange don't exist yet — buttons are disabled
stubs), any dedicated visual-design polish pass.

## Plan for next session

1. **Visual QA pass first** — user hasn't seen the UI rendered yet. Run
   `npm run dev`, walk through onboarding → Hub → Tasks → Scheduler →
   Settings → Stats on both a mobile viewport and desktop width, note every
   friction point/bug/ugly spot before building anything new.
2. Fix whatever that pass turns up — likely candidate: this is the first
   real look at the "dusk cockpit" theme and component spacing/hierarchy,
   expect adjustments.
3. Once the base UI is confirmed solid, do the deliberate visual-design
   pass called for in spec.md §2/§7 (this was explicitly scoped as
   separate from initial scaffolding, not a nice-to-have).
4. Wire Google Calendar OAuth (client ID/secret already configured): build
   `/api/google-calendar/callback`, token storage in
   `google_calendar_connections`, and turn the two disabled Settings
   buttons into real import/export flows.
5. Automate `.ics` sync: port the parse/upsert logic in
   `src/lib/actions/ics.ts` into a Supabase Edge Function scheduled via
   `pg_cron` (not Vercel Cron — Hobby tier is once/day, too infrequent).
6. Deploy to Vercel for real multi-device (phone + desktop) testing against
   the shared DB.
7. Rotate the Supabase DB password (it passed through chat in plaintext
   during setup) once the above is stable — Project Settings → Database →
   Reset database password.
