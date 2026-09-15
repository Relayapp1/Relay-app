-- Postgres RLS is row-level, not column-level, so it can't express Base44's
-- field-level `rls.write` restrictions (e.g. "only the driver on THIS trip can
-- write current_latitude"). These BEFORE UPDATE triggers close that gap.
--
-- The `relay.trusted_write` transaction-local setting lets the wallet_*/
-- trip_review_* RPCs (20260915000009_rpc_functions.sql) write admin-only
-- columns on behalf of a non-admin caller (e.g. a broker calling
-- wallet_reserve_funding), the same way Base44's asServiceRole calls bypassed
-- field-level rls entirely. Each RPC sets it via
-- `perform set_config('relay.trusted_write', 'on', true)` before its own
-- UPDATE; `true` as the third arg scopes it to the current transaction, so it
-- never leaks into unrelated statements.

create function public.enforce_profile_field_permissions()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() or current_setting('relay.trusted_write', true) = 'on' then
    return new;
  end if;
  if new.role is distinct from old.role then
    raise exception 'Only an admin can change role';
  end if;
  if new.phone_verified is distinct from old.phone_verified then
    raise exception 'Only an admin can change phone_verified';
  end if;
  if new.phone_verified_at is distinct from old.phone_verified_at then
    raise exception 'Only an admin can change phone_verified_at';
  end if;
  return new;
end;
$$;

create trigger enforce_profiles_field_permissions before update on public.profiles
  for each row execute function public.enforce_profile_field_permissions();

-- brokers.status / drivers.status: admin-only write (both tables share this
-- shape, so one function works for both — it only references `status`).
create function public.enforce_status_admin_only()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() or current_setting('relay.trusted_write', true) = 'on' then
    return new;
  end if;
  if new.status is distinct from old.status then
    raise exception 'Only an admin can change status';
  end if;
  return new;
end;
$$;

create trigger enforce_brokers_field_permissions before update on public.brokers
  for each row execute function public.enforce_status_admin_only();
create trigger enforce_drivers_field_permissions before update on public.drivers
  for each row execute function public.enforce_status_admin_only();

-- trip_expenses.status: broker-or-admin write.
create function public.enforce_trip_expense_field_permissions()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() or current_setting('relay.trusted_write', true) = 'on' then
    return new;
  end if;
  if new.status is distinct from old.status and new.broker_id <> auth.uid() then
    raise exception 'Only the broker or an admin can change status';
  end if;
  return new;
end;
$$;

create trigger enforce_trip_expenses_field_permissions before update on public.trip_expenses
  for each row execute function public.enforce_trip_expense_field_permissions();

-- trips: the big one — four separate write-permission groups.
create function public.enforce_trip_field_permissions()
returns trigger
language plpgsql
as $$
declare
  is_driver boolean := (new.driver_id = auth.uid());
  is_broker boolean := (new.broker_id = auth.uid());
begin
  if public.is_admin() or current_setting('relay.trusted_write', true) = 'on' then
    return new;
  end if;

  -- driver-or-admin write: location + pickup/delivery condition fields
  if not is_driver and (
    new.current_latitude is distinct from old.current_latitude
    or new.current_longitude is distinct from old.current_longitude
    or new.last_location_at is distinct from old.last_location_at
    or new.location_active is distinct from old.location_active
    or new.location_consent is distinct from old.location_consent
    or new.pickup_photo is distinct from old.pickup_photo
    or new.pickup_condition_acknowledged is distinct from old.pickup_condition_acknowledged
    or new.pickup_condition_notes is distinct from old.pickup_condition_notes
    or new.pickup_odometer is distinct from old.pickup_odometer
    or new.pickup_confirmed_at is distinct from old.pickup_confirmed_at
    or new.delivery_photo is distinct from old.delivery_photo
    or new.delivery_condition_acknowledged is distinct from old.delivery_condition_acknowledged
    or new.delivery_condition_notes is distinct from old.delivery_condition_notes
    or new.delivery_odometer is distinct from old.delivery_odometer
    or new.delivery_confirmed_at is distinct from old.delivery_confirmed_at
  ) then
    raise exception 'Only the driver or an admin can change location/pickup/delivery fields';
  end if;

  -- broker-or-admin write: payment_method, tip_amount
  if not is_broker and (
    new.payment_method is distinct from old.payment_method
    or new.tip_amount is distinct from old.tip_amount
  ) then
    raise exception 'Only the broker or an admin can change payment_method/tip_amount';
  end if;

  -- broker-or-driver-or-admin write: payment_status
  if not (is_broker or is_driver) and new.payment_status is distinct from old.payment_status then
    raise exception 'Only a trip party or an admin can change payment_status';
  end if;

  -- admin-only write (in practice only ever written by wallet_*/trip_review_* RPCs
  -- via the relay.trusted_write bypass above)
  if new.funding_status is distinct from old.funding_status
    or new.funded_amount is distinct from old.funded_amount
    or new.funded_at is distinct from old.funded_at
    or new.delivery_review_status is distinct from old.delivery_review_status
    or new.broker_reviewed_at is distinct from old.broker_reviewed_at
    or new.dispute_reason is distinct from old.dispute_reason
    or new.dispute_opened_at is distinct from old.dispute_opened_at
    or new.dispute_resolution is distinct from old.dispute_resolution
    or new.dispute_resolved_at is distinct from old.dispute_resolved_at
  then
    raise exception 'Only an admin (via wallet/trip-review functions) can change funding/dispute fields';
  end if;

  return new;
end;
$$;

create trigger enforce_trips_field_permissions before update on public.trips
  for each row execute function public.enforce_trip_field_permissions();
