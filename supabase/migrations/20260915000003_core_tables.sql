-- Broker and Driver: "owner-or-admin CRUD via created_by_id" (RLS pattern group A).
-- Deal and Bid: no RLS reference existed in Base44 — schema here matches the
-- entity properties from the inventory; RLS policies for these two are
-- designed fresh in 20260915000007_rls_policies.sql.

create table public.brokers (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid not null references public.profiles (id),
  full_name text not null,
  email text not null,
  phone text not null,
  company text,
  business_address text,
  mc_number text,
  poster_type text not null default 'business' check (poster_type in ('business', 'individual')),
  w9_document text,
  broker_license_document text,
  government_id_document text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  rating numeric not null default 5,
  review_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid not null references public.profiles (id),
  full_name text not null,
  email text not null,
  phone text not null,
  bio text,
  home_location text,
  operating_area text,
  vehicle_types text,
  years_experience numeric,
  preferred_rate numeric,
  license_number text,
  license_state text not null,
  license_expiration date not null,
  license_front text,
  license_back text,
  license_document text,
  driving_history_consent boolean not null default false,
  driving_history_report text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  rating numeric not null default 5,
  review_count integer not null default 0,
  response_rate numeric not null default 100,
  on_time_percentage numeric not null default 100,
  completed_deliveries integer not null default 0,
  cancelled_trips integer not null default 0,
  total_hours_worked numeric not null default 0,
  total_expenses numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  broker_id uuid not null references public.profiles (id),
  broker_name text,
  pickup_location text not null,
  delivery_location text not null,
  vehicle_info text not null,
  return_plan text not null
    check (return_plan in ('Lease return provided', 'Broker will Uber driver back', 'Driver arranges own return')),
  pickup_date date not null,
  pickup_time text,
  estimated_hours numeric not null,
  minimum_rate numeric not null,
  target_rate numeric,
  is_lease_return boolean not null default false,
  uber_driver_back boolean not null default false,
  payment_method text default 'Relay wallet' check (payment_method in ('Relay wallet')),
  notes text,
  status text not null default 'open' check (status in ('open', 'assigned', 'completed', 'cancelled')),
  -- on delete set null: a deal isn't necessarily removed when the assigned/
  -- preferred driver deletes their own account (only the broker's own deals
  -- are purged by delete_account_data()), so this side must yield.
  assigned_driver_id uuid references public.profiles (id) on delete set null,
  accepted_bid_id uuid,
  preferred_driver_id uuid references public.profiles (id) on delete set null,
  preferred_driver_name text,
  preferred_only boolean not null default false,
  priority_until timestamptz,
  cancelled_by text check (cancelled_by in ('driver', 'broker', 'admin')),
  cancelled_at timestamptz,
  completed_at timestamptz,
  -- Plain uuid, not a real FK: self-referencing constraints on a table that's
  -- also bulk-deleted by delete_account_data() would need to be DEFERRABLE to
  -- avoid row-order failures, and these are informational links only.
  reposted_from_deal_id uuid,
  reposted_as_deal_id uuid,
  reposted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id),
  driver_id uuid not null references public.profiles (id),
  driver_name text,
  driver_operating_area text,
  hourly_rate numeric not null,
  estimated_payout numeric,
  driver_rating numeric,
  completed_jobs integer,
  on_time_percentage numeric,
  cancellation_rate numeric,
  relevant_experience text,
  vetting_status text check (vetting_status in ('approved', 'pending', 'rejected')),
  notes text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- on delete set null: bids and deals reference each other (deal.accepted_bid_id
-- <-> bid.deal_id), so this side must yield on delete to avoid a circular
-- constraint deadlock when a deal's bids are purged (e.g. delete_account_data()).
alter table public.deals
  add constraint deals_accepted_bid_id_fkey foreign key (accepted_bid_id)
    references public.bids (id) on delete set null;

create trigger set_brokers_updated_at before update on public.brokers
  for each row execute function public.set_updated_at();
create trigger set_drivers_updated_at before update on public.drivers
  for each row execute function public.set_updated_at();
create trigger set_deals_updated_at before update on public.deals
  for each row execute function public.set_updated_at();
create trigger set_bids_updated_at before update on public.bids
  for each row execute function public.set_updated_at();

create index deals_broker_id_idx on public.deals (broker_id);
create index deals_status_idx on public.deals (status);
create index bids_deal_id_idx on public.bids (deal_id);
create index bids_driver_id_idx on public.bids (driver_id);
create index brokers_created_by_id_idx on public.brokers (created_by_id);
create index drivers_created_by_id_idx on public.drivers (created_by_id);
