# CLAUDE.md

Single source of truth for **Scheduler** — a single-user, purpose-built
replacement for a Notion setup used to plan Aerospace Engineering
coursework (tasks + study-time scheduling). Cares a lot about visual
design (not a generic dashboard template) and about two flows staying
near one-tap: logging a study block, checking off a task. Used mobile
day-to-day, desktop for weekly (Sunday) planning.

## Stack

- Next.js 15 (App Router, TypeScript) on Vercel free tier.
- Supabase free tier: Postgres + Auth + Storage. RLS is the backstop, not
  the only check — Server Actions in `src/lib/actions/` do the mutations.
- Auth: Supabase Auth, Google OAuth primary + email magic-link fallback.
  No passwords.
- Tailwind v4, custom tokens only (`src/app/globals.css`, `--scheduler-*`
  → `--color-*`) — dark "dusk cockpit" (default) + light theme, toggled
  via `data-theme` on `<html>`. Fraunces (display/serif) + Space Grotesk
  (UI). **Never hardcode a hex color when a token fits** — add a token
  pair (dark + light) instead.
- `src/lib/database.types.ts` is hand-written to match
  `supabase/migrations/`; regenerate via `npx supabase gen types
  typescript --linked` instead of hand-editing further, once linked.

## Rules that aren't obvious from the code

- **Tasks and blocks are NOT linked** — connected only implicitly via
  shared `tag_id`. Tried as a real relation in the Notion prototype and
  explicitly rejected (too much upkeep). Don't reintroduce a relation.
- **Parent/child task auto-completion is enforced in Postgres**, not
  client-side (`tasks_derive_done` + `tasks_propagate_to_ancestors`,
  `0001_init.sql`) — a task with children always has `done` derived from
  them, bidirectionally, up to 3 nesting levels (`depth` 0–2, a trigger
  rejects a 4th).
- **`moveTask` (drag reparent, `src/lib/actions/tasks.ts`) always detaches
  the moved task's direct children first** (promoting them to independent
  roots — grandchildren stay attached to their now-promoted parent), then
  reparents the moved task. This ordering is what makes a cycle
  impossible (the moved task always has zero children when its own
  `parent_id` write happens) and covers every reparent case in one rule.
  Depth changes cascade to descendants via `tasks_after_depth_cascade`
  (`0003_task_move_and_completed_at.sql`).
- **Blocks store plain wall-clock `date`/`start_time`/`end_time`**, not a
  UTC instant — deliberately immune to timezone changes. `imported_events`
  (`.ics`/Google) DO store a real UTC instant, so a timezone change only
  needs to touch that table (freezes past events' display via `frozen_*`
  columns, future ones re-derive live) — see `src/lib/actions/profile.ts`.
- **Calendar-date arithmetic must never round-trip through a local-time
  `Date` + `.toISOString()`** — that silently shifts results a day under
  a positive UTC offset (this broke "next week" for a full round before
  being caught). `src/lib/dates.ts` does all date-part math in pure UTC
  millis; keep new date helpers there consistent with that.
- **Tag groups replace the old fixed `kind: unit/other` split**
  (`0005_tag_groups.sql`): `tag_groups (label, color, is_study_unit,
  sort_order)`, tags get a nullable `group_id`. A group's
  `is_study_unit` drives the "Study {label}" block-title treatment
  (`deriveBlockTitle`, `src/lib/tags.ts`) — falls back to the legacy
  `kind` column only for tags that predate groups and were never
  assigned one (kept, NOT NULL relaxed, not backfilled — no need, the
  fallback covers it). New tags: picking a group pre-fills its color
  (still editable); no group → a random preset color is issued.
- **Tag delete → referencing tasks/blocks become tagless** (`ON DELETE
  SET NULL`). **Tag archive → cascades to that tag's *future*
  tasks/blocks only**; past stays untouched, unarchive reverses exactly
  that set. Same semantics for tag-group delete (tags become ungrouped).
  See `src/lib/actions/tags.ts` / `tag-groups.ts`.
- **Task nesting caps at 3 levels; block titles are always auto-derived
  from the tag**, never typed, everywhere.
- **Tag colors are freely repeatable**, not unique per tag — lets several
  tags deliberately share a "group color."
- Migrations are applied to the live Supabase project via a short-lived
  Node script (`pg` package + `SUPABASE_DB_URL` from `.env.local`,
  `npm install --no-save pg`, removed after) — there's no staging
  environment, so ask before running anything non-additive (dropping/
  narrowing a column, not just adding one).
- The Supabase DB password passed through chat in plaintext during setup
  and still lives in `.env.local` — rotate it once the app is stable
  (Project Settings → Database → Reset database password).

## Explicitly rejected — don't re-propose without new information

- Task ↔ block relation with manual reassignment (see above).
- Full calendar-grid view on the Hub — a compact deadlines list instead,
  for mobile.
- Side-by-side stats/column layouts on mobile — single-column by default,
  side-by-side only on wide viewports.

## Data model

Authoritative source: `supabase/migrations/` + `src/lib/database.types.ts`.

- **`tags`**: `{ id, label, color, kind: "unit"|"other"|null (legacy),
  group_id (nullable → tag_groups), archived, sort_order }`.
- **`tag_groups`**: `{ id, label, color, is_study_unit, sort_order }`.
- **`tasks`**: `{ id, title, tag_id, done (derived once it has children),
  due_date, notes, parent_id, depth (0–2), completed_at, created_at }`.
- **`blocks`**: `{ id, tag_id, title (auto-derived), date, start_time,
  end_time, details (≤30 chars), created_at }`.
- **`ics_feeds`**: `{ source: "classes"|"tests" (fixed slot id), label
  (user-facing, editable), kind: "url"|"file", url, storage_path,
  last_sync_* }`.
- **`imported_events`**: `{ source: "classes"|"tests"|"google", title,
  starts_at/ends_at (UTC), location, raw_uid (dedupe), frozen_* }`.
- **`google_calendar_connections`**: `{ google_account_email, calendar_id,
  sync_direction: "import"|"export", refresh_token }` — not wired up yet
  (client ID/secret in `.env.local`, no callback route).

## Build/lint

- `npm run dev` / `npm run build` (typecheck + lint too) / `npm run lint`

## Architecture notes (non-obvious implementation details)

- **Task tree** (`src/components/task-tree.tsx`): 3 columns by depth
  (main/sub/sub-sub), not nested indentation. `expandedIds` (a `Set`)
  lives centrally in `TaskTree` — a task's children only appear in the
  next column while its id is in the set. Every card registers into a
  shared `nodeRefs` map (via `TreeCtx`); a `useLayoutEffect` measures
  parent/child `getBoundingClientRect()` pairs to draw cubic-bezier SVG
  connectors between columns (hidden below `md` — columns stack, a "under
  {parent}" caption substitutes). A live dashed "ghost" connector previews
  the pending drop target while dragging, read straight from the DOM
  during render (not through state). Card background is depth-based
  (`--color-level-0/1/2`, pure gray scale, distinct from the navy-tinted
  `surface`/`surface-2`). Drag/reparent mechanics (grip handle,
  long-press, `moveTask`) are unchanged by any of this.
- **Calendar week view** (`src/components/week-calendar.tsx`): `hourHeight`
  is runtime-measured (`ResizeObserver` on the scroll container ÷ 12
  visible hours), reused for all position/drag math. Drag-to-move is
  optimistic (`useOptimistic`) inside the same transition as the
  `moveBlock` call, so there's no flash back to the old spot. A stationary
  pointerdown/up (under `CLICK_THRESHOLD_PX`) is treated as a click, not a
  drag, opening `BlockEditModal` instead of firing a no-op move. A live
  now-line uses `nowClockInTimezone(timezone)` (the profile's timezone,
  not the browser's). Week nav lives in a separate `WeekNav` client
  component (`router.push` inside `useTransition`, dims instead of
  flashing while pending) — this file has no navigation itself.
- **Stats** (`src/app/(app)/stats/page.tsx`): server fetches a bounded
  12-month window of `blocks` + all non-archived `tasks` (every depth);
  `StatsExplorer` (tag multi-select + range-preset plot + insight card)
  and `TagBreakdown` (single tag + interval → counts) do all
  filtering/aggregation client-side — this is interactive filtering, not
  something that benefits from a server round-trip per change. `LineChart`
  is a dependency-free hand-rolled SVG chart (matches `bar-chart.tsx`'s
  existing no-library approach); series color is each tag's own `color`
  (not a generated palette), reusing the identity color already used for
  pills/blocks everywhere else.
- **NavShell** (`src/components/nav-shell.tsx`) content width: `/calendar`
  and `/tasks` (+ `/tasks/archive`) get `max-w-full`; every other route is
  capped `max-w-3xl`.
- `contrastText()` (tag-color legibility) lives in `src/lib/color.ts`,
  shared by the calendar and Stats.

## Page review

One line per page — update after each visual pass. Detailed notes for an
in-progress review go in the "Open items" section below, then fold back
to a single line here once resolved.

- **Onboarding** — confirmed good.
- **Hub** — not yet reviewed.
- **Tasks** — v1 of the 3-column tree + tag groups just built, pending
  visual review.
- **Calendar** — click-to-edit modal, block descriptions, now-line, and
  the next-week/flicker fixes just built, pending visual review.
- **Settings** — confirmed good except: sync options untested; new "Tag
  groups" section pending visual review.
- **Stats** — full rewrite just built, pending visual review.

## Open items

*(Nothing outstanding right now — add a `Q:`/`A:` pair here when a
decision needs the user's input before building, or a short note when
something needs a live look before it can be marked reviewed above.)*

## Not yet built

- Automatic/periodic `.ics` sync (currently manual "Sync now") — port
  `src/lib/actions/ics.ts`'s parse/upsert into a Supabase Edge Function on
  `pg_cron` (not Vercel Cron — Hobby tier is once/day).
- Google Calendar OAuth (`/api/google-calendar/callback`, token storage in
  `google_calendar_connections`, wire the two disabled Settings buttons).
- The deliberate visual-design polish pass (explicitly scoped separate
  from functional work).
- A "current streak" Stats metric (consecutive days with a completed task
  or logged block) — no natural home in the current plot/insight-
  card/breakdown trio yet.
- Deploy to Vercel for real multi-device testing against the shared DB.
