-- The account type picked on the register form was only ever carried via
-- sessionStorage from the tab that submitted signUp() to AccountProfile's
-- onboarding step, read once the confirmation link is clicked. That works
-- only if the link is opened in that same tab — but email clients almost
-- always open confirmation links in a new tab (sometimes a different
-- device entirely), where sessionStorage is empty. handle_new_user() then
-- created the profile row with no account_type override, silently falling
-- back to the column default ('driver') regardless of what was actually
-- selected — e.g. a broker signup quietly became a driver account.
--
-- Fix: read it from the signup's own metadata instead, which Supabase
-- stores server-side on auth.users at signup time (see supabaseAuth.js's
-- signUp options.data) and is available immediately when this trigger
-- fires — no dependency on which tab/device confirms the email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_type text := new.raw_user_meta_data->>'account_type';
begin
  insert into public.profiles (id, email, account_type)
  values (
    new.id,
    new.email,
    case when requested_type in ('driver', 'broker', 'individual') then requested_type else 'driver' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
