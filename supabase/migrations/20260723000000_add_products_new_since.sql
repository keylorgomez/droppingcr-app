-- Tracks when the "NUEVO" badge was activated on a product, so the frontend
-- can auto-expire it 15 days later without needing a manual toggle-off or a cron job.
alter table products add column if not exists new_since timestamptz;

-- Backfill: products already flagged as "nuevo" get a fresh 15-day window
-- starting now, instead of instantly losing the badge on deploy.
update products set new_since = now() where is_new = true and new_since is null;
