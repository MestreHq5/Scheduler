-- Lets the Hub's "today's work" progress bar exclude specific tags (e.g. Gym,
-- Free) from counting as work. Defaults true so every existing tag keeps
-- counting until the user opts one out in Settings.
alter table public.tags add column counts_as_work boolean not null default true;
