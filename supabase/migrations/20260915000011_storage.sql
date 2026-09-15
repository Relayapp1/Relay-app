-- 4 private buckets, one per document/photo category, so each bucket's RLS
-- policy join stays simple. No public bucket at all.

insert into storage.buckets (id, name, public) values
  ('driver-documents', 'driver-documents', false),
  ('broker-documents', 'broker-documents', false),
  ('trip-photos', 'trip-photos', false),
  ('expense-receipts', 'expense-receipts', false)
on conflict (id) do nothing;

-- Path convention: {owner_user_id}/{row_id}/{filename}
create policy "driver_documents_owner_or_admin" on storage.objects for all
  using (bucket_id = 'driver-documents' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()))
  with check (bucket_id = 'driver-documents' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));

create policy "broker_documents_owner_or_admin" on storage.objects for all
  using (bucket_id = 'broker-documents' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()))
  with check (bucket_id = 'broker-documents' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));

-- Path convention: {trip_id}/{filename} — both trip parties can read/write.
create policy "trip_photos_party_or_admin" on storage.objects for all
  using (
    bucket_id = 'trip-photos' and (
      is_admin() or exists (
        select 1 from public.trips
        where trips.id::text = (storage.foldername(name))[1]
          and (trips.broker_id = auth.uid() or trips.driver_id = auth.uid())
      )
    )
  )
  with check (
    bucket_id = 'trip-photos' and (
      is_admin() or exists (
        select 1 from public.trips
        where trips.id::text = (storage.foldername(name))[1]
          and (trips.broker_id = auth.uid() or trips.driver_id = auth.uid())
      )
    )
  );

create policy "expense_receipts_party_or_admin" on storage.objects for all
  using (
    bucket_id = 'expense-receipts' and (
      is_admin() or exists (
        select 1 from public.trips
        where trips.id::text = (storage.foldername(name))[1]
          and (trips.broker_id = auth.uid() or trips.driver_id = auth.uid())
      )
    )
  )
  with check (
    bucket_id = 'expense-receipts' and (
      is_admin() or exists (
        select 1 from public.trips
        where trips.id::text = (storage.foldername(name))[1]
          and (trips.broker_id = auth.uid() or trips.driver_id = auth.uid())
      )
    )
  );
