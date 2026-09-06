-- .ics sync now creates real rows in `blocks` (previously only wrote to the
-- disconnected `imported_events` table, which nothing in the UI ever read).
-- Dedupe key so re-syncing the same feed updates existing rows instead of
-- duplicating. Regular (non-imported) blocks leave both columns null.
--
-- Uses a PLAIN unique index, not a partial one filtered to `ics_uid is not
-- null`: Postgres's ON CONFLICT arbiter for a partial index requires the
-- INSERT to repeat that exact WHERE predicate, but Supabase-js's
-- upsert(rows, { onConflict: "a,b,c" }) only ever emits a bare column list —
-- a partial index would make every sync fail at runtime. A plain unique
-- index works fine here anyway: Postgres treats NULLs as distinct from each
-- other, so any number of ordinary blocks (both columns null) coexist; the
-- constraint only fires when two rows share the same non-null triple.
alter table public.blocks
  add column ics_source text check (ics_source is null or ics_source in ('classes', 'tests'));
alter table public.blocks add column ics_uid text;
create unique index blocks_ics_dedupe_idx on public.blocks (user_id, ics_source, ics_uid);

-- The tag every block from this feed is created/upserted with — auto-created
-- on first sync (default label + randomTagColor()), reused after. If the
-- user deletes that tag, this goes null (ON DELETE SET NULL, matching
-- blocks.tag_id) and the next sync just creates a fresh replacement tag.
alter table public.ics_feeds
  add column tag_id uuid references public.tags (id) on delete set null;
