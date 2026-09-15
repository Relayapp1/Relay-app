import { supabase } from '@/api/supabaseClient';

export async function submitTripReview(trip, rating, comment) {
  const { data, error } = await supabase.rpc('submit_review', {
    p_trip_id: trip.id,
    p_rating: rating,
    p_comment: comment,
  });
  if (error) throw new Error(error.message || 'Could not submit review');
  return data;
}
