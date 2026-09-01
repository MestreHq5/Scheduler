-- Aero Hub — initial schema
-- Run this in the Supabase SQL Editor (or via `supabase db push` once the
-- CLI is linked to your project). Safe to run once on a fresh project.

-- ============================================================================
-- profiles
-- One row per authenticated user. Created automatically on signup.
-- timezone is an IANA name (e.g. "Europe/Lisbon") — DST is handled
-- automatically by Postgres/JS when converting through it, no extra logic
-- needed for the summer/winter shift itself.
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  timezone text not null default 'Europe/Lisbon',
  previous_timezone text,
  timezone_changed_at timestamptz,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: select own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile (+ two starter tags) on first signup.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);

  insert into public.tags (user_id, label, color, kind, sort_order) values
    (new.id, 'Gym', '#22c55e', 'other', 0),
    (new.id, 'Free - Other', '#64748b', 'other', 1);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================================
-- tags
-- Fixed-ish list, edited occasionally. kind='unit' gets the "Study {label}"
-- title treatment on blocks; kind='other' (Gym, Free, errands...) does not.
-- archived tags are hidden from pickers/UI but never deleted; unarchiving
-- restores them exactly as before.
-- ============================================================================
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  color text not null default '#6366f1',
  kind text not null check (kind in ('unit', 'other')),
  archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.tags enable row level security;

create policy "tags: all own" on public.tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ============================================================================
-- tasks
-- Deliberately NOT linked to blocks — connection is implicit via tag_id only.
-- 3-level nesting max: depth 0 (top-level) -> 1 (subtask) -> 2 (subtask's
-- own children). `done` on any task WITH children is fully derived from its
-- children by trigger below; manual toggles only take effect on leaf tasks.
-- ============================================================================
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  tag_id uuid references public.tags (id) on delete set null,
  done boolean not null default false,
  due_date date,
  notes text,
  parent_id uuid references public.tasks (id) on delete cascade,
  depth smallint not null default 0,
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint depth_range check (depth between 0 and 2)
);

alter table public.tasks enable row level security;

create policy "tasks: all own" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index tasks_user_parent_idx on public.tasks (user_id, parent_id);
create index tasks_user_tag_idx on public.tasks (user_id, tag_id);
create index tasks_user_due_idx on public.tasks (user_id, due_date) where due_date is not null;

-- Enforce nesting depth = parent.depth + 1, reject a 4th level.
create function public.tasks_set_depth()
returns trigger
language plpgsql
as $$
declare
  parent_depth smallint;
begin
  if new.parent_id is null then
    new.depth := 0;
  else
    select depth into parent_depth from public.tasks where id = new.parent_id;
    if parent_depth is null then
      raise exception 'parent_id % does not exist', new.parent_id;
    end if;
    if parent_depth >= 2 then
      raise exception 'max task nesting depth (3 levels) exceeded';
    end if;
    new.depth := parent_depth + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update of parent_id on public.tasks
  for each row execute function public.tasks_set_depth();

create function public.tasks_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_touch
  before update on public.tasks
  for each row execute function public.tasks_touch_updated_at();

-- Auto-completion: a task with children ignores manual `done` writes and is
-- instead derived from its children (all done -> done; any undone -> undone).
-- Propagates upward so a grandparent reacts to a grandchild toggle too.
create function public.tasks_derive_done()
returns trigger
language plpgsql
as $$
declare
  child_count int;
  done_count int;
begin
  select count(*), count(*) filter (where done)
    into child_count, done_count
    from public.tasks where parent_id = new.id;

  if child_count > 0 then
    new.done := (done_count = child_count);
  end if;

  return new;
end;
$$;

create trigger tasks_before_write_derive_done
  before update of done on public.tasks
  for each row execute function public.tasks_derive_done();

-- After any change to a task's done/parent state, walk up the parent chain
-- and recompute each ancestor's derived `done`.
create function public.tasks_propagate_to_ancestors()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target_parent uuid;
  child_count int;
  done_count int;
  computed_done boolean;
begin
  target_parent := coalesce(new.parent_id, old.parent_id);

  while target_parent is not null loop
    select count(*), count(*) filter (where done)
      into child_count, done_count
      from public.tasks where parent_id = target_parent;

    if child_count = 0 then
      exit;
    end if;

    computed_done := (done_count = child_count);

    update public.tasks
      set done = computed_done
      where id = target_parent and done is distinct from computed_done;

    select parent_id into target_parent from public.tasks where id = target_parent;
  end loop;

  return null;
end;
$$;

create trigger tasks_after_write_propagate
  after insert or update of done, parent_id or delete on public.tasks
  for each row execute function public.tasks_propagate_to_ancestors();


-- ============================================================================
-- blocks (Scheduler)
-- Plain wall-clock date/time as entered by the user — NOT stored as an
-- absolute UTC instant. This is deliberate: a block is "9am on the 12th, in
-- whatever my local time is", so it's naturally immune to timezone-change
-- side effects (unlike imported .ics events, see below). title is snapshotted
-- at creation time so it survives the tag being deleted later.
-- ============================================================================
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tag_id uuid references public.tags (id) on delete set null,
  title text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  details text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  constraint time_order check (end_time > start_time)
);

alter table public.blocks enable row level security;

create policy "blocks: all own" on public.blocks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index blocks_user_date_idx on public.blocks (user_id, date);


-- ============================================================================
-- ics_feeds
-- Config for the two .ics sources (classes / tests). Either a live URL that
-- gets polled, or a one-off/manually-refreshed uploaded file (Supabase
-- Storage path). Distinct from Google Calendar, which is a separate,
-- explicit connection (see google_calendar_connections).
-- ============================================================================
create table public.ics_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('classes', 'tests')),
  kind text not null check (kind in ('url', 'file')),
  url text,
  storage_path text,
  last_synced_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  created_at timestamptz not null default now(),
  unique (user_id, source)
);

alter table public.ics_feeds enable row level security;

create policy "ics_feeds: all own" on public.ics_feeds
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ============================================================================
-- imported_events
-- From .ics feeds (source = classes/tests) OR an explicit Google Calendar
-- import (source = google). These carry a real UTC instant (unlike blocks),
-- so they ARE affected by a timezone change. To satisfy "never change past
-- events" on a tz change, past rows get their display frozen at change time
-- (frozen_* columns); future rows keep re-deriving their local display live
-- from starts_at/ends_at using the profile's current timezone.
-- ============================================================================
create table public.imported_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('classes', 'tests', 'google')),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  raw_uid text not null,
  frozen_date date,
  frozen_start_time time,
  frozen_end_time time,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, source, raw_uid)
);

alter table public.imported_events enable row level security;

create policy "imported_events: all own" on public.imported_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index imported_events_user_starts_idx on public.imported_events (user_id, starts_at);


-- ============================================================================
-- google_calendar_connections
-- Explicit, separate from .ics upload/subscribe. sync_direction records
-- whether this connection is importing FROM Google or exporting TO Google,
-- so the UI can always state plainly which direction is active.
-- ============================================================================
create table public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  google_account_email text not null,
  calendar_id text not null,
  sync_direction text not null check (sync_direction in ('import', 'export')),
  refresh_token text not null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.google_calendar_connections enable row level security;

create policy "google_calendar_connections: all own" on public.google_calendar_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
