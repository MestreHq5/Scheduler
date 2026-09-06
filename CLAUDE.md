# CLAUDE.md

Single source of truth for **Scheduler** — a single-user, purpose-built
replacement for a Notion setup used to plan Aerospace Engineering
coursework (tasks + study-time scheduling). Cares a lot about visual
design (not a generic dashboard template) and about two flows staying
near one-tap: logging a study block, checking off a task. Used mobile
day-to-day, desktop for weekly (Sunday) planning.

## Stack

- Next.js 15 (App Router, TypeScript). Deployed to Vercel
  (`getscheduler.vercel.app`), GitHub App connected — every push to
  `main` auto-deploys to production.
- Supabase free tier: Postgres + Auth + Storage. RLS is the backstop, not
  the only check — Server Actions in `src/lib/actions/` do the mutations.
- Auth: Supabase Auth, Google OAuth primary + email magic-link fallback.
  No passwords.
- Tailwind v4, custom tokens only (`src/app/globals.css`, `--scheduler-*`
  → `--color-*`) — dark "dusk cockpit" (default) + light theme, toggled
  via `data-theme` on `<html>`. Fraunces (display/serif) + Space Grotesk
  (UI). **Never hardcode a hex color when a token fits.**
- `src/lib/database.types.ts` is hand-written to match
  `supabase/migrations/`; regenerate via `npx supabase gen types
  typescript --linked` instead of hand-editing further, once linked.
- App logo/favicon: `public/logo.png` / `src/app/icon.png`.

## Rules that aren't obvious from the code

- **Tasks and blocks are NOT linked** — connected only implicitly via
  shared `tag_id`. Tried as a real relation and explicitly rejected (too
  much upkeep). Don't reintroduce one.
- **Parent/child task auto-completion is enforced in Postgres**
  (`tasks_derive_done` + `tasks_propagate_to_ancestors`, `0001_init.sql`)
  — a task with children always has `done` derived from them,
  bidirectionally, up to 3 nesting levels (`depth` 0–2, a trigger rejects
  a 4th).
- **`moveTask` (`src/lib/actions/tasks.ts`) always detaches the moved
  task's direct children first** (promoting them to independent roots),
  then reparents the moved task — this ordering is what makes a cycle
  impossible in one rule. Depth cascades via `tasks_after_depth_cascade`
  (`0003_task_move_and_completed_at.sql`). Task delete is permanent, no
  undo — UI always confirms first.
- **Blocks store plain wall-clock `date`/`start_time`/`end_time`**, never
  a UTC instant — immune to timezone changes, `.ics` imports included.
  `imported_events`/`frozen_*` (`src/lib/actions/profile.ts`) is a
  separate, currently-unused mechanism reserved for a future Google
  Calendar import (real UTC instants, frozen on timezone change) —
  nothing writes to it today.
- **`.ics` import is a one-shot action, not a persistent feed**
  (`importIcsAsTag`, `src/lib/actions/ics.ts`): pick a file, type a tag
  name, every event becomes a `blocks` row under a freshly-created tag
  (one shared color/title). No stored feed, no re-sync — import again
  under a new tag name any time. Converts UTC `DTSTART`/`DTEND` to
  wall-clock via `instantToLocalParts` using the profile's timezone *at
  import time*, then it's fixed forever like any block. `parseIcs`
  (`src/lib/ics.ts`) doesn't expand `RRULE` — the Settings Help modal
  tells the user (or an AI building the file) to write one `VEVENT` per
  date instead. A more complex feed-tracking version of this (fixed
  "classes"/"tests" slots, re-syncable, dedupe columns) was built and
  replaced by this simpler design in the same session — don't resurrect
  it without re-checking it's still wanted. `ics_feeds`, `imported_events`
  storage, and `blocks.ics_source`/`ics_uid` are vestigial leftovers from
  that (see Data model, Not yet built).
- **A tag or its whole group can opt out of `duplicateWeek`**
  (`exclude_from_duplicate`, `0008_tag_exclude_from_duplicate.sql`) —
  skipped if its own tag OR the tag's group has the flag; tagless blocks
  always copy. Toggled via a "Skip copy" pill next to "Work"/"Study".
- **`WeekNav` force-prefetches both neighboring weeks**
  (`router.prefetch(href, { kind: PrefetchKind.FULL })`) so clicking
  through weeks feels instant. `PrefetchKind` isn't exported from public
  `next/navigation` — deep-imports `next/dist/client/components/router-
  reducer/router-reducer-types`. The *default* prefetch (no `kind`) only
  warms the static shell for this `searchParams`-driven page, not the
  actual Supabase data — don't simplify this back, it stops helping.
- **Calendar-date arithmetic must never round-trip through a local-time
  `Date` + `.toISOString()`** — silently shifts results a day under a
  positive UTC offset (broke "next week" and `duplicateWeek` separately
  before being caught). `src/lib/dates.ts` does all date-part math in
  pure UTC millis (`addDays`, `daysBetween`, `resolveRangePreset`) —
  always reuse those instead of a new local-`Date` version.
- **Tag groups** (`tag_groups`: label, color, `is_study_unit`,
  sort_order) — a group's `is_study_unit` drives the "Study {label}"
  block-title treatment (`deriveBlockTitle`, `src/lib/tags.ts`); falls
  back to the legacy per-tag `kind` column only for tags that predate
  groups. Picking a group pre-fills (and re-fills) a tag's color; no
  group → random preset color. Color pickers are always the custom
  `ColorPicker` component, never the bare native input.
- **`counts_as_work`** (per tag, default `true`) drives the Hub's daily
  work-progress bar; tagless blocks always count. **`exclude_from_
  duplicate`** follows the same "tagless always included" precedent.
- **Tag delete → referencing tasks/blocks become tagless.** **Tag/group
  archive or delete → cascades to that tag's *future* tasks/blocks
  only**; past stays untouched, unarchive reverses exactly that set.
- **Task nesting caps at 3 levels; block titles are always auto-derived
  from the tag**, never typed, everywhere.
- **Tag colors are freely repeatable** — lets several tags share a
  "group color" on purpose.
- **Every `tags`/`tag_groups` fetch must order by `.order("sort_order")
  .order("created_at")`, never `sort_order` alone.** `sort_order`
  defaults to `0` for every row (nothing sets it otherwise), so Postgres
  doesn't guarantee stable order across queries with an all-ties column
  — caused a real bug where a "Work"/"Skip copy" pill toggle looked like
  it hit the wrong tag because the list silently re-sorted between click
  and re-render. `created_at` is a stable tiebreaker.
- Migrations are applied to the live Supabase project via a short-lived
  Node script (`pg` package + `SUPABASE_DB_URL` from `.env.local`,
  `npm install --no-save pg`, removed after) — no staging environment,
  so ask before anything non-additive (dropping/narrowing a column).
- The Supabase DB password passed through chat in plaintext during setup
  and still lives in `.env.local` — rotate it once the app is stable.

## Explicitly rejected — don't re-propose without new information

- Task ↔ block relation with manual reassignment.
- Side-by-side stats/column layouts on mobile — single-column by
  default, side-by-side only on wide viewports.
- A full calendar-grid embedded on the Hub — superseded by a single-
  *day* view (today only); don't reflate it into a full week grid.
- Connector lines/nodes and FLIP slide-on-expand animation in the task
  tree — both cut (fragile SVG geometry, broke often); the columned/
  indented spacing now carries the nesting signal on its own.

## Data model

Authoritative source: `supabase/migrations/` + `src/lib/database.types.ts`.

- **`tags`**: `{ id, label, color, kind (legacy), group_id, counts_as_work
  (default true), exclude_from_duplicate (default false), archived,
  sort_order }`.
- **`tag_groups`**: `{ id, label, color, is_study_unit,
  exclude_from_duplicate (default false), sort_order }`.
- **`tasks`**: `{ id, title, tag_id, done (derived), due_date, notes,
  parent_id, depth (0–2), completed_at, created_at }`.
- **`blocks`**: `{ id, tag_id, title (auto-derived), date, start_time,
  end_time, details (≤30 chars — short label, shown on the calendar
  card), location (≤60 chars, `0009_block_location.sql`), notes
  (unrestricted, `0010_block_notes.sql` — long-form, edit-modal only,
  never shown on the card), ics_source/ics_uid (nullable, vestigial),
  created_at }`. `tag_id` may be null (tag deleted, or a tagless block
  created via calendar double-click) — `title` then just reads "Block".
- **`ics_feeds`**, **`imported_events`**: vestigial, unused by any
  current code path (see Rules' `.ics` import bullet).
- **`google_calendar_connections`**: not wired up yet.

## Build/lint

- `npm run dev` / `npm run build` (typecheck + lint too) / `npm run lint`

## Architecture notes (non-obvious implementation details)

- **Task tree** (`src/components/task-tree.tsx`): one 3-column grid
  **per root task**, stacked vertically — guarantees a root always
  starts below the *entire* expanded subtree of the root above it (was a
  real bug when columns were tree-wide). `expandedIds` seeds on mount
  with every task that has children (fully open by default). Drag-
  reparent is **optimistic** (`useOptimistic`) — `applyOptimisticMove`
  locally replays `moveTask`'s detach-then-reparent rule; a failed move
  shows a dismissable error and self-reverts. Card background is depth-
  based (`--color-level-0/1/2`). Below `md`, groups render root → its
  children → its grandchildren (flat, grouped by depth — not properly
  per-parent), with a left-margin indent per depth (`MOBILE_INDENT`,
  pure margin, not `pl-*`, so it can't collide with the card's own
  padding) standing in for the desktop column layout. Known gap: because
  grandchildren are still grouped by depth rather than rendered
  recursively under their actual parent, indentation alone can't fully
  disambiguate ownership when a root has multiple children that each
  have their own children — fixing that means real recursive rendering
  on mobile without regressing desktop's column layout (same grouping
  data). Not done. The due-date picker sits on its own line below the
  tag/count/subtask row (was sharing one wrappable row, overflowed
  sideways on narrow phones with a long tag label).
- **Calendar week view** (`src/components/week-calendar.tsx`) takes an
  arbitrary-length `weekDates` array (lets the Hub reuse it as a single-
  day view, including on the Hub). `hourHeight` is runtime-measured
  (`ResizeObserver` ÷ 12 visible hours). Block cards are always exactly
  two lines, both CSS-truncated as a width-overflow safety net (never
  wrapped, never a third line): line one is the tag's group label (just
  the tag label if it has no group; falls back to the block's stored
  `title` when tagless) plus `· details` if the short `details` field is
  set; line two is `location · time` if `location` is set, else just the
  time range. `notes` (the long-form field) is never shown on the card at
  all — it only appears in `BlockEditModal`, which is also the only place
  it can be edited (unlike `details`/`location`, it's not in
  `QuickAddBlock`). The weekday header
  is its **own sticky wrapper, not a grid row inside the scrolling
  grid** — CSS Grid computes a sticky item's containing block as its own
  (short) row track, so a header cell that's just one row of a tall grid
  runs out of room to stay stuck and detaches after a small amount of
  scroll; splitting the header into a sibling `sticky top-0` block
  (matching `gridTemplateColumns` so columns still align) gives it the
  whole scrollable height as its containing block instead. Don't merge
  the header back into the same grid as the day columns. Double-clicking
  empty space in a day column (guarded by `e.target === e.currentTarget`
  so it never fires on top of a block) calls `createBlock` with
  `tag_id: null` for the clicked hour, rounded down (23:00 clamps its end
  to 23:59 since `time` has no 24:00). Drag-to-move and edge-resize are
  both optimistic inside the same transition as the server call. A
  stationary pointerdown/up (under `CLICK_THRESHOLD_PX`) opens
  `BlockEditModal` instead of firing a no-op move. The now-line uses the
  profile's timezone, not the browser's. `WeekNav` is a separate client
  component (see Rules' prefetch bullet). The scroll container has an
  even `p-2` padding — safe because `position: sticky` offsets resolve
  against the *padding* edge of the scrolling ancestor, so it reads as a
  permanent margin rather than a scrolling gap.
- **Date/time pickers** (`wheel-date-picker.tsx`, `circular-time-
  picker.tsx`): full keyboard control (arrows move/nudge, Enter
  commits). The time dial is a 24h face with outer (1–12) and inner
  (13–23 & 00) rings rendered simultaneously — no AM/PM anywhere.
- **Hub** (`src/app/(app)/page.tsx`): 2-column (stacks on mobile) —
  `DeadlinesPanel` + `TagTracker` left, single-day `WeekCalendar` right.
  `WorkProgress` bar sums today's `counts_as_work` blocks, elapsed vs.
  total, with in-progress blocks counting proportionally.
- **Stats** (`src/app/(app)/stats/page.tsx`): server fetches a bounded
  12-month window; `StatsExplorer`/`TagBreakdown` do all filtering
  client-side. `LineChart` is a dependency-free hand-rolled SVG chart;
  series color is each tag's own color. Insight card only shows period-
  over-period % change/trend — most-active-weekday and a completion-rate
  insight were tried and cut, don't re-add without asking.
- **Settings' "Import .ics"** (`ics-import-form.tsx`): tag-name input +
  file input + Import button, no sync/status bookkeeping in the UI.
  Errors from `importIcsAsTag` are caught locally (`try`/`catch` inside
  the `useTransition` callback) and shown inline — letting that reject
  unhandled once crashed the page; don't drop this try/catch.
  `IcsHelpModal` is static content for a non-technical reader *and* an
  AI generating the file — central point: one event per date, no RRULE.
- **NavShell** (`src/components/nav-shell.tsx`): every page shares
  `max-w-5xl px-4 md:px-8`. Sidebar nav rows and the bottom email/theme/
  log-out group are centered as **shrink-to-fit groups** (no `w-full` on
  the buttons — that stretches the hover background full-width and reads
  as left-aligned). `html { scrollbar-gutter: stable }` stops the
  sidebar shifting between tall/short pages. Mobile bottom nav is
  `fixed bottom-0` with an explicit `z-40` (added after a report of page
  content visually crossing above it).
- Light theme is deliberately a step darker than raw white (`bg`/
  `surface`/`surface-2` are grays, not `#fff`), body text is
  `font-weight: 500` — plain 400 on near-white read as washed out.
- `contrastText()` (`src/lib/color.ts`), `randomTagColor()`/
  `deriveBlockTitle()` (`src/lib/tags.ts`), `formatDateDMY()`
  (`src/lib/dates.ts`, `DD/MM`/`DD/MM/YYYY`, always zero-padded) — reuse
  these; never render a raw `YYYY-MM-DD` or hand-roll a tag color.

## Mobile review

Write notes under the relevant heading from a real phone — plain
description, nested `Q:`/`A:` for anything needing a decision. Once
addressed, wipe back to a short confirmed-status line; durable findings
belong in Architecture Notes/Rules above, not here.

### Onboarding / Login / Settings / Stats

Confirmed good.

### Hub / Calendar

Fixed — bottom nav `z-40`, calendar card `p-2` padding (see Architecture
Notes). Not yet re-verified on a real device.

### Tasks

Fixed — mobile indent/card-size, due-date line split, bolder "under X"
label (see Architecture Notes). Open question: multi-child grandchild
grouping is still ambiguous on mobile (see Architecture Notes' "known
gap") — try the current fix on a phone first; ask for the recursive-
rendering version specifically if it's still unclear.

### Other

Fixed — bottom nav is `fixed` + `z-40`, unambiguously always on top.
Desktop sidebar was already `sticky top-0 h-dvh`.

## Not yet built

- Persistent/re-syncable `.ics` feeds — deliberately not how it works
  now (see Rules); a from-scratch feed model would be needed if wanted
  later. Related cleanup, not urgent: `ics_feeds` table, `ics-feeds`
  storage bucket, `blocks.ics_source`/`ics_uid` are safe to drop once
  confirmed nothing needs reviving from them.
- Google Calendar OAuth (`/api/google-calendar/callback`, token storage
  in `google_calendar_connections`) — no Settings UI teaser either.
- The deliberate visual-design polish pass (scoped separate from
  functional work).
- A "current streak" Stats metric — considered, not built (no natural
  home in the current plot/insight-card/breakdown trio).
