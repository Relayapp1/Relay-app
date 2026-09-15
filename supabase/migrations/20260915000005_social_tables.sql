create table public.messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id),
  broker_id uuid not null references public.profiles (id),
  driver_id uuid not null references public.profiles (id),
  sender_id uuid not null references public.profiles (id),
  sender_name text,
  sender_role text not null check (sender_role in ('broker', 'driver')),
  content text not null,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id),
  trip_id uuid not null references public.trips (id),
  reviewer_id uuid not null references public.profiles (id),
  reviewer_name text,
  reviewer_role text check (reviewer_role in ('driver', 'broker')),
  reviewee_id uuid not null references public.profiles (id),
  reviewee_role text check (reviewee_role in ('driver', 'broker')),
  rating numeric not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now()
);

create table public.favorite_drivers (
  id uuid primary key default gen_random_uuid(),
  broker_id uuid not null references public.profiles (id),
  driver_id uuid not null references public.profiles (id),
  driver_name text,
  created_at timestamptz not null default now(),
  unique (broker_id, driver_id)
);

create table public.saved_routes (
  id uuid primary key default gen_random_uuid(),
  broker_id uuid not null references public.profiles (id),
  label text,
  pickup_location text not null,
  delivery_location text not null,
  created_at timestamptz not null default now()
);

create index messages_trip_id_idx on public.messages (trip_id);
create index reviews_reviewee_id_idx on public.reviews (reviewee_id);
create index reviews_trip_id_reviewer_id_idx on public.reviews (trip_id, reviewer_id);
create index favorite_drivers_broker_id_idx on public.favorite_drivers (broker_id);
create index favorite_drivers_driver_id_idx on public.favorite_drivers (driver_id);
create index saved_routes_broker_id_idx on public.saved_routes (broker_id);
