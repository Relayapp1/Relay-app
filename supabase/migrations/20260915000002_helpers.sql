-- Shared helpers used across every table's RLS policies and triggers.

create function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'Direct equivalent of Base44''s {"user_condition": {"role": "admin"}} RLS clause.';

-- Generic updated_at maintenance, attached per-table below.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
