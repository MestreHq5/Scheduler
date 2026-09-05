# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working
with code in this repository. It is the **single source of truth** for
this project — it used to be split across `CLAUDE.md` and `spec.md`; the
two have been collapsed into this file and `spec.md` no longer exists.

## What this project is

"Scheduler" — a single-user (extensible to a few friends), purpose-built
replacement for a Notion setup used to plan Aerospace Engineering
coursework (tasks + study-time scheduling). The Notion version worked
functionally but was visually generic and templated, and had one
structural gap (parent/child task auto-completion) Notion can't do
natively. This is a from-scratch **substitute**, not a complement.

All of the original spec's "Open questions" are now **answered and
implemented** — see the decisions below.

## Who this is for / product priorities

- One user only. No multi-tenant concerns, no team features, no sharing.
- Studying Aerospace Engineering, semester-based, with a fixed-ish set of
  curricular units (tags) per semester that changes each semester.
- Wants speed above all for the two daily-use flows: logging a study
  block, and checking off tasks. Both must be as close to one-tap as
  possible — every extra tap/field in these two flows should be
  scrutinized.
- Cares about visual design — meant to look and feel intentional, not a
  generic dashboard template. Take real care with typography, color, and
  layout.
- Used primarily on mobile day-to-day (checking off tasks, logging blocks
  between classes), but also needs a solid desktop/wide view for weekly
  planning sessions (the Sunday planning workflow below).

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
- **App name is "Scheduler" everywhere** — title/metadata, login page,
  sidebar logo, `package.json` `name`. ("Aero Hub" was a wrong name
  introduced by an earlier session and has been fully removed.) The
  calendar/week-view section is routed at `/calendar` (nav label
  "Calendar") — not `/scheduler`, to avoid clashing with the app name.

## Core workflows (why the product is shaped this way)

- **Sunday planning session**: brain-dump the week's tasks into a flat
  list (title + tag, due dates optional — only real deadlines get one),
  then build the week's study blocks on the Calendar page (tag + time range,
  no typing). Tasks are never pre-assigned to specific blocks.
- **Sitting down to study**: user opens a tag-filtered view of open tasks
  (e.g. tagged "Aero II") and decides in the moment what to work on. This
  is *why* tasks and blocks are only ever connected implicitly via tag,
  never via a stored relation.
- **Checking off tasks**: simple checkbox toggle, no rollover mechanic —
  an unfinished task just stays unchecked and reappears next time the tag
  is filtered.
- **Tree view of tasks**: parent tasks and children are visually
  associated as a true indented tree (not Notion's board-grouped-by-parent
  workaround). Main tasks render as visually separated "branch" cards,
  collapsed by default; clicking a node's toggle opens that branch,
  indented — same collapse/expand behavior at every nesting level (see
  Architecture notes).
- **Central Hub**: quote/phrase (customizable text) → hero visual → Today's
  blocks → Tasks → Deadlines → Stats, in that fixed order (see below).
- **Calendar page**: needs a real calendar/agenda view (day + week minimum) —
  purpose is retrospective ("was my week effective?"), not just an
  upcoming-blocks list. A tag-grouped view is useful but secondary.
- **Calendar import**: two live `.ics` feeds from the university (classes,
  tests/exams), synced periodically, shown on the same calendar as
  Scheduler blocks but visually distinguishable and never conflated with
  self-planned blocks or Tasks. Auto-generating Task entries from imported
  exam events is a possible future feature, not built.

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
- **Task drag-and-drop reparenting**: grip-icon handle only (not whole-row
  drag, to avoid fighting click-to-edit and tap-to-toggle). Desktop:
  click-drag. Mobile: long-press, with the press duration configurable in
  Settings → Interaction so the user can tune it by feel. Reparenting
  rules are detailed in "Architecture notes" (`moveTask`) below.
- **Completed main tasks**: the tree only loads not-done tasks plus the 3
  most-recently-completed main tasks (by real `completed_at`, not
  `updated_at`) and their full subtree; older completed tasks stay in the
  DB and reappear the moment their main task is un-done. Completed tasks
  render at 50% opacity with a left-to-right strike-through animation
  (`ease-out` — fast start, slow finish). `/tasks/archive` lists all
  completed main tasks + subtree, newest first, 5 main tasks per page.
- **Date/time pickers**: due dates and block times use a themed iOS-style
  scrolling wheel (date) and Android-style circular dial (time) — never
  native `<input type=date/time>` — consistent across Tasks and Calendar.
- **Tag colors are freely repeatable**, not unique per tag — this lets
  multiple tags (e.g. individual imported classes) share one visual
  "group color" deliberately.
- **Block titles are always auto-derived from the tag** (e.g. "Study Aero
  II", or bare "Gym"/"Free" for non-unit tags) — never typed.
- **Hub section order is fixed and deliberate**: Today's blocks → Tasks →
  Deadlines → Stats. Don't reorder without a reason (tuned from real Notion
  usage — Tasks was promoted above Stats/Deadlines after a mobile pass).
- **Mobile-first** for logging a block and checking off a task — both must
  stay near one-tap. Single-column mobile layouts; side-by-side only on
  wide viewports (a Notion-era side-by-side stats layout was reverted for
  this reason — don't reintroduce it on mobile).
- **Theme**: dark "dusk cockpit" (default) and a light variant, toggled via
  a button in the sidebar next to Log out, persisted to `localStorage`
  (`scheduler-theme`) and applied via a `data-theme` attribute on
  `<html>`. A tiny inline bootstrap script in `src/app/layout.tsx` sets
  that attribute before first paint to avoid a flash of the wrong theme.
  Color tokens live in `src/app/globals.css` as CSS custom properties
  overridden per theme — never hardcode a hex color in a component when an
  existing token fits; add a new token pair (dark + light) instead.
- **Sidebar is sticky** on desktop (`md:sticky md:top-0 md:h-dvh`) — it no
  longer scrolls away with page content.
- **Calendar page gets extra width**: unlike every other page (capped at
  `max-w-3xl` by `NavShell`'s content wrapper), `/calendar` opts out to use
  the full available width so all 7 day columns fit without horizontal
  scroll at any viewport size, including mobile (see Architecture notes —
  this **reverses** the earlier "mobile horizontal-scroll is an accepted
  exception" decision from the previous review round).
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
  exactly that set. See `src/lib/actions/tags.ts`. Tags are created/edited
  from a modal (available on the Tasks page, and reachable from Settings →
  Tags), not a full-page form.
- **No semester-rollover feature** — the user just keeps editing/archiving
  the same flat tag list indefinitely, no "start new semester" action.
- **Stats are current-week-focused but support week-over-week comparison**
  (this week vs. last 2), not a full historical browser — see `/stats`.
- **Duplicate-week button** on the Calendar page copies a week's blocks forward
  one week, allows overlap with whatever's already there (user resolves
  collisions manually), and never touches the source (past) week.
- **Calendar blocks that overlap in time split the column width evenly**
  (two overlapping = half each, three-way = thirds); the user resolves
  awkward multi-way overlaps manually rather than the UI special-casing
  them further.
- **`.ics` calendar sync accepts either a live URL or an uploaded file**
  per source (classes/tests) — the two live feed URLs weren't available at
  spec time and may never be reliably link-shaped, so file upload is a
  first-class option, not a fallback. Google Calendar import/export is a
  **separate, explicit** connection (UI always states which direction is
  active) — never silently conflated with `.ics` upload.
- **`.ics` feed display names are user-editable**, not hardcoded
  "Classes"/"Tests" wording — `source` ('classes'/'tests') stays as the
  internal identifier for the two feed slots, but `ics_feeds.label` (added
  in `0004_ics_feed_labels.sql`) is what's shown in Settings, so the two
  import slots work for any kind of recurring event feed, not just this
  user's university classes/tests.
- **Stats avoid hardcoded assumptions about the user's tags** (e.g. no
  "Gym" reference) — the completed-tasks trend counts main tasks generally
  rather than filtering by a specific tag label. See "Plan for next
  session" for further stats ideas proposed but not yet built.

## Explicitly rejected / deferred — don't re-propose without new information

- **Task ↔ Scheduler Block relation with manual "roll to next block"
  reassignment.** Tried conceptually in the Notion prototype, rejected
  after thinking through real usage — too much upkeep for marginal
  benefit. Tasks and blocks connect only via shared tag, at view-time, not
  via a stored relation.
- **Full calendar-grid view embedded on the Hub/home screen.** Rejected in
  favor of a compact sorted deadlines list, specifically for mobile
  usability.
- **Side-by-side column layouts on mobile-first views.** The Notion
  version originally had two stats charts side by side; this was reverted
  to stacked after recognizing it doesn't work on narrow screens. Keep
  mobile layouts single-column by default; use side-by-side only on
  wide/desktop viewports if at all.
- **Cinematic sideways-branching tree view for Tasks** — deferred, not
  rejected. The user wants this but has no sketch/reference yet and asked
  to settle drag-and-drop reparenting first (now done). Check in for a
  reference/sketch before attempting the visual redesign.

## Data model (conceptual reference — `src/lib/database.types.ts` and
`supabase/migrations/` are the authoritative, current source)

**Tag** (shared across Tasks and Calendar): `{ id, label, color, kind:
"unit" | "other" }` — `kind` distinguishes curricular units (get the
"Study {unit}" title treatment) from non-academic tags like Gym /
Free - Other. Units are semester-specific and expected to change every
semester — never hardcode a unit list as permanent. `color` is not unique
— tags may deliberately share a color (see "group color" decision above).

**Task**: `{ id, title, tag_id, done, due_date, notes, parent_id,
completed_at, created_at }`. `done` on a parent is derived from children
(3-level cap, bidirectional — see Architecture notes), not freely editable
once it has children. `completed_at` drives "most recently completed"
ordering (Hub/Tasks/archive), distinct from `updated_at`.

**Scheduler Block**: `{ id, tag_id, title (auto-derived), start_time,
end_time, date, details, created_at }`.

**Imported Event** (from `.ics`/Google): `{ id, source: "classes" |
"tests", title, start_time, end_time, location, raw_uid (dedupe key on
re-sync), last_synced_at }`.

**`ics_feeds`**: `{ id, source: "classes" | "tests" (internal slot id,
fixed), label (user-facing display name, nullable — falls back to a
generic "Import 1"/"Import 2" placeholder), kind: "url" | "file", url,
storage_path, last_synced_at, last_sync_status, last_sync_error }`.

## Build/lint commands

- `npm run dev` — dev server
- `npm run build` — production build (also runs typecheck + lint)
- `npm run lint` — ESLint only

## Architecture notes

- `src/app/(app)/` — authenticated route group (Hub, Tasks, Calendar,
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
- Task auto-completion is enforced in Postgres via triggers
  (`tasks_derive_done` + `tasks_propagate_to_ancestors` in
  `0001_init.sql`), not computed client-side — a task with children always
  has its `done` derived from them, propagating up all 3 levels,
  bidirectionally (unchecking a child un-completes ancestors too).
- Blocks store wall-clock `date`/`start_time`/`end_time` (not a UTC
  instant) since they're inherently local, not timezone-relative.
  `imported_events` (from `.ics`/Google) DO store a real UTC instant — see
  the timezone bullet above.
- Task drag-and-drop reparenting (`moveTask` in `src/lib/actions/tasks.ts`)
  always detaches a moved task's **direct children first** (promoting them
  to independent root tasks, each their own branch — grandchildren stay put,
  still attached to their own now-promoted parent), then reparents the moved
  task itself. This one rule covers every case the user described (moving a
  grandchild up a level, moving a subtask to a different main task, and
  promoting a subtask to a new main task while leaving its own children
  behind to be moved manually) and means a reparent can never create a
  cycle (the moved task always has zero children by the time its own
  `parent_id` write happens). Depth changes cascade to descendants via the
  `tasks_after_depth_cascade` trigger (`0003_task_move_and_completed_at.sql`)
  since `tasks_set_depth` (0001) only ever set the moved row's own depth.
- Calendar week view (`src/components/week-calendar.tsx`) is an hour grid
  (00:00–24:00, always fully rendered). All 7 day columns are always shown
  side by side with no horizontal scroll at any viewport, including
  mobile — `NavShell` gives `/calendar` a wider content wrapper
  (`max-w-full` instead of the usual `max-w-3xl`) to make room, and the
  grid uses `minmax(0, 1fr)` day columns (no hard px floor) so they shrink
  to fit rather than overflow. The *vertical* viewport always shows
  exactly `VISIBLE_HOURS` (12) hours without scrolling regardless of
  screen height: `hourHeight` is computed at runtime from the scroll
  container's own measured `clientHeight` via `ResizeObserver` (not a
  fixed px-per-hour constant), then reused for all position/drag math so
  block placement and the hour ruler stay in sync. Opens pre-scrolled to
  ~7am. Blocks render with a **solid** tag-color background (not a tinted
  overlay); `contrastText()` picks black or white text per-block from the
  tag color's relative luminance so custom tag colors stay legible. Block
  drag uses pointer events (not HTML5 DnD) so it works with touch, snaps
  to 15-minute increments, and saves via `moveBlock`. The drop itself is
  **optimistic** via React 19's `useOptimistic`: on pointer-up the block
  jumps to its new slot immediately (inside the same transition as the
  `moveBlock` call, so there's no flash back to the old spot while the
  request is in flight); if `moveBlock` throws, the optimistic state is
  discarded automatically and a dismissible error banner names the
  specific block and reason (`"<title>" couldn't be moved — <error>`),
  auto-dismissing after 6s.
- Task tree (`src/components/task-tree.tsx`): each root (`depth === 0`)
  task renders as its own bordered card, spaced apart from its siblings
  (`space-y-4` on the root `<ul>`), so main tasks read as separate
  branches rather than one continuous list. Every node with children
  starts **collapsed** (`expanded` state defaults to `false`) at every
  depth — clicking its round toggle button reveals that branch, indented
  further than before (`ml-8`/`ml-9` + a `border-l-2` branch line, up from
  the original `ml-6`/`border-l`). This is a UI-only change; the
  underlying drag-and-drop reparenting rules below are unaffected.

## Current status (as of the last working session)

Deployed against a real Supabase project. **All four migrations
(`0001_init.sql` through `0004_ics_feed_labels.sql`) have been run against
the live project** — RLS, triggers, the `ics-feeds` storage bucket,
`tasks.completed_at`, `profiles.task_drag_hold_ms`, the depth-cascade
trigger, and `ics_feeds.label` are all live and verified present via a
direct Postgres connection (`SUPABASE_DB_URL` in `.env.local`, used only
for one-off admin scripts like this — the app itself never reads it). The
task drag-hold setting, task move, `completed_at` ordering, and `.ics`
feed labels should now all work end-to-end. Google OAuth + email
magic-link login both work (verified by code review — `signInWithOtp` +
`src/app/auth/callback/route.ts`'s `exchangeCodeForSession`; if it doesn't
work in practice, check Supabase Auth's email/SMTP settings and the
redirect-URL allowlist first, not the app code). Build/lint are clean.

Going forward, any new migration should be applied the same way (a
short-lived Node script using the `pg` package and `SUPABASE_DB_URL`,
installed with `npm install --no-save pg` and removed after) rather than
left pending — ask before running one against production if the change
is anything other than additive (new column/table/trigger), since this
project has no staging environment.

Built: DB schema + RLS + auto-completion trigger, auth, timezone
onboarding, app shell/nav (renamed Aero Hub → Scheduler; sidebar
vertically centered + now sticky, extra top padding on page content,
logout button with hover-to-danger color, dark/light theme toggle), Hub,
Tasks (tree view, 3-level nesting, quick-add, inline title/date editing,
tag-creation modal, drag-and-drop reparenting with grip handle +
configurable long-press, completed-task fade/strike animation,
3-most-recent-completed loading + `/tasks/archive` pagination, wheel date
picker + circular time dial, collapsed-by-default branch-card redesign),
Calendar (24h hour-grid week view with a runtime-measured 12h-visible
viewport, full-width no-horizontal-scroll layout at every viewport, solid
contrast-aware block colors, quick-add block, duplicate-week, overlap
column-splitting, drag-to-move blocks, same wheel/dial pickers), Settings
(tags CRUD with archive cascade + per-tag repeatable color, timezone
change, `.ics` feed config with manual sync + user-editable generic feed
labels, drag-hold-duration setting), Stats (week-over-week comparison,
generic main-tasks-completed trend in place of the old hardcoded "Gym"
chart).

Not built: automatic/periodic `.ics` sync (currently manual "Sync now"),
Google Calendar OAuth wiring (client ID/secret are in `.env.local`, but the
callback route and token exchange don't exist yet — buttons are disabled
stubs), the deliberate visual-design polish pass, the full cinematic
sideways-branching tree view for Tasks (the collapsed branch-card redesign
this round is a step toward it, not the final version — still deferred
pending a user sketch/reference).

## Stats — further ideas proposed, not yet built

The user asked to see automatic-stats ideas before more get built (only
the generic tasks-completed swap above is done so far). Candidates worth
considering next, all tag/label-agnostic:

- **Total hours logged** per week (sum across all tags, not just per-tag
  bars) as a single headline number/trend — quick "did I actually study
  this week" gut-check without reading a whole bar chart.
- **Day-of-week distribution** for the current week — which days blocks
  cluster on, useful for noticing an uneven week before Sunday planning.
- **Task completion rate**: completed vs. created main tasks per week
  (not just a raw completed count) — surfaces a growing backlog even if
  the completed count looks steady.
- **Current streak**: consecutive days with at least one completed task
  or logged block.

## Plan for next session

1. **Review this round's changes rendered** — see "Visual review notes"
   below for what's new: the redesigned collapsed-branch task tree, the
   full-width no-scroll 12h calendar with solid blocks, the dark/light
   toggle, the sticky sidebar, and the generic `.ics` feed labels. All
   four migrations are now live, so the drag-hold setting, task move, and
   `.ics` labels should all work during this pass.
2. Pick which of the "Stats — further ideas" above (if any) to build.
3. Once the above is confirmed solid, do the deliberate visual-design
   polish pass called for by the product priorities above (still
   explicitly scoped as separate).
4. Full cinematic sideways-branching tree view for Tasks — check in for a
   sketch/reference before attempting it.
5. Wire Google Calendar OAuth (client ID/secret already configured): build
   `/api/google-calendar/callback`, token storage in
   `google_calendar_connections`, and turn the two disabled Settings
   buttons into real import/export flows.
6. Automate `.ics` sync: port the parse/upsert logic in
   `src/lib/actions/ics.ts` into a Supabase Edge Function scheduled via
   `pg_cron` (not Vercel Cron — Hobby tier is once/day, too infrequent).
7. Deploy to Vercel for real multi-device (phone + desktop) testing against
   the shared DB.
8. Rotate the Supabase DB password (it passed through chat in plaintext
   during setup, and again lives in `.env.local`'s `SUPABASE_DB_URL`) once
   the above is stable — Project Settings → Database → Reset database
   password.

## Visual review notes (page-by-page)

**How this section works** (changed this round — keep it this way going
forward): write short, concrete notes under each page as you go through
`npm run dev` — one bullet per issue, plain description, no need to
phrase it as a question. When something gets built in response, it gets
a single-line `Done — <one clause>` under the bullet, with any real
explanation going into "Key product decisions" / "Architecture notes"
above instead of piling up here. After each round this section is wiped
back to empty headings and the durable stuff is folded upward — so it
never carries more than one round's worth of notes at a time. If a note
needs a back-and-forth (a genuine open question), use a nested `Q:` /
`A:` pair instead of a paragraph.

Not yet visually confirmed at all (built but never seen rendered): the
dark/light theme toggle, the sticky sidebar, the collapsed-by-default
task-tree redesign, the full-width 12-hour calendar with solid blocks and
optimistic drag, and the editable `.ics` feed labels.

### Onboarding

- Perfect right now. Now changes from now forward. 

### Hub

- 

### Tasks

I have used the UI and I still find it difficult to use it rapidly and that is the key point. 

- Put all the main tasks at left. Subtasks at middle. Subsubtasks at right. A node in front of the main tasks connects in curved lines to a dot in each subtask associated. Finally a node in front of each subtask connects to a node on each subsubtask. This is also preferable when moving tasks because you can make some kind of animation to let the user see that droping the task there will connect to the previous task. 

- Make the level colored. Tasks have one color, subtasks another one and subsubtasks another one. Use shades of gray for the dark mode and shades of white/grey to the light mode. 

- Enlarge the viewport. Still let the content to be centered but the margins here should be smaller. There is like 20vw margin to the right and 20vw margin to the sidebar. Try lowering them to anything between 5 and 10 at most. 

- Tag must be mandatory. Children inherit the tag from the parent but I should be able to edit it. 

- The date dial for dealines is looking really good but I am not able to set it properly. It's dificult to change and the defined date on the center is blocked by a small card (maybe the card is in front of the date).

- Dropdown for the new tag needs a litle more work to blen with the page style. Still looks default. 

`Q:` When creating the tags it appears if I want to put it in Curricular Unit or Other. This is a bit restrictive and not sure I want this feature as is. Allow people create groups in settings like "Curricular Units" or "Events" or "Work", etc. Then this drop-down have this groups that all have a color. Add a no group option. The create button option will link directly to settings. Any suggestions? Does this make sense? Answer this question and we can resolve on the next passage, no hurry, 





### Calendar

- The UI still flickers, probably once it receives the confirmation from supabase. Could you disable this extra UI render? 

- Same issue in tasks whit the date dial. The hour dial is on spot though. 

- Next week button is not working. Previous week works. 

- I should be able to click on the block and edit the information (including date, description, etc). This can be done in a modal greying the rest of the page. 

- All blocks should allow a small description. Cap to 30 characters so it can render inside the block (the value is arbitrary, choose more or less than 30 folllowing your judgment). This is important to put the room number for classes for example. Add the description field on the block maker. 

- Add a line on the calendar on todays date and hour that moves with the time and crosses the blocks. This helps knowing when we are on the day and schedule. 


### Settings

- Perfect for now. But I haven't try the sync options. I will do it in the next passage probably. 

- Change the settings icon to a gear.

### Stats

I am going back and fourth with this one do let's define this for once: 

- Wipe this page clean. Add a plot where people can add whicherver tags they want and select the time interval they want. A plot below forms with weekly averages showing the progression. 

`Q:` Add in the component of the plot a message below in a card styled and given as an insight. Use automatic stats like, you worked % more in this tag or you have been declining the time on this tag... (Not sure on how you do it). Propose some stats below, I will review the ones I think most benefic. 

- Add another component where user can select a tag and select a time interval. It shows the amount of blocks of that specific tag where used (number of blocks) on the time specified. Also shows how many tasks, subtasks and subsubtasks with the tag where marked done on that interval and finally how many hours (an minutes) where used for that tag. 

- To make it easier, the select button for the interval may have words like this week (counts from the last Monday up to the day). Last week (count from the previous weeks Monday to the Sunday of the week). Same for this month (counts from day 1 of the month up to today), or last month. Also use last 3 months, last 6 months and last year. Finally add custom range for the purpose discussed below. 

### Other 

- Make a better divisory for the sidebar. The simple line is to thin and simple. 

- Improve colors on both dark mode (specially on calendar the thin lines became dificult to read). Use a more grey-dark instead of bluish. For the light mode, the beije makes it dificult to read as well but I think is also because the thin lines.

- Create a logo for the app. Add as favicon and put the log on onbording page and at the top of sidebar above scheduler word (that needs also some centering on the sidebar).

- Add robots.txt and other usefull files. Add a 404 page. 
