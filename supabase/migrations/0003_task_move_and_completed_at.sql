-- Adds task drag-and-drop reparenting support + a real completion timestamp.
-- Run this in the Supabase SQL Editor after 0001 and 0002.

-- ============================================================================
-- tasks.completed_at
-- Was previously stood in for by `updated_at`, which also bumps on any
-- unrelated edit (e.g. fixing a typo on a done task). Set/cleared alongside
-- `done` inside the existing tasks_derive_done() trigger so it fires
-- uniformly for leaf toggles and ancestor-propagated toggles alike.
-- ============================================================================
alter table public.tasks add column completed_at timestamptz;

create or replace function public.tasks_derive_done()
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

  if new.done and not old.done then
    new.completed_at := now();
  elsif not new.done and old.done then
    new.completed_at := null;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- Depth cascade
-- tasks_set_depth (0001) only sets the *moved* row's own depth, it never
-- recomputes descendants. The move/reparent feature needs this: promoting a
-- depth-1 task to root must also shift its depth-2 children from 2 -> 1.
-- Fires only on an actual depth change, and cascades to each row's own
-- children in turn (re-firing this same trigger), terminating once no
-- descendant's depth needs to change. The existing depth_range check
-- (0 to 2) remains the backstop if a cascade would exceed 3 levels.
-- ============================================================================
create function public.tasks_cascade_depth()
returns trigger
language plpgsql
as $$
begin
  update public.tasks set depth = new.depth + 1
  where parent_id = new.id and depth is distinct from new.depth + 1;
  return new;
end;
$$;

create trigger tasks_after_depth_cascade
  after update of depth on public.tasks
  for each row when (old.depth is distinct from new.depth)
  execute function public.tasks_cascade_depth();

-- ============================================================================
-- profiles.task_drag_hold_ms
-- Long-press duration (ms) before a touch drag starts on the Tasks tree,
-- user-adjustable in Settings -> Interaction.
-- ============================================================================
alter table public.profiles add column task_drag_hold_ms int not null default 450;
