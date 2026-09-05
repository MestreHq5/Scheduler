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
- App logo/favicon is `public/logo.png` (also `src/app/icon.png`) — a
  real asset now, not the earlier placeholder inline SVG. Used on
  login/onboarding/404 and the sidebar.

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
  (`0003_task_move_and_completed_at.sql`). Task delete is permanent
  (`deleteTask`) — the UI always confirms first, there's no undo/trash.
- **Blocks store plain wall-clock `date`/`start_time`/`end_time`**, not a
  UTC instant — deliberately immune to timezone changes. `imported_events`
  (`.ics`/Google) DO store a real UTC instant, so a timezone change only
  needs to touch that table (freezes past events' display via `frozen_*`
  columns, future ones re-derive live) — see `src/lib/actions/profile.ts`.
- **Calendar-date arithmetic must never round-trip through a local-time
  `Date` + `.toISOString()`** — that silently shifts results a day under
  a positive UTC offset. This broke "next week" *and*, separately,
  `duplicateWeek` (its own inline instance of the same anti-pattern, not
  caught by the first fix) before being caught. `src/lib/dates.ts` does
  all date-part math in pure UTC millis (`addDays`, `daysBetween`,
  `resolveRangePreset`, etc.) — always reuse those helpers for new date
  math instead of writing another local-`Date` version.
- **Tag groups replace the old fixed `kind: unit/other` split**
  (`0005_tag_groups.sql`): `tag_groups (label, color, is_study_unit,
  sort_order)`, tags get a nullable `group_id`. A group's
  `is_study_unit` drives the "Study {label}" block-title treatment
  (`deriveBlockTitle`, `src/lib/tags.ts`) — falls back to the legacy
  `kind` column only for tags that predate groups and were never
  assigned one (kept, NOT NULL relaxed, not backfilled — no need, the
  fallback covers it). Picking a group pre-fills its color (still
  editable, and re-fills whenever the group selection changes again,
  both at tag creation and when re-grouping an existing tag); no group →
  a random preset color. Color pickers everywhere are the custom
  `ColorPicker` component (curated swatch grid + a tucked-away native
  `<input type=color>` for anything else) — never the bare native input.
- **A tag's `counts_as_work` flag** (`0006_tag_counts_as_work.sql`,
  default `true`) drives the Hub's daily work-progress bar — lets Gym/
  Free-style tags opt out of counting as "work". Tagless blocks always
  count. Toggled per tag in Settings (styled pill, not a checkbox).
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
- Side-by-side stats/column layouts on mobile — single-column by default,
  side-by-side only on wide viewports.
- A full calendar-grid embedded on the Hub was once rejected for mobile —
  since superseded: the Hub now embeds a single-*day* view (today only),
  which is a deliberately smaller thing than the earlier "full grid"
  proposal. Don't reflate it into a full week grid there.

## Data model

Authoritative source: `supabase/migrations/` + `src/lib/database.types.ts`.

- **`tags`**: `{ id, label, color, kind: "unit"|"other"|null (legacy),
  group_id (nullable → tag_groups), counts_as_work (default true),
  archived, sort_order }`.
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

- **Task tree** (`src/components/task-tree.tsx`): one 3-column
  (main/sub/sub-sub) grid **per root task**, stacked vertically — not one
  tree-wide set of 3 columns. This is what guarantees a root's card
  always starts below the *entire* expanded subtree of the root above it
  (no cross-root bleed) — a real bug when it was tree-wide (a short
  subtree in one root left the next root's card floating beside a much
  taller neighboring column). No connector lines/nodes and no FLIP
  slide-on-expand animation anymore — both were cut (SVG connector
  geometry was fragile and broke often; the columned-per-root spacing
  now carries the "which subtree is this in" signal on its own).
  `expandedIds` (a `Set`) still lives centrally in `TaskTree`, **seeded
  on mount with every task that has children** (fully open by default —
  collapsing is a user action, not the initial state); a task's children
  only render in the next column while its id is in the set, and adding
  a first subtask via the inline quick-add calls `ensureExpanded` so
  it's immediately visible. Drag-reparent (grip handle, long-press,
  `moveTask`) is now **optimistic** (`useOptimistic`, mirroring
  `week-calendar.tsx`'s pattern) — `applyOptimisticMove` locally
  replays the same detach-children-then-reparent rule `moveTask` runs
  server-side so the move is instant instead of waiting on a full
  round-trip + revalidate; a failed move surfaces a dismissable error
  banner and self-reverts. Card background is depth-based
  (`--color-level-0/1/2`, pure gray scale, distinct from the
  navy-tinted `surface`/`surface-2`). Below `md` everything still
  stacks into one column, so a group is now root → its children → its
  grandchildren, in that order — also fixes a pre-existing mobile bug
  where all roots listed first, then every child of every root mixed
  together, then every grandchild.
- **Calendar week view** (`src/components/week-calendar.tsx`) now takes
  an arbitrary-length `weekDates` array (grid columns and weekday labels
  are both derived from the array/date, not hardcoded to 7/Monday-start)
  — this is what lets the Hub reuse it as a single-day view. `hourHeight`
  is runtime-measured (`ResizeObserver` on the scroll container ÷ 12
  visible hours), reused for all position/drag/resize math. Drag-to-move
  and edge-resize (two small handles per block, independent `resize`
  state from `drag`) are both optimistic (`useOptimistic`) inside the
  same transition as the `moveBlock` call. A stationary pointerdown/up
  (under `CLICK_THRESHOLD_PX`) is a click, not a drag — opens
  `BlockEditModal` instead of firing a no-op move. A live now-line uses
  `nowClockInTimezone(timezone)` (the profile's timezone, not the
  browser's). Week nav lives in a separate `WeekNav` client component
  (`router.push` inside `useTransition`, dims instead of flashing while
  pending) — this file has no navigation itself. New blocks default to
  the next full hour from now (`nextHourSlot` in `quick-add-block.tsx`).
- **Date/time pickers** (`wheel-date-picker.tsx`, `circular-time-
  picker.tsx`) both support full keyboard control now: the date wheel's
  ←/→ move focus between day/month/year, ↑/↓ nudge the focused column's
  value (a `WheelColumn` `useEffect` on `value` syncs its scroll position
  to *external* changes, not just its own scroll gesture), Enter commits.
  The time dial is a real 24h Android-style face — the hour step renders
  outer (1–12) and inner (13–23 & 00) rings simultaneously, tap either
  directly; ←/→ rotate the value by 1h (crossing rings naturally at the
  wrap), ↑/↓ jump exactly ±12h (same clock position, other ring), Enter
  commits. No AM/PM anywhere anymore.
- **Hub** (`src/app/(app)/page.tsx`): a 2-column layout (stacks on
  mobile) — left: `DeadlinesPanel` (due-date range presets: today/3
  days/week/2 weeks) + `TagTracker` (pick tag(s), see each one's next 5
  upcoming blocks — e.g. add a "Tests" tag and track every exam at a
  glance); right: `WeekCalendar` reused with `weekDates={[today]}`. A
  `WorkProgress` bar above both sums today's blocks whose tag
  `counts_as_work` (tagless blocks always count) and shows elapsed vs.
  total, blocks-in-progress counting proportionally so it creeps forward
  smoothly rather than jumping once per finished block.
- **Stats** (`src/app/(app)/stats/page.tsx`): server fetches a bounded
  12-month window of `blocks` + all non-archived `tasks` (every depth);
  `StatsExplorer` (tag multi-select + range-preset plot + insight card)
  and `TagBreakdown` (single tag + interval → counts) do all
  filtering/aggregation client-side — this is interactive filtering, not
  something that benefits from a server round-trip per change. `LineChart`
  is a dependency-free hand-rolled SVG chart (matches `bar-chart.tsx`'s
  existing no-library approach); series color is each tag's own `color`
  (not a generated palette), reusing the identity color already used for
  pills/blocks everywhere else. Insight card only shows period-over-period
  % change and trend direction — most-active-weekday and a completion-
  rate insight were tried and explicitly cut, don't re-add without
  asking.
- **NavShell** (`src/components/nav-shell.tsx`) content width: every
  page shares the same `max-w-5xl px-4 md:px-8` — was split (`max-w-full`
  for `/`, `/calendar`, `/tasks` + `/tasks/archive`; `max-w-3xl` for
  Settings) until explicitly unified to match Stats everywhere, so the
  calendar/task-tree pages are no longer edge-to-edge on wide viewports.
  Sidebar nav rows, the logo/title block, and the bottom email/theme-
  toggle/log-out group are all centered **as shrink-to-fit groups**
  (`items-center` on their flex-column parents, no `w-full` on the
  buttons) — a plain `w-full` button/link stretches its hover/active
  background the full column width, which reads as left-aligned even
  though the icon+label inside is itself centered. The dotted divider
  above the email is a fixed `w-28`, not `flex-1` on both sides, so it
  doesn't visually outspan that now-narrower centered group beneath it.
  The sidebar/content divider is a soft top-to-bottom gradient line
  (absolutely positioned `w-px` span with a `via-border` gradient), not
  a flat `border-r`. `html { scrollbar-gutter: stable }` (`globals.css`)
  keeps the sidebar from shifting a few px when navigating between a
  page tall enough to need a scrollbar and one that isn't.
- Light theme (`globals.css`) is deliberately a step darker than a raw
  white — `--scheduler-bg`/`surface`/`surface-2` are all light *grays*,
  not `#fff`, and body text gets `font-weight: 500` (Space Grotesk 500
  is loaded in `layout.tsx`) — plain 400-weight text on a near-white
  ground read as washed out.
- `contrastText()` (tag-color legibility) lives in `src/lib/color.ts`,
  shared by the calendar and Stats. `randomTagColor()` and
  `deriveBlockTitle()` live in `src/lib/tags.ts`. `formatDateDMY()`
  (`src/lib/dates.ts`) is the one user-facing date format in the app —
  `DD/MM` or `DD/MM/YYYY`, always zero-padded — `WheelDatePicker`
  computes it once and hands it to callers as `label` alongside the raw
  `value`; never render a raw `YYYY-MM-DD` or a `.slice(5)` fragment.

## Page review

Write notes directly under the relevant heading as you go through `npm
run dev` — plain description, no need to phrase it as a question. Use a
nested `Q:`/`A:` pair right there for anything that needs a decision
before it can be built. Once a page's notes are addressed, this gets
wiped back to an empty heading (or a short confirmed-status line) for
the next pass — so it never carries more than one round's worth at a
time. Everything built last round is written up in Architecture Notes/
Rules above, not repeated here.

### Onboarding

Confirmed good.

### Login

New this pass — logo above "Scheduler," "Ad astra" tagline removed.


### Hub

New this pass — "View all" now sits right next to the "Deadlines"
heading instead of far-right of the row; a deadline/tracked-block's tag
+ date now sit right after its title instead of flush against the far
edge; the gap between the two Hub columns is wider; all dates render
`DD/MM` via `formatDateDMY()`.

### Tasks

New this pass — each root task is now its own 3-column group (see
Architecture Notes), so a root always starts below the *entire*
expanded subtree of the root above it; connector lines/nodes and the
FLIP slide animation are both gone; drag-reparent is optimistic now
(instant move, error banner + auto-revert on failure).

### Calendar

Confirmed good — margin now matches the rest of the app (see Other).

### Settings

Confirmed good — margin now matches the rest of the app (see Other).

### Stats

Confirmed good — still wants a week of real use before being called
bug-free.

### Other

New this pass — logo/favicon swap (new background-less mark, square-
cropped from the source art); sidebar delimiter is now a soft gradient
fade instead of a flat border; logo/title, nav tabs, and the bottom
email/theme-toggle/log-out are all centered as shrink-to-fit groups;
all pages share the same horizontal padding as Stats; light theme
background is a step darker and body text is heavier; the sidebar no
longer shifts a few px between tall and short pages
(`scrollbar-gutter: stable`).
## Not yet built

- Automatic/periodic `.ics` sync (currently manual "Sync now") — port
  `src/lib/actions/ics.ts`'s parse/upsert into a Supabase Edge Function on
  `pg_cron` (not Vercel Cron — Hobby tier is once/day).
- Google Calendar OAuth (`/api/google-calendar/callback`, token storage in
  `google_calendar_connections`, wire the two disabled Settings buttons).
- The deliberate visual-design polish pass (explicitly scoped separate
  from functional work).
- A "current streak" Stats metric — considered, not built (no natural
  home in the current plot/insight-card/breakdown trio).
- Deploy to Vercel for real multi-device testing against the shared DB.
