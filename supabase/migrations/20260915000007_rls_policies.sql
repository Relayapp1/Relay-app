-- Enable RLS on every table, then apply the policies designed in the migration plan.
-- Group A = owner-or-admin via created_by_id (brokers, drivers).
-- Group B = party-field-or-admin via broker_id/driver_id (messages, trip_incidents,
--           trip_locations, favorite_drivers, saved_routes).
-- Bid/Deal/Trip/Review/Wallet/WalletTransaction each have bespoke shapes noted inline.

alter table public.profiles enable row level security;
alter table public.brokers enable row level security;
alter table public.drivers enable row level security;
alter table public.deals enable row level security;
alter table public.bids enable row level security;
alter table public.trips enable row level security;
alter table public.trip_expenses enable row level security;
alter table public.trip_incidents enable row level security;
alter table public.trip_locations enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.favorite_drivers enable row level security;
alter table public.saved_routes enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;

-- profiles ---------------------------------------------------------------
-- Row-level: self-or-admin. Column-level lock (role/phone_verified*) is a
-- separate trigger, see 20260915000008_field_protection_triggers.sql.
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.is_admin());
-- No insert/delete policy: rows are created by the handle_new_user trigger
-- (security definer, bypasses RLS) and deleted via CASCADE from auth.users.

-- brokers / drivers (group A) ---------------------------------------------
create policy brokers_select on public.brokers
  for select using (created_by_id = auth.uid() or public.is_admin());
create policy brokers_insert on public.brokers
  for insert with check (created_by_id = auth.uid() or public.is_admin());
create policy brokers_update on public.brokers
  for update using (created_by_id = auth.uid() or public.is_admin());
create policy brokers_delete on public.brokers
  for delete using (created_by_id = auth.uid() or public.is_admin());

create policy drivers_select on public.drivers
  for select using (created_by_id = auth.uid() or public.is_admin());
create policy drivers_insert on public.drivers
  for insert with check (created_by_id = auth.uid() or public.is_admin());
create policy drivers_update on public.drivers
  for update using (created_by_id = auth.uid() or public.is_admin());
create policy drivers_delete on public.drivers
  for delete using (created_by_id = auth.uid() or public.is_admin());

-- deals (fresh design: brokers post, any driver browses open ones) --------
create policy deals_select on public.deals
  for select using (
    status = 'open'
    or broker_id = auth.uid()
    or assigned_driver_id = auth.uid()
    or preferred_driver_id = auth.uid()
    or public.is_admin()
  );
create policy deals_insert on public.deals
  for insert with check (broker_id = auth.uid() or public.is_admin());
create policy deals_update on public.deals
  for update using (broker_id = auth.uid() or public.is_admin());
create policy deals_delete on public.deals
  for delete using (broker_id = auth.uid() or public.is_admin());

-- bids (fresh design: driver owns their bid, broker sees bids on own deals) -
create policy bids_select on public.bids
  for select using (
    driver_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.deals
      where deals.id = bids.deal_id and deals.broker_id = auth.uid()
    )
  );
create policy bids_insert on public.bids
  for insert with check (driver_id = auth.uid() or public.is_admin());
create policy bids_update on public.bids
  for update using (
    driver_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.deals
      where deals.id = bids.deal_id and deals.broker_id = auth.uid()
    )
  );
create policy bids_delete on public.bids
  for delete using (driver_id = auth.uid() or public.is_admin());

-- trips (entity-level broker-or-driver-or-admin; field-level via trigger) --
create policy trips_select on public.trips
  for select using (broker_id = auth.uid() or driver_id = auth.uid() or public.is_admin());
create policy trips_insert on public.trips
  for insert with check (broker_id = auth.uid() or public.is_admin());
create policy trips_update on public.trips
  for update using (broker_id = auth.uid() or driver_id = auth.uid() or public.is_admin());
create policy trips_delete on public.trips
  for delete using (public.is_admin());

-- trip_expenses (driver creates/deletes, both parties read/update) --------
create policy trip_expenses_select on public.trip_expenses
  for select using (driver_id = auth.uid() or broker_id = auth.uid() or public.is_admin());
create policy trip_expenses_insert on public.trip_expenses
  for insert with check (driver_id = auth.uid() or public.is_admin());
create policy trip_expenses_update on public.trip_expenses
  for update using (driver_id = auth.uid() or broker_id = auth.uid() or public.is_admin());
create policy trip_expenses_delete on public.trip_expenses
  for delete using (driver_id = auth.uid() or public.is_admin());

-- trip_incidents (group B, message-style: both parties create/read, admin-only write) -
create policy trip_incidents_select on public.trip_incidents
  for select using (broker_id = auth.uid() or driver_id = auth.uid() or public.is_admin());
create policy trip_incidents_insert on public.trip_incidents
  for insert with check (broker_id = auth.uid() or driver_id = auth.uid() or public.is_admin());
create policy trip_incidents_update on public.trip_incidents
  for update using (public.is_admin());
create policy trip_incidents_delete on public.trip_incidents
  for delete using (public.is_admin());

-- trip_locations (group B: only driver writes, both parties read) ---------
create policy trip_locations_select on public.trip_locations
  for select using (driver_id = auth.uid() or broker_id = auth.uid() or public.is_admin());
create policy trip_locations_insert on public.trip_locations
  for insert with check (driver_id = auth.uid() or public.is_admin());
create policy trip_locations_update on public.trip_locations
  for update using (public.is_admin());
create policy trip_locations_delete on public.trip_locations
  for delete using (public.is_admin());

-- messages (group B: both parties create/read, admin-only update/delete) --
create policy messages_select on public.messages
  for select using (broker_id = auth.uid() or driver_id = auth.uid() or public.is_admin());
create policy messages_insert on public.messages
  for insert with check (broker_id = auth.uid() or driver_id = auth.uid() or public.is_admin());
create policy messages_update on public.messages
  for update using (public.is_admin());
create policy messages_delete on public.messages
  for delete using (public.is_admin());

-- reviews (unique: create is reviewer-only, no admin branch; read is public) -
create policy reviews_select on public.reviews
  for select using (auth.uid() is not null);
create policy reviews_insert on public.reviews
  for insert with check (reviewer_id = auth.uid());
create policy reviews_update on public.reviews
  for update using (reviewer_id = auth.uid() or public.is_admin());
create policy reviews_delete on public.reviews
  for delete using (reviewer_id = auth.uid() or public.is_admin());

-- favorite_drivers (group B) ----------------------------------------------
create policy favorite_drivers_select on public.favorite_drivers
  for select using (broker_id = auth.uid() or driver_id = auth.uid() or public.is_admin());
create policy favorite_drivers_insert on public.favorite_drivers
  for insert with check (broker_id = auth.uid() or public.is_admin());
create policy favorite_drivers_update on public.favorite_drivers
  for update using (public.is_admin());
create policy favorite_drivers_delete on public.favorite_drivers
  for delete using (broker_id = auth.uid() or public.is_admin());

-- saved_routes (group B, broker-only variant) ------------------------------
create policy saved_routes_select on public.saved_routes
  for select using (broker_id = auth.uid() or public.is_admin());
create policy saved_routes_insert on public.saved_routes
  for insert with check (broker_id = auth.uid() or public.is_admin());
create policy saved_routes_update on public.saved_routes
  for update using (public.is_admin());
create policy saved_routes_delete on public.saved_routes
  for delete using (broker_id = auth.uid() or public.is_admin());

-- wallets (owner can read/create-on-demand; only admin/RPCs mutate balances) -
create policy wallets_select on public.wallets
  for select using (user_id = auth.uid() or public.is_admin());
create policy wallets_insert on public.wallets
  for insert with check (user_id = auth.uid() or public.is_admin());
create policy wallets_update on public.wallets
  for update using (public.is_admin());
create policy wallets_delete on public.wallets
  for delete using (public.is_admin());

-- wallet_transactions (fully admin-locked writes; real writes route through
-- the security-definer wallet_* RPCs, which bypass RLS the same way Base44's
-- asServiceRole calls did) --------------------------------------------------
create policy wallet_transactions_select on public.wallet_transactions
  for select using (user_id = auth.uid() or public.is_admin());
create policy wallet_transactions_insert on public.wallet_transactions
  for insert with check (public.is_admin());
create policy wallet_transactions_update on public.wallet_transactions
  for update using (public.is_admin());
create policy wallet_transactions_delete on public.wallet_transactions
  for delete using (public.is_admin());
