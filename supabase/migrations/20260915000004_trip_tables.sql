-- Trip is the most complex entity: entity-level RLS is broker-or-driver-or-admin,
-- but ~20 individual columns have field-level write restrictions in Base44 that
-- Postgres RLS (row-level, not column-level) can't express directly. Those
-- restrictions are enforced by a BEFORE UPDATE trigger in
-- 20260915000008_field_protection_triggers.sql, not by RLS itself.

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id),
  bid_id uuid not null references public.bids (id),
  broker_id uuid not null references public.profiles (id),
  broker_name text,
  driver_id uuid not null references public.profiles (id),
  driver_name text,
  accepted_rate numeric not null,
  pickup_location text,
  delivery_location text,
  vehicle_info text,
  return_plan text,
  estimated_hours numeric,
  job_notes text,
  pickup_date date,
  pickup_time text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'paused', 'completed', 'cancelled')),
  timer_started_at timestamptz,
  started_at timestamptz,
  started_on_time boolean,
  tracked_minutes numeric not null default 0,
  completed_at timestamptz,
  cancelled_by text check (cancelled_by in ('driver', 'broker', 'admin')),
  cancelled_at timestamptz,
  cancellation_fee_status text not null default 'not_applicable'
    check (cancellation_fee_status in ('not_applicable', 'policy_pending', 'assessed', 'waived', 'paid')),
  cancellation_fee_amount numeric,

  -- driver-or-admin write only (enforced by trigger):
  current_latitude numeric,
  current_longitude numeric,
  last_location_at timestamptz,
  location_active boolean not null default false,
  location_consent boolean not null default false,
  pickup_photo text,
  pickup_condition_acknowledged boolean not null default false,
  pickup_condition_notes text,
  pickup_odometer numeric,
  pickup_confirmed_at timestamptz,
  delivery_photo text,
  delivery_condition_acknowledged boolean not null default false,
  delivery_condition_notes text,
  delivery_odometer numeric,
  delivery_confirmed_at timestamptz,

  -- broker-or-admin write only (enforced by trigger):
  payment_method text,
  tip_amount numeric not null default 0,

  -- broker-or-driver-or-admin write only (enforced by trigger):
  payment_status text not null default 'pending' check (payment_status in ('pending', 'sent', 'received')),

  -- admin-only write, in practice written only by the wallet_*/trip_review_* RPCs:
  funding_status text not null default 'pending'
    check (funding_status in ('pending', 'confirmed', 'released', 'refunded')),
  funded_amount numeric,
  funded_at timestamptz,
  delivery_review_status text not null default 'pending'
    check (delivery_review_status in ('pending', 'approved', 'disputed', 'resolved')),
  broker_reviewed_at timestamptz,
  dispute_reason text,
  dispute_opened_at timestamptz,
  dispute_resolution text,
  dispute_resolved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id),
  deal_id uuid not null references public.deals (id),
  driver_id uuid not null references public.profiles (id),
  broker_id uuid not null references public.profiles (id),
  category text not null check (category in ('Gas', 'Tolls', 'Parking', 'Food', 'Other')),
  amount numeric not null,
  expense_date date,
  notes text,
  receipt_document text,
  -- broker-or-admin write only (enforced by trigger):
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_incidents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id),
  broker_id uuid not null references public.profiles (id),
  driver_id uuid not null references public.profiles (id),
  -- on delete set null: reporter can be the admin who filed it, a third party
  -- not otherwise attached to this trip (unlike driver_id/broker_id, which are
  -- always one of the trip's two parties and get cleaned up with them).
  reporter_id uuid references public.profiles (id) on delete set null,
  reporter_role text not null check (reporter_role in ('driver', 'broker', 'admin')),
  category text not null
    check (category in ('vehicle_condition', 'delay', 'documentation', 'expense', 'payment', 'other')),
  description text not null,
  photo text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved')),
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_locations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id),
  broker_id uuid not null references public.profiles (id),
  driver_id uuid not null references public.profiles (id),
  latitude numeric not null,
  longitude numeric not null,
  accuracy_meters numeric,
  recorded_at timestamptz not null default now()
);

create trigger set_trips_updated_at before update on public.trips
  for each row execute function public.set_updated_at();
create trigger set_trip_expenses_updated_at before update on public.trip_expenses
  for each row execute function public.set_updated_at();
create trigger set_trip_incidents_updated_at before update on public.trip_incidents
  for each row execute function public.set_updated_at();

create index trips_broker_id_idx on public.trips (broker_id);
create index trips_driver_id_idx on public.trips (driver_id);
create index trips_deal_id_idx on public.trips (deal_id);
create index trip_expenses_trip_id_idx on public.trip_expenses (trip_id);
create index trip_incidents_trip_id_idx on public.trip_incidents (trip_id);
create index trip_locations_trip_id_idx on public.trip_locations (trip_id);
create index trip_locations_recorded_at_idx on public.trip_locations (recorded_at desc);
