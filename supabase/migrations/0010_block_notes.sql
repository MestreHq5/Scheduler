-- ============================================================================
-- blocks.notes — long-form free text, editable only from the block edit
-- modal and never shown on the calendar card itself. `details` remains the
-- short label concatenated into the card's first line.
-- ============================================================================
alter table public.blocks add column notes text;
