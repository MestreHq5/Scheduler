-- Lets each .ics import slot carry a user-chosen display name instead of the
-- hardcoded "classes"/"tests" wording, which only fit one person's use case.
-- `source` stays as the internal identifier (still exactly two feed slots);
-- `label` is what's shown in Settings, defaulting to a generic placeholder
-- when unset so existing rows don't need backfilling.
alter table public.ics_feeds add column label text;
