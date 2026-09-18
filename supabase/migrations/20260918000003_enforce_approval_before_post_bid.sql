-- deals_insert/bids_insert only checked "is this your own broker_id/driver_id",
-- never that the caller actually has an approved brokers/drivers row. The only
-- thing stopping an unapproved (or undocumented) signup from posting a job or
-- bidding was client-side gating in DriveBid.jsx (broker?.status==='approved',
-- driver?.status!=='approved') — trivially bypassable via a direct REST/RPC
-- call with a valid session token. Move the same rule into RLS so it's
-- actually enforced.
drop policy if exists deals_insert on public.deals;
create policy deals_insert on public.deals
  for insert with check (
    public.is_admin()
    or (
      broker_id = auth.uid()
      and exists (
        select 1 from public.brokers
        where brokers.created_by_id = auth.uid() and brokers.status = 'approved'
      )
    )
  );

drop policy if exists bids_insert on public.bids;
create policy bids_insert on public.bids
  for insert with check (
    public.is_admin()
    or (
      driver_id = auth.uid()
      and exists (
        select 1 from public.drivers
        where drivers.created_by_id = auth.uid() and drivers.status = 'approved'
      )
    )
  );
