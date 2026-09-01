# Aero Hub — Project Spec for Claude Code

## 1. Context & Origin

This app is a from-scratch replacement for a Notion setup built for a new
semester of Aerospace Engineering study planning. The Notion version works
functionally but is visually generic ("overkill" in the wrong direction —
heavy, templated, not built for how the owner actually works). This spec
describes a **standalone web app**, purpose-built, to replace it entirely —
not a complement to Notion, a substitute.

**Do not start building until explicitly told to.** This file is a plan to
hand to Claude Code when the decision is made to proceed. Read the whole
thing before writing any code, and confirm the stack/scope with the user
before scaffolding, since some decisions below (hosting, auth) are
tentative and worth re-confirming at build time.

## 2. Who this is for

- One user only. No multi-tenant concerns, no team features, no sharing.
- Studying Aerospace Engineering, semester-based, with a fixed set of
  curricular units (subjects) per semester that changes each semester.
- Wants speed above all for the two daily-use flows: logging a study
  block, and checking off tasks. Both must be as close to one-tap as
  possible.
- Cares about visual design — this is explicitly meant to look and feel
  intentional, not like a generic dashboard template. Treat the visual
  design pass as seriously as the functional build. Reference the
  `frontend-design` skill/guidance if available in the build environment for
  aesthetic direction, typography, and avoiding templated-looking defaults.
- Will use this primarily on mobile day-to-day (checking off tasks,
  logging blocks between classes) but also wants a solid desktop/wide view
  for weekly planning sessions (Sunday planning, see workflow below).

## 3. Core workflows to support (from real usage discussion)

### 3.1 Sunday planning session
Every Sunday, the user:
1. Brain-dumps the week's tasks into a flat list — each task gets a title
   and a tag (curricular unit, or a non-academic tag like Gym/Free/Errand).
   Due dates are optional — most tasks don't have one; only real deadlines
   (tests, submissions) get a date.
2. Builds the week's study blocks on the Scheduler — for each block, picks
   a tag (from a fixed preset list) and a time range. No typing required
   beyond picking a tag and setting start/end time.
3. Does NOT link tasks to specific blocks in advance. Linking task→block
   was explicitly tried and rejected as a design (see 3.2) — too much
   upkeep, abandoned within weeks in the old system.

### 3.2 Sitting down to study (the "on the spot" moment)
When the user sits down for a study block (e.g. "Study Aero II 9–11"),
they open a tag-filtered view of open tasks tagged "Aero II" and decide
in the moment what to work on. No pre-assignment of task-to-block. This
means: **no task→block relation in the data model.** Tasks and Scheduler
blocks are only ever connected implicitly, by sharing the same tag.

### 3.3 Checking off tasks
Simple checkbox toggle. If a task isn't finished, it just stays unchecked
and shows up again next time the user filters by that tag — no "rollover"
mechanic, no moving between time blocks. This was a deliberate
simplification from an earlier, more complex design (task-to-block
relations with manual "roll to next block" reassignment) that was judged
to be more friction than it was worth.

### 3.4 Parent/child tasks with auto-completion
This is the **one feature Notion structurally cannot do**, and the main
reason a custom app is worth building for the Tasks feature specifically:
- A task can have sub-tasks (children).
- When ALL of a parent's sub-tasks are marked done, the parent
  **auto-completes** — no manual confirmation needed. This is a genuine
  improvement over the Notion version, where the closest achievable
  behavior was a progress rollup the user still had to act on manually.
- If a sub-task is un-checked after the parent auto-completed, the parent
  should revert to incomplete (keep this consistent both ways).
- Nesting depth: support at least 2 levels (parent → children). Supporting
  arbitrary depth (children can have their own children) is a nice-to-have,
  not a hard requirement — ask the user before investing in deep recursion
  if it adds meaningful complexity.

### 3.5 Tree view of tasks
Visual grouping so parent tasks and their children are visually associated
— parent as a heading/column, children nested/listed under it. In the
Notion version this was approximated with a board view grouped by parent
(columns = parents, cards = children stacked under each). In a custom app,
a true indented tree (or a card-with-nested-checklist layout) is preferred
since it's one of the few things Notion couldn't do natively — do this
properly rather than re-implementing Notion's board-as-tree workaround.

### 3.6 Central Hub (home view)
A landing view combining:
- A short motivating quote/phrase at the top (currently a Latin quote —
  keep this customizable text, not hardcoded, since the user may want to
  change it).
- A hero/cover visual — the Notion version used a wing/sunset photo. Bring
  the same aesthetic sensibility to whatever the app's hero treatment is;
  doesn't need to be a literal photo, could be a designed header.
- **Stats**: open tasks per curricular unit (bar chart), blocks/hours
  scheduled per curricular unit (bar chart). Both should be easy to add to
  later (e.g. "hours actually completed this week" once time-tracking
  exists, if it ever does — not in scope now).
- **Deadlines**: a compact list (not a full calendar — deliberately
  rejected a calendar-grid embed on the Hub as too heavy for at-a-glance
  use and bad on mobile) of tasks with a due date, soonest first,
  undone only.
- **Tasks**: quick access to open tasks (likely the tag-filtered or tree
  view, or a simple "what's open" list) — this was moved to the TOP of the
  Notion hub (above Stats/Deadlines) after a mobile-usability pass, because
  it's the most-used section day to day. Preserve that priority ordering:
  Today's blocks → Tasks → Deadlines → Stats.

### 3.7 Scheduler
- Create a "block": pick a tag (curricular unit, or Gym / Free - Other /
  other non-academic tags), set a start and end time on a given day.
- Title should NEVER need to be typed. In Notion this was solved with
  page templates that pre-filled "Study {unit}" as the title alongside
  the tag, in one tap. Replicate that: selecting a tag auto-generates the
  display title (e.g. "Study Aero II", or just "Gym" / "Free" for
  non-study tags — no "Study" prefix on those).
- Needs a real calendar/agenda view — day and week at minimum — since the
  explicit purpose (per the user) is "to see if my week was effective or
  not," i.e. a retrospective, visual view of how time was actually spent
  across a week, not just a list of upcoming blocks.
- A tag-grouped view (similar to Notion's "Upcoming by Tag") for quickly
  seeing all blocks for a given unit is useful but secondary to the
  calendar view.

### 3.8 Calendar import (.ics)
- The user's university issues **two separate live .ics URLs** — one for
  tests/exams, one for classes. Both are subscribable feeds (live URLs,
  not static one-time files), though the user did not have the actual URLs
  at spec-writing time.
- The app should support **subscribing to both external .ics feed URLs**
  and periodically syncing them (not a one-time import) so exam/class
  schedule changes propagate automatically. This likely requires a small
  backend job (cron / scheduled function) that fetches and parses each
  feed on an interval and diffs it into the app's own event store.
  Client-side-only fetching of external .ics URLs will likely hit CORS
  issues — plan for a backend-mediated fetch.
- Imported class/test events are a **separate concern from Scheduler
  blocks and Tasks** — don't conflate them. They should be visually
  distinguishable but shown on the same calendar/agenda view as Scheduler
  blocks, so the user can see everything (self-planned study blocks +
  university-imposed classes/tests) in one place.
- Tests from the exam feed are a natural candidate for auto-generating a
  "deadline" entry, but don't build automatic Task creation from calendar
  events unless/until the user asks for it explicitly — flag it as a
  possible future feature, not initial scope.

## 4. Data model (draft — adjust freely during build, this is a starting
point based on what was validated in the Notion prototype)

### Tag (shared across Tasks and Scheduler)
A fixed-ish list, edited occasionally at the start of each semester when
units change. Suggested shape: `{ id, label, color, kind: "unit" | "other" }`
kind distinguishes curricular units (which get the "Study {unit}" title
treatment) from non-academic tags like Gym / Free - Other / errands.

Units seen in the prototype (semester-specific, will change — do not
hardcode as permanent): Aero II, Aero III, PPS, TC, Aeroelasticidade, PF,
Prop, TF, SPHEA, Aeroacústica, Web.Dev, ACMAA. Non-unit tags: Gym,
Free - Other.

### Task
```
{
  id, title, tag_id, done: boolean,
  due_date: date | null,
  notes: text | null,
  parent_id: id | null,       // null = top-level task
  created_at
}
```
`done` for a parent should be derived/kept in sync from children per 3.4,
not just a freely-editable field once it has children — decide during
build whether to make it fully derived (computed, not stored) or stored-
but-synced; either is fine, just be consistent about which.

### Scheduler Block
```
{
  id, tag_id, title (auto-derived from tag_id, see 3.7),
  start_time, end_time, date,
  details: text | null,
  created_at
}
```

### Imported Event (from .ics feeds)
```
{
  id, source: "classes" | "tests", title, start_time, end_time,
  location: text | null, raw_uid (from ics, for dedupe on re-sync),
  last_synced_at
}
```

## 5. Explicitly rejected designs (don't reintroduce these)

- **Task ↔ Scheduler Block relation with manual "roll to next block"
  reassignment.** Tried conceptually in the Notion prototype, rejected by
  the user after thinking through real usage — too much upkeep for
  marginal benefit. Tasks and blocks connect only via shared tag, at
  view-time, not via a stored relation.
- **Full calendar-grid view embedded on the Hub/home screen.** Rejected in
  favor of a compact sorted list, specifically for mobile usability.
- **Side-by-side column layouts on mobile-first views.** The Notion
  version originally had two stats charts side by side; this was reverted
  to stacked after recognizing it doesn't work on narrow screens. Keep
  mobile layouts single-column by default; use side-by-side only on
  wide/desktop viewports if at all.

## 6. Suggested stack (tentative — confirm with user before scaffolding)

- **Frontend**: React, hosted on Vercel.
- **Backend**: needed (not a static site) — for .ics fetching/syncing at
  minimum, and likely for persistence. Options to evaluate at build time:
  Next.js API routes / Vercel Serverless Functions for the backend logic,
  paired with a hosted Postgres (Vercel Postgres, Supabase, or Neon).
- **Repo**: user will create a dedicated GitHub repo for this project when
  ready to start.
- **Auth**: single-user app — evaluate whether any auth is even needed
  (could be a private deployment with no login) vs. simple auth if the
  user wants access from multiple devices/browsers without it being
  fully public. Confirm with user before implementing.
- **Deployment target**: Vercel primary; user also mentioned "Windows app"
  as a possible alternative direction — if that path is chosen instead of
  a webapp, stack changes significantly (would need a native or
  Electron-style shell instead). Confirm which direction before
  proceeding — this spec assumes the webapp direction unless told
  otherwise.

## 7. Design/UX priorities

- Mobile-first for Tasks (checking off) and Scheduler block creation
  (fastest possible entry). Desktop/wide gets richer views (week calendar,
  tree view, stats) but must not sacrifice the mobile experience for it.
- Visual design should feel bespoke, not templated — this was a repeated,
  explicit dissatisfaction with the Notion version even after significant
  customization effort. Take real care with typography, color, and layout
  rather than defaulting to generic dashboard patterns.
- Speed of data entry beats feature completeness for the two core loops
  (log a block, check a task). Every extra tap/field in those two flows
  should be scrutinized.

## 8. Open questions to resolve with the user before/at build time

1. Auth approach (see 6) — none, or simple single-user login?
2. Exact hosting choice for backend/DB (Vercel Postgres vs. Supabase vs.
   Neon, or other).
3. Whether task auto-completion state (3.4) should be stored or fully
   computed.
4. Arbitrary-depth task nesting vs. fixed 2-level — worth the complexity?
5. The two .ics feed URLs are not yet available (university hasn't issued
   them) — get these before building the sync feature, or stub it with
   sample .ics data first.
6. Confirm final direction: webapp (per this spec) vs. Windows native app
   — mentioned as an alternative but not the primary plan here.
