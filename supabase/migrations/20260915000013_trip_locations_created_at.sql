-- trip_locations was the one table without a created_at column (it only had
-- recorded_at, the GPS timestamp) — but the supabaseEntities shim's SELECT
-- always aliases created_at as created_date for every table uniformly, to
-- match the ~13 existing ".created_date" reads across the app without
-- special-casing each call site. Add the column so that holds here too.
alter table public.trip_locations add column created_at timestamptz not null default now();
