import { supabase } from '@/api/supabaseClient';

async function call(fn, params) {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw new Error(error.message || 'Trip review failed');
  return data;
}

export const approveTripDelivery = (trip) =>
  call('trip_review_approve', { p_trip_id: trip.id });

export const disputeTripDelivery = (trip, reason) =>
  call('trip_review_dispute', { p_trip_id: trip.id, p_reason: reason });

export const resolveTripDispute = (trip, resolution) =>
  call('trip_review_resolve', { p_trip_id: trip.id, p_resolution: resolution });
