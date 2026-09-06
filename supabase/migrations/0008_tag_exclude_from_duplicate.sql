-- Lets a tag or its whole group opt out of duplicateWeek ("copy to next
-- week"). A block is excluded if EITHER its own tag has the flag OR that
-- tag's group has the flag; tagless blocks always copy — same precedent as
-- tags.counts_as_work's "tagless blocks always count".
alter table public.tags add column exclude_from_duplicate boolean not null default false;
alter table public.tag_groups add column exclude_from_duplicate boolean not null default false;
