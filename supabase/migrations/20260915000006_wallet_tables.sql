create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  role text not null check (role in ('driver', 'broker')),
  balance numeric not null default 0,
  pending_deposits numeric not null default 0,
  pending_withdrawals numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  role text not null check (role in ('driver', 'broker')),
  type text not null check (
    type in (
      'deposit', 'withdrawal', 'payment_sent', 'payment_received',
      'funding_reserved', 'funding_refund', 'cancellation_fee'
    )
  ),
  amount numeric not null,
  speed text not null default 'standard' check (speed in ('standard', 'instant')),
  fee_amount numeric not null default 0,
  status text not null default 'pending' check (status in ('pending', 'completed', 'rejected')),
  -- on delete set null on both: a transaction is a financial audit record that
  -- should outlive the trip or counterparty it referenced (deleting either
  -- shouldn't delete or block-delete this row's own account-holder side).
  trip_id uuid references public.trips (id) on delete set null,
  counterparty_id uuid references public.profiles (id) on delete set null,
  bank_name text,
  bank_account_last4 text,
  bank_routing text,
  notes text,
  created_at timestamptz not null default now()
);

create trigger set_wallets_updated_at before update on public.wallets
  for each row execute function public.set_updated_at();

create index wallets_user_id_idx on public.wallets (user_id);
create index wallet_transactions_user_id_idx on public.wallet_transactions (user_id);
create index wallet_transactions_status_idx on public.wallet_transactions (status);
