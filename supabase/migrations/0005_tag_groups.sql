-- Replaces the fixed kind='unit'/'other' split with user-defined tag groups
-- (e.g. "Curricular Units", "Events", "Work"). `is_study_unit` on a group
-- replaces what kind='unit' used to drive (the "Study {label}" block-title
-- treatment) — user-defined per group now instead of a hardcoded two-way
-- switch. Purely additive: `tags.kind` stays in place (its NOT NULL is
-- relaxed since new tags no longer set it) so existing ungrouped tags keep
-- behaving exactly as before; deriveBlockTitle() falls back to kind only
-- when a tag has no group.
create table public.tag_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  color text not null default '#6366f1',
  is_study_unit boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.tag_groups enable row level security;

create policy "tag_groups: all own" on public.tag_groups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.tags add column group_id uuid references public.tag_groups (id) on delete set null;
alter table public.tags alter column kind drop not null;
