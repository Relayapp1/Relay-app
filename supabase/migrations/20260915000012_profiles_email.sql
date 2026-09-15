-- Base44's User entity implicitly carried an "email" field (platform-managed,
-- not declared in its custom schema) that AdminDashboard's user list reads.
-- profiles has no such column since email lives in auth.users, which the
-- anon/authenticated roles can't query directly — so mirror it onto
-- profiles at signup and keep it in sync on change, rather than needing an
-- Edge Function round-trip for a simple display value.

alter table public.profiles add column email text;

update public.profiles p set email = u.email from auth.users u where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();
