-- is_admin() is invoked from inside profiles' own RLS policies
-- (profiles_select/profiles_update: "id = auth.uid() or is_admin()"), and
-- is_admin() itself queries profiles. Run as a plain (non-security-definer)
-- function, that self-referencing SELECT is *also* subject to profiles' RLS,
-- which calls is_admin() again, which queries profiles again... Postgres
-- doesn't reliably prove the redundant "id = auth.uid()" makes the second
-- branch dead code, so this recurses until it blows the stack
-- ("stack depth limit exceeded") rather than looping forever in principle,
-- but it never resolves on its own either way.
--
-- security definer makes the function run as its owner rather than the
-- calling role, so its internal SELECT bypasses RLS entirely (Postgres
-- exempts table owners/superusers from RLS by default) — breaking the cycle.
-- search_path is pinned so a security definer function can't be tricked by a
-- caller-controlled search_path into resolving "profiles" to some other
-- object.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;
