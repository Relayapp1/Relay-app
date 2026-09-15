-- Ports Base44's 4 retained backend functions (submit-review, trip-review,
-- wallet-ops) as SECURITY DEFINER Postgres functions. Unlike the original,
-- each is a single Postgres transaction by default (atomic), and every
-- balance-mutating function takes a row lock (`for update`) on the wallet
-- before checking/changing its balance, closing race windows the original
-- sequential-await implementation had.
--
-- All are `security definer` owned by the migration role, so — like Base44's
-- asServiceRole — they bypass RLS. Any of them that write trip columns locked
-- by enforce_trip_field_permissions() set `relay.trusted_write` first.

-- ============================================================================
-- wallet-ops
-- ============================================================================

create function public.wallet_deposit_request(p_amount numeric, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_account_type text;
  v_role text;
  v_txn wallet_transactions;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select account_type into v_account_type from profiles where id = v_uid;
  v_role := case when v_account_type = 'driver' then 'driver' else 'broker' end;
  if not (v_role = 'broker' or is_admin()) then
    raise exception 'Only a broker or admin can request a deposit';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  insert into wallets (user_id, role) values (v_uid, v_role) on conflict (user_id) do nothing;
  perform 1 from wallets where user_id = v_uid for update;

  update wallets set pending_deposits = pending_deposits + p_amount where user_id = v_uid;

  insert into wallet_transactions (user_id, role, type, amount, status, notes)
  values (v_uid, v_role, 'deposit', p_amount, 'pending', p_notes)
  returning * into v_txn;

  return to_jsonb(v_txn);
end;
$$;

create function public.wallet_withdraw_request(
  p_amount numeric,
  p_bank_name text,
  p_bank_account_last4 text,
  p_bank_routing text,
  p_speed text default 'standard'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_account_type text;
  v_role text;
  v_speed text := coalesce(p_speed, 'standard');
  v_fee numeric := 0;
  v_total numeric;
  v_wallet wallets;
  v_txn wallet_transactions;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select account_type into v_account_type from profiles where id = v_uid;
  v_role := case when v_account_type = 'driver' then 'driver' else 'broker' end;
  if not (v_role = 'driver' or is_admin()) then
    raise exception 'Only a driver or admin can request a withdrawal';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if v_speed not in ('standard', 'instant') then
    raise exception 'Invalid speed';
  end if;
  if v_speed = 'instant' then
    v_fee := 2;
  end if;
  v_total := p_amount + v_fee;

  insert into wallets (user_id, role) values (v_uid, v_role) on conflict (user_id) do nothing;
  select * into v_wallet from wallets where user_id = v_uid for update;
  if v_wallet.balance < v_total then
    raise exception 'Insufficient balance';
  end if;

  update wallets set pending_withdrawals = pending_withdrawals + v_total where user_id = v_uid;

  insert into wallet_transactions (
    user_id, role, type, amount, speed, fee_amount, status,
    bank_name, bank_account_last4, bank_routing
  )
  values (
    v_uid, v_role, 'withdrawal', p_amount, v_speed, v_fee, 'pending',
    p_bank_name, p_bank_account_last4, p_bank_routing
  )
  returning * into v_txn;

  return to_jsonb(v_txn);
end;
$$;

create function public.wallet_reserve_funding(p_trip_id uuid, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trip trips;
  v_wallet wallets;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_trip from trips where id = p_trip_id;
  if v_trip is null then raise exception 'Trip not found'; end if;
  if not (v_trip.broker_id = v_uid or is_admin()) then
    raise exception 'Not authorized';
  end if;
  if v_trip.funding_status = 'confirmed' then
    raise exception 'Funding is already confirmed for this trip';
  end if;
  if v_trip.status not in ('scheduled', 'paused') then
    raise exception 'Trip is not in a fundable state';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  select * into v_wallet from wallets where user_id = v_trip.broker_id for update;
  if v_wallet is null or v_wallet.balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  update wallets set balance = balance - p_amount where user_id = v_trip.broker_id;

  insert into wallet_transactions (user_id, role, type, amount, status, trip_id, counterparty_id)
  values (v_trip.broker_id, 'broker', 'funding_reserved', p_amount, 'completed', p_trip_id, v_trip.driver_id);

  perform set_config('relay.trusted_write', 'on', true);
  update trips
  set funding_status = 'confirmed', funded_amount = p_amount, funded_at = now(), payment_method = 'Relay wallet'
  where id = p_trip_id;

  return jsonb_build_object('success', true, 'funded_amount', p_amount);
end;
$$;

create function public.wallet_refund_funding(p_trip_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trip trips;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_trip from trips where id = p_trip_id;
  if v_trip is null then raise exception 'Trip not found'; end if;
  if not (v_trip.broker_id = v_uid or v_trip.driver_id = v_uid or is_admin()) then
    raise exception 'Not authorized';
  end if;

  if v_trip.funding_status <> 'confirmed' then
    return jsonb_build_object('success', true, 'refunded', 0);
  end if;

  perform 1 from wallets where user_id = v_trip.broker_id for update;
  update wallets set balance = balance + v_trip.funded_amount where user_id = v_trip.broker_id;

  insert into wallet_transactions (user_id, role, type, amount, status, trip_id, counterparty_id)
  values (v_trip.broker_id, 'broker', 'funding_refund', v_trip.funded_amount, 'completed', p_trip_id, v_trip.driver_id);

  perform set_config('relay.trusted_write', 'on', true);
  update trips set funding_status = 'refunded' where id = p_trip_id;

  return jsonb_build_object('success', true, 'refunded', v_trip.funded_amount);
end;
$$;

create function public.wallet_charge_cancellation_fee(p_trip_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trip trips;
  v_fee numeric;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_trip from trips where id = p_trip_id;
  if v_trip is null then raise exception 'Trip not found'; end if;
  if not (v_trip.driver_id = v_uid or is_admin()) then
    raise exception 'Not authorized';
  end if;
  if not (v_trip.status = 'cancelled' and v_trip.cancelled_by = 'driver') then
    raise exception 'Trip is not an eligible driver cancellation';
  end if;

  if v_trip.cancellation_fee_status <> 'policy_pending' then
    return jsonb_build_object('success', true, 'cancellation_fee_amount', v_trip.cancellation_fee_amount);
  end if;

  v_fee := round(coalesce(v_trip.accepted_rate, 0) * coalesce(v_trip.estimated_hours, 0) * 0.10, 2);

  if v_fee > 0 then
    insert into wallets (user_id, role) values (v_trip.driver_id, 'driver') on conflict (user_id) do nothing;
    perform 1 from wallets where user_id = v_trip.driver_id for update;
    -- balance may go negative here by design — recovered from future payouts,
    -- matching the original wallet-ops behavior.
    update wallets set balance = balance - v_fee where user_id = v_trip.driver_id;

    insert into wallet_transactions (user_id, role, type, amount, status, trip_id, counterparty_id)
    values (v_trip.driver_id, 'driver', 'cancellation_fee', v_fee, 'completed', p_trip_id, v_trip.broker_id);
  end if;

  perform set_config('relay.trusted_write', 'on', true);
  update trips set cancellation_fee_status = 'assessed', cancellation_fee_amount = v_fee where id = p_trip_id;

  return jsonb_build_object('success', true, 'cancellation_fee_amount', v_fee);
end;
$$;

create function public.wallet_process_payment(p_trip_id uuid, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trip trips;
  v_broker_wallet wallets;
  v_reserved numeric;
  v_additional numeric;
  v_refund numeric;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_trip from trips where id = p_trip_id;
  if v_trip is null then raise exception 'Trip not found'; end if;
  if not (v_trip.broker_id = v_uid or is_admin()) then
    raise exception 'Not authorized';
  end if;
  if v_trip.payment_status in ('sent', 'received') then
    raise exception 'Payment has already been sent for this trip';
  end if;
  if v_trip.delivery_review_status = 'disputed' then
    raise exception 'Cannot process payment while delivery is disputed';
  elsif v_trip.delivery_review_status not in ('approved', 'resolved') then
    raise exception 'Delivery must be approved before payment can be processed';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  v_reserved := case when v_trip.funding_status = 'confirmed' then coalesce(v_trip.funded_amount, 0) else 0 end;
  v_additional := greatest(0, p_amount - v_reserved);
  v_refund := greatest(0, v_reserved - p_amount);

  select * into v_broker_wallet from wallets where user_id = v_trip.broker_id for update;
  if v_additional > 0 and (v_broker_wallet is null or v_broker_wallet.balance < v_additional) then
    raise exception 'Broker has insufficient balance';
  end if;

  update wallets set balance = balance - v_additional + v_refund where user_id = v_trip.broker_id;

  insert into wallets (user_id, role) values (v_trip.driver_id, 'driver') on conflict (user_id) do nothing;
  perform 1 from wallets where user_id = v_trip.driver_id for update;
  update wallets set balance = balance + p_amount where user_id = v_trip.driver_id;

  insert into wallet_transactions (user_id, role, type, amount, status, trip_id, counterparty_id)
  values (v_trip.broker_id, 'broker', 'payment_sent', p_amount, 'completed', p_trip_id, v_trip.driver_id);
  insert into wallet_transactions (user_id, role, type, amount, status, trip_id, counterparty_id)
  values (v_trip.driver_id, 'driver', 'payment_received', p_amount, 'completed', p_trip_id, v_trip.broker_id);
  if v_refund > 0 then
    insert into wallet_transactions (user_id, role, type, amount, status, trip_id, counterparty_id)
    values (v_trip.broker_id, 'broker', 'funding_refund', v_refund, 'completed', p_trip_id, v_trip.driver_id);
  end if;

  perform set_config('relay.trusted_write', 'on', true);
  update trips
  set payment_status = 'sent',
      funding_status = case when v_reserved > 0 then 'released' else v_trip.funding_status end
  where id = p_trip_id;

  return jsonb_build_object(
    'success', true, 'total', p_amount, 'reserved', v_reserved,
    'additional', v_additional, 'refund', v_refund
  );
end;
$$;

create function public.wallet_approve_transaction(p_transaction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn wallet_transactions;
  v_wallet wallets;
  v_total numeric;
begin
  if not is_admin() then raise exception 'Admin only'; end if;
  select * into v_txn from wallet_transactions where id = p_transaction_id for update;
  if v_txn is null then raise exception 'Transaction not found'; end if;
  if v_txn.status <> 'pending' then raise exception 'Transaction is not pending'; end if;

  if v_txn.type = 'deposit' then
    update wallets
    set balance = balance + v_txn.amount,
        pending_deposits = greatest(0, pending_deposits - v_txn.amount)
    where user_id = v_txn.user_id;
  elsif v_txn.type = 'withdrawal' then
    v_total := v_txn.amount + v_txn.fee_amount;
    select * into v_wallet from wallets where user_id = v_txn.user_id for update;
    if v_wallet is null or v_wallet.balance < v_total then
      raise exception 'Driver has insufficient balance';
    end if;
    update wallets
    set balance = balance - v_total,
        pending_withdrawals = greatest(0, pending_withdrawals - v_total)
    where user_id = v_txn.user_id;
  else
    raise exception 'Only pending deposit/withdrawal transactions can be approved';
  end if;

  update wallet_transactions set status = 'completed' where id = p_transaction_id;
  return jsonb_build_object('success', true);
end;
$$;

create function public.wallet_reject_transaction(p_transaction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn wallet_transactions;
begin
  if not is_admin() then raise exception 'Admin only'; end if;
  select * into v_txn from wallet_transactions where id = p_transaction_id for update;
  if v_txn is null then raise exception 'Transaction not found'; end if;
  if v_txn.status <> 'pending' then raise exception 'Transaction is not pending'; end if;

  if v_txn.type = 'deposit' then
    update wallets set pending_deposits = greatest(0, pending_deposits - v_txn.amount) where user_id = v_txn.user_id;
  elsif v_txn.type = 'withdrawal' then
    update wallets
    set pending_withdrawals = greatest(0, pending_withdrawals - (v_txn.amount + v_txn.fee_amount))
    where user_id = v_txn.user_id;
  end if;

  update wallet_transactions set status = 'rejected' where id = p_transaction_id;
  return jsonb_build_object('success', true);
end;
$$;

-- ============================================================================
-- submit-review
-- ============================================================================

create function public.submit_review(p_trip_id uuid, p_rating numeric, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trip trips;
  v_is_driver boolean;
  v_is_broker boolean;
  v_reviewer_role text;
  v_reviewee_role text;
  v_reviewee_id uuid;
  v_avg_rating numeric;
  v_review_count integer;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_trip from trips where id = p_trip_id;
  if v_trip is null then raise exception 'Trip not found'; end if;

  v_is_driver := v_trip.driver_id = v_uid;
  v_is_broker := v_trip.broker_id = v_uid;
  if not (v_is_driver or v_is_broker) then
    raise exception 'Not authorized';
  end if;
  if v_trip.status <> 'completed' then
    raise exception 'Trip is not completed';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;
  if exists (select 1 from reviews where trip_id = p_trip_id and reviewer_id = v_uid) then
    raise exception 'You have already reviewed this trip';
  end if;

  if v_is_driver then
    v_reviewer_role := 'driver';
    v_reviewee_role := 'broker';
    v_reviewee_id := v_trip.broker_id;
  else
    v_reviewer_role := 'broker';
    v_reviewee_role := 'driver';
    v_reviewee_id := v_trip.driver_id;
  end if;

  insert into reviews (deal_id, trip_id, reviewer_id, reviewee_id, reviewer_role, reviewee_role, rating, comment)
  values (v_trip.deal_id, p_trip_id, v_uid, v_reviewee_id, v_reviewer_role, v_reviewee_role, p_rating, p_comment);

  select round(avg(rating)::numeric, 1), count(*)
  into v_avg_rating, v_review_count
  from reviews where reviewee_id = v_reviewee_id;

  if v_reviewee_role = 'driver' then
    update drivers set rating = v_avg_rating, review_count = v_review_count where created_by_id = v_reviewee_id;
  else
    update brokers set rating = v_avg_rating, review_count = v_review_count where created_by_id = v_reviewee_id;
  end if;

  return jsonb_build_object('success', true, 'rating', v_avg_rating, 'review_count', v_review_count);
end;
$$;

-- ============================================================================
-- trip-review (approve / dispute / resolve)
-- ============================================================================

create function public.trip_review_approve(p_trip_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trip trips;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_trip from trips where id = p_trip_id;
  if v_trip is null then raise exception 'Trip not found'; end if;
  if not (v_trip.broker_id = v_uid or is_admin()) then
    raise exception 'Not authorized';
  end if;
  if v_trip.status <> 'completed' then
    raise exception 'Trip is not completed';
  end if;
  if v_trip.delivery_review_status = 'resolved' then
    raise exception 'Delivery review is already resolved';
  end if;

  perform set_config('relay.trusted_write', 'on', true);
  update trips
  set delivery_review_status = 'approved', broker_reviewed_at = now(),
      dispute_reason = null, dispute_opened_at = null
  where id = p_trip_id;

  return jsonb_build_object('success', true);
end;
$$;

create function public.trip_review_dispute(p_trip_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trip trips;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_trip from trips where id = p_trip_id;
  if v_trip is null then raise exception 'Trip not found'; end if;
  if not (v_trip.broker_id = v_uid or is_admin()) then
    raise exception 'Not authorized';
  end if;
  if v_trip.status <> 'completed' then
    raise exception 'Trip is not completed';
  end if;
  if v_trip.payment_status in ('sent', 'received') then
    raise exception 'Payment has already been processed for this trip';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required';
  end if;

  perform set_config('relay.trusted_write', 'on', true);
  update trips
  set delivery_review_status = 'disputed', dispute_reason = p_reason,
      dispute_opened_at = now(), broker_reviewed_at = now()
  where id = p_trip_id;

  return jsonb_build_object('success', true);
end;
$$;

create function public.trip_review_resolve(p_trip_id uuid, p_resolution text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip trips;
begin
  if not is_admin() then raise exception 'Admin only'; end if;
  select * into v_trip from trips where id = p_trip_id;
  if v_trip is null then raise exception 'Trip not found'; end if;
  if v_trip.delivery_review_status <> 'disputed' then
    raise exception 'Trip is not disputed';
  end if;
  if p_resolution is null or btrim(p_resolution) = '' then
    raise exception 'A resolution is required';
  end if;

  perform set_config('relay.trusted_write', 'on', true);
  update trips
  set delivery_review_status = 'resolved', dispute_resolution = p_resolution,
      dispute_resolved_at = now(), broker_reviewed_at = now()
  where id = p_trip_id;

  return jsonb_build_object('success', true);
end;
$$;

-- ============================================================================
-- delete-account: the data half. Called by the delete-account Edge Function,
-- which authenticates the user, calls this, removes the returned storage
-- paths, then calls auth.admin.deleteUser (which cascades the profiles row).
--
-- Correctness fixes over the original Base44 function (which had no real FK
-- enforcement so these gaps were silent, not fatal):
--   - also purges favorite_drivers/saved_routes, which Base44's delete-account
--     never touched at all (a pre-existing gap, not carried forward here).
--   - also purges any OTHER driver's bids on a deleted broker's deals, not
--     just the deleting user's own bids — otherwise a real FK would block
--     the deal delete outright instead of silently orphaning rows.
-- ============================================================================

create function public.delete_account_data()
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_paths text[];
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  perform set_config('relay.trusted_write', 'on', true);

  select coalesce(array_agg(p), '{}') into v_paths from (
    select unnest(array[w9_document, broker_license_document, government_id_document]) as p
    from brokers where created_by_id = v_uid
    union all
    select unnest(array[license_front, license_back, license_document, driving_history_report])
    from drivers where created_by_id = v_uid
    union all
    select unnest(array[pickup_photo, delivery_photo])
    from trips where driver_id = v_uid or broker_id = v_uid
    union all
    select receipt_document from trip_expenses where driver_id = v_uid or broker_id = v_uid
    union all
    select photo from trip_incidents where driver_id = v_uid or broker_id = v_uid
  ) s
  where p is not null;

  delete from wallet_transactions where user_id = v_uid;
  delete from trip_locations where driver_id = v_uid or broker_id = v_uid;
  delete from trip_incidents where driver_id = v_uid or broker_id = v_uid;
  delete from messages where driver_id = v_uid or broker_id = v_uid;
  delete from reviews where reviewer_id = v_uid or reviewee_id = v_uid;
  delete from trip_expenses where driver_id = v_uid or broker_id = v_uid;
  delete from trips where driver_id = v_uid or broker_id = v_uid;
  delete from bids where driver_id = v_uid or deal_id in (select id from deals where broker_id = v_uid);
  delete from deals where broker_id = v_uid;
  delete from favorite_drivers where broker_id = v_uid or driver_id = v_uid;
  delete from saved_routes where broker_id = v_uid;
  delete from wallets where user_id = v_uid;
  delete from drivers where created_by_id = v_uid;
  delete from brokers where created_by_id = v_uid;

  return v_paths;
end;
$$;

-- Only authenticated users may call these — anonymous access makes no sense
-- for any of them (auth.uid() would just be null and every function already
-- rejects that explicitly, but revoking at the grant level is the belt to
-- that suspenders). PostgreSQL requires the full argument-type signature to
-- resolve each function unambiguously in REVOKE.
revoke execute on function public.wallet_deposit_request(numeric, text) from anon;
revoke execute on function public.wallet_withdraw_request(numeric, text, text, text, text) from anon;
revoke execute on function public.wallet_reserve_funding(uuid, numeric) from anon;
revoke execute on function public.wallet_refund_funding(uuid) from anon;
revoke execute on function public.wallet_charge_cancellation_fee(uuid) from anon;
revoke execute on function public.wallet_process_payment(uuid, numeric) from anon;
revoke execute on function public.wallet_approve_transaction(uuid) from anon;
revoke execute on function public.wallet_reject_transaction(uuid) from anon;
revoke execute on function public.submit_review(uuid, numeric, text) from anon;
revoke execute on function public.trip_review_approve(uuid) from anon;
revoke execute on function public.trip_review_dispute(uuid, text) from anon;
revoke execute on function public.trip_review_resolve(uuid, text) from anon;
revoke execute on function public.delete_account_data() from anon;
