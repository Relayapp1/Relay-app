-- Enable Realtime (postgres_changes) on every table with a live .subscribe()
-- call in the frontend inventory. Supabase Realtime respects each table's RLS
-- for authenticated subscriptions, so no separate publication-level ACL is
-- needed beyond this.

alter publication supabase_realtime add table public.deals;
alter publication supabase_realtime add table public.bids;
alter publication supabase_realtime add table public.trips;
alter publication supabase_realtime add table public.trip_expenses;
alter publication supabase_realtime add table public.trip_locations;
alter publication supabase_realtime add table public.trip_incidents;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.wallet_transactions;
