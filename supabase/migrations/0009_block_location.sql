-- ============================================================================
-- blocks.location — a free-text place/room field shown on the calendar card
-- next to the time, and populated from .ics LOCATION on import.
-- ============================================================================
alter table public.blocks add column location text;
