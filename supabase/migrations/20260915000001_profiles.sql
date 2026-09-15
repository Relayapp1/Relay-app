-- Profiles: replaces Base44's User entity. auth.users (Supabase-managed) holds
-- email/password/OAuth identity; this table carries everything else.
--
-- email_link_verified / email_link_verified_at are NOT ported as columns here —
-- Supabase's native auth.users.email_confirmed_at is the replacement and is
-- merged into the user shape at the application layer (see AuthContext.jsx),
-- not duplicated into a second column that could drift out of sync.

create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  account_type text not null default 'driver'
    check (account_type in ('broker', 'driver', 'individual', 'admin')),
  role text not null default 'user'
    check (role in ('admin', 'user')),
  contact_email text,
  display_name text,
  phone text,
  phone_verified boolean not null default false,
  phone_verified_at timestamptz,
  terms_accepted_at timestamptz,
  data_consent_accepted_at timestamptz,
  data_consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Replaces Base44 User entity. account_type = broker/driver/individual/admin (marketplace role). role = admin/user (privilege flag, drives is_admin()).';

-- Auto-create a profile row whenever a new auth.users row is created (signup,
-- OAuth first login, or admin.createUser during account recreation).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
